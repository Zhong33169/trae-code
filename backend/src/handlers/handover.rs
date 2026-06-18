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

pub async fn confirm_handover(
    pool: web::Data<DbPool>,
    auth_user: AuthUser,
    id: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let handover_id = Uuid::parse_str(&id)
        .map_err(|_| AppError::ValidationError("ID格式错误".to_string()))?;

    let handover = db::confirm_handover(&pool, handover_id, &auth_user)?;

    Ok(HttpResponse::Ok().json(ApiResponse::ok_with_msg(handover, "交接确认成功")))
}

pub async fn list_handovers(
    pool: web::Data<DbPool>,
    _auth_user: AuthUser,
    form_id: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let fid = Uuid::parse_str(&form_id)
        .map_err(|_| AppError::ValidationError("ID格式错误".to_string()))?;

    let records = db::list_handovers(&pool, fid)?;

    Ok(HttpResponse::Ok().json(ApiResponse::ok(records)))
}
