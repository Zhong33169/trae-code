use actix_web::{web, HttpResponse, Responder, HttpRequest, get};
use chrono::{Duration, Utc, NaiveDateTime};
use sqlx::SqlitePool;

use crate::middleware::auth::get_current_user;
use crate::models::{ApiResponse, SummaryStatistics, TrendData, NodeType, SamplingTask};

fn build_query_with_params<'a>(
    sql: &'a str,
    params: &'a [String],
) -> sqlx::query::QueryScalar<'a, sqlx::Sqlite, i64, sqlx::sqlite::SqliteArguments<'a>> {
    let mut query = sqlx::query_scalar(sql);
    for p in params {
        query = query.bind(p);
    }
    query
}

fn build_query_as_with_params<'a, O>(
    sql: &'a str,
    params: &'a [String],
) -> sqlx::query::QueryAs<'a, sqlx::Sqlite, O, sqlx::sqlite::SqliteArguments<'a>>
where
    O: for<'r> sqlx::FromRow<'r, sqlx::sqlite::SqliteRow> + Send + Unpin,
{
    let mut query = sqlx::query_as::<_, O>(sql);
    for p in params {
        query = query.bind(p);
    }
    query
}

#[get("/summary")]
async fn get_summary(
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
) -> impl Responder {
    let claims = match get_current_user(&req) {
        Some(c) => c,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error(401, "未授权")),
    };

    let today = Utc::now().format("%Y-%m-%d").to_string();

    let mut conditions = Vec::new();
    let mut params: Vec<String> = Vec::new();

    if claims.role == "registrar" {
        conditions.push("registrar_id = ?");
        params.push(claims.user_id.clone());
    } else if claims.role == "auditor" {
        conditions.push("(auditor_id = ? OR auditor_id IS NULL)");
        params.push(claims.user_id.clone());
    } else if claims.role == "reviewer" {
        conditions.push("(reviewer_id = ? OR reviewer_id IS NULL)");
        params.push(claims.user_id.clone());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    fn build_where_with_condition(where_clause: &str, condition: &str) -> String {
        if where_clause.is_empty() {
            format!("WHERE {}", condition)
        } else {
            format!("{} AND {}", where_clause, condition)
        }
    }

    let total_sql = format!("SELECT COUNT(*) FROM sampling_tasks {}", where_clause);
    let total_tasks: i64 = match build_query_with_params(&total_sql, &params)
        .fetch_one(pool.get_ref())
        .await
    {
        Ok(c) => c,
        Err(e) => {
            log::error!("Count total error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "统计失败")
            );
        }
    };

    let pending_where = build_where_with_condition(&where_clause, "status = 'pending'");
    let pending_sql = format!("SELECT COUNT(*) FROM sampling_tasks {}", pending_where);
    let pending_tasks: i64 = match build_query_with_params(&pending_sql, &params)
        .fetch_one(pool.get_ref())
        .await
    {
        Ok(c) => c,
        Err(e) => {
            log::error!("Count pending error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "统计失败")
            );
        }
    };

    let processing_where = build_where_with_condition(&where_clause, "status = 'processing'");
    let processing_sql = format!("SELECT COUNT(*) FROM sampling_tasks {}", processing_where);
    let processing_tasks: i64 = match build_query_with_params(&processing_sql, &params)
        .fetch_one(pool.get_ref())
        .await
    {
        Ok(c) => c,
        Err(e) => {
            log::error!("Count processing error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "统计失败")
            );
        }
    };

    let completed_where = build_where_with_condition(&where_clause, "status IN ('completed', 'archived')");
    let completed_sql = format!("SELECT COUNT(*) FROM sampling_tasks {}", completed_where);
    let completed_tasks: i64 = match build_query_with_params(&completed_sql, &params)
        .fetch_one(pool.get_ref())
        .await
    {
        Ok(c) => c,
        Err(e) => {
            log::error!("Count completed error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "统计失败")
            );
        }
    };

    let today_new_where = build_where_with_condition(&where_clause, "DATE(created_at) = ?");
    let today_new_sql = format!("SELECT COUNT(*) FROM sampling_tasks {}", today_new_where);
    let mut today_new_params = params.clone();
    today_new_params.push(today.clone());
    let today_new_tasks: i64 = match build_query_with_params(&today_new_sql, &today_new_params)
        .fetch_one(pool.get_ref())
        .await
    {
        Ok(c) => c,
        Err(e) => {
            log::error!("Count today new error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "统计失败")
            );
        }
    };

    let today_completed_where = build_where_with_condition(&where_clause, "DATE(archived_at) = ? AND status = 'archived'");
    let today_completed_sql = format!("SELECT COUNT(*) FROM sampling_tasks {}", today_completed_where);
    let mut today_completed_params = params.clone();
    today_completed_params.push(today.clone());
    let today_completed_tasks: i64 = match build_query_with_params(&today_completed_sql, &today_completed_params)
        .fetch_one(pool.get_ref())
        .await
    {
        Ok(c) => c,
        Err(e) => {
            log::error!("Count today completed error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "统计失败")
            );
        }
    };

    let all_sql = format!("SELECT * FROM sampling_tasks {}", where_clause);
    let all_tasks: Vec<SamplingTask> = match build_query_as_with_params::<SamplingTask>(&all_sql, &params)
        .fetch_all(pool.get_ref())
        .await
    {
        Ok(t) => t,
        Err(e) => {
            log::error!("Get all tasks error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "统计失败")
            );
        }
    };

    let mut timeout_count = 0;
    let mut total_processing_hours: f64 = 0.0;
    let mut completed_count = 0;

    for task in &all_tasks {
        if task.is_timeout() {
            timeout_count += 1;
        }

        if let (Some(start), Some(end)) = (
            task.order_sampling_started_at.as_ref(),
            task.archived_at.as_ref(),
        ) {
            if let (Ok(s), Ok(e)) = (
                NaiveDateTime::parse_from_str(start, "%Y-%m-%d %H:%M:%S"),
                NaiveDateTime::parse_from_str(end, "%Y-%m-%d %H:%M:%S"),
            ) {
                let duration = e - s;
                total_processing_hours += duration.num_hours() as f64;
                completed_count += 1;
            }
        }
    }

    let avg_processing_hours = if completed_count > 0 {
        total_processing_hours / completed_count as f64
    } else {
        0.0
    };

    HttpResponse::Ok().json(ApiResponse::success(SummaryStatistics {
        total_tasks,
        pending_tasks,
        processing_tasks,
        completed_tasks,
        timeout_tasks: timeout_count,
        today_new_tasks,
        today_completed_tasks,
        avg_processing_hours,
    }))
}

#[get("/trend")]
async fn get_trend(
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
) -> impl Responder {
    let claims = match get_current_user(&req) {
        Some(c) => c,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error(401, "未授权")),
    };

    let mut conditions = Vec::new();
    let mut params: Vec<String> = Vec::new();

    if claims.role == "registrar" {
        conditions.push("registrar_id = ?");
        params.push(claims.user_id.clone());
    } else if claims.role == "auditor" {
        conditions.push("(auditor_id = ? OR auditor_id IS NULL)");
        params.push(claims.user_id.clone());
    } else if claims.role == "reviewer" {
        conditions.push("(reviewer_id = ? OR reviewer_id IS NULL)");
        params.push(claims.user_id.clone());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    fn build_where_with_condition2(where_clause: &str, condition: &str) -> String {
        if where_clause.is_empty() {
            format!("WHERE {}", condition)
        } else {
            format!("{} AND {}", where_clause, condition)
        }
    }

    let mut trend_data = Vec::new();
    let days = 7;

    for i in 0..days {
        let date = (Utc::now() - Duration::days(days - 1 - i)).format("%Y-%m-%d").to_string();

        let new_where = build_where_with_condition2(&where_clause, "DATE(created_at) = ?");
        let new_sql = format!("SELECT COUNT(*) FROM sampling_tasks {}", new_where);
        let mut new_params = params.clone();
        new_params.push(date.clone());
        let new_tasks: i64 = match build_query_with_params(&new_sql, &new_params)
            .fetch_one(pool.get_ref())
            .await
        {
            Ok(c) => c,
            Err(e) => {
                log::error!("Count trend new error: {}", e);
                return HttpResponse::InternalServerError().json(
                    ApiResponse::<()>::error(500, "统计失败")
                );
            }
        };

        let completed_where = build_where_with_condition2(&where_clause, "DATE(archived_at) = ? AND status = 'archived'");
        let completed_sql = format!("SELECT COUNT(*) FROM sampling_tasks {}", completed_where);
        let mut completed_params = params.clone();
        completed_params.push(date.clone());
        let completed_tasks: i64 = match build_query_with_params(&completed_sql, &completed_params)
            .fetch_one(pool.get_ref())
            .await
        {
            Ok(c) => c,
            Err(e) => {
                log::error!("Count trend completed error: {}", e);
                return HttpResponse::InternalServerError().json(
                    ApiResponse::<()>::error(500, "统计失败")
                );
            }
        };

        let day_where = build_where_with_condition2(&where_clause, "DATE(created_at) <= ?");
        let day_sql = format!("SELECT * FROM sampling_tasks {}", day_where);
        let mut day_params = params.clone();
        day_params.push(date.clone());
        let day_tasks: Vec<SamplingTask> = match build_query_as_with_params::<SamplingTask>(&day_sql, &day_params)
            .fetch_all(pool.get_ref())
            .await
        {
            Ok(t) => t,
            Err(e) => {
                log::error!("Get day tasks error: {}", e);
                return HttpResponse::InternalServerError().json(
                    ApiResponse::<()>::error(500, "统计失败")
                );
            }
        };

        let mut timeout_count = 0;
        for task in &day_tasks {
            if task.current_node != NodeType::Archived.to_string() && task.is_timeout() {
                timeout_count += 1;
            }
        }

        trend_data.push(TrendData {
            date: date.clone(),
            new_tasks,
            completed_tasks,
            timeout_tasks: timeout_count,
        });
    }

    HttpResponse::Ok().json(ApiResponse::success(trend_data))
}

pub fn init_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/statistics")
            .service(get_summary)
            .service(get_trend)
    );
}
