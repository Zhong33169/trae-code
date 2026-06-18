use crate::auth::{current_user, login, require_role};
use crate::db::get_conn;
use crate::models::*;
use anyhow::{anyhow, Result};
use poem::handler;
use poem::web::{Json, Path, Query};
use poem::Request;
use rusqlite::params;
use serde_json::Value;
use std::collections::HashMap;

fn row_to_user(row: &rusqlite::Row) -> rusqlite::Result<User> {
    Ok(User {
        id: row.get(0)?,
        username: row.get(1)?,
        role: row.get(2)?,
        display_name: row.get(3)?,
        created_at: row.get(4)?,
    })
}

fn row_to_topic(row: &rusqlite::Row) -> rusqlite::Result<Topic> {
    Ok(Topic {
        id: row.get(0)?,
        topic_no: row.get(1)?,
        title: row.get(2)?,
        source: row.get(3)?,
        reporter: row.get(4)?,
        department: row.get(5)?,
        deadline: row.get(6)?,
        status: row.get(7)?,
        content: row.get(8)?,
        register_id: row.get(9)?,
        register_name: row.get(10)?,
        register_at: row.get(11)?,
        reviewer_id: row.get(12)?,
        reviewer_name: row.get(13)?,
        review_at: row.get(14)?,
        review_result: row.get(15)?,
        review_comment: row.get(16)?,
        archiver_id: row.get(17)?,
        archiver_name: row.get(18)?,
        archive_at: row.get(19)?,
        archive_comment: row.get(20)?,
        reject_reason: row.get(21)?,
        anomaly_tag: row.get(22)?,
        created_from: row.get(23)?,
        import_batch_id: row.get(24)?,
    })
}

fn row_to_attachment(row: &rusqlite::Row) -> rusqlite::Result<Attachment> {
    Ok(Attachment {
        id: row.get(0)?,
        topic_id: row.get(1)?,
        filename: row.get(2)?,
        file_type: row.get(3)?,
        file_size: row.get(4)?,
        uploaded_by: row.get(5)?,
        uploaded_by_name: row.get(6)?,
        uploaded_at: row.get(7)?,
    })
}

fn row_to_import_batch(row: &rusqlite::Row) -> rusqlite::Result<ImportBatch> {
    Ok(ImportBatch {
        id: row.get(0)?,
        batch_no: row.get(1)?,
        source: row.get(2)?,
        operator_id: row.get(3)?,
        operator_name: row.get(4)?,
        imported_at: row.get(5)?,
        total_count: row.get(6)?,
        success_count: row.get(7)?,
        conflict_count: row.get(8)?,
        error_count: row.get(9)?,
        remark: row.get(10)?,
    })
}

fn row_to_import_record(row: &rusqlite::Row) -> rusqlite::Result<ImportRecord> {
    Ok(ImportRecord {
        id: row.get(0)?,
        batch_id: row.get(1)?,
        topic_no: row.get(2)?,
        title: row.get(3)?,
        status: row.get(4)?,
        diff_json: row.get(5)?,
        error_msg: row.get(6)?,
        topic_id: row.get(7)?,
        process_status: row.get(8).unwrap_or_else(|_| "pending".to_string()),
        process_remark: row.get(9).unwrap_or(None),
        processed_by: row.get(10).unwrap_or(None),
        processed_by_name: row.get(11).unwrap_or(None),
        processed_at: row.get(12).unwrap_or(None),
    })
}

fn row_to_audit(row: &rusqlite::Row) -> rusqlite::Result<AuditLog> {
    Ok(AuditLog {
        id: row.get(0)?,
        topic_id: row.get(1)?,
        import_batch_id: row.get(2)?,
        user_id: row.get(3)?,
        user_name: row.get(4)?,
        action: row.get(5)?,
        old_status: row.get(6)?,
        new_status: row.get(7)?,
        detail: row.get(8)?,
        created_at: row.get(9)?,
    })
}

pub fn write_audit(
    topic_id: Option<&str>,
    import_batch_id: Option<&str>,
    user_id: &str,
    user_name: &str,
    action: &str,
    old_status: Option<&str>,
    new_status: Option<&str>,
    detail: Option<&str>,
) -> Result<()> {
    let conn = get_conn();
    conn.execute(
        "INSERT INTO audit_logs (id, topic_id, import_batch_id, user_id, user_name, action, old_status, new_status, detail, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            new_uuid(),
            topic_id,
            import_batch_id,
            user_id,
            user_name,
            action,
            old_status,
            new_status,
            detail,
            now_str(),
        ],
    )?;
    Ok(())
}

const TOPIC_SELECT_SQL: &str = r#"
    SELECT t.id, t.topic_no, t.title, t.source, t.reporter, t.department, t.deadline, t.status,
           t.content, t.register_id, ru.display_name, t.register_at,
           t.reviewer_id, rv.display_name, t.review_at, t.review_result, t.review_comment,
           t.archiver_id, ar.display_name, t.archive_at, t.archive_comment,
           t.reject_reason, t.anomaly_tag, t.created_from, t.import_batch_id
    FROM topics t
    LEFT JOIN users ru ON t.register_id = ru.id
    LEFT JOIN users rv ON t.reviewer_id = rv.id
    LEFT JOIN users ar ON t.archiver_id = ar.id
"#;

pub fn get_topic_by_id(id: &str) -> Result<Topic> {
    let conn = get_conn();
    let sql = format!("{} WHERE t.id = ?1", TOPIC_SELECT_SQL);
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query(params![id])?;
    let row = rows.next()?.ok_or_else(|| anyhow!("选题单不存在"))?;
    row_to_topic(&row).map_err(|e| anyhow!(e))
}

fn classify_anomaly(deadline: &Option<String>) -> String {
    if let Some(d) = deadline {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(d) {
            if dt < chrono::Utc::now() {
                return "overdue".to_string();
            }
        }
    }
    "normal".to_string()
}

// ======= Handlers =======

#[handler]
pub async fn handle_login(Json(req): Json<LoginRequest>) -> Json<ApiResponse<LoginResponse>> {
    match login(&req.username, &req.password) {
        Ok((token, user)) => json_ok(LoginResponse { token, user }),
        Err(e) => json_err(&e.to_string()),
    }
}

#[handler]
pub async fn handle_me(req: &Request) -> Json<ApiResponse<User>> {
    match current_user(req) {
        Ok(u) => json_ok(u),
        Err(e) => json_err(&e.to_string()),
    }
}

#[handler]
pub async fn handle_list_users(req: &Request) -> Json<ApiResponse<Vec<User>>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };
    if let Err(e) = require_role(&user, &["registrar", "reviewer", "archiver"]) {
        return json_err(&e.to_string());
    }
    let conn = get_conn();
    let mut stmt = conn
        .prepare("SELECT id, username, role, display_name, created_at FROM users ORDER BY created_at")
        .unwrap();
    let rows: Vec<User> = stmt
        .query_map([], |row| row_to_user(row))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    json_ok(rows)
}

#[derive(serde::Deserialize)]
pub struct TopicListQuery {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub anomaly: Option<String>,
    #[serde(default)]
    pub keyword: Option<String>,
}

#[handler]
pub async fn handle_list_topics(
    req: &Request,
    Query(q): Query<TopicListQuery>,
) -> Json<ApiResponse<Vec<Topic>>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };
    if let Err(e) = require_role(&user, &["registrar", "reviewer", "archiver"]) {
        return json_err(&e.to_string());
    }
    let conn = get_conn();
    let mut where_clauses: Vec<String> = Vec::new();
    let mut params_vec: Vec<String> = Vec::new();

    if let Some(s) = q.status {
        if !s.is_empty() {
            where_clauses.push("t.status = ?".to_string());
            params_vec.push(s);
        }
    }
    if let Some(a) = q.anomaly {
        if !a.is_empty() {
            where_clauses.push("t.anomaly_tag = ?".to_string());
            params_vec.push(a);
        }
    }
    if let Some(k) = q.keyword {
        if !k.is_empty() {
            where_clauses
                .push("(t.title LIKE ? OR t.topic_no LIKE ? OR t.reporter LIKE ?)".to_string());
            params_vec.push(format!("%{}%", k));
            params_vec.push(format!("%{}%", k));
            params_vec.push(format!("%{}%", k));
        }
    }

    let full_sql = if where_clauses.is_empty() {
        format!("{} ORDER BY t.register_at DESC", TOPIC_SELECT_SQL)
    } else {
        format!(
            "{} WHERE {} ORDER BY t.register_at DESC",
            TOPIC_SELECT_SQL,
            where_clauses.join(" AND ")
        )
    };

    let mut stmt = conn.prepare(&full_sql).unwrap();
    let rows: Vec<Topic> = stmt
        .query_map(rusqlite::params_from_iter(params_vec.iter()), |row| {
            row_to_topic(row)
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    json_ok(rows)
}

#[handler]
pub async fn handle_get_topic(
    req: &Request,
    Path(id): Path<String>,
) -> Json<ApiResponse<Topic>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };
    if let Err(e) = require_role(&user, &["registrar", "reviewer", "archiver"]) {
        return json_err(&e.to_string());
    }
    match get_topic_by_id(&id) {
        Ok(t) => json_ok(t),
        Err(e) => json_err(&e.to_string()),
    }
}

#[handler]
pub async fn handle_create_topic(
    req: &Request,
    Json(body): Json<CreateTopicRequest>,
) -> Json<ApiResponse<Topic>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };
    if let Err(e) = require_role(&user, &["registrar"]) {
        return json_err(&e.to_string());
    }
    let conn = get_conn();
    let id = new_uuid();
    let now = now_str();
    let anomaly = body
        .anomaly_tag
        .clone()
        .unwrap_or_else(|| classify_anomaly(&body.deadline));

    if let Err(e) = conn.execute(
        "INSERT INTO topics (id, topic_no, title, source, reporter, department, deadline, status, content, register_id, register_at, anomaly_tag, created_from) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'online')",
        params![
            id,
            body.topic_no,
            body.title,
            body.source,
            body.reporter,
            body.department,
            body.deadline,
            "registered",
            body.content,
            user.id,
            now,
            anomaly,
        ],
    ) {
        return json_err(&e.to_string());
    }

    write_audit(
        Some(&id),
        None,
        &user.id,
        &user.display_name,
        "create",
        None,
        Some("registered"),
        Some("选题登记员发起选题登记"),
    )
    .ok();

    match get_topic_by_id(&id) {
        Ok(t) => json_ok(t),
        Err(e) => json_err(&e.to_string()),
    }
}

#[handler]
pub async fn handle_review_topic(
    req: &Request,
    Path(id): Path<String>,
    Json(body): Json<ReviewRequest>,
) -> Json<ApiResponse<Topic>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };
    if let Err(e) = require_role(&user, &["reviewer"]) {
        return json_err(&e.to_string());
    }
    let topic = match get_topic_by_id(&id) {
        Ok(t) => t,
        Err(e) => return json_err(&e.to_string()),
    };
    if topic.status != "registered" {
        return json_err("仅 registered 状态可审核");
    }

    let conn = get_conn();
    let now = now_str();
    let new_status = if body.result == "approved" {
        "reviewed"
    } else {
        "rejected"
    };

    if let Err(e) = conn.execute(
        "UPDATE topics SET status = ?1, reviewer_id = ?2, review_at = ?3, review_result = ?4, review_comment = ?5, reject_reason = ?6, anomaly_tag = CASE WHEN ?7 = 'rejected' THEN 'rejected' ELSE anomaly_tag END WHERE id = ?8",
        params![
            new_status,
            user.id,
            now,
            body.result,
            body.comment,
            body.reject_reason,
            new_status,
            id,
        ],
    ) {
        return json_err(&e.to_string());
    }

    let detail = if new_status == "reviewed" {
        format!(
            "选题审核主管审核通过：{}",
            body.comment.clone().unwrap_or_default()
        )
    } else {
        format!(
            "选题审核主管退回：{}",
            body.reject_reason.clone().unwrap_or_default()
        )
    };
    write_audit(
        Some(&id),
        None,
        &user.id,
        &user.display_name,
        if new_status == "reviewed" { "approve" } else { "reject" },
        Some("registered"),
        Some(new_status),
        Some(&detail),
    )
    .ok();

    match get_topic_by_id(&id) {
        Ok(t) => json_ok(t),
        Err(e) => json_err(&e.to_string()),
    }
}

#[handler]
pub async fn handle_archive_topic(
    req: &Request,
    Path(id): Path<String>,
    Json(body): Json<ArchiveRequest>,
) -> Json<ApiResponse<Topic>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };
    if let Err(e) = require_role(&user, &["archiver"]) {
        return json_err(&e.to_string());
    }
    let topic = match get_topic_by_id(&id) {
        Ok(t) => t,
        Err(e) => return json_err(&e.to_string()),
    };
    if topic.status != "reviewed" {
        return json_err("仅 reviewed 状态可复核归档");
    }

    let conn = get_conn();
    let now = now_str();
    if let Err(e) = conn.execute(
        "UPDATE topics SET status = 'archived', archiver_id = ?1, archive_at = ?2, archive_comment = ?3 WHERE id = ?4",
        params![user.id, now, body.comment, id],
    ) {
        return json_err(&e.to_string());
    }

    write_audit(
        Some(&id),
        None,
        &user.id,
        &user.display_name,
        "archive",
        Some("reviewed"),
        Some("archived"),
        Some(&format!(
            "新闻采编中心复核归档：{}",
            body.comment.clone().unwrap_or_default()
        )),
    )
    .ok();

    match get_topic_by_id(&id) {
        Ok(t) => json_ok(t),
        Err(e) => json_err(&e.to_string()),
    }
}

#[handler]
pub async fn handle_rectify_topic(
    req: &Request,
    Path(id): Path<String>,
    Json(body): Json<CreateTopicRequest>,
) -> Json<ApiResponse<Topic>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };
    if let Err(e) = require_role(&user, &["registrar"]) {
        return json_err(&e.to_string());
    }
    let topic = match get_topic_by_id(&id) {
        Ok(t) => t,
        Err(e) => return json_err(&e.to_string()),
    };
    if topic.status != "rejected" {
        return json_err("仅 rejected 状态可补正");
    }

    let conn = get_conn();
    let anomaly = body
        .anomaly_tag
        .clone()
        .unwrap_or_else(|| classify_anomaly(&body.deadline));

    if let Err(e) = conn.execute(
        "UPDATE topics SET topic_no = ?1, title = ?2, source = ?3, reporter = ?4, department = ?5, deadline = ?6, content = ?7, status = 'registered', reject_reason = NULL, anomaly_tag = ?8, reviewer_id = NULL, review_at = NULL, review_result = NULL, review_comment = NULL WHERE id = ?9",
        params![
            body.topic_no,
            body.title,
            body.source,
            body.reporter,
            body.department,
            body.deadline,
            body.content,
            anomaly,
            id,
        ],
    ) {
        return json_err(&e.to_string());
    }

    write_audit(
        Some(&id),
        None,
        &user.id,
        &user.display_name,
        "rectify",
        Some("rejected"),
        Some("registered"),
        Some("选题登记员补正后重新发起登记"),
    )
    .ok();

    match get_topic_by_id(&id) {
        Ok(t) => json_ok(t),
        Err(e) => json_err(&e.to_string()),
    }
}

#[handler]
pub async fn handle_list_attachments(
    req: &Request,
    Path(id): Path<String>,
) -> Json<ApiResponse<Vec<Attachment>>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };
    if let Err(e) = require_role(&user, &["registrar", "reviewer", "archiver"]) {
        return json_err(&e.to_string());
    }
    let conn = get_conn();
    let mut stmt = conn
        .prepare(
            r#"SELECT a.id, a.topic_id, a.filename, a.file_type, a.file_size, a.uploaded_by, u.display_name, a.uploaded_at
               FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id
               WHERE a.topic_id = ?1 ORDER BY a.uploaded_at"#,
        )
        .unwrap();
    let rows: Vec<Attachment> = stmt
        .query_map(params![id], |row| row_to_attachment(row))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    json_ok(rows)
}

#[handler]
pub async fn handle_add_attachment(
    req: &Request,
    Path(id): Path<String>,
    Json(body): Json<AttachmentCreateReq>,
) -> Json<ApiResponse<Attachment>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };
    if let Err(e) = require_role(&user, &["registrar", "reviewer", "archiver"]) {
        return json_err(&e.to_string());
    }
    let conn = get_conn();
    let aid = new_uuid();
    let now = now_str();
    if let Err(e) = conn.execute(
        "INSERT INTO attachments (id, topic_id, filename, file_type, file_size, uploaded_by, uploaded_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![aid, id, body.filename, body.file_type, body.file_size, user.id, now],
    ) {
        return json_err(&e.to_string());
    }
    write_audit(
        Some(&id),
        None,
        &user.id,
        &user.display_name,
        "upload_attachment",
        None,
        None,
        Some(&format!("上传附件：{}", body.filename)),
    )
    .ok();

    let mut stmt = conn
        .prepare(
            r#"SELECT a.id, a.topic_id, a.filename, a.file_type, a.file_size, a.uploaded_by, u.display_name, a.uploaded_at
               FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id WHERE a.id = ?1"#,
        )
        .unwrap();
    let attachment = stmt
        .query_row(params![aid], |row| row_to_attachment(row))
        .unwrap();
    json_ok(attachment)
}

#[handler]
pub async fn handle_list_batches(req: &Request) -> Json<ApiResponse<Vec<ImportBatch>>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };
    if let Err(e) = require_role(&user, &["registrar", "reviewer", "archiver"]) {
        return json_err(&e.to_string());
    }
    let conn = get_conn();
    let mut stmt = conn
        .prepare(
            r#"SELECT b.id, b.batch_no, b.source, b.operator_id, u.display_name, b.imported_at,
                      b.total_count, b.success_count, b.conflict_count, b.error_count, b.remark
               FROM import_batches b LEFT JOIN users u ON b.operator_id = u.id
               ORDER BY b.imported_at DESC"#,
        )
        .unwrap();
    let rows: Vec<ImportBatch> = stmt
        .query_map([], |row| row_to_import_batch(row))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    json_ok(rows)
}

#[handler]
pub async fn handle_batch_records(
    req: &Request,
    Path(id): Path<String>,
) -> Json<ApiResponse<Vec<ImportRecord>>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };
    if let Err(e) = require_role(&user, &["registrar", "reviewer", "archiver"]) {
        return json_err(&e.to_string());
    }
    let conn = get_conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, batch_id, topic_no, title, status, diff_json, error_msg, topic_id, process_status, process_remark, processed_by, processed_by_name, processed_at FROM import_records WHERE batch_id = ?1 ORDER BY id",
        )
        .unwrap();
    let rows: Vec<ImportRecord> = stmt
        .query_map(params![id], |row| row_to_import_record(row))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    json_ok(rows)
}

#[handler]
pub async fn handle_execute_import(
    req: &Request,
    Json(body): Json<ImportRequest>,
) -> Json<ApiResponse<ImportResult>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };
    if let Err(e) = require_role(&user, &["registrar"]) {
        return json_err(&e.to_string());
    }
    let conn = get_conn();
    let batch_id = new_uuid();
    let batch_no = format!("IMP{}", chrono::Utc::now().format("%Y%m%d%H%M%S"));
    let now = now_str();

    let mut success_count = 0i64;
    let mut conflict_count = 0i64;
    let mut error_count = 0i64;
    let mut records: Vec<ImportRecord> = Vec::new();

    for item in &body.items {
        let record_id = new_uuid();
        let exists: i64 = match conn.query_row(
            "SELECT COUNT(*) FROM topics WHERE topic_no = ?1",
            params![item.topic_no],
            |row| row.get(0),
        ) {
            Ok(v) => v,
            Err(_) => 0,
        };

        if exists > 0 {
            conflict_count += 1;
            let diff = compute_diff(&conn, item);
            let existing_topic_id: Option<String> = conn
                .query_row(
                    "SELECT id FROM topics WHERE topic_no = ?1",
                    params![item.topic_no],
                    |row| row.get(0),
                )
                .ok();
            conn.execute(
                "INSERT INTO import_records (id, batch_id, topic_no, title, status, diff_json, error_msg, topic_id, process_status, process_remark, processed_by, processed_by_name, processed_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'pending',NULL,NULL,NULL,NULL)",
                params![
                    record_id,
                    batch_id,
                    item.topic_no,
                    item.title,
                    "conflict",
                    diff.clone(),
                    "选题单编号已存在，存在线上线下状态冲突或重复回填，未覆盖",
                    existing_topic_id,
                ],
            )
            .ok();
            records.push(ImportRecord {
                id: record_id,
                batch_id: batch_id.clone(),
                topic_no: item.topic_no.clone(),
                title: Some(item.title.clone()),
                status: "conflict".to_string(),
                diff_json: diff.clone(),
                error_msg: Some("选题单编号已存在，存在线上线下状态冲突或重复回填，未覆盖".to_string()),
                topic_id: existing_topic_id.clone(),
                process_status: "pending".to_string(),
                process_remark: None,
                processed_by: None,
                processed_by_name: None,
                processed_at: None,
            });
            write_audit(
                existing_topic_id.as_deref(),
                Some(&batch_id),
                &user.id,
                &user.display_name,
                "import_conflict",
                None,
                None,
                Some(&format!(
                    "离线台账回填冲突：选题单 {} 已存在，未覆盖",
                    item.topic_no
                )),
            )
            .ok();
            continue;
        }

        let topic_id = new_uuid();
        let anomaly = item
            .anomaly_tag
            .clone()
            .unwrap_or_else(|| classify_anomaly(&item.deadline));
        let status = item
            .status
            .clone()
            .unwrap_or_else(|| "registered".to_string());
        let valid_statuses = ["registered", "reviewed", "archived", "rejected"];
        if !valid_statuses.contains(&status.as_str()) {
            error_count += 1;
            conn.execute(
                "INSERT INTO import_records (id, batch_id, topic_no, title, status, diff_json, error_msg, topic_id, process_status, process_remark, processed_by, processed_by_name, processed_at) VALUES (?1,?2,?3,?4,?5,?6,?7,NULL,'pending',NULL,NULL,NULL,NULL)",
                params![
                    record_id,
                    batch_id,
                    item.topic_no,
                    item.title,
                    "error",
                    Option::<String>::None,
                    format!("非法状态值：{}", status),
                ],
            )
            .ok();
            records.push(ImportRecord {
                id: record_id,
                batch_id: batch_id.clone(),
                topic_no: item.topic_no.clone(),
                title: Some(item.title.clone()),
                status: "error".to_string(),
                diff_json: None,
                error_msg: Some(format!("非法状态值：{}", status)),
                topic_id: None,
                process_status: "pending".to_string(),
                process_remark: None,
                processed_by: None,
                processed_by_name: None,
                processed_at: None,
            });
            write_audit(
                None,
                Some(&batch_id),
                &user.id,
                &user.display_name,
                "import_error",
                None,
                None,
                Some(&format!(
                    "离线台账回填失败：选题单 {}，非法状态值：{}",
                    item.topic_no, status
                )),
            )
            .ok();
            continue;
        }

        match conn.execute(
            "INSERT INTO topics (id, topic_no, title, source, reporter, department, deadline, status, content, register_id, register_at, anomaly_tag, created_from, import_batch_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'offline',?13)",
            params![
                topic_id,
                item.topic_no,
                item.title,
                item.source.clone().unwrap_or_else(|| "离线台账导入".to_string()),
                item.reporter
                    .clone()
                    .or_else(|| item.reporter_name.clone())
                    .unwrap_or_else(|| "待补录".to_string()),
                item.department,
                item.deadline,
                status,
                item.content,
                user.id,
                now,
                anomaly,
                batch_id,
            ],
        ) {
            Ok(_) => {
                success_count += 1;
                conn.execute(
                    "INSERT INTO import_records (id, batch_id, topic_no, title, status, diff_json, error_msg, topic_id, process_status, process_remark, processed_by, processed_by_name, processed_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'not_applicable',NULL,NULL,NULL,NULL)",
                    params![
                        record_id,
                        batch_id,
                        item.topic_no,
                        item.title,
                        "success",
                        Option::<String>::None,
                        Option::<String>::None,
                        topic_id,
                    ],
                )
                .ok();
                records.push(ImportRecord {
                    id: record_id,
                    batch_id: batch_id.clone(),
                    topic_no: item.topic_no.clone(),
                    title: Some(item.title.clone()),
                    status: "success".to_string(),
                    diff_json: None,
                    error_msg: None,
                    topic_id: Some(topic_id.clone()),
                    process_status: "not_applicable".to_string(),
                    process_remark: None,
                    processed_by: None,
                    processed_by_name: None,
                    processed_at: None,
                });
                write_audit(
                    Some(&topic_id),
                    Some(&batch_id),
                    &user.id,
                    &user.display_name,
                    "import_create",
                    None,
                    Some(&status),
                    Some(&format!(
                        "离线台账回填成功导入：批次 {}，来源 {}",
                        batch_no, body.source
                    )),
                )
                .ok();
            }
            Err(e) => {
                error_count += 1;
                conn.execute(
                    "INSERT INTO import_records (id, batch_id, topic_no, title, status, diff_json, error_msg, topic_id, process_status, process_remark, processed_by, processed_by_name, processed_at) VALUES (?1,?2,?3,?4,?5,?6,?7,NULL,'pending',NULL,NULL,NULL,NULL)",
                    params![
                        record_id,
                        batch_id,
                        item.topic_no,
                        item.title,
                        "error",
                        Option::<String>::None,
                        e.to_string(),
                    ],
                )
                .ok();
                records.push(ImportRecord {
                    id: record_id,
                    batch_id: batch_id.clone(),
                    topic_no: item.topic_no.clone(),
                    title: Some(item.title.clone()),
                    status: "error".to_string(),
                    diff_json: None,
                    error_msg: Some(e.to_string()),
                    topic_id: None,
                    process_status: "pending".to_string(),
                    process_remark: None,
                    processed_by: None,
                    processed_by_name: None,
                    processed_at: None,
                });
                write_audit(
                    None,
                    Some(&batch_id),
                    &user.id,
                    &user.display_name,
                    "import_error",
                    None,
                    None,
                    Some(&format!(
                        "离线台账回填失败：{} - {}",
                        item.topic_no,
                        e.to_string()
                    )),
                )
                .ok();
            }
        }
    }

    conn.execute(
        "INSERT INTO import_batches (id, batch_no, source, operator_id, imported_at, total_count, success_count, conflict_count, error_count, remark) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            batch_id,
            batch_no,
            body.source,
            user.id,
            now,
            body.items.len() as i64,
            success_count,
            conflict_count,
            error_count,
            body.remark,
        ],
    )
    .ok();

    json_ok(ImportResult {
        batch_id: batch_id.clone(),
        batch_no,
        total_count: body.items.len() as i64,
        success_count,
        conflict_count,
        error_count,
        records,
    })
}

fn compute_diff(conn: &rusqlite::Connection, item: &ImportTopicItem) -> Option<String> {
    let mut stmt = conn
        .prepare(
            "SELECT topic_no, title, source, reporter, department, deadline, status, content FROM topics WHERE topic_no = ?1",
        )
        .ok()?;
    let row = stmt
        .query_row(params![item.topic_no], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
            ))
        })
        .ok()?;

    let mut diff: HashMap<String, Value> = HashMap::new();
    if row.1 != item.title {
        diff.insert(
            "title".to_string(),
            serde_json::json!({"old": row.1, "new": item.title}),
        );
    }
    let new_source = item.source.clone().unwrap_or_default();
    if row.2 != new_source {
        diff.insert(
            "source".to_string(),
            serde_json::json!({"old": row.2, "new": new_source}),
        );
    }
    let new_reporter = item
        .reporter
        .clone()
        .or_else(|| item.reporter_name.clone())
        .unwrap_or_default();
    if row.3 != new_reporter {
        diff.insert(
            "reporter".to_string(),
            serde_json::json!({"old": row.3, "new": new_reporter}),
        );
    }
    if row.4 != item.department {
        diff.insert(
            "department".to_string(),
            serde_json::json!({"old": row.4, "new": item.department}),
        );
    }
    if row.5 != item.deadline {
        diff.insert(
            "deadline".to_string(),
            serde_json::json!({"old": row.5, "new": item.deadline}),
        );
    }
    if Some(row.6.clone()) != item.status.clone() {
        diff.insert(
            "status".to_string(),
            serde_json::json!({"old": row.6, "new": item.status.clone().unwrap_or_default()}),
        );
    }
    if row.7 != item.content {
        diff.insert(
            "content".to_string(),
            serde_json::json!({"old": row.7, "new": item.content}),
        );
    }
    Some(serde_json::to_string(&diff).unwrap_or_default())
}

#[derive(serde::Deserialize)]
pub struct AuditQuery {
    #[serde(default, rename = "topic_id")]
    pub topic_id: Option<String>,
    #[serde(default, rename = "batch_id")]
    pub batch_id: Option<String>,
}

#[handler]
pub async fn handle_list_audit(
    req: &Request,
    Query(q): Query<AuditQuery>,
) -> Json<ApiResponse<Vec<AuditLog>>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };
    if let Err(e) = require_role(&user, &["registrar", "reviewer", "archiver"]) {
        return json_err(&e.to_string());
    }
    let conn = get_conn();
    let base_sql = "SELECT id, topic_id, import_batch_id, user_id, user_name, action, old_status, new_status, detail, created_at FROM audit_logs";
    let rows: Vec<AuditLog> = if let Some(tid) = q.topic_id.as_ref() {
        let mut stmt = conn
            .prepare(&format!("{} WHERE topic_id = ?1 ORDER BY created_at DESC", base_sql))
            .unwrap();
        stmt.query_map(params![tid], |row| row_to_audit(row))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    } else if let Some(bid) = q.batch_id.as_ref() {
        let mut stmt = conn
            .prepare(&format!("{} WHERE import_batch_id = ?1 ORDER BY created_at DESC", base_sql))
            .unwrap();
        stmt.query_map(params![bid], |row| row_to_audit(row))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    } else {
        let mut stmt = conn
            .prepare(&format!("{} ORDER BY created_at DESC LIMIT 200", base_sql))
            .unwrap();
        stmt.query_map([], |row| row_to_audit(row))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };
    json_ok(rows)
}

#[handler]
pub async fn handle_process_conflict(
    req: &Request,
    Path(record_id): Path<String>,
    Json(body): Json<ProcessConflictRequest>,
) -> Json<ApiResponse<ImportRecord>> {
    let user = match current_user(req) {
        Ok(u) => u,
        Err(e) => return json_err(&e.to_string()),
    };

    let conn = get_conn();
    let now = chrono::Utc::now().to_rfc3339();

    let record_result = conn.query_row(
        "SELECT id, batch_id, topic_no, title, status, diff_json, error_msg, topic_id, process_status, process_remark, processed_by, processed_by_name, processed_at FROM import_records WHERE id = ?1",
        params![record_id],
        |row| row_to_import_record(row),
    );
    let record = match record_result {
        Ok(r) => r,
        Err(_) => return json_err("导入记录不存在"),
    };

    if record.status != "conflict" {
        return json_err("仅冲突记录可办理");
    }

    let topic_id = match record.topic_id.as_ref() {
        Some(tid) => tid.clone(),
        None => return json_err("冲突记录缺少关联 topic_id"),
    };
    let batch_id = record.batch_id.clone();

    match body.action.as_str() {
        "submit" => {
            if let Err(e) = require_role(&user, &["registrar"]) {
                return json_err(&e.to_string());
            }
            if record.process_status != "pending" {
                return json_err("仅待处理的冲突可提交");
            }
            conn.execute(
                "UPDATE import_records SET process_status = 'submitted', process_remark = ?1, processed_by = ?2, processed_by_name = ?3, processed_at = ?4 WHERE id = ?5",
                params![
                    body.remark,
                    user.id,
                    user.display_name,
                    now,
                    record_id,
                ],
            ).ok();
            let _ = write_audit(
                Some(&topic_id),
                Some(&batch_id),
                &user.id,
                &user.display_name,
                "conflict_submit",
                None,
                None,
                Some(&format!("登记员提交冲突处理申请：{}", body.remark)),
            );
        }
        "resolve" | "ignore" => {
            if let Err(e) = require_role(&user, &["reviewer"]) {
                return json_err(&e.to_string());
            }
            if record.process_status != "submitted" && record.process_status != "pending" {
                return json_err("仅待处理或已提交的冲突可办理");
            }

            let new_process_status = "resolved";

            if body.action == "resolve" {
                if let Some(diff_str) = record.diff_json.as_ref() {
                    if let Ok(diff_obj) = serde_json::from_str::<HashMap<String, Value>>(diff_str) {
                        let topic_result = conn.query_row(
                            "SELECT id, topic_no, title, source, reporter, department, deadline, status, content FROM topics WHERE id = ?1",
                            params![topic_id],
                            |row| {
                                Ok((
                                    row.get::<_, String>(0)?,
                                    row.get::<_, String>(1)?,
                                    row.get::<_, String>(2)?,
                                    row.get::<_, String>(3)?,
                                    row.get::<_, String>(4)?,
                                    row.get::<_, String>(5)?,
                                    row.get::<_, Option<String>>(6)?,
                                    row.get::<_, String>(7)?,
                                    row.get::<_, Option<String>>(8)?,
                                ))
                            },
                        );
                        if let Ok((_id, _no, old_title, _old_source, old_reporter, old_department, old_deadline, old_status, old_content)) = topic_result {
                            let mut new_title = old_title;
                            let mut new_reporter = old_reporter;
                            let mut new_department = old_department;
                            let mut new_deadline = old_deadline;
                            let mut new_status = old_status;
                            let mut new_content = old_content;

                            for (k, v) in &diff_obj {
                                if let Some(new_val) = v.get("new") {
                                    match k.as_str() {
                                        "title" => if let Some(s) = new_val.as_str() { new_title = s.to_string(); }
                                        "reporter" => if let Some(s) = new_val.as_str() { new_reporter = s.to_string(); }
                                        "department" => if let Some(s) = new_val.as_str() { new_department = s.to_string(); }
                                        "deadline" => if let Some(s) = new_val.as_str() { new_deadline = Some(s.to_string()); }
                                        "status" => if let Some(s) = new_val.as_str() { new_status = s.to_string(); }
                                        "content" => if let Some(s) = new_val.as_str() { new_content = Some(s.to_string()); }
                                        _ => {}
                                    }
                                }
                            }

                            conn.execute(
                                "UPDATE topics SET title = ?1, reporter = ?2, department = ?3, deadline = ?4, status = ?5, content = ?6 WHERE id = ?7",
                                params![
                                    new_title,
                                    new_reporter,
                                    new_department,
                                    new_deadline,
                                    new_status,
                                    new_content,
                                    topic_id,
                                ],
                            ).ok();

                            let _ = write_audit(
                                Some(&topic_id),
                                Some(&batch_id),
                                &user.id,
                                &user.display_name,
                                "conflict_resolve",
                                None,
                                None,
                                Some(&format!("审核主管采纳线下数据覆盖线上：{}", body.remark)),
                            );
                        }
                    }
                }
            } else {
                let _ = write_audit(
                    Some(&topic_id),
                    Some(&batch_id),
                    &user.id,
                    &user.display_name,
                    "conflict_ignore",
                    None,
                    None,
                    Some(&format!("审核主管保留线上数据：{}", body.remark)),
                );
            }

            conn.execute(
                "UPDATE import_records SET process_status = ?1, process_remark = ?2, processed_by = ?3, processed_by_name = ?4, processed_at = ?5 WHERE id = ?6",
                params![
                    new_process_status,
                    body.remark,
                    user.id,
                    user.display_name,
                    now,
                    record_id,
                ],
            ).ok();
        }
        _ => return json_err("无效的 action，仅支持 submit / resolve / ignore"),
    }

    let updated = conn.query_row(
        "SELECT id, batch_id, topic_no, title, status, diff_json, error_msg, topic_id, process_status, process_remark, processed_by, processed_by_name, processed_at FROM import_records WHERE id = ?1",
        params![record_id],
        |row| row_to_import_record(row),
    ).ok();

    match updated {
        Some(r) => json_ok(r),
        None => json_err("更新后查询失败"),
    }
}

fn now_str() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn new_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}
