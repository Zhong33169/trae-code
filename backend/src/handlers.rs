use actix_web::{web, HttpResponse};
use std::sync::Mutex;
use rusqlite::Connection;
use crate::models::*;
use crate::auth::{verify_password, generate_token};
use crate::middleware::AuthClaims;
use crate::workflow::*;
use crate::errors::AppError;

type Db = web::Data<Mutex<Connection>>;

fn row_to_appointment(row: &rusqlite::Row) -> rusqlite::Result<Appointment> {
    Ok(Appointment {
        id: row.get("id")?,
        visitor_name: row.get("visitor_name")?,
        visitor_phone: row.get("visitor_phone")?,
        visitor_id_number: row.get("visitor_id_number")?,
        exhibition_name: row.get("exhibition_name")?,
        status: row.get("status")?,
        version: row.get("version")?,
        created_by: row.get("created_by")?,
        updated_by: row.get("updated_by")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn row_to_evidence(row: &rusqlite::Row) -> rusqlite::Result<Evidence> {
    Ok(Evidence {
        id: row.get("id")?,
        appointment_id: row.get("appointment_id")?,
        evidence_type: row.get("type")?,
        content: row.get("content")?,
        created_by: row.get("created_by")?,
        created_at: row.get("created_at")?,
    })
}

fn row_to_operation_log(row: &rusqlite::Row) -> rusqlite::Result<OperationLog> {
    Ok(OperationLog {
        id: row.get("id")?,
        appointment_id: row.get("appointment_id")?,
        action: row.get("action")?,
        operator: row.get("operator")?,
        operator_role: row.get("operator_role")?,
        detail: row.get("detail")?,
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

fn get_logs_for_appointment(conn: &Connection, apt_id: &str) -> Vec<OperationLog> {
    let mut stmt = conn.prepare(
        "SELECT id, appointment_id, action, operator, operator_role, detail, timestamp FROM operation_logs WHERE appointment_id = ?1 ORDER BY id"
    ).unwrap();
    stmt.query_map(rusqlite::params![apt_id], row_to_operation_log)
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
}

fn insert_operation_log(
    conn: &Connection,
    appointment_id: &str,
    action: &str,
    operator: &str,
    operator_role: &str,
    detail: &str,
) {
    let now = chrono::Utc::now().to_rfc3339();
    let _ = conn.execute(
        "INSERT INTO operation_logs (appointment_id, action, operator, operator_role, detail, timestamp) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![appointment_id, action, operator, operator_role, detail, now],
    );
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
                role,
                display_name,
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
    let page_size = query.page_size.unwrap_or(10).max(1).min(100);
    let offset = (page - 1) * page_size;

    let (total, items) = if let Some(ref status) = query.status {
        let total: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM appointments WHERE status = ?1",
                rusqlite::params![status],
                |row| row.get(0),
            )
            .unwrap_or(0);
        let mut stmt = conn.prepare(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE status = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
        ).map_err(|e| AppError::InternalError(e.to_string()))?;
        let items: Vec<Appointment> = stmt
            .query_map(rusqlite::params![status, page_size, offset], row_to_appointment)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        (total, items)
    } else {
        let total: i64 = conn
            .query_row("SELECT COUNT(*) FROM appointments", [], |row| row.get(0))
            .unwrap_or(0);
        let mut stmt = conn.prepare(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments ORDER BY created_at DESC LIMIT ?1 OFFSET ?2"
        ).map_err(|e| AppError::InternalError(e.to_string()))?;
        let items: Vec<Appointment> = stmt
            .query_map(rusqlite::params![page_size, offset], row_to_appointment)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        (total, items)
    };

    Ok(HttpResponse::Ok().json(AppointmentListResponse {
        items,
        total,
        page,
        page_size,
    }))
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

    let evidence = get_evidence_for_appointment(&conn, &id);
    let operation_logs = get_logs_for_appointment(&conn, &id);

    Ok(HttpResponse::Ok().json(AppointmentDetail {
        id: appointment.id,
        visitor_name: appointment.visitor_name,
        visitor_phone: appointment.visitor_phone,
        visitor_id_number: appointment.visitor_id_number,
        exhibition_name: appointment.exhibition_name,
        status: appointment.status,
        version: appointment.version,
        created_by: appointment.created_by,
        updated_by: appointment.updated_by,
        created_at: appointment.created_at,
        updated_at: appointment.updated_at,
        evidence,
        operation_logs,
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
        "approve" => {
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
                "归档操作必须是 approve 或 reject".into(),
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

pub async fn batch_review(
    claims: AuthClaims,
    db: Db,
    body: web::Json<BatchReviewRequest>,
) -> Result<HttpResponse, AppError> {
    validate_role("reviewer", &claims.role)?;

    let conn = db.lock().unwrap();
    let mut results = Vec::new();

    for item in &body.items {
        let result = process_single_review(&conn, &claims, item);
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

    Ok(HttpResponse::Ok().json(BatchResult { results }))
}

fn process_single_review(
    conn: &Connection,
    claims: &AuthClaims,
    item: &BatchReviewItem,
) -> Result<(), AppError> {
    let appointment = conn
        .query_row(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE id = ?1",
            rusqlite::params![item.id],
            row_to_appointment,
        )
        .map_err(|_| AppError::NotFound("预约单不存在".into()))?;

    validate_status(&["pending_review", "rejected_for_review"], &appointment.status)?;
    validate_version(item.version, appointment.version)?;

    let evidence = get_evidence_for_appointment(conn, &item.id);

    let (new_status, action, detail_text) = match item.action.as_str() {
        "approve" => {
            validate_evidence(&evidence)?;
            ("pending_archive", "review_approve", item.detail.as_deref().unwrap_or("审核通过"))
        }
        "reject" => {
            ("rejected_for_correction", "review_reject", item.detail.as_deref().unwrap_or("审核退回"))
        }
        _ => return Err(AppError::BadRequest("审核操作必须是 approve 或 reject".into())),
    };

    let now = chrono::Utc::now().to_rfc3339();
    let new_version = appointment.version + 1;

    conn.execute(
        "UPDATE appointments SET status = ?1, version = ?2, updated_by = ?3, updated_at = ?4 WHERE id = ?5",
        rusqlite::params![new_status, new_version, claims.sub, now, item.id],
    ).map_err(|e| AppError::InternalError(e.to_string()))?;

    insert_operation_log(conn, &item.id, action, &claims.sub, &claims.role, detail_text);
    Ok(())
}

pub async fn batch_archive(
    claims: AuthClaims,
    db: Db,
    body: web::Json<BatchArchiveRequest>,
) -> Result<HttpResponse, AppError> {
    validate_role("archivist", &claims.role)?;

    let conn = db.lock().unwrap();
    let mut results = Vec::new();

    for item in &body.items {
        let result = process_single_archive(&conn, &claims, item);
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

    Ok(HttpResponse::Ok().json(BatchResult { results }))
}

fn process_single_archive(
    conn: &Connection,
    claims: &AuthClaims,
    item: &BatchArchiveItem,
) -> Result<(), AppError> {
    let appointment = conn
        .query_row(
            "SELECT id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at FROM appointments WHERE id = ?1",
            rusqlite::params![item.id],
            row_to_appointment,
        )
        .map_err(|_| AppError::NotFound("预约单不存在".into()))?;

    validate_status(&["pending_archive"], &appointment.status)?;
    validate_version(item.version, appointment.version)?;

    let evidence = get_evidence_for_appointment(conn, &item.id);

    let (new_status, action, detail_text) = match item.action.as_str() {
        "approve" => {
            validate_evidence(&evidence)?;
            ("archived", "archive_approve", item.detail.as_deref().unwrap_or("归档完成"))
        }
        "reject" => {
            ("rejected_for_review", "archive_reject", item.detail.as_deref().unwrap_or("复核退回"))
        }
        _ => return Err(AppError::BadRequest("归档操作必须是 approve 或 reject".into())),
    };

    let now = chrono::Utc::now().to_rfc3339();
    let new_version = appointment.version + 1;

    conn.execute(
        "UPDATE appointments SET status = ?1, version = ?2, updated_by = ?3, updated_at = ?4 WHERE id = ?5",
        rusqlite::params![new_status, new_version, claims.sub, now, item.id],
    ).map_err(|e| AppError::InternalError(e.to_string()))?;

    insert_operation_log(conn, &item.id, action, &claims.sub, &claims.role, detail_text);
    Ok(())
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
