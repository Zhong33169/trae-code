use rocket::serde::json::Json;
use rocket::State;
use sha2::{Digest, Sha256};

use crate::auth::{create_token, AuthUser};
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{ApiResponse, LoginRequest, LoginResponse, User, UserWithPassword};

#[post("/login", data = "<req>")]
pub async fn login(
    pool: &State<DbPool>,
    req: Json<LoginRequest>,
) -> AppResult<LoginResponse> {
    let conn = pool.get()?;

    let user_result: Result<UserWithPassword, _> = conn.query_row(
        "SELECT id, username, password_hash, real_name, role, created_at FROM users WHERE username = ?1",
        [&req.username],
        |row| {
            Ok(UserWithPassword {
                id: row.get(0)?,
                username: row.get(1)?,
                password_hash: row.get(2)?,
                real_name: row.get(3)?,
                role: row.get(4)?,
                created_at: row.get(5)?,
            })
        },
    );

    let user = user_result.map_err(|_| AppError::Auth("用户名或密码错误".into()))?;

    let mut hasher = Sha256::new();
    hasher.update(req.password.as_bytes());
    let input_hash = hex::encode(hasher.finalize());

    if input_hash != user.password_hash {
        return Err(AppError::Auth("用户名或密码错误".into()));
    }

    let token = create_token(&User {
        id: user.id.clone(),
        username: user.username.clone(),
        real_name: user.real_name.clone(),
        role: user.role.clone(),
        created_at: user.created_at.clone(),
    })?;

    let response = LoginResponse {
        token,
        user: User {
            id: user.id,
            username: user.username,
            real_name: user.real_name,
            role: user.role,
            created_at: user.created_at,
        },
    };

    Ok(Json(ApiResponse {
        success: true,
        message: "登录成功".into(),
        data: Some(response),
    }))
}

#[get("/me")]
pub async fn me(auth: AuthUser) -> AppResult<User> {
    Ok(Json(ApiResponse {
        success: true,
        message: "OK".into(),
        data: Some(User {
            id: auth.id,
            username: auth.username,
            real_name: auth.real_name,
            role: auth.role,
            created_at: "".into(),
        }),
    }))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![login, me]
}
