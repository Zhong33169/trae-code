use rocket::request::{self, FromRequest, Request};
use rocket::outcome::Outcome;
use rusqlite::params;
use std::collections::HashMap;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use uuid::Uuid;

use crate::models::{User, UserRole, UserWithPassword};
use crate::db::DB_CONN;
use crate::db::hash_password;

static TOKENS: Lazy<Mutex<HashMap<String, i64>>> = Lazy::new(|| Mutex::new(HashMap::new()));

pub fn create_token(user_id: i64) -> String {
    let token = Uuid::new_v4().to_string();
    TOKENS.lock().unwrap().insert(token.clone(), user_id);
    token
}

pub fn get_user_by_token(token: &str) -> Option<User> {
    let user_id = TOKENS.lock().unwrap().get(token).cloned()?;
    get_user_by_id(user_id)
}

pub fn get_user_by_id(user_id: i64) -> Option<User> {
    let conn = DB_CONN.lock().unwrap();
    let result = conn.query_row(
        "SELECT id, username, display_name, role, created_at FROM users WHERE id = ?1",
        params![user_id],
        |row| {
            let role_str: String = row.get(3)?;
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                display_name: row.get(2)?,
                role: UserRole::from_str(&role_str).unwrap_or(UserRole::Registrar),
                created_at: row.get(4)?,
            })
        },
    );
    result.ok()
}

pub fn verify_user(username: &str, password: &str) -> Option<UserWithPassword> {
    let conn = DB_CONN.lock().unwrap();
    let pw_hash = hash_password(password);
    let result = conn.query_row(
        "SELECT id, username, password_hash, display_name, role, created_at FROM users WHERE username = ?1",
        params![username],
        |row| {
            let role_str: String = row.get(4)?;
            Ok(UserWithPassword {
                id: row.get(0)?,
                username: row.get(1)?,
                password_hash: row.get(2)?,
                display_name: row.get(3)?,
                role: UserRole::from_str(&role_str).unwrap_or(UserRole::Registrar),
                created_at: row.get(5)?,
            })
        },
    );
    result.ok().filter(|u| u.password_hash == pw_hash)
}

pub struct AuthenticatedUser {
    pub user: User,
    pub token: String,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthenticatedUser {
    type Error = String;

    async fn from_request(req: &'r Request<'_>) -> request::Outcome<Self, Self::Error> {
        let auth_header = req.headers().get_one("Authorization");
        let token = match auth_header {
            Some(header) => {
                if header.starts_with("Bearer ") {
                    &header[7..]
                } else {
                    return Outcome::Error((rocket::http::Status::Unauthorized, "Invalid authorization header".to_string()));
                }
            }
            None => {
                return Outcome::Error((rocket::http::Status::Unauthorized, "Missing authorization header".to_string()));
            }
        };

        match get_user_by_token(token) {
            Some(user) => Outcome::Success(AuthenticatedUser {
                user,
                token: token.to_string(),
            }),
            None => Outcome::Error((rocket::http::Status::Unauthorized, "Invalid or expired token".to_string())),
        }
    }
}
