use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use crate::{AppState, models::Claims};
use std::sync::Arc;

#[derive(Clone)]
pub struct AuthUser {
    pub id: String,
    pub username: String,
    pub name: String,
    pub role: String,
}

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Response {
    let headers = req.headers();
    let auth_header = headers.get("Authorization");

    let token = match auth_header {
        Some(h) => {
            let h_str = h.to_str().unwrap_or("");
            if h_str.starts_with("Bearer ") {
                h_str[7..].to_string()
            } else {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({
                        "error": "无效的认证格式",
                        "code": "INVALID_AUTH_FORMAT"
                    }))
                ).into_response();
            }
        }
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "缺少认证令牌",
                    "code": "MISSING_TOKEN"
                }))
            ).into_response();
        }
    };

    let decoding_key = DecodingKey::from_secret(state.config.jwt_secret.as_ref());
    let validation = Validation::new(Algorithm::HS256);

    match decode::<Claims>(&token, &decoding_key, &validation) {
        Ok(token_data) => {
            let claims = token_data.claims;
            let auth_user = AuthUser {
                id: claims.sub,
                username: claims.username,
                name: claims.name,
                role: claims.role,
            };
            req.extensions_mut().insert(Arc::new(auth_user));
            next.run(req).await
        }
        Err(e) => {
            let error_msg = match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => "认证令牌已过期",
                jsonwebtoken::errors::ErrorKind::InvalidToken => "无效的认证令牌",
                _ => "认证失败",
            };
            (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": error_msg,
                    "code": "AUTH_FAILED"
                }))
            ).into_response()
        }
    }
}
