use actix_web::{web, HttpResponse};
use uuid::Uuid;
use serde::Serialize;
use crate::db;
use crate::models::*;
use crate::auth::AuthUser;
use crate::errors::AppError;
use crate::db::DbPool;

#[derive(Serialize)]
struct ApiResponse<T: Serialize> {
    success: bool,
    message: String,
    data: Option<T>,
}

impl<T: Serialize> ApiResponse<T> {
    fn ok(data: T) -> Self {
        ApiResponse {
            success: true,
            message: "操作成功".to_string(),
            data: Some(data),
        }
    }

    fn ok_with_msg(data: T, msg: &str) -> Self {
        ApiResponse {
            success: true,
            message: msg.to_string(),
            data: Some(data),
        }
    }
}

pub async fn list_forms(
    pool: web::Data<DbPool>,
    auth_user: AuthUser,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> Result<HttpResponse, AppError> {
    let status = query.get("status").map(|s| s.as_str());
    let page: i64 = query.get("page")
        .and_then(|s| s.parse().ok())
        .unwrap_or(1);
    let page_size: i64 = query.get("page_size")
        .and_then(|s| s.parse().ok())
        .unwrap_or(10);

    let result = db::list_forms(&pool, status, page, page_size, &auth_user.role, auth_user.user_id)?;

    Ok(HttpResponse::Ok().json(ApiResponse::ok(result)))
}

pub async fn create_form(
    pool: web::Data<DbPool>,
    auth_user: AuthUser,
    req: web::Json<CreateFormRequest>,
) -> Result<HttpResponse, AppError> {
    if !matches!(auth_user.role, Role::Registrar) {
        return Err(AppError::PermissionError("只有登记员可以创建年检单".to_string()));
    }

    if req.corporate_id.is_nil() {
        return Err(AppError::ValidationError("请选择企业".to_string()));
    }

    if req.corporate_name.trim().is_empty() {
        return Err(AppError::ValidationError("企业名称不能为空".to_string()));
    }

    if req.year <= 0 {
        return Err(AppError::ValidationError("年检年份无效".to_string()));
    }

    let form = db::create_inspection_form(&pool, &auth_user, &req)?;

    Ok(HttpResponse::Created().json(ApiResponse::ok_with_msg(form, "创建成功")))
}

pub async fn get_form(
    pool: web::Data<DbPool>,
    auth_user: AuthUser,
    id: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let form_id = Uuid::parse_str(&id)
        .map_err(|_| AppError::ValidationError("ID格式错误".to_string()))?;

    let form = db::get_form_by_id(&pool, form_id)?
        .ok_or_else(|| AppError::NotFoundError("年检单不存在".to_string()))?;

    if matches!(auth_user.role, Role::Registrar) && form.registrant_id != auth_user.user_id {
        return Err(AppError::PermissionError("无权查看该年检单".to_string()));
    }

    Ok(HttpResponse::Ok().json(ApiResponse::ok(form)))
}

pub async fn update_form(
    pool: web::Data<DbPool>,
    auth_user: AuthUser,
    id: web::Path<String>,
    req: web::Json<UpdateFormRequest>,
) -> Result<HttpResponse, AppError> {
    let form_id = Uuid::parse_str(&id)
        .map_err(|_| AppError::ValidationError("ID格式错误".to_string()))?;

    let form = db::update_inspection_form(&pool, form_id, &auth_user, &req)?;

    Ok(HttpResponse::Ok().json(ApiResponse::ok_with_msg(form, "更新成功")))
}

pub async fn submit_form(
    pool: web::Data<DbPool>,
    auth_user: AuthUser,
    id: web::Path<String>,
    req: web::Json<HandoverRequest>,
) -> Result<HttpResponse, AppError> {
    let form_id = Uuid::parse_str(&id)
        .map_err(|_| AppError::ValidationError("ID格式错误".to_string()))?;

    if req.shift.trim().is_empty() {
        return Err(AppError::ValidationError("请选择班次".to_string()));
    }

    if req.receiver_person_id.is_nil() {
        return Err(AppError::ValidationError("请选择接收人".to_string()));
    }

    let form = db::submit_for_audit(&pool, form_id, &auth_user, &req)?;

    Ok(HttpResponse::Ok().json(ApiResponse::ok_with_msg(form, "提交审核成功，请等待接收人确认交接")))
}

pub async fn audit_form(
    pool: web::Data<DbPool>,
    auth_user: AuthUser,
    id: web::Path<String>,
    req: web::Json<AuditRequest>,
) -> Result<HttpResponse, AppError> {
    let form_id = Uuid::parse_str(&id)
        .map_err(|_| AppError::ValidationError("ID格式错误".to_string()))?;

    if !req.pass && req.opinion.as_ref().map(|s| s.trim().is_empty()).unwrap_or(true) {
        return Err(AppError::ValidationError("审核退回必须填写意见".to_string()));
    }

    let form = db::audit_form(&pool, form_id, &auth_user, &req)?;

    let msg = if req.pass { "审核通过" } else { "审核退回" };
    Ok(HttpResponse::Ok().json(ApiResponse::ok_with_msg(form, msg)))
}

pub async fn review_form(
    pool: web::Data<DbPool>,
    auth_user: AuthUser,
    id: web::Path<String>,
    req: web::Json<ReviewRequest>,
) -> Result<HttpResponse, AppError> {
    let form_id = Uuid::parse_str(&id)
        .map_err(|_| AppError::ValidationError("ID格式错误".to_string()))?;

    if !req.pass && req.opinion.as_ref().map(|s| s.trim().is_empty()).unwrap_or(true) {
        return Err(AppError::ValidationError("复核退回必须填写意见".to_string()));
    }

    let form = db::review_form(&pool, form_id, &auth_user, &req)?;

    let msg = if req.pass { "复核通过，已归档" } else { "复核退回" };
    Ok(HttpResponse::Ok().json(ApiResponse::ok_with_msg(form, msg)))
}
