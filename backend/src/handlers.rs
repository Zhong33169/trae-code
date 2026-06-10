use actix_web::{web, HttpResponse, Responder};
use crate::models::*;
use crate::db::AppState;
use crate::services;
use std::sync::Arc;

fn success_response<T: serde::Serialize>(data: T) -> HttpResponse {
    HttpResponse::Ok().json(ApiResponse {
        success: true,
        message: "操作成功".to_string(),
        data: Some(data),
    })
}

fn error_response(message: &str) -> HttpResponse {
    HttpResponse::BadRequest().json(ApiResponse::<()> {
        success: false,
        message: message.to_string(),
        data: None,
    })
}

pub async fn list_users(state: web::Data<Arc<AppState>>) -> impl Responder {
    match services::list_users(&state.pool).await {
        Ok(users) => success_response(users),
        Err(e) => error_response(&e),
    }
}

pub async fn get_stats(state: web::Data<Arc<AppState>>) -> impl Responder {
    match services::get_stats(&state.pool).await {
        Ok(stats) => success_response(stats),
        Err(e) => error_response(&e),
    }
}

pub async fn list_records(
    state: web::Data<Arc<AppState>>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    let status = query.get("status").cloned();
    let exception_type = query.get("exception_type").cloned();
    let handler_role = query.get("handler_role").cloned();
    let handler_id = query.get("handler_id").and_then(|v| v.parse::<i64>().ok());

    match services::list_records(&state.pool, status, exception_type, handler_role, handler_id).await {
        Ok(records) => success_response(records),
        Err(e) => error_response(&e),
    }
}

pub async fn list_handled_records(
    state: web::Data<Arc<AppState>>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    let handler_id = match query.get("handler_id").and_then(|v| v.parse::<i64>().ok()) {
        Some(id) => id,
        None => return error_response("缺少 handler_id 参数"),
    };
    let status = query.get("status").cloned();
    let action = query.get("action").cloned();

    match services::list_handled_records(&state.pool, handler_id, status, action).await {
        Ok(records) => success_response(records),
        Err(e) => error_response(&e),
    }
}

pub async fn get_workbench_stats(
    state: web::Data<Arc<AppState>>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    let handler_id = match query.get("handler_id").and_then(|v| v.parse::<i64>().ok()) {
        Some(id) => id,
        None => return error_response("缺少 handler_id 参数"),
    };
    let handler_role = query.get("handler_role").cloned().unwrap_or_else(|| "registrar".to_string());

    match services::get_workbench_stats(&state.pool, handler_id, &handler_role).await {
        Ok(stats) => success_response(stats),
        Err(e) => error_response(&e),
    }
}

pub async fn get_record(
    state: web::Data<Arc<AppState>>,
    id: web::Path<i64>,
) -> impl Responder {
    match services::get_record(&state.pool, id.into_inner()).await {
        Ok(Some(record)) => success_response(record),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<()> {
            success: false,
            message: "记录不存在".to_string(),
            data: None,
        }),
        Err(e) => error_response(&e),
    }
}

pub async fn create_record(
    state: web::Data<Arc<AppState>>,
    req: web::Json<CreateRecordRequest>,
) -> impl Responder {
    match services::create_record(&state.pool, req.into_inner()).await {
        Ok(record) => HttpResponse::Created().json(ApiResponse {
            success: true,
            message: "创建成功".to_string(),
            data: Some(record),
        }),
        Err(e) => error_response(&e),
    }
}

pub async fn update_record(
    state: web::Data<Arc<AppState>>,
    id: web::Path<i64>,
    req: web::Json<UpdateRecordRequest>,
) -> impl Responder {
    match services::update_record(&state.pool, id.into_inner(), req.into_inner()).await {
        Ok(record) => success_response(record),
        Err(e) => error_response(&e),
    }
}

pub async fn submit_record(
    state: web::Data<Arc<AppState>>,
    id: web::Path<i64>,
    req: web::Json<SubmitRequest>,
) -> impl Responder {
    match services::submit_record(&state.pool, id.into_inner(), req.into_inner()).await {
        Ok(record) => success_response(record),
        Err(e) => error_response(&e),
    }
}

pub async fn audit_record(
    state: web::Data<Arc<AppState>>,
    id: web::Path<i64>,
    req: web::Json<AuditRequest>,
) -> impl Responder {
    match services::audit_record(&state.pool, id.into_inner(), req.into_inner()).await {
        Ok(record) => success_response(record),
        Err(e) => error_response(&e),
    }
}

pub async fn review_record(
    state: web::Data<Arc<AppState>>,
    id: web::Path<i64>,
    req: web::Json<ReviewRequest>,
) -> impl Responder {
    match services::review_record(&state.pool, id.into_inner(), req.into_inner()).await {
        Ok(record) => success_response(record),
        Err(e) => error_response(&e),
    }
}

pub async fn correct_record(
    state: web::Data<Arc<AppState>>,
    id: web::Path<i64>,
    req: web::Json<CorrectRequest>,
) -> impl Responder {
    match services::correct_record(&state.pool, id.into_inner(), req.into_inner()).await {
        Ok(record) => success_response(record),
        Err(e) => error_response(&e),
    }
}

pub async fn list_process_records(
    state: web::Data<Arc<AppState>>,
    id: web::Path<i64>,
) -> impl Responder {
    match services::list_process_records(&state.pool, id.into_inner()).await {
        Ok(records) => success_response(records),
        Err(e) => error_response(&e),
    }
}

pub async fn list_evidence(
    state: web::Data<Arc<AppState>>,
    id: web::Path<i64>,
) -> impl Responder {
    match services::list_evidence(&state.pool, id.into_inner()).await {
        Ok(items) => success_response(items),
        Err(e) => error_response(&e),
    }
}

pub async fn add_evidence(
    state: web::Data<Arc<AppState>>,
    id: web::Path<i64>,
    req: web::Json<AddEvidenceRequest>,
) -> impl Responder {
    match services::add_evidence(&state.pool, id.into_inner(), req.into_inner()).await {
        Ok(item) => HttpResponse::Created().json(ApiResponse {
            success: true,
            message: "添加成功".to_string(),
            data: Some(item),
        }),
        Err(e) => error_response(&e),
    }
}
