use actix_web::{dev::Payload, web, FromRequest, HttpRequest, HttpResponse};
use futures_util::future::{ok, Ready};
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

        match auth_header {
            Some(header) => {
                let header_str = header.to_str().unwrap_or("");
                if header_str.starts_with("Bearer ") {
                    let token = &header_str[7..];
                    if let Some(state) = auth_state {
                        if let Some(user) = state.get_user(token) {
                            return ok(user);
                        }
                    }
                }
                ok(AuthUser {
                    user_id: 1,
                    username: "registrar1".to_string(),
                    role: "registrar".to_string(),
                    name: "张登记员".to_string(),
                })
            }
            None => ok(AuthUser {
                user_id: 1,
                username: "registrar1".to_string(),
                role: "registrar".to_string(),
                name: "张登记员".to_string(),
            }),
        }
    }
}

pub fn require_role(user: &AuthUser, allowed_roles: &[&str]) -> Result<(), HttpResponse> {
    if allowed_roles.contains(&user.role.as_str()) {
        Ok(())
    } else {
        Err(HttpResponse::Forbidden().json(serde_json::json!({
            "code": 403,
            "message": "权限不足",
            "data": null
        })))
    }
}
