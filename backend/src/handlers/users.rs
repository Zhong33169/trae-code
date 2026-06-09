use rocket::serde::json::Json;
use rocket::State;

use crate::auth::AuthUser;
use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::{ApiResponse, User};

#[get("/list")]
pub async fn list_users(
    pool: &State<DbPool>,
    _auth: AuthUser,
) -> AppResult<Vec<User>> {
    let conn = pool.get()?;

    let mut stmt = conn
        .prepare("SELECT id, username, real_name, role, created_at FROM users ORDER BY created_at")?;

    let users_iter = stmt.query_map([], |row| {
        Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            real_name: row.get(2)?,
            role: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;

    let mut users = Vec::new();
    for user in users_iter {
        users.push(user?);
    }

    Ok(Json(ApiResponse {
        success: true,
        message: "OK".into(),
        data: Some(users),
    }))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![list_users]
}
