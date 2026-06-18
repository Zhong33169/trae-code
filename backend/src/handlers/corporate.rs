use actix_web::{web, HttpResponse};
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

pub async fn list_corporates(
    pool: web::Data<DbPool>,
    _auth_user: AuthUser,
) -> Result<HttpResponse, AppError> {
    let corporates = db::list_corporate_info(&pool)?;

    Ok(HttpResponse::Ok().json(ApiResponse::ok(corporates)))
}
