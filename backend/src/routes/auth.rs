use rocket::{State, serde::json::Json, Route, get, post, routes};
use crate::DbConn;
use crate::models::user::{User, LoginRequest, LoginResponse, all_roles};
use crate::models::common::ApiResponse;
use rusqlite::params;

pub fn routes() -> Vec<Route> {
    routes![login, get_users, get_roles, get_current_user]
}

#[post("/login", format = "json", data = "<req>")]
pub fn login(conn: &State<DbConn>, req: Json<LoginRequest>) -> Json<ApiResponse<LoginResponse>> {
    let db = conn.conn.lock().unwrap();
    
    let result = db.query_row(
        "SELECT u.id, u.username, u.real_name, u.role, u.created_at, u.password
         FROM users u
         WHERE u.username = ?1",
        params![req.username],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        },
    );

    match result {
        Ok((id, username, real_name, role, created_at, stored_pwd)) => {
            if stored_pwd != req.password {
                return Json(ApiResponse::ok(
                    LoginResponse {
                        success: false,
                        token: String::new(),
                        user: User {
                            id, username, real_name, role, created_at,
                        },
                        message: "密码错误".into(),
                    },
                    "登录失败"
                ));
            }

            let token = format!("token-{}-{}", id, chrono::Local::now().timestamp());

            Json(ApiResponse::ok(
                LoginResponse {
                    success: true,
                    token,
                    user: User {
                        id, username, real_name, role, created_at,
                    },
                    message: "登录成功".into(),
                },
                "操作成功"
            ))
        }
        Err(_) => {
            Json(ApiResponse::err("用户不存在"))
        }
    }
}

#[get("/users")]
pub fn get_users(conn: &State<DbConn>) -> Json<ApiResponse<Vec<User>>> {
    let db = conn.conn.lock().unwrap();
    
    let mut stmt = db.prepare(
        "SELECT id, username, real_name, role, created_at FROM users ORDER BY role, username"
    ).unwrap();
    
    let rows = stmt.query_map([], |row| {
        Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            real_name: row.get(2)?,
            role: row.get(3)?,
            created_at: row.get(4)?,
        })
    }).unwrap();
    
    let users: Vec<User> = rows.filter_map(|r| r.ok()).collect();
    Json(ApiResponse::ok(users, "查询成功"))
}

#[get("/roles")]
pub fn get_roles() -> Json<ApiResponse<Vec<crate::models::user::RoleInfo>>> {
    Json(ApiResponse::ok(all_roles(), "查询成功"))
}

#[get("/me/<user_id>")]
pub fn get_current_user(conn: &State<DbConn>, user_id: String) -> Json<ApiResponse<User>> {
    let db = conn.conn.lock().unwrap();
    
    let result = db.query_row(
        "SELECT id, username, real_name, role, created_at FROM users WHERE id = ?1",
        params![user_id],
        |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                real_name: row.get(2)?,
                role: row.get(3)?,
                created_at: row.get(4)?,
            })
        },
    );

    match result {
        Ok(user) => Json(ApiResponse::ok(user, "查询成功")),
        Err(_) => Json(ApiResponse::err("用户不存在")),
    }
}
