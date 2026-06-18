use actix_web::{web, HttpResponse};
use uuid::Uuid;
use serde::Serialize;
use crate::db;
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
}

pub async fn list_logs(
    pool: web::Data<DbPool>,
    _auth_user: AuthUser,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> Result<HttpResponse, AppError> {
    let form_id = query.get("form_id")
        .and_then(|s| Uuid::parse_str(s).ok());

    let page: i64 = query.get("page")
        .and_then(|s| s.parse().ok())
        .unwrap_or(1);
    let page_size: i64 = query.get("page_size")
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);

    let result = db::list_operation_logs(&pool, form_id, page, page_size)?;

    Ok(HttpResponse::Ok().json(ApiResponse::ok(result)))
}
