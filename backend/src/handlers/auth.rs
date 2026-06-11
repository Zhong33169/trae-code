use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
    extract::Extension,
};
use jsonwebtoken::{encode, EncodingKey, Header, Algorithm};
use chrono::{Utc, Duration};
use std::sync::Arc;

use crate::{AppState, models::{LoginRequest, LoginResponse, UserInfo, Claims, User}};
use crate::middleware::auth::AuthUser;

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Response {
    let user: Option<User> = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE username = ?"
    )
    .bind(&req.username)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let user = match user {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "用户名或密码错误",
                    "code": "INVALID_CREDENTIALS"
                }))
            ).into_response();
        }
    };

    let is_valid = bcrypt::verify(&req.password, &user.password_hash)
        .unwrap_or(false);

    if !is_valid {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": "用户名或密码错误",
                "code": "INVALID_CREDENTIALS"
            }))
        ).into_response();
    }

    let exp = (Utc::now() + Duration::hours(24)).timestamp() as usize;
    let claims = Claims {
        sub: user.id.clone(),
        username: user.username.clone(),
        name: user.name.clone(),
        role: user.role.clone(),
        exp,
    };

    let token = match encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_ref())
    ) {
        Ok(t) => t,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "生成令牌失败",
                    "code": "TOKEN_GENERATION_FAILED"
                }))
            ).into_response();
        }
    };

    let user_info = UserInfo {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
    };

    Json(LoginResponse {
        token,
        user: user_info,
    }).into_response()
}

pub async fn me(
    Extension(auth_user): Extension<Arc<AuthUser>>,
) -> Response {
    Json(UserInfo {
        id: auth_user.id.clone(),
        username: auth_user.username.clone(),
        name: auth_user.name.clone(),
        role: auth_user.role.clone(),
    }).into_response()
}
