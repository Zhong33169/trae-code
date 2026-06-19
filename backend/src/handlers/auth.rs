use crate::auth::{encode_token, role_label};
use crate::db::DbPool;
use crate::models::{ApiResponse, LoginRequest, LoginResponse, User};
use bcrypt::verify;
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::serde::json::Json;
use rocket::State;

#[post("/login", format = "json", data = "<req>")]
pub fn login(
    pool: &State<DbPool>,
    req: Json<LoginRequest>,
) -> Result<Json<LoginResponse>, Custom<Json<ApiResponse<()>>>> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare("SELECT id, username, password_hash, role, real_name, created_at FROM users WHERE username = ?1")
        .map_err(|e| Custom(Status::InternalServerError, Json(ApiResponse::err(&format!("数据库错误：{}", e)))))?;
    let user = stmt
        .query_row(rusqlite::params![req.username.clone()], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
        .map_err(|_| Custom(Status::Unauthorized, Json(ApiResponse::err("账号或密码错误"))))?;

    let (id, username, password_hash, role, real_name, created_at) = user;
    let valid = verify(&req.password, &password_hash).map_err(|_| {
        Custom(Status::Unauthorized, Json(ApiResponse::err("账号或密码错误")))
    })?;
    if !valid {
        return Err(Custom(Status::Unauthorized, Json(ApiResponse::err("账号或密码错误"))));
    }

    let token = encode_token(&id, &username, &role, &real_name).map_err(|e| {
        Custom(Status::InternalServerError, Json(ApiResponse::err(&format!("令牌生成失败：{}", e))))
    })?;

    let user_info = User { id: id.clone(), username: username.clone(), role: role.clone(), real_name: real_name.clone(), created_at };
    Ok(Json(LoginResponse {
        token,
        user: user_info,
        message: format!("登录成功，欢迎您，{}（{}）", role_label(&role), username),
    }))
}

#[get("/me")]
pub fn me(user: crate::auth::AuthUser) -> Json<ApiResponse<User>> {
    Json(ApiResponse::ok(
        User {
            id: user.user_id,
            username: user.username,
            role: user.role,
            real_name: user.real_name,
            created_at: "-".to_string(),
        },
        "获取当前用户信息成功",
    ))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![login, me]
}
