use actix_web::{web, HttpResponse, Responder};
use actix_multipart::Multipart;
use crate::db::Database;
use crate::middleware::auth::{AuthUser, require_role, role_label};
use crate::models::*;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;
use futures_util::StreamExt;
use std::io::Write;
use rusqlite::params;

const UPLOAD_DIR: &str = "uploads";

fn row_to_attachment(row: &rusqlite::Row) -> rusqlite::Result<TicketAttachment> {
    Ok(TicketAttachment {
        id: row.get(0)?,
        ticket_id: row.get(1)?,
        filename: row.get(2)?,
        file_path: row.get(3)?,
        file_size: row.get(4)?,
        uploaded_by: row.get(5)?,
        uploaded_by_name: row.get(6)?,
        uploaded_at: row.get(7)?,
    })
}

fn add_audit_log(db: &Database, ticket_id: Option<i64>, user_id: i64, action: &str, detail: Option<&str>, is_failure: bool, failure_reason: Option<&str>) {
    let conn = db.conn.lock().unwrap();
    let _ = conn.execute(
        "INSERT INTO audit_logs (ticket_id, user_id, action, detail, is_failure, failure_reason) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![ticket_id, user_id, action, detail, if is_failure { 1 } else { 0 }, failure_reason],
    );
}

pub async fn list_attachments(
    path: web::Path<i64>,
    db: web::Data<Database>,
    _auth_user: AuthUser,
) -> impl Responder {
    let ticket_id = path.into_inner();
    let conn = db.conn.lock().unwrap();

    let sql = "SELECT a.id, a.ticket_id, a.filename, a.file_path, a.file_size,
                      a.uploaded_by, u.name as uploaded_by_name, a.uploaded_at
               FROM ticket_attachments a
               LEFT JOIN users u ON a.uploaded_by = u.id
               WHERE a.ticket_id = ?1
               ORDER BY a.uploaded_at DESC";

    let mut stmt = conn.prepare(sql).unwrap();
    let attachments: Vec<_> = stmt.query_map([ticket_id], row_to_attachment)
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    HttpResponse::Ok().json(ApiResponse::success(attachments))
}

pub async fn upload_attachment(
    path: web::Path<i64>,
    mut payload: Multipart,
    db: web::Data<Database>,
    auth_user: AuthUser,
) -> impl Responder {
    let ticket_id = path.into_inner();

    if let Err(resp) = require_role(&auth_user, &["registrar", "auditor"]) {
        add_audit_log(&db, Some(ticket_id), auth_user.user_id, "upload_attachment_forbidden", None, true,
            Some(&format!("{}({})无权上传附件，仅投诉登记员或审核主管可操作", auth_user.name, role_label(&auth_user.role))));
        return resp;
    }

    let dir_path = format!("{}/{}", UPLOAD_DIR, ticket_id);
    fs::create_dir_all(&dir_path).ok();

    while let Some(item) = payload.next().await {
        let mut field = match item {
            Ok(f) => f,
            Err(e) => return HttpResponse::BadRequest().json(ApiResponse::<()>::error(&format!("上传失败: {}", e))),
        };

        let cd = field.content_disposition();
        let filename = cd
            .get_filename()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let path = PathBuf::from(&filename);
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");

        let stored_name = format!("{}.{}", Uuid::new_v4(), ext);
        let file_path = format!("{}/{}", dir_path, stored_name);
        let mut file = match fs::File::create(&file_path) {
            Ok(f) => f,
            Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&format!("创建文件失败: {}", e))),
        };

        let mut file_size: i64 = 0;
        while let Some(chunk) = field.next().await {
            let data = match chunk {
                Ok(d) => d,
                Err(e) => return HttpResponse::BadRequest().json(ApiResponse::<()>::error(&format!("读取文件失败: {}", e))),
            };
            file.write_all(&data).ok();
            file_size += data.len() as i64;
        }

        let conn = db.conn.lock().unwrap();
        let result = conn.execute(
            "INSERT INTO ticket_attachments (ticket_id, filename, file_path, file_size, uploaded_by)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![ticket_id, filename, file_path, file_size, auth_user.user_id],
        );

        match result {
            Ok(_) => {
                let id = conn.last_insert_rowid();
                drop(conn);
                add_audit_log(&db, Some(ticket_id), auth_user.user_id, "upload_attachment", Some(&format!("上传附件: {}", filename)), false, None);
                let conn = db.conn.lock().unwrap();
                let sql = "SELECT a.id, a.ticket_id, a.filename, a.file_path, a.file_size,
                                  a.uploaded_by, u.name as uploaded_by_name, a.uploaded_at
                           FROM ticket_attachments a
                           LEFT JOIN users u ON a.uploaded_by = u.id
                           WHERE a.id = ?1";
                let attachment = conn.query_row(sql, [id], row_to_attachment).unwrap();
                return HttpResponse::Ok().json(ApiResponse::success(attachment));
            }
            Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&format!("保存记录失败: {}", e))),
        }
    }

    HttpResponse::BadRequest().json(ApiResponse::<()>::error("没有文件上传"))
}

pub async fn delete_attachment(
    path: web::Path<(i64, i64)>,
    db: web::Data<Database>,
    auth_user: AuthUser,
) -> impl Responder {
    let (ticket_id, attachment_id) = path.into_inner();

    if let Err(resp) = require_role(&auth_user, &["registrar"]) {
        add_audit_log(&db, Some(ticket_id), auth_user.user_id, "delete_attachment_forbidden", None, true,
            Some(&format!("{}({})无权删除附件，仅投诉登记员可操作", auth_user.name, role_label(&auth_user.role))));
        return resp;
    }

    let conn = db.conn.lock().unwrap();

    let file_path: String = match conn.query_row(
        "SELECT file_path FROM ticket_attachments WHERE id = ?1 AND ticket_id = ?2",
        params![attachment_id, ticket_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return HttpResponse::NotFound().json(ApiResponse::<()>::error("附件不存在")),
    };

    let result = conn.execute(
        "DELETE FROM ticket_attachments WHERE id = ?1",
        params![attachment_id],
    );

    match result {
        Ok(_) => {
            fs::remove_file(&file_path).ok();
            drop(conn);
            add_audit_log(&db, Some(ticket_id), auth_user.user_id, "delete_attachment", Some(&format!("删除附件: {}", file_path)), false, None);
            HttpResponse::Ok().json(ApiResponse::success("删除成功"))
        }
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&format!("删除失败: {}", e))),
    }
}
