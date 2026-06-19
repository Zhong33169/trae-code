use axum::{
    extract::State,
    http::HeaderMap,
    Json,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};

use crate::errors::{AppError, AppResult};
use crate::middleware::get_claims;
use crate::models::{Claims, LoginRequest, LoginResponse, User};
use crate::state::AppState;

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> AppResult<Json<LoginResponse>> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, password_hash, real_name, role, created_at, updated_at FROM users WHERE username = ?"
    )
    .bind(&req.username)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| AppError::Unauthorized("用户名或密码错误".to_string()))?;

    let valid = bcrypt::verify(&req.password, &user.password_hash)?;
    if !valid {
        return Err(AppError::Unauthorized("用户名或密码错误".to_string()));
    }

    let exp = (Utc::now() + Duration::hours(24)).timestamp() as usize;

    let claims = Claims {
        sub: user.id.clone(),
        user_id: user.id.clone(),
        username: user.username.clone(),
        role: user.role.clone(),
        exp,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_ref()),
    )
    .map_err(|e| AppError::Internal(format!("生成 Token 失败: {}", e)))?;

    Ok(Json(LoginResponse { token, user }))
}

pub async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> AppResult<Json<User>> {
    let claims = get_claims(&headers, &state).await?;

    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, password_hash, real_name, role, created_at, updated_at FROM users WHERE id = ?"
    )
    .bind(&claims.user_id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(user))
}
