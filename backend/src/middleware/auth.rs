use actix_web::{dev::Payload, web, FromRequest, HttpRequest, HttpResponse};
use futures_util::future::{err, ok, Ready};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;
use crate::models::ApiResponse;
use crate::db::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    pub user_id: i64,
    pub username: String,
    pub role: String,
    pub name: String,
}

pub struct AuthState {
    pub tokens: Mutex<HashMap<String, AuthUser>>,
}

impl AuthState {
    pub fn new() -> Self {
        AuthState {
            tokens: Mutex::new(HashMap::new()),
        }
    }

    pub fn create_token(&self, user: AuthUser) -> String {
        let token = Uuid::new_v4().to_string();
        self.tokens.lock().unwrap().insert(token.clone(), user);
        token
    }

    pub fn get_user(&self, token: &str) -> Option<AuthUser> {
        self.tokens.lock().unwrap().get(token).cloned()
    }

    pub fn remove_token(&self, token: &str) {
        self.tokens.lock().unwrap().remove(token);
    }
}

fn get_source_ip(req: &HttpRequest) -> Option<String> {
    req.headers()
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
        .or_else(|| req.headers().get("x-real-ip").and_then(|h| h.to_str().ok()).map(|s| s.to_string()))
        .or_else(|| req.peer_addr().map(|addr| addr.ip().to_string()))
}

fn get_user_agent(req: &HttpRequest) -> Option<String> {
    req.headers()
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
}

fn log_unauthorized(req: &HttpRequest, message: &str, user_id: Option<i64>, db: &web::Data<Database>) {
    if let Ok(conn) = db.conn.lock() {
        let path = req.uri().path().to_string();
        let source_ip = get_source_ip(req);
        let user_agent = get_user_agent(req);
        let _ = conn.execute(
            "INSERT INTO audit_logs (ticket_id, user_id, action, detail, is_failure, failure_reason, batch_id, source_ip, user_agent) VALUES (NULL, ?1, ?2, ?3, 1, ?4, NULL, ?5, ?6)",
            rusqlite::params![
                user_id,
                "unauthorized_access",
                Some(&format!("访问{}被拒绝", path)),
                Some(message),
                source_ip,
                user_agent,
            ],
        );
    }
}

fn unauthorized_response(req: &HttpRequest, message: &str, user_id: Option<i64>, db: Option<&web::Data<Database>>) -> actix_web::Error {
    if let Some(db) = db {
        log_unauthorized(req, message, user_id, db);
    }
    let resp = HttpResponse::Unauthorized()
        .content_type("application/json")
        .json(ApiResponse::<()>::error_with_code(401, message));
    actix_web::error::InternalError::from_response("", resp).into()
}

impl FromRequest for AuthUser {
    type Error = actix_web::Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let auth_state = req.app_data::<web::Data<AuthState>>();
        let db = req.app_data::<web::Data<Database>>();
        let auth_header = req.headers().get("Authorization");

        let token = auth_header.and_then(|h| {
            let s = h.to_str().unwrap_or("");
            if s.starts_with("Bearer ") {
                Some(&s[7..])
            } else {
                None
            }
        });

        match token {
            Some(t) => {
                if let Some(state) = auth_state {
                    if let Some(user) = state.get_user(t) {
                        return ok(user);
                    }
                }
                err(unauthorized_response(req, "无效或已过期的登录凭证，请重新登录", None, db))
            }
            None => {
                err(unauthorized_response(req, "缺少登录凭证，请先登录", None, db))
            }
        }
    }
}

pub fn require_role(user: &AuthUser, allowed_roles: &[&str]) -> Result<(), HttpResponse> {
    if allowed_roles.contains(&user.role.as_str()) {
        Ok(())
    } else {
        Err(HttpResponse::Forbidden()
            .json(ApiResponse::<()>::error_with_code(403, &format!(
                "权限不足：{}角色无法执行此操作", role_label(&user.role)
            ))))
    }
}

pub fn role_label(role: &str) -> &str {
    match role {
        "registrar" => "投诉登记员",
        "auditor" => "投诉审核主管",
        "reviewer" => "复核负责人",
        _ => role,
    }
}
