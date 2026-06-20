use actix_web::{web, HttpResponse, Responder};
use crate::db::Database;
use crate::middleware::auth::AuthUser;
use crate::models::*;
use rusqlite::params;

fn row_to_audit_log(row: &rusqlite::Row) -> rusqlite::Result<AuditLog> {
    Ok(AuditLog {
        id: row.get(0)?,
        ticket_id: row.get(1)?,
        user_id: row.get(2)?,
        user_name: row.get(3)?,
        action: row.get(4)?,
        detail: row.get(5)?,
        is_failure: row.get::<_, i64>(6)? != 0,
        failure_reason: row.get(7)?,
        created_at: row.get(8)?,
    })
}

pub async fn list_audit_logs(
    path: web::Path<i64>,
    db: web::Data<Database>,
    _auth_user: AuthUser,
) -> impl Responder {
    let ticket_id = path.into_inner();
    let conn = db.conn.lock().unwrap();

    let sql = "SELECT a.id, a.ticket_id, a.user_id, u.name as user_name,
                      a.action, a.detail, a.is_failure, a.failure_reason, a.created_at
               FROM audit_logs a
               LEFT JOIN users u ON a.user_id = u.id
               WHERE a.ticket_id = ?1
               ORDER BY a.created_at DESC";

    let mut stmt = conn.prepare(sql).unwrap();
    let logs: Vec<_> = stmt.query_map(params![ticket_id], row_to_audit_log)
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    HttpResponse::Ok().json(ApiResponse::success(logs))
}

pub async fn list_all_audit_logs(
    db: web::Data<Database>,
    _auth_user: AuthUser,
) -> impl Responder {
    let conn = db.conn.lock().unwrap();

    let sql = "SELECT a.id, a.ticket_id, a.user_id, u.name as user_name,
                      a.action, a.detail, a.is_failure, a.failure_reason, a.created_at
               FROM audit_logs a
               LEFT JOIN users u ON a.user_id = u.id
               ORDER BY a.created_at DESC
               LIMIT 100";

    let mut stmt = conn.prepare(sql).unwrap();
    let logs: Vec<_> = stmt.query_map([], row_to_audit_log)
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    HttpResponse::Ok().json(ApiResponse::success(logs))
}

pub async fn list_failure_logs(
    db: web::Data<Database>,
    _auth_user: AuthUser,
) -> impl Responder {
    let conn = db.conn.lock().unwrap();

    let sql = "SELECT a.id, a.ticket_id, a.user_id, u.name as user_name,
                      a.action, a.detail, a.is_failure, a.failure_reason, a.created_at
               FROM audit_logs a
               LEFT JOIN users u ON a.user_id = u.id
               WHERE a.is_failure = 1
               ORDER BY a.created_at DESC
               LIMIT 100";

    let mut stmt = conn.prepare(sql).unwrap();
    let logs: Vec<_> = stmt.query_map([], row_to_audit_log)
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    HttpResponse::Ok().json(ApiResponse::success(logs))
}
