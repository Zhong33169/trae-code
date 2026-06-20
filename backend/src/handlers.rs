use actix_web::{web, HttpResponse};
use std::sync::Mutex;
use rusqlite::Connection;
use crate::models::*;
use crate::auth::{verify_password, generate_token};
use crate::middleware::AuthClaims;
use crate::workflow::*;
use crate::errors::AppError;

type Db = web::Data<Mutex<Connection>>;

fn current_handler_for_status(status: &str) -> &str {
    match status {
        "pending_review" => "reviewer",
        "pending_archive" => "archivist",
        "rejected_for_correction" => "registrar",
        "rejected_for_review" => "reviewer",
        "archived" => "archivist",
        _ => "registrar",
    }
}

fn action_label(action: &str) -> &str {
    match action {
        "create" => "创建预约单",
        "correct" => "补正预约单",
        "review_approve" => "审核通过",
        "review_reject" => "审核退回",
        "archive_approve" => "复核归档",
        "archive_reject" => "复核退回",
        "add_evidence" => "添加证据",
        _ => action,
    }
}

fn row_to_appointment(row: &rusqlite::Row) -> rusqlite::Result<Appointment> {
    let status: String = row.get("status")?;
    Ok(Appointment {
        id: row.get("id")?,
        visitor_name: row.get("visitor_name")?,
        visitor_phone: row.get("visitor_phone")?,
        visitor_id_number: row.get("visitor_id_number")?,
        exhibition_name: row.get("exhibition_name")?,
        current_handler_role: current_handler_for_status(&status).to_string(),
        status,
        version: row.get("version")?,
        created_by: row.get("created_by")?,
        updated_by: row.get("updated_by")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn row_to_evidence(row: &rusqlite::Row) -> rusqlite::Result<Evidence> {
    let id: i64 = row.get("id")?;
    Ok(Evidence {
        id: id.to_string(),
        appointment_id: row.get("appointment_id")?,
        evidence_type: row.get("type")?,
        content: row.get("content")?,
        created_by: row.get("created_by")?,
        created_at: row.get("created_at")?,
    })
}

fn row_to_operation_log(row: &rusqlite::Row) -> rusqlite::Result<OperationLog> {
    let id: i64 = row.get("id")?;
    Ok(OperationLog {
        id: id.to_string(),
        appointment_id: row.get("appointment_id")?,
        action: row.get("action")?,
        operator: row.get("operator")?,
        operator_role: row.get("operator_role")?,
        detail: row.get("detail")?,
        batch_id: row.get("batch_id").ok().flatten(),
        timestamp: row.get("timestamp")?,
    })
}

fn get_evidence_for_appointment(conn: &Connection, apt_id: &str) -> Vec<Evidence> {
    let mut stmt = conn.prepare(
        "SELECT id, appointment_id, type, content, created_by, created_at FROM evidence WHERE appointment_id = ?1 ORDER BY id"
    ).unwrap();
    stmt.query_map(rusqlite::params![apt_id], row_to_evidence)
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
}

fn group_evidence(all: Vec<Evidence>) -> EvidenceGroup {
    let mut reservation = Vec::new();
    let mut check_in = Vec::new();
    let mut data_recovery = Vec::new();
    for e in all {
        match e.evidence_type.as_str() {
            "reservation" => reservation.push(e),
            "check_in" => check_in.push(e),
            "data_recovery" => data_recovery.push(e),
            _ => {}
        }
    }
    EvidenceGroup { reservation, check_in, data_recovery }
}

fn get_logs_for_appointment(conn: &Connection, apt_id: &str) -> Vec<OperationLog> {
    let mut stmt = conn.prepare(
        "SELECT id, appointment_id, action, operator, operator_role, detail, batch_id, timestamp FROM operation_logs WHERE appointment_id = ?1 ORDER BY id"
    ).unwrap();
    stmt.query_map(rusqlite::params![apt_id], row_to_operation_log)
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
}

fn get_batch_records_for_appointment(conn: &Connection, apt_id: &str) -> Vec<AppointmentBatchItem> {
    let mut stmt = conn.prepare(
        "SELECT bi.batch_id, b.action_type, b.action, bi.success, bi.error_code, bi.error_message, b.created_at FROM batch_items bi JOIN batches b ON bi.batch_id = b.id WHERE bi.appointment_id = ?1 ORDER BY b.created_at DESC"
    ).unwrap();
    stmt.query_map(rusqlite::params![apt_id], |row| Ok(AppointmentBatchItem {
        batch_id: row.get(0)?,
        action_type: row.get(1)?,
        action: row.get(2)?,
        success: row.get::<_, i64>(3)? != 0,
        error_code: row.get(4).ok().flatten(),
        error_message: row.get(5).ok().flatten(),
        created_at: row.get(6)?,
    })).unwrap().filter_map(|r| r.ok()).collect()
}

fn build_version_history(logs: &[OperationLog]) -> Vec<VersionRecord> {
    let mut history = Vec::new();
    let mut current_version = 1;
    for log in logs {
        if log.action == "create" {
            history.push(VersionRecord {
                version: 1,
                action: action_label(&log.action).to_string(),
                operator: log.operator.clone(),
                operator_role: log.operator_role.clone(),
                timestamp: log.timestamp.clone(),
                changes: log.detail.clone(),
            });
            current_version = 1;
        } else if log.action.starts_with("review_") || log.action.starts_with("archive_") || log.action == "correct" {
            current_version += 1;
            history.push(VersionRecord {
                version: current_version,
                action: action_label(&log.action).to_string(),
                operator: log.operator.clone(),
                operator_role: log.operator_role.clone(),
                timestamp: log.timestamp.clone(),
                changes: log.detail.clone(),
            });
        }
    }
    history
}

fn insert_operation_log(
    conn: &Connection,
    appointment_id: &str,
    action: &str,
    operator: &str,
    operator_role: &str,
    detail: &str,
) {
    insert_operation_log_with_batch(conn, appointment_id, action, operator, operator_role, detail, None)
}

fn insert_operation_log_with_batch(
    conn: &Connection,
    appointment_id: &str,
    action: &str,
    operator: &str,
    operator_role: &str,
    detail: &str,
    batch_id: Option<&str>,
) {
    let now = chrono::Utc::now().to_rfc3339();
    let _ = conn.execute(
        "INSERT INTO operation_logs (appointment_id, action, operator, operator_role, detail, batch_id, timestamp) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![appointment_id, action, operator, operator_role, detail, batch_id, now],
    );
}

fn generate_batch_id(action_type: &str) -> String {
    let prefix = match action_type {
        "batch_review" => "BR",
        "batch_archive" => "BA",
        _ => "BX",
    };
    let ts = chrono::Utc::now().format("%Y%m%d%H%M%S");
    let rand = uuid::Uuid::new_v4().simple().to_string();
    format!("{}-{}-{}", prefix, ts, &rand[..6])
}

pub async fn login(db: Db, body: web::Json<LoginRequest>) -> Result<HttpResponse, AppError> {
    let conn = db.lock().unwrap();
    let result = conn.query_row(
        "SELECT id, username, password_hash, role, display_name FROM users WHERE username = ?1",
        rusqlite::params![body.username],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        },
    );

    match result {
        Ok((_id, username, password_hash, role, display_name)) => {
            if !verify_password(&body.password, &password_hash) {
                return Err(AppError::Unauthorized("用户名或密码错误".into()));
            }
            let token = generate_token(&username, &role)
                .map_err(|e| AppError::InternalError(e.to_string()))?;
            Ok(HttpResponse::Ok().json(LoginResponse {
                token,
                user: LoginResponseUser {
                    username: username.clone(),
                    role,
                    display_name,
                },
            }))
        }
        Err(_) => Err(AppError::Unauthorized("用户名或密码错误".into())),
    }
}

pub async fn me(claims: AuthClaims, db: Db) -> Result<HttpResponse, AppError> {
    let conn = db.lock().unwrap();
    let result = conn.query_row(
        "SELECT username, role, display_name FROM users WHERE username = ?1",
        rusqlite::params![claims.sub],
        |row| {
            Ok(UserInfo {
                username: row.get(0)?,
                role: row.get(1)?,
                display_name: row.get(2)?,
            })
        },
    );
    match result {
        Ok(user) => Ok(HttpResponse::Ok().json(user)),
        Err(_) => Err(AppError::NotFound("用户不存在".into())),
    }
}

pub async fn list_appointments(
    claims: AuthClaims,
    db: Db,
    query: web::Query<AppointmentQuery>,
) -> Result<HttpResponse, AppError> {
    let _ = claims;
    let conn = db.lock().unwrap();
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(50).max(1).min(200);
    let offset = (page - 1) * page_size;

    let items: Vec<Appointment> = match (&query.status, &query.keyword) {
        (Some(status), Some(keyword)) if !keyword.is_empty() => {
            let kw = format!("%{}%", keyword);
            let mut stmt = conn.prepare(
                "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE status = ?1 AND (visitor_name LIKE ?2 OR visitor_phone LIKE ?2 OR visitor_id_number LIKE ?2) ORDER BY created_at DESC LIMIT ?3 OFFSET ?4"
            ).map_err(|e| AppError::InternalError(e.to_string()))?;
            stmt.query_map(rusqlite::params![status, kw, page_size, offset], row_to_appointment)
                .unwrap()
                .filter_map(|r| r.ok())
                .collect()
        }
        (Some(status), _) => {
            let mut stmt = conn.prepare(
                "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE status = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
            ).map_err(|e| AppError::InternalError(e.to_string()))?;
            stmt.query_map(rusqlite::params![status, page_size, offset], row_to_appointment)
                .unwrap()
                .filter_map(|r| r.ok())
                .collect()
        }
        (None, Some(keyword)) if !keyword.is_empty() => {
            let kw = format!("%{}%", keyword);
            let mut stmt = conn.prepare(
                "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE visitor_name LIKE ?1 OR visitor_phone LIKE ?1 OR visitor_id_number LIKE ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
            ).map_err(|e| AppError::InternalError(e.to_string()))?;
            stmt.query_map(rusqlite::params![kw, page_size, offset], row_to_appointment)
                .unwrap()
                .filter_map(|r| r.ok())
                .collect()
        }
        _ => {
            let mut stmt = conn.prepare(
                "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments ORDER BY created_at DESC LIMIT ?1 OFFSET ?2"
            ).map_err(|e| AppError::InternalError(e.to_string()))?;
            stmt.query_map(rusqlite::params![page_size, offset], row_to_appointment)
                .unwrap()
                .filter_map(|r| r.ok())
                .collect()
        }
    };

    Ok(HttpResponse::Ok().json(items))
}

pub async fn get_appointment(
    claims: AuthClaims,
    db: Db,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let _ = claims;
    let id = path.into_inner();
    let conn = db.lock().unwrap();

    let appointment = conn
        .query_row(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE id = ?1",
            rusqlite::params![id],
            row_to_appointment,
        )
        .map_err(|_| AppError::NotFound("预约单不存在".into()))?;

    let all_evidence = get_evidence_for_appointment(&conn, &id);
    let evidence = group_evidence(all_evidence);
    let operation_logs = get_logs_for_appointment(&conn, &id);
    let version_history = build_version_history(&operation_logs);
    let batch_records = get_batch_records_for_appointment(&conn, &id);

    Ok(HttpResponse::Ok().json(AppointmentDetail {
        id: appointment.id.clone(),
        visitor_name: appointment.visitor_name,
        visitor_phone: appointment.visitor_phone,
        visitor_id_number: appointment.visitor_id_number,
        exhibition_name: appointment.exhibition_name,
        current_handler_role: appointment.current_handler_role,
        status: appointment.status,
        version: appointment.version,
        created_by: appointment.created_by,
        updated_by: appointment.updated_by,
        created_at: appointment.created_at,
        updated_at: appointment.updated_at,
        evidence,
        version_history,
        operation_logs,
        batch_records,
    }))
}

pub async fn create_appointment(
    claims: AuthClaims,
    db: Db,
    body: web::Json<CreateAppointmentRequest>,
) -> Result<HttpResponse, AppError> {
    validate_role("registrar", &claims.role)?;

    let conn = db.lock().unwrap();
    check_duplicate(&conn, &body.visitor_id_number, &body.exhibition_name, None)?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO appointments (id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 'pending_review', 1, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            id, body.visitor_name, body.visitor_phone, body.visitor_id_number,
            body.exhibition_name, claims.sub, claims.sub, now, now
        ],
    ).map_err(|e| AppError::InternalError(e.to_string()))?;

    insert_operation_log(&conn, &id, "create", &claims.sub, &claims.role, "创建预约单");

    let appointment = conn
        .query_row(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE id = ?1",
            rusqlite::params![id],
            row_to_appointment,
        )
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    Ok(HttpResponse::Created().json(appointment))
}

pub async fn correct_appointment(
    claims: AuthClaims,
    db: Db,
    path: web::Path<String>,
    body: web::Json<CorrectAppointmentRequest>,
) -> Result<HttpResponse, AppError> {
    validate_role("registrar", &claims.role)?;

    let id = path.into_inner();
    let conn = db.lock().unwrap();

    let appointment = conn
        .query_row(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE id = ?1",
            rusqlite::params![id],
            row_to_appointment,
        )
        .map_err(|_| AppError::NotFound("预约单不存在".into()))?;

    validate_status(&["rejected_for_correction"], &appointment.status)?;
    validate_version(body.version, appointment.version)?;

    check_duplicate(
        &conn,
        &body.visitor_id_number,
        &body.exhibition_name,
        Some(&id),
    )?;

    let now = chrono::Utc::now().to_rfc3339();
    let new_version = appointment.version + 1;

    conn.execute(
        "UPDATE appointments SET visitor_name = ?1, visitor_phone = ?2, visitor_id_number = ?3, exhibition_name = ?4, status = 'pending_review', version = ?5, updated_by = ?6, updated_at = ?7 WHERE id = ?8",
        rusqlite::params![
            body.visitor_name, body.visitor_phone, body.visitor_id_number,
            body.exhibition_name, new_version, claims.sub, now, id
        ],
    ).map_err(|e| AppError::InternalError(e.to_string()))?;

    insert_operation_log(&conn, &id, "correct", &claims.sub, &claims.role, "登记员补正");

    let updated = conn
        .query_row(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE id = ?1",
            rusqlite::params![id],
            row_to_appointment,
        )
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    Ok(HttpResponse::Ok().json(updated))
}

pub async fn review_appointment(
    claims: AuthClaims,
    db: Db,
    path: web::Path<String>,
    body: web::Json<ReviewRequest>,
) -> Result<HttpResponse, AppError> {
    validate_role("reviewer", &claims.role)?;

    let id = path.into_inner();
    let conn = db.lock().unwrap();

    let appointment = conn
        .query_row(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE id = ?1",
            rusqlite::params![id],
            row_to_appointment,
        )
        .map_err(|_| AppError::NotFound("预约单不存在".into()))?;

    validate_status(&["pending_review", "rejected_for_review"], &appointment.status)?;
    validate_version(body.version, appointment.version)?;

    let evidence = get_evidence_for_appointment(&conn, &id);

    let new_status;
    let action;
    let detail_text;

    match body.action.as_str() {
        "approve" => {
            validate_evidence(&evidence)?;
            new_status = "pending_archive";
            action = "review_approve";
            detail_text = body.detail.as_deref().unwrap_or("审核通过");
        }
        "reject" => {
            new_status = "rejected_for_correction";
            action = "review_reject";
            detail_text = body.detail.as_deref().unwrap_or("审核退回");
        }
        _ => {
            return Err(AppError::BadRequest(
                "审核操作必须是 approve 或 reject".into(),
            ));
        }
    };

    let now = chrono::Utc::now().to_rfc3339();
    let new_version = appointment.version + 1;

    conn.execute(
        "UPDATE appointments SET status = ?1, version = ?2, updated_by = ?3, updated_at = ?4 WHERE id = ?5",
        rusqlite::params![new_status, new_version, claims.sub, now, id],
    ).map_err(|e| AppError::InternalError(e.to_string()))?;

    insert_operation_log(&conn, &id, action, &claims.sub, &claims.role, detail_text);

    let updated = conn
        .query_row(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE id = ?1",
            rusqlite::params![id],
            row_to_appointment,
        )
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    Ok(HttpResponse::Ok().json(updated))
}

pub async fn archive_appointment(
    claims: AuthClaims,
    db: Db,
    path: web::Path<String>,
    body: web::Json<ArchiveRequest>,
) -> Result<HttpResponse, AppError> {
    validate_role("archivist", &claims.role)?;

    let id = path.into_inner();
    let conn = db.lock().unwrap();

    let appointment = conn
        .query_row(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE id = ?1",
            rusqlite::params![id],
            row_to_appointment,
        )
        .map_err(|_| AppError::NotFound("预约单不存在".into()))?;

    validate_status(&["pending_archive"], &appointment.status)?;
    validate_version(body.version, appointment.version)?;

    let evidence = get_evidence_for_appointment(&conn, &id);

    let new_status;
    let action;
    let detail_text;

    match body.action.as_str() {
        "approve" | "archive" => {
            validate_evidence(&evidence)?;
            new_status = "archived";
            action = "archive_approve";
            detail_text = body.detail.as_deref().unwrap_or("归档完成");
        }
        "reject" => {
            new_status = "rejected_for_review";
            action = "archive_reject";
            detail_text = body.detail.as_deref().unwrap_or("复核退回");
        }
        _ => {
            return Err(AppError::BadRequest(
                "归档操作必须是 archive 或 reject".into(),
            ));
        }
    };

    let now = chrono::Utc::now().to_rfc3339();
    let new_version = appointment.version + 1;

    conn.execute(
        "UPDATE appointments SET status = ?1, version = ?2, updated_by = ?3, updated_at = ?4 WHERE id = ?5",
        rusqlite::params![new_status, new_version, claims.sub, now, id],
    ).map_err(|e| AppError::InternalError(e.to_string()))?;

    insert_operation_log(&conn, &id, action, &claims.sub, &claims.role, detail_text);

    let updated = conn
        .query_row(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE id = ?1",
            rusqlite::params![id],
            row_to_appointment,
        )
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    Ok(HttpResponse::Ok().json(updated))
}

fn process_single_review(
    conn: &Connection,
    claims: &AuthClaims,
    id: &str,
    expected_version: i64,
    action: &str,
    comment: Option<&str>,
    batch_id: Option<&str>,
) -> Result<(), AppError> {
    let appointment = conn
        .query_row(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE id = ?1",
            rusqlite::params![id],
            row_to_appointment,
        )
        .map_err(|_| AppError::NotFound("预约单不存在".into()))?;

    validate_status(&["pending_review", "rejected_for_review"], &appointment.status)?;
    validate_version(expected_version, appointment.version)?;

    let evidence = get_evidence_for_appointment(conn, id);

    let (new_status, action_name, detail_text) = match action {
        "approve" => {
            validate_evidence(&evidence)?;
            ("pending_archive", "review_approve", comment.unwrap_or("批量审核通过"))
        }
        "reject" => {
            ("rejected_for_correction", "review_reject", comment.unwrap_or("批量审核退回"))
        }
        _ => return Err(AppError::BadRequest("审核操作必须是 approve 或 reject".into())),
    };

    let now = chrono::Utc::now().to_rfc3339();
    let new_version = appointment.version + 1;

    conn.execute(
        "UPDATE appointments SET status = ?1, version = ?2, updated_by = ?3, updated_at = ?4 WHERE id = ?5",
        rusqlite::params![new_status, new_version, claims.sub, now, id],
    ).map_err(|e| AppError::InternalError(e.to_string()))?;

    insert_operation_log_with_batch(conn, id, action_name, &claims.sub, &claims.role, detail_text, batch_id);
    Ok(())
}

fn persist_batch(
    conn: &Connection,
    batch_id: &str,
    action_type: &str,
    action: &str,
    claims: &AuthClaims,
    comment: Option<&str>,
    results: &[BatchResultItem],
) {
    let total = results.len() as i64;
    let success = results.iter().filter(|r| r.success).count() as i64;
    let fail = total - success;
    let now = chrono::Utc::now().to_rfc3339();

    let _ = conn.execute(
        "INSERT INTO batches (id, action_type, action, operator, operator_role, comment, total_count, success_count, fail_count, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            batch_id, action_type, action, claims.sub, claims.role,
            comment, total, success, fail, now
        ],
    );

    for r in results {
        let success_int: i64 = if r.success { 1 } else { 0 };
        let _ = conn.execute(
            "INSERT INTO batch_items (batch_id, appointment_id, success, error_code, error_message) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                batch_id, r.id, success_int,
                r.error_code.as_deref(), r.error.as_deref()
            ],
        );
    }
}

pub async fn batch_review(
    claims: AuthClaims,
    db: Db,
    body: web::Json<BatchReviewRequest>,
) -> Result<HttpResponse, AppError> {
    validate_role("reviewer", &claims.role)?;

    let conn = db.lock().unwrap();
    let batch_id = generate_batch_id("batch_review");
    let mut results = Vec::new();

    for item in &body.items {
        let result = process_single_review(
            &conn, &claims, &item.id, item.version,
            &body.action, body.comment.as_deref(), Some(&batch_id),
        );
        match result {
            Ok(_) => results.push(BatchResultItem {
                id: item.id.clone(),
                success: true,
                error: None,
                error_code: None,
            }),
            Err(e) => results.push(BatchResultItem {
                id: item.id.clone(),
                success: false,
                error: Some(e.to_string()),
                error_code: Some(e.error_code().to_string()),
            }),
        }
    }

    persist_batch(&conn, &batch_id, "batch_review", &body.action, &claims, body.comment.as_deref(), &results);

    Ok(HttpResponse::Ok().json(BatchResultWithId {
        batch_id,
        results,
    }))
}

pub async fn batch_archive(
    claims: AuthClaims,
    db: Db,
    body: web::Json<BatchArchiveRequest>,
) -> Result<HttpResponse, AppError> {
    validate_role("archivist", &claims.role)?;

    let conn = db.lock().unwrap();
    let batch_id = generate_batch_id("batch_archive");
    let mut results = Vec::new();

    for item in &body.items {
        let result = process_single_archive(
            &conn, &claims, &item.id, item.version,
            &body.action, body.comment.as_deref(), Some(&batch_id),
        );
        match result {
            Ok(_) => results.push(BatchResultItem {
                id: item.id.clone(),
                success: true,
                error: None,
                error_code: None,
            }),
            Err(e) => results.push(BatchResultItem {
                id: item.id.clone(),
                success: false,
                error: Some(e.to_string()),
                error_code: Some(e.error_code().to_string()),
            }),
        }
    }

    persist_batch(&conn, &batch_id, "batch_archive", &body.action, &claims, body.comment.as_deref(), &results);

    Ok(HttpResponse::Ok().json(BatchResultWithId {
        batch_id,
        results,
    }))
}

fn process_single_archive(
    conn: &Connection,
    claims: &AuthClaims,
    id: &str,
    expected_version: i64,
    action: &str,
    comment: Option<&str>,
    batch_id: Option<&str>,
) -> Result<(), AppError> {
    let appointment = conn
        .query_row(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE id = ?1",
            rusqlite::params![id],
            row_to_appointment,
        )
        .map_err(|_| AppError::NotFound("预约单不存在".into()))?;

    validate_status(&["pending_archive"], &appointment.status)?;
    validate_version(expected_version, appointment.version)?;

    let evidence = get_evidence_for_appointment(conn, id);

    let (new_status, action_name, detail_text) = match action {
        "approve" | "archive" => {
            validate_evidence(&evidence)?;
            ("archived", "archive_approve", comment.unwrap_or("批量归档完成"))
        }
        "reject" => {
            ("rejected_for_review", "archive_reject", comment.unwrap_or("批量复核退回"))
        }
        _ => return Err(AppError::BadRequest("归档操作必须是 archive 或 reject".into())),
    };

    let now = chrono::Utc::now().to_rfc3339();
    let new_version = appointment.version + 1;

    conn.execute(
        "UPDATE appointments SET status = ?1, version = ?2, updated_by = ?3, updated_at = ?4 WHERE id = ?5",
        rusqlite::params![new_status, new_version, claims.sub, now, id],
    ).map_err(|e| AppError::InternalError(e.to_string()))?;

    insert_operation_log_with_batch(conn, id, action_name, &claims.sub, &claims.role, detail_text, batch_id);
    Ok(())
}

pub async fn list_batches(
    _claims: AuthClaims,
    db: Db,
    q: web::Query<BatchListQuery>,
) -> Result<HttpResponse, AppError> {
    let conn = db.lock().unwrap();
    let limit = q.limit.unwrap_or(20).min(100);
    let mut sql = "SELECT id, action_type, action, operator, operator_role, comment, total_count, success_count, fail_count, created_at FROM batches".to_string();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref action_type) = q.action_type {
        if params.is_empty() {
            sql.push_str(" WHERE");
        }
        params.push(Box::new(action_type.clone()));
        sql.push_str(&format!(" action_type = ?{}", params.len()));
    }

    sql.push_str(" ORDER BY created_at DESC LIMIT ?");
    params.push(Box::new(limit));

    let mut stmt = conn.prepare(&sql).map_err(|e| AppError::InternalError(e.to_string()))?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt.query_map(params_refs.as_slice(), |row| {
        Ok(BatchSummary {
            id: row.get("id")?,
            action_type: row.get("action_type")?,
            action: row.get("action")?,
            operator: row.get("operator")?,
            operator_role: row.get("operator_role")?,
            comment: row.get("comment")?,
            total_count: row.get("total_count")?,
            success_count: row.get("success_count")?,
            fail_count: row.get("fail_count")?,
            created_at: row.get("created_at")?,
        })
    }).map_err(|e| AppError::InternalError(e.to_string()))?;

    let mut batches = Vec::new();
    for row in rows {
        batches.push(row.map_err(|e| AppError::InternalError(e.to_string()))?);
    }
    Ok(HttpResponse::Ok().json(batches))
}

pub async fn get_batch_detail(
    _claims: AuthClaims,
    db: Db,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let batch_id = path.into_inner();
    let conn = db.lock().unwrap();

    let batch = conn.query_row(
        "SELECT id, action_type, action, operator, operator_role, comment, total_count, success_count, fail_count, created_at FROM batches WHERE id = ?1",
        rusqlite::params![&batch_id],
        |row| {
            Ok(BatchDetail {
                id: row.get("id")?,
                action_type: row.get("action_type")?,
                action: row.get("action")?,
                operator: row.get("operator")?,
                operator_role: row.get("operator_role")?,
                comment: row.get("comment")?,
                total_count: row.get("total_count")?,
                success_count: row.get("success_count")?,
                fail_count: row.get("fail_count")?,
                created_at: row.get("created_at")?,
                items: Vec::new(),
            })
        },
    ).map_err(|_| AppError::NotFound("批次不存在".into()))?;

    let mut stmt = conn.prepare(
        "SELECT id, appointment_id, success, error_code, error_message FROM batch_items WHERE batch_id = ?1 ORDER BY id"
    ).map_err(|e| AppError::InternalError(e.to_string()))?;
    let rows = stmt.query_map(rusqlite::params![&batch_id], |row| {
        let success_int: i64 = row.get("success")?;
        Ok(BatchDetailItem {
            id: row.get::<_, i64>("id")?.to_string(),
            appointment_id: row.get("appointment_id")?,
            success: success_int == 1,
            error_code: row.get("error_code")?,
            error_message: row.get("error_message")?,
        })
    }).map_err(|e| AppError::InternalError(e.to_string()))?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| AppError::InternalError(e.to_string()))?);
    }

    Ok(HttpResponse::Ok().json(BatchDetail { items, ..batch }))
}

pub async fn list_evidence(
    claims: AuthClaims,
    db: Db,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let _ = claims;
    let id = path.into_inner();
    let conn = db.lock().unwrap();

    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM appointments WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if exists == 0 {
        return Err(AppError::NotFound("预约单不存在".into()));
    }

    let evidence = get_evidence_for_appointment(&conn, &id);
    Ok(HttpResponse::Ok().json(evidence))
}

pub async fn add_evidence(
    claims: AuthClaims,
    db: Db,
    path: web::Path<String>,
    body: web::Json<CreateEvidenceRequest>,
) -> Result<HttpResponse, AppError> {
    validate_role("registrar", &claims.role)?;

    let id = path.into_inner();
    let conn = db.lock().unwrap();

    let appointment = conn
        .query_row(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE id = ?1",
            rusqlite::params![id],
            row_to_appointment,
        )
        .map_err(|_| AppError::NotFound("预约单不存在".into()))?;

    if appointment.status == "archived" {
        return Err(AppError::WrongStatus("已归档的单据不能添加证据".into()));
    }

    let valid_types = ["reservation", "check_in", "data_recovery"];
    if !valid_types.contains(&body.evidence_type.as_str()) {
        return Err(AppError::BadRequest(
            "证据类型必须是 reservation、check_in 或 data_recovery".into(),
        ));
    }

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO evidence (appointment_id, type, content, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, body.evidence_type, body.content, claims.sub, now],
    ).map_err(|e| AppError::InternalError(e.to_string()))?;

    let evidence_id = conn.last_insert_rowid();

    insert_operation_log(
        &conn,
        &id,
        "add_evidence",
        &claims.sub,
        &claims.role,
        &format!("添加证据: {}", body.evidence_type),
    );

    let evidence = conn
        .query_row(
            "SELECT id, appointment_id, type, content, created_by, created_at FROM evidence WHERE id = ?1",
            rusqlite::params![evidence_id],
            row_to_evidence,
        )
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    Ok(HttpResponse::Created().json(evidence))
}
