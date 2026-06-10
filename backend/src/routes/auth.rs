use rocket::serde::json::Json;
use rocket::http::Status;

use crate::models::{LoginRequest, LoginResponse, ApiError};
use crate::auth::{verify_user, create_token};

#[post("/login", format = "json", data = "<req>")]
pub fn login(req: Json<LoginRequest>) -> Result<Json<LoginResponse>, (Status, Json<ApiError>)> {
    let user = verify_user(&req.username, &req.password)
        .ok_or_else(|| (
            Status::Unauthorized,
            Json(ApiError {
                error: "登录失败".to_string(),
                details: Some("用户名或密码错误".to_string()),
            })
        ))?;

    let token = create_token(user.id);

    Ok(Json(LoginResponse {
        user: crate::models::User {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            role: user.role,
            created_at: user.created_at,
        },
        token,
    }))
}
