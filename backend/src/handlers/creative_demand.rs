use axum::{
    extract::{State, Path, Query, Extension},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;
use chrono::Utc;

use crate::{AppState, models::{
    CreativeDemand, CreateCreativeDemandRequest, UpdateCreativeDemandRequest,
    TransitionRequest, BatchTransitionRequest, ScanRequest,
    StatisticsResponse, DemandStatus,
}};
use crate::middleware::auth::AuthUser;
use crate::services::{scan, transition, audit};

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub status: Option<String>,
    pub role: Option<String>,
    pub mine: Option<bool>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
    Extension(auth_user): Extension<Arc<AuthUser>>,
) -> Response {
    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;

    let mut sql = "SELECT * FROM creative_demands WHERE 1=1".to_string();
    let mut params: Vec<String> = Vec::new();

    if let Some(status) = &query.status {
        sql.push_str(" AND status = ?");
        params.push(status.clone());
    }

    if query.mine.unwrap_or(false) {
        sql.push_str(" AND current_handler_role = ?");
        params.push(auth_user.role.clone());
    }

    sql.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

    let mut q = sqlx::query_as::<_, CreativeDemand>(&sql);
    for p in &params {
        q = q.bind(p);
    }
    q = q.bind(page_size).bind(offset);

    let demands = match q.fetch_all(&state.pool).await {
        Ok(d) => d,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": format!("查询失败: {}", e),
                    "code": "QUERY_FAILED"
                }))
            ).into_response();
        }
    };

    let count_sql = "SELECT COUNT(*) FROM creative_demands WHERE 1=1".to_string();
    let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql);
    for p in &params {
        count_q = count_q.bind(p);
    }
    let total = count_q.fetch_one(&state.pool).await.unwrap_or(0);

    Json(serde_json::json!({
        "items": demands,
        "total": total,
        "page": page,
        "page_size": page_size,
    })).into_response()
}

pub async fn create(
    State(state): State<AppState>,
    Extension(auth_user): Extension<Arc<AuthUser>>,
    Json(req): Json<CreateCreativeDemandRequest>,
) -> Response {
    if auth_user.role != "registrar" {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": "只有创意需求登记员可以创建创意需求单",
                "code": "PERMISSION_DENIED"
            }))
        ).into_response();
    }

    let id = Uuid::new_v4().to_string();
    let code = format!("CD{}{:04}", 
        Utc::now().format("%Y%m"),
        (rand::random::<u16>() % 10000)
    );

    let brief_materials = req.brief_materials.map(|m| serde_json::to_string(&m).unwrap_or_default());
    let attachments = req.attachments.map(|a| serde_json::to_string(&a).unwrap_or_default());

    let result = sqlx::query(
        r#"
        INSERT INTO creative_demands 
        (id, code, title, client_name, status, current_handler_role, 
         created_by, brief_materials, brief_deadline, brief_opinion, 
         remarks, attachments)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&id)
    .bind(&code)
    .bind(&req.title)
    .bind(&req.client_name)
    .bind(DemandStatus::PendingRegistrar.as_str())
    .bind("registrar")
    .bind(&auth_user.id)
    .bind(brief_materials)
    .bind(req.brief_deadline)
    .bind(req.brief_opinion)
    .bind(req.remarks)
    .bind(attachments)
    .execute(&state.pool)
    .await;

    if let Err(e) = result {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": format!("创建失败: {}", e),
                "code": "CREATE_FAILED"
            }))
        ).into_response();
    }

    let _ = audit::log_action(
        &state.pool,
        Some(&id),
        &auth_user.id,
        &auth_user.name,
        &auth_user.role,
        "create",
        None,
        Some(DemandStatus::PendingRegistrar.as_str()),
        Some(&format!("创建创意需求单: {}", req.title)),
        None,
    ).await;

    let demand: CreativeDemand = sqlx::query_as::<_, CreativeDemand>(
        "SELECT * FROM creative_demands WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await
    .unwrap();

    (StatusCode::CREATED, Json(demand)).into_response()
}

pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Extension(_auth_user): Extension<Arc<AuthUser>>,
) -> Response {
    let demand: Option<CreativeDemand> = sqlx::query_as::<_, CreativeDemand>(
        "SELECT * FROM creative_demands WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    match demand {
        Some(d) => Json(d).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "创意需求单不存在",
                "code": "NOT_FOUND"
            }))
        ).into_response(),
    }
}

pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Extension(auth_user): Extension<Arc<AuthUser>>,
    Json(req): Json<UpdateCreativeDemandRequest>,
) -> Response {
    let demand: Option<CreativeDemand> = sqlx::query_as::<_, CreativeDemand>(
        "SELECT * FROM creative_demands WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let demand = match demand {
        Some(d) => d,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": "创意需求单不存在",
                    "code": "NOT_FOUND"
                }))
            ).into_response();
        }
    };

    if !demand.can_be_handled_by(&auth_user.role) {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": "您不是当前处理人，无权修改此创意需求单",
                "code": "PERMISSION_DENIED"
            }))
        ).into_response();
    }

    let new_version = demand.version + 1;

    let brief_materials = req.brief_materials.map(|m| serde_json::to_string(&m).unwrap_or_default())
        .or(demand.brief_materials);
    let schedule_materials = req.schedule_materials.map(|m| serde_json::to_string(&m).unwrap_or_default())
        .or(demand.schedule_materials);
    let confirmation_materials = req.confirmation_materials.map(|m| serde_json::to_string(&m).unwrap_or_default())
        .or(demand.confirmation_materials);
    let attachments = req.attachments.map(|a| serde_json::to_string(&a).unwrap_or_default())
        .or(demand.attachments);

    let result = sqlx::query(
        r#"
        UPDATE creative_demands SET
            title = COALESCE(?, title),
            client_name = COALESCE(?, client_name),
            brief_materials = COALESCE(?, brief_materials),
            brief_deadline = COALESCE(?, brief_deadline),
            brief_opinion = COALESCE(?, brief_opinion),
            schedule_materials = COALESCE(?, schedule_materials),
            schedule_deadline = COALESCE(?, schedule_deadline),
            schedule_opinion = COALESCE(?, schedule_opinion),
            confirmation_materials = COALESCE(?, confirmation_materials),
            confirmation_deadline = COALESCE(?, confirmation_deadline),
            confirmation_opinion = COALESCE(?, confirmation_opinion),
            attachments = COALESCE(?, attachments),
            remarks = COALESCE(?, remarks),
            processing_result = COALESCE(?, processing_result),
            return_reason = COALESCE(?, return_reason),
            updated_at = CURRENT_TIMESTAMP,
            version = ?
        WHERE id = ? AND version = ?
        "#
    )
    .bind(req.title)
    .bind(req.client_name)
    .bind(brief_materials)
    .bind(req.brief_deadline)
    .bind(req.brief_opinion)
    .bind(schedule_materials)
    .bind(req.schedule_deadline)
    .bind(req.schedule_opinion)
    .bind(confirmation_materials)
    .bind(req.confirmation_deadline)
    .bind(req.confirmation_opinion)
    .bind(attachments)
    .bind(req.remarks)
    .bind(req.processing_result)
    .bind(req.return_reason)
    .bind(new_version)
    .bind(&id)
    .bind(demand.version)
    .execute(&state.pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() == 0 => {
            return (
                StatusCode::CONFLICT,
                Json(serde_json::json!({
                    "error": "并发冲突：该创意需求单已被其他用户修改，请刷新后重试",
                    "code": "CONCURRENCY_CONFLICT"
                }))
            ).into_response();
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": format!("更新失败: {}", e),
                    "code": "UPDATE_FAILED"
                }))
            ).into_response();
        }
        _ => {}
    }

    let _ = audit::log_action(
        &state.pool,
        Some(&id),
        &auth_user.id,
        &auth_user.name,
        &auth_user.role,
        "update",
        Some(&demand.status),
        Some(&demand.status),
        Some("更新创意需求单信息"),
        None,
    ).await;

    let updated: CreativeDemand = sqlx::query_as::<_, CreativeDemand>(
        "SELECT * FROM creative_demands WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await
    .unwrap();

    Json(updated).into_response()
}

pub async fn scan(
    State(state): State<AppState>,
    Extension(auth_user): Extension<Arc<AuthUser>>,
    Json(req): Json<ScanRequest>,
) -> Response {
    let result = scan::scan_code(
        &state.pool,
        &req.code,
        &auth_user.id,
        &auth_user.role,
    ).await;

    match result {
        Ok(response) => Json(response).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": format!("扫码失败: {}", e),
                "code": "SCAN_FAILED"
            }))
        ).into_response(),
    }
}

pub async fn transition(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Extension(auth_user): Extension<Arc<AuthUser>>,
    Json(req): Json<TransitionRequest>,
) -> Response {
    let result = transition::validate_and_transition(
        &state.pool,
        &id,
        &req,
        &auth_user.id,
        &auth_user.role,
        &auth_user.name,
    ).await;

    match result {
        Ok(r) if r.success => {
            Json(serde_json::json!({
                "success": true,
                "message": r.message,
                "data": r.demand
            })).into_response()
        }
        Ok(r) => {
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": r.message,
                    "code": "TRANSITION_FAILED",
                    "data": r.demand
                }))
            ).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": format!("状态流转失败: {}", e),
                "code": "TRANSITION_ERROR"
            }))
        ).into_response(),
    }
}

pub async fn batch_transition(
    State(state): State<AppState>,
    Extension(auth_user): Extension<Arc<AuthUser>>,
    Json(req): Json<BatchTransitionRequest>,
) -> Response {
    let mut results = Vec::new();
    let mut success_count = 0;
    let mut fail_count = 0;

    for id in &req.ids {
        let transition_req = TransitionRequest {
            target_status: req.target_status.clone(),
            comments: req.comments.clone(),
        };

        let result = transition::validate_and_transition(
            &state.pool,
            id,
            &transition_req,
            &auth_user.id,
            &auth_user.role,
            &auth_user.name,
        ).await;

        match result {
            Ok(r) if r.success => {
                success_count += 1;
                results.push(serde_json::json!({
                    "id": id,
                    "success": true,
                    "message": r.message
                }));
            }
            Ok(r) => {
                fail_count += 1;
                results.push(serde_json::json!({
                    "id": id,
                    "success": false,
                    "error": r.message
                }));
            }
            Err(e) => {
                fail_count += 1;
                results.push(serde_json::json!({
                    "id": id,
                    "success": false,
                    "error": format!("系统错误: {}", e)
                }));
            }
        }
    }

    Json(serde_json::json!({
        "success": success_count == req.ids.len(),
        "success_count": success_count,
        "fail_count": fail_count,
        "total": req.ids.len(),
        "results": results
    })).into_response()
}

pub async fn statistics(
    State(state): State<AppState>,
    Extension(auth_user): Extension<Arc<AuthUser>>,
) -> Response {
    let counts: Vec<(String, i64)> = sqlx::query_as::<_, (String, i64)>(
        "SELECT status, COUNT(*) FROM creative_demands GROUP BY status"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let stats_map: HashMap<String, i64> = counts.into_iter().collect();

    let my_tasks: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM creative_demands WHERE current_handler_role = ?"
    )
    .bind(&auth_user.role)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM creative_demands")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let response = StatisticsResponse {
        total,
        pending_registrar: *stats_map.get("pending_registrar").unwrap_or(&0),
        pending_supervisor: *stats_map.get("pending_supervisor").unwrap_or(&0),
        pending_reviewer: *stats_map.get("pending_reviewer").unwrap_or(&0),
        completed: *stats_map.get("completed").unwrap_or(&0),
        rejected: *stats_map.get("rejected").unwrap_or(&0),
        my_tasks,
    };

    Json(response).into_response()
}
