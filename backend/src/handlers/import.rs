use actix_web::{web, HttpResponse, Responder};
use crate::db::Database;
use crate::middleware::auth::{AuthUser, require_role, role_label};
use crate::models::*;
use chrono::Utc;
use rusqlite::params;
use serde_json;

fn row_to_batch(row: &rusqlite::Row) -> rusqlite::Result<ImportBatch> {
    Ok(ImportBatch {
        id: row.get(0)?,
        batch_no: row.get(1)?,
        source: row.get(2)?,
        total_count: row.get(3)?,
        success_count: row.get(4)?,
        fail_count: row.get(5)?,
        imported_by: row.get(6)?,
        imported_by_name: row.get(7)?,
        imported_at: row.get(8)?,
    })
}

fn row_to_record(row: &rusqlite::Row) -> rusqlite::Result<ImportRecord> {
    Ok(ImportRecord {
        id: row.get(0)?,
        batch_id: row.get(1)?,
        ticket_id: row.get(2)?,
        original_ticket_no: row.get(3)?,
        original_data: row.get(4)?,
        status: row.get(5)?,
        diff_detail: row.get(6)?,
        error_message: row.get(7)?,
        created_at: row.get(8)?,
    })
}

fn insert_audit_log(conn: &rusqlite::Connection, ticket_id: Option<i64>, user_id: i64, action: &str, detail: Option<&str>, is_failure: bool, failure_reason: Option<&str>, batch_id: Option<i64>) {
    let _ = conn.execute(
        "INSERT INTO audit_logs (ticket_id, user_id, action, detail, is_failure, failure_reason, batch_id, source_ip, user_agent) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL)",
        params![ticket_id, user_id, action, detail, if is_failure { 1 } else { 0 }, failure_reason, batch_id],
    );
}

fn add_audit_log(db: &Database, ticket_id: Option<i64>, user_id: i64, action: &str, detail: Option<&str>, is_failure: bool, failure_reason: Option<&str>) {
    let conn = db.conn.lock().unwrap();
    insert_audit_log(&conn, ticket_id, user_id, action, detail, is_failure, failure_reason, None);
}

pub async fn import_tickets(
    req: web::Json<ImportRequest>,
    db: web::Data<Database>,
    auth_user: AuthUser,
) -> impl Responder {
    if let Err(resp) = require_role(&auth_user, &["registrar", "auditor"]) {
        add_audit_log(&db, None, auth_user.user_id, "import_forbidden", None, true,
            Some(&format!("{}({})无权导入工单，仅投诉登记员或审核主管可操作", auth_user.name, role_label(&auth_user.role))));
        return resp;
    }

    let batch_no = format!("BATCH{}", Utc::now().format("%Y%m%d%H%M%S"));
    let total = req.items.len() as i64;

    let conn = db.conn.lock().unwrap();

    let result = conn.execute(
        "INSERT INTO import_batches (batch_no, source, total_count, success_count, fail_count, imported_by)
         VALUES (?1, ?2, ?3, 0, 0, ?4)",
        params![batch_no, req.source, total, auth_user.user_id],
    );

    if result.is_err() {
        return HttpResponse::InternalServerError().json(ApiResponse::<()>::error("创建批次失败"));
    }

    let batch_id = conn.last_insert_rowid();
    drop(conn);

    let mut success_count = 0i64;
    let mut fail_count = 0i64;
    let mut records: Vec<ImportRecord> = Vec::new();

    for item in &req.items {
        let conn = db.conn.lock().unwrap();

        let existing: Result<(i64, String, String, String), _> = conn.query_row(
            "SELECT id, ticket_no, status, title FROM complaint_tickets WHERE ticket_no = ?1",
            params![item.ticket_no],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, String>(3)?)),
        );

        let original_data = serde_json::to_string(item).unwrap_or_default();

        match existing {
            Ok((existing_id, _ticket_no, existing_status, existing_title)) => {
                let mut diffs: Vec<String> = Vec::new();

                if existing_status != item.status.clone().unwrap_or_else(|| "pending_audit".to_string()) {
                    diffs.push(format!(
                        "状态不一致：线上为{}，线下为{}",
                        existing_status,
                        item.status.clone().unwrap_or_else(|| "pending_audit".to_string())
                    ));
                }

                if existing_title != item.title {
                    diffs.push(format!("标题不一致：线上为\"{}\"，线下为\"{}\"", existing_title, item.title));
                }

                let status = if !diffs.is_empty() {
                    fail_count += 1;
                    "conflict"
                } else {
                    fail_count += 1;
                    "duplicate"
                };

                let error_msg = if status == "duplicate" {
                    "工单号已存在，重复回填".to_string()
                } else {
                    format!("线上线下状态/内容冲突，未静默覆盖：{}", diffs.join("; "))
                };

                let _ = conn.execute(
                    "INSERT INTO import_records (batch_id, ticket_id, original_ticket_no, original_data, status, diff_detail, error_message)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        batch_id,
                        existing_id,
                        item.ticket_no,
                        original_data,
                        status,
                        diffs.join("; "),
                        error_msg
                    ],
                );

                let record_id = conn.last_insert_rowid();

                insert_audit_log(
                    &conn,
                    Some(existing_id),
                    auth_user.user_id,
                    if status == "duplicate" { "import_duplicate" } else { "import_conflict" },
                    Some(&format!("批次{}：{}", batch_no, error_msg)),
                    true,
                    Some(&error_msg),
                    Some(batch_id),
                );

                let record = conn.query_row(
                    "SELECT id, batch_id, ticket_id, original_ticket_no, original_data, status, diff_detail, error_message, created_at
                     FROM import_records WHERE id = ?1",
                    params![record_id],
                    row_to_record,
                ).unwrap();
                records.push(record);
            }
            Err(_) => {
                let status = item.status.as_deref().unwrap_or("pending_audit");
                let priority = item.priority.as_deref().unwrap_or("normal");
                let source = "offline_import";

                let insert_result = conn.execute(
                    "INSERT INTO complaint_tickets (ticket_no, title, content, complainant, contact, status, priority, source, deadline, created_by, import_batch_id)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    params![
                        item.ticket_no,
                        item.title,
                        item.content,
                        item.complainant,
                        item.contact,
                        status,
                        priority,
                        source,
                        item.deadline,
                        auth_user.user_id,
                        batch_id
                    ],
                );

                match insert_result {
                    Ok(_) => {
                        let ticket_id = conn.last_insert_rowid();
                        success_count += 1;

                        let _ = conn.execute(
                            "INSERT INTO import_records (batch_id, ticket_id, original_ticket_no, original_data, status, diff_detail, error_message)
                             VALUES (?1, ?2, ?3, ?4, 'success', NULL, NULL)",
                            params![batch_id, ticket_id, item.ticket_no, original_data],
                        );

                        let record_id = conn.last_insert_rowid();

                        insert_audit_log(
                            &conn,
                            Some(ticket_id),
                            auth_user.user_id,
                            "import_success",
                            Some(&format!("批次{}：离线台账导入成功", batch_no)),
                            false,
                            None,
                            Some(batch_id),
                        );

                        let record = conn.query_row(
                            "SELECT id, batch_id, ticket_id, original_ticket_no, original_data, status, diff_detail, error_message, created_at
                             FROM import_records WHERE id = ?1",
                            params![record_id],
                            row_to_record,
                        ).unwrap();
                        records.push(record);
                    }
                    Err(e) => {
                        fail_count += 1;
                        let _ = conn.execute(
                            "INSERT INTO import_records (batch_id, ticket_id, original_ticket_no, original_data, status, diff_detail, error_message)
                             VALUES (?1, NULL, ?2, ?3, 'failed', NULL, ?4)",
                            params![batch_id, item.ticket_no, original_data, format!("导入失败: {}", e)],
                        );

                        let record_id = conn.last_insert_rowid();

                        insert_audit_log(
                            &conn,
                            None,
                            auth_user.user_id,
                            "import_failed",
                            Some(&format!("批次{}：工单号{}导入失败", batch_no, item.ticket_no)),
                            true,
                            Some(&format!("{}", e)),
                            Some(batch_id),
                        );

                        let record = conn.query_row(
                            "SELECT id, batch_id, ticket_id, original_ticket_no, original_data, status, diff_detail, error_message, created_at
                             FROM import_records WHERE id = ?1",
                            params![record_id],
                            row_to_record,
                        ).unwrap();
                        records.push(record);
                    }
                }
            }
        }

        drop(conn);
    }

    let conn = db.conn.lock().unwrap();
    let _ = conn.execute(
        "UPDATE import_batches SET success_count = ?1, fail_count = ?2 WHERE id = ?3",
        params![success_count, fail_count, batch_id],
    );

    insert_audit_log(
        &conn,
        None,
        auth_user.user_id,
        "import_batch",
        Some(&format!("批次{}：共{}条，成功{}条，失败{}条", batch_no, total, success_count, fail_count)),
        fail_count > 0,
        if fail_count > 0 { Some("部分条目导入失败") } else { None },
        Some(batch_id),
    );

    HttpResponse::Ok().json(ApiResponse::success(ImportResult {
        batch_id,
        batch_no,
        total,
        success: success_count,
        failed: fail_count,
        records,
    }))
}

pub async fn list_batches(
    db: web::Data<Database>,
    auth_user: AuthUser,
) -> impl Responder {
    let conn = db.conn.lock().unwrap();

    let sql = "SELECT b.id, b.batch_no, b.source, b.total_count, b.success_count, b.fail_count,
                      b.imported_by, u.name as imported_by_name, b.imported_at
               FROM import_batches b
               LEFT JOIN users u ON b.imported_by = u.id
               ORDER BY b.imported_at DESC
               LIMIT 50";

    let mut stmt = conn.prepare(sql).unwrap();
    let batches: Vec<_> = stmt.query_map([], row_to_batch)
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    HttpResponse::Ok().json(ApiResponse::success(batches))
}

pub async fn get_batch(
    path: web::Path<i64>,
    db: web::Data<Database>,
    _auth_user: AuthUser,
) -> impl Responder {
    let batch_id = path.into_inner();
    let conn = db.conn.lock().unwrap();

    let batch = conn.query_row(
        "SELECT b.id, b.batch_no, b.source, b.total_count, b.success_count, b.fail_count,
                b.imported_by, u.name as imported_by_name, b.imported_at
         FROM import_batches b
         LEFT JOIN users u ON b.imported_by = u.id
         WHERE b.id = ?1",
        params![batch_id],
        row_to_batch,
    );

    match batch {
        Ok(b) => HttpResponse::Ok().json(ApiResponse::success(b)),
        Err(_) => HttpResponse::NotFound().json(ApiResponse::<()>::error("批次不存在")),
    }
}

pub async fn list_batch_records(
    path: web::Path<i64>,
    db: web::Data<Database>,
    _auth_user: AuthUser,
) -> impl Responder {
    let batch_id = path.into_inner();
    let conn = db.conn.lock().unwrap();

    let mut stmt = conn.prepare(
        "SELECT id, batch_id, ticket_id, original_ticket_no, original_data, status, diff_detail, error_message, created_at
         FROM import_records
         WHERE batch_id = ?1
         ORDER BY id",
    ).unwrap();

    let records: Vec<_> = stmt.query_map(params![batch_id], row_to_record)
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    HttpResponse::Ok().json(ApiResponse::success(records))
}
