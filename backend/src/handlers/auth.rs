use actix_web::{web, HttpResponse};
use serde::Serialize;
use crate::db;
use crate::models::*;
use crate::auth::{self, AuthUser};
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

pub async fn login(
    pool: web::Data<DbPool>,
    req: web::Json<LoginRequest>,
) -> Result<HttpResponse, AppError> {
    let user_info = db::get_user_by_username(&pool, &req.username)?
        .ok_or_else(|| AppError::AuthError("用户名或密码错误".to_string()))?;

    let (user, password_hash) = user_info;

    if !auth::verify_password(&req.password, &password_hash)? {
        return Err(AppError::AuthError("用户名或密码错误".to_string()));
    }

    let token = auth::create_token(user.id, &user.username, &user.name, &user.role)?;

    Ok(HttpResponse::Ok().json(ApiResponse::ok_with_msg(
        LoginResponse { token, user },
        "登录成功"
    )))
}

pub async fn me(
    _pool: web::Data<DbPool>,
    auth_user: AuthUser,
) -> Result<HttpResponse, AppError> {
    let user = User {
        id: auth_user.user_id,
        username: auth_user.username,
        name: auth_user.name,
        role: auth_user.role,
        created_at: chrono::Utc::now(),
    };

    Ok(HttpResponse::Ok().json(ApiResponse::ok(user)))
}
