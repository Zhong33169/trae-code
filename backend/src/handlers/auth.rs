use actix_web::{web, HttpResponse, Responder, HttpRequest};
use crate::db::Database;
use crate::middleware::auth::{AuthState, AuthUser, role_label};
use crate::models::*;
use argon2::{Argon2, PasswordVerifier, PasswordHasher, password_hash::{PasswordHash, SaltString, rand_core::OsRng}};
use rusqlite::params;

fn insert_audit_log(conn: &rusqlite::Connection, ticket_id: Option<i64>, user_id: Option<i64>, action: &str, detail: Option<&str>, is_failure: bool, failure_reason: Option<&str>, batch_id: Option<i64>, source_ip: Option<&str>, user_agent: Option<&str>) {
    let _ = conn.execute(
        "INSERT INTO audit_logs (ticket_id, user_id, action, detail, is_failure, failure_reason, batch_id, source_ip, user_agent) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![ticket_id, user_id, action, detail, if is_failure { 1 } else { 0 }, failure_reason, batch_id, source_ip, user_agent],
    );
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

fn get_allowed_actions(role: &str) -> Vec<AllowedAction> {
    match role {
        "registrar" => vec![
            AllowedAction { key: "create_ticket".into(), label: "创建工单".into(), description: "投诉登记员可创建新工单".into() },
            AllowedAction { key: "edit_ticket".into(), label: "编辑草稿".into(), description: "可编辑草稿或退回的工单".into() },
            AllowedAction { key: "resubmit_ticket".into(), label: "补正重提".into(), description: "退回补正后重新提交审核".into() },
            AllowedAction { key: "upload_attachment".into(), label: "上传附件".into(), description: "可为工单上传附件材料".into() },
            AllowedAction { key: "delete_attachment".into(), label: "删除附件".into(), description: "可删除自己上传的附件".into() },
            AllowedAction { key: "import_tickets".into(), label: "导入工单".into(), description: "可从离线台账批量导入工单".into() },
        ],
        "auditor" => vec![
            AllowedAction { key: "start_process".into(), label: "开始办理".into(), description: "审核主管可受理待审核工单".into() },
            AllowedAction { key: "submit_review".into(), label: "提交复核".into(), description: "办理完成后提交复核".into() },
            AllowedAction { key: "return_ticket".into(), label: "退回补正".into(), description: "材料不全时退回登记员补正".into() },
            AllowedAction { key: "upload_attachment".into(), label: "上传附件".into(), description: "办理过程中可上传补充材料".into() },
            AllowedAction { key: "import_tickets".into(), label: "导入工单".into(), description: "可从离线台账批量导入工单".into() },
        ],
        "reviewer" => vec![
            AllowedAction { key: "archive_ticket".into(), label: "复核归档".into(), description: "复核负责人可归档待复核工单".into() },
            AllowedAction { key: "return_review".into(), label: "复核退回".into(), description: "复核不通过时退回审核主管".into() },
        ],
        _ => vec![],
    }
}

pub async fn login(
    req: web::Json<LoginRequest>,
    db: web::Data<Database>,
    auth_state: web::Data<AuthState>,
    http_req: HttpRequest,
) -> impl Responder {
    let source_ip = get_source_ip(&http_req);
    let user_agent = get_user_agent(&http_req);
    let username = req.username.clone();

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
                Err(_) => {
                    insert_audit_log(&conn, None, Some(user.id), "login_failure", Some("密码哈希错误"), true, Some("密码哈希错误"), None, source_ip.as_deref(), user_agent.as_deref());
                    return HttpResponse::InternalServerError().json(ApiResponse::<()>::error("密码哈希错误"));
                }
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

                    insert_audit_log(&conn, None, Some(user.id), "login_success", Some("登录成功"), false, None, None, source_ip.as_deref(), user_agent.as_deref());

                    HttpResponse::Ok().json(ApiResponse::success(LoginResponse {
                        token,
                        user,
                    }))
                }
                Err(_) => {
                    insert_audit_log(&conn, None, Some(user.id), "login_failure", Some(&format!("用户{}登录失败", username)), true, Some("用户名或密码错误"), None, source_ip.as_deref(), user_agent.as_deref());
                    HttpResponse::Unauthorized().json(ApiResponse::<()>::error_with_code(401, "用户名或密码错误"))
                }
            }
        }
        Err(_) => {
            insert_audit_log(&conn, None, None, "login_failure", Some(&format!("用户名{}不存在", username)), true, Some("用户名或密码错误"), None, source_ip.as_deref(), user_agent.as_deref());
            HttpResponse::Unauthorized().json(ApiResponse::<()>::error_with_code(401, "用户名或密码错误"))
        }
    }
}

pub async fn logout(
    auth_user: AuthUser,
    auth_state: web::Data<AuthState>,
    db: web::Data<Database>,
    req: HttpRequest,
) -> impl Responder {
    let source_ip = get_source_ip(&req);
    let user_agent = get_user_agent(&req);

    if let Some(header) = req.headers().get("Authorization") {
        let header_str = header.to_str().unwrap_or("");
        if header_str.starts_with("Bearer ") {
            let token = &header_str[7..];
            auth_state.remove_token(token);
        }
    }

    let conn = db.conn.lock().unwrap();
    insert_audit_log(&conn, None, Some(auth_user.user_id), "logout_success", Some("退出登录"), false, None, None, source_ip.as_deref(), user_agent.as_deref());

    HttpResponse::Ok().json(ApiResponse::success("已退出登录"))
}

pub async fn get_session(auth_user: AuthUser, db: web::Data<Database>) -> impl Responder {
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
        Ok(user) => {
            let session = SessionResponse {
                role_label: role_label(&user.role).to_string(),
                allowed_actions: get_allowed_actions(&user.role),
                user,
            };
            HttpResponse::Ok().json(ApiResponse::success(session))
        }
        Err(_) => HttpResponse::NotFound().json(ApiResponse::<()>::error_with_code(404, "用户不存在")),
    }
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
        Err(_) => HttpResponse::NotFound().json(ApiResponse::<()>::error_with_code(404, "用户不存在")),
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
