use actix_web::{web, HttpResponse, Responder, HttpRequest};
use crate::db::Database;
use crate::middleware::auth::{AuthState, AuthUser};
use crate::models::*;
use argon2::{Argon2, PasswordVerifier, PasswordHasher, password_hash::{PasswordHash, SaltString, rand_core::OsRng}};

pub async fn login(
    req: web::Json<LoginRequest>,
    db: web::Data<Database>,
    auth_state: web::Data<AuthState>,
) -> impl Responder {
    let conn = db.conn.lock().unwrap();
    let result = conn.query_row(
        "SELECT id, username, password_hash, role, name, created_at FROM users WHERE username = ?1",
        [&req.username],
        |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                password_hash: row.get(2)?,
                role: row.get(3)?,
                name: row.get(4)?,
                created_at: row.get(5)?,
            })
        },
    );

    match result {
        Ok(user) => {
            let parsed_hash = match PasswordHash::new(&user.password_hash) {
                Ok(h) => h,
                Err(_) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error("密码哈希错误")),
            };

            let argon2 = Argon2::default();
            match argon2.verify_password(req.password.as_bytes(), &parsed_hash) {
                Ok(_) => {
                    let token = auth_state.create_token(AuthUser {
                        user_id: user.id,
                        username: user.username.clone(),
                        role: user.role.clone(),
                        name: user.name.clone(),
                    });

                    HttpResponse::Ok().json(ApiResponse::success(LoginResponse {
                        token,
                        user,
                    }))
                }
                Err(_) => HttpResponse::Unauthorized().json(ApiResponse::<()>::error("用户名或密码错误")),
            }
        }
        Err(_) => HttpResponse::Unauthorized().json(ApiResponse::<()>::error("用户名或密码错误")),
    }
}

pub async fn logout(
    _auth_user: AuthUser,
    auth_state: web::Data<AuthState>,
    req: HttpRequest,
) -> impl Responder {
    if let Some(header) = req.headers().get("Authorization") {
        let header_str = header.to_str().unwrap_or("");
        if header_str.starts_with("Bearer ") {
            let token = &header_str[7..];
            auth_state.remove_token(token);
        }
    }
    HttpResponse::Ok().json(ApiResponse::success("已退出登录"))
}

pub async fn get_current_user(auth_user: AuthUser, db: web::Data<Database>) -> impl Responder {
    let conn = db.conn.lock().unwrap();
    let result = conn.query_row(
        "SELECT id, username, password_hash, role, name, created_at FROM users WHERE id = ?1",
        [auth_user.user_id],
        |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                password_hash: row.get(2)?,
                role: row.get(3)?,
                name: row.get(4)?,
                created_at: row.get(5)?,
            })
        },
    );

    match result {
        Ok(user) => HttpResponse::Ok().json(ApiResponse::success(user)),
        Err(_) => HttpResponse::NotFound().json(ApiResponse::<()>::error("用户不存在")),
    }
}

pub async fn get_all_users(db: web::Data<Database>) -> impl Responder {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, username, password_hash, role, name, created_at FROM users ORDER BY id",
    ).unwrap();

    let users = stmt.query_map([], |row| {
        Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            password_hash: row.get(2)?,
            role: row.get(3)?,
            name: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).unwrap();

    let result: Vec<User> = users.filter_map(|r| r.ok()).collect();
    HttpResponse::Ok().json(ApiResponse::success(result))
}
