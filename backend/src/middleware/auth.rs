use actix_web::{dev::Payload, web, FromRequest, HttpRequest, HttpResponse};
use futures_util::future::{err, ok, Ready};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

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

impl FromRequest for AuthUser {
    type Error = actix_web::Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let auth_state = req.app_data::<web::Data<AuthState>>();
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
                err(actix_web::error::ErrorUnauthorized(
                    serde_json::json!({"code": 401, "message": "无效或已过期的登录凭证，请重新登录", "data": null}).to_string()
                ))
            }
            None => {
                err(actix_web::error::ErrorUnauthorized(
                    serde_json::json!({"code": 401, "message": "缺少登录凭证，请先登录", "data": null}).to_string()
                ))
            }
        }
    }
}

pub fn require_role(user: &AuthUser, allowed_roles: &[&str]) -> Result<(), HttpResponse> {
    if allowed_roles.contains(&user.role.as_str()) {
        Ok(())
    } else {
        Err(HttpResponse::Forbidden().json(serde_json::json!({
            "code": 403,
            "message": format!("权限不足：{}角色无法执行此操作", role_label(&user.role)),
            "data": null
        })))
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
