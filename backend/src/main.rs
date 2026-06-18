#[macro_use] extern crate rocket;

use rocket::http::Status;
use rocket::serde::json::{Json, Value, json};
use rocket::State;
use rocket_cors::{CorsOptions, AllowedOrigins};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;
use chrono::Utc;
use std::time::Duration;

type Db = Mutex<Connection>;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct User {
    id: String,
    username: String,
    display_name: String,
    role: String,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct FinancingApplication {
    id: String,
    application_no: String,
    applicant_name: String,
    applicant_id_card: String,
    company_name: String,
    company_credit_code: String,
    financing_amount: f64,
    financing_term_months: i64,
    risk_level: String,
    status: String,
    current_handler: String,
    current_handler_name: Option<String>,
    current_handler_role: Option<String>,
    version: i64,
    required_evidence: Value,
    submitted_evidence: Value,
    last_handler_id: Option<String>,
    last_handler_name: Option<String>,
    last_handler_role: Option<String>,
    last_opinion: Option<String>,
    last_result: Option<String>,
    created_by: String,
    created_by_name: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OperationRecord {
    id: String,
    application_id: String,
    operator_id: String,
    operator_name: Option<String>,
    operator_role: String,
    action: String,
    from_status: Option<String>,
    to_status: Option<String>,
    from_risk_level: Option<String>,
    to_risk_level: Option<String>,
    opinion: Option<String>,
    result: String,
    version_before: i64,
    version_after: i64,
    created_at: String,
}

#[derive(Debug, Deserialize)]
struct CreateApplicationRequest {
    applicant_name: String,
    applicant_id_card: String,
    company_name: String,
    company_credit_code: String,
    financing_amount: f64,
    financing_term_months: i64,
    risk_level: String,
    required_evidence: Vec<String>,
    submitted_evidence: Vec<String>,
    operator_id: String,
}

#[derive(Debug, Deserialize)]
struct SubmitApplicationRequest {
    application_id: String,
    operator_id: String,
    submitted_evidence: Option<Vec<String>>,
    opinion: Option<String>,
    expected_version: i64,
}

#[derive(Debug, Deserialize)]
struct ProcessApplicationRequest {
    application_id: String,
    operator_id: String,
    action: String,
    opinion: String,
    expected_version: i64,
    new_risk_level: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AuditRequest {
    application_id: String,
    operator_id: String,
    pass: bool,
    remark: String,
    expected_version: i64,
    new_risk_level: Option<String>,
}

fn now_str() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%S+08:00").to_string()
}

fn valid_risk(rl: &str) -> bool {
    matches!(rl, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")
}

fn risk_order(rl: &str) -> i32 {
    match rl {
        "LOW" => 1,
        "MEDIUM" => 2,
        "HIGH" => 3,
        "CRITICAL" => 4,
        _ => 0,
    }
}

fn get_user(conn: &Connection, uid: &str) -> Option<User> {
    conn.query_row(
        "SELECT id, username, display_name, role, created_at FROM users WHERE id = ?1",
        params![uid],
        |row| Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            display_name: row.get(2)?,
            role: row.get(3)?,
            created_at: row.get(4)?,
        })
    ).optional().ok().flatten()
}

fn get_app(conn: &Connection, aid: &str) -> Option<FinancingApplication> {
    let sql = "SELECT a.id, a.application_no, a.applicant_name, a.applicant_id_card,
       a.company_name, a.company_credit_code, a.financing_amount, a.financing_term_months,
       a.risk_level, a.status, a.current_handler, a.version,
       a.required_evidence, a.submitted_evidence,
       a.last_handler_id, a.last_opinion, a.last_result,
       a.created_by, a.created_at, a.updated_at,
       h.display_name, h.role, lh.display_name, lh.role, cb.display_name
       FROM financing_applications a
       LEFT JOIN users h ON a.current_handler = h.id
       LEFT JOIN users lh ON a.last_handler_id = lh.id
       LEFT JOIN users cb ON a.created_by = cb.id
       WHERE a.id = ?1";
    conn.query_row(sql, params![aid], |row| {
        Ok(FinancingApplication {
            id: row.get(0)?,
            application_no: row.get(1)?,
            applicant_name: row.get(2)?,
            applicant_id_card: row.get(3)?,
            company_name: row.get(4)?,
            company_credit_code: row.get(5)?,
            financing_amount: row.get(6)?,
            financing_term_months: row.get(7)?,
            risk_level: row.get(8)?,
            status: row.get(9)?,
            current_handler: row.get(10)?,
            version: row.get(11)?,
            required_evidence: serde_json::from_str(&row.get::<_, String>(12)?).unwrap_or(json!([])),
            submitted_evidence: serde_json::from_str(&row.get::<_, String>(13)?).unwrap_or(json!([])),
            last_handler_id: row.get(14)?,
            last_opinion: row.get(15)?,
            last_result: row.get(16)?,
            created_by: row.get(17)?,
            created_at: row.get(18)?,
            updated_at: row.get(19)?,
            current_handler_name: row.get(20)?,
            current_handler_role: row.get(21)?,
            last_handler_name: row.get(22)?,
            last_handler_role: row.get(23)?,
            created_by_name: row.get(24)?,
        })
    }).optional().ok().flatten()
}

fn insert_record(conn: &Connection,
    app_id: &str, op_id: &str, op_role: &str,
    action: &str, fs: Option<&str>, ts: Option<&str>,
    frl: Option<&str>, trl: Option<&str>,
    opinion: Option<&str>, result: &str, vb: i64, va: i64
) -> Result<(), String> {
    let rec_id = Uuid::new_v4().to_string();
    conn.execute("INSERT INTO operation_records (id, application_id, operator_id, operator_role, action,
            from_status, to_status, from_risk_level, to_risk_level, opinion, result, version_before, version_after, created_at)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
        params![rec_id, app_id, op_id, op_role, action, fs, ts, frl, trl, opinion, result, vb, va, now_str()]
    ).map_err(|e| e.to_string())?;
    Ok(())
}

fn update_app_status(conn: &Connection, aid: &str, status: &str, handler: &str,
    lh: Option<&str>, lop: Option<&str>, lr: Option<&str>, risk: Option<&str>,
    submitted_ev: Option<&str>, new_version: i64) -> Result<(), String>
{
    let mut sql = String::from("UPDATE financing_applications SET status=?1, current_handler=?2, version=?3, updated_at=?4");
    let mut n = 5i32;
    let mut set_clauses: Vec<String> = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(h) = lh { set_clauses.push(format!("last_handler_id=?{}", n)); params_vec.push(Box::new(h.to_string())); n+=1; }
    if let Some(o) = lop { set_clauses.push(format!("last_opinion=?{}", n)); params_vec.push(Box::new(o.to_string())); n+=1; }
    if let Some(r) = lr { set_clauses.push(format!("last_result=?{}", n)); params_vec.push(Box::new(r.to_string())); n+=1; }
    if let Some(rl) = risk { set_clauses.push(format!("risk_level=?{}", n)); params_vec.push(Box::new(rl.to_string())); n+=1; }
    if let Some(ev) = submitted_ev { set_clauses.push(format!("submitted_evidence=?{}", n)); params_vec.push(Box::new(ev.to_string())); n+=1; }

    if !set_clauses.is_empty() {
        sql.push_str(", ");
        sql.push_str(&set_clauses.join(", "));
    }
    sql.push_str(&format!(" WHERE id=?{}", n));

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let updated_at = now_str();
    let mut final_params: Vec<&dyn rusqlite::ToSql> = Vec::new();
    final_params.push(&status);
    final_params.push(&handler);
    final_params.push(&new_version);
    final_params.push(&updated_at);
    for p in &params_vec {
        final_params.push(p.as_ref());
    }
    final_params.push(&aid);

    stmt.execute(&*final_params).map_err(|e| e.to_string())?;
    Ok(())
}

fn check_required_evidence(req: &Value, subm: &Value) -> (bool, Vec<String>) {
    let req_list: Vec<String> = serde_json::from_value(req.clone()).unwrap_or_default();
    let subm_list: Vec<String> = serde_json::from_value(subm.clone()).unwrap_or_default();
    let mut missing: Vec<String> = Vec::new();
    for r in &req_list {
        if !subm_list.contains(r) {
            missing.push(r.clone());
        }
    }
    (missing.is_empty(), missing)
}

#[get("/users")]
fn list_users(db: &State<Db>) -> Json<Value> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, username, display_name, role, created_at FROM users ORDER BY role, username").unwrap();
    let rows = stmt.query_map([], |row| Ok(User {
        id: row.get(0)?, username: row.get(1)?, display_name: row.get(2)?,
        role: row.get(3)?, created_at: row.get(4)?,
    })).unwrap();
    let users: Vec<User> = rows.filter_map(|r| r.ok()).collect();
    Json(json!({ "users": users }))
}

#[get("/applications?<role>&<handler>&<status>&<risk>&<keyword>")]
fn list_applications(db: &State<Db>, role: Option<String>, handler: Option<String>,
    status: Option<String>, risk: Option<String>, keyword: Option<String>) -> Json<Value>
{
    let conn = db.lock().unwrap();
    let mut sql = String::from("SELECT a.id, a.application_no, a.applicant_name, a.applicant_id_card,
        a.company_name, a.company_credit_code, a.financing_amount, a.financing_term_months,
        a.risk_level, a.status, a.current_handler, a.version,
        a.required_evidence, a.submitted_evidence,
        a.last_handler_id, a.last_opinion, a.last_result,
        a.created_by, a.created_at, a.updated_at,
        h.display_name, h.role, lh.display_name, lh.role, cb.display_name
        FROM financing_applications a
        LEFT JOIN users h ON a.current_handler = h.id
        LEFT JOIN users lh ON a.last_handler_id = lh.id
        LEFT JOIN users cb ON a.created_by = cb.id WHERE 1=1");
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(r) = role {
        if r == "REGISTRAR" {
            sql.push_str(" AND (a.status IN ('DRAFT','RETURNED_FOR_CORRECTION','EVIDENCE_MISSING') OR a.created_by IN (SELECT id FROM users WHERE role='REGISTRAR'))");
        } else if r == "AUDITOR" {
            sql.push_str(" AND a.status IN ('PENDING_VERIFICATION','OVERDUE','STATUS_CONFLICT','VERIFICATION_PASSED')");
        } else if r == "REVIEWER" {
            sql.push_str(" AND a.status IN ('REVIEW_PENDING','ARCHIVED','REJECTED')");
        }
    }
    if let Some(h) = handler { sql.push_str(" AND a.current_handler=?"); params.push(Box::new(h)); }
    if let Some(s) = status { sql.push_str(" AND a.status=?"); params.push(Box::new(s)); }
    if let Some(rl) = risk { sql.push_str(" AND a.risk_level=?"); params.push(Box::new(rl)); }
    if let Some(kw) = keyword {
        let like = format!("%{}%", kw);
        sql.push_str(" AND (a.application_no LIKE ? OR a.applicant_name LIKE ? OR a.company_name LIKE ?)");
        params.push(Box::new(like.clone()));
        params.push(Box::new(like.clone()));
        params.push(Box::new(like));
    }
    sql.push_str(" ORDER BY a.created_at DESC, a.updated_at DESC");

    let mut stmt = conn.prepare(&sql).unwrap();
    let p_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt.query_map(&*p_refs, |row| Ok(FinancingApplication {
        id: row.get(0)?, application_no: row.get(1)?, applicant_name: row.get(2)?,
        applicant_id_card: row.get(3)?, company_name: row.get(4)?,
        company_credit_code: row.get(5)?, financing_amount: row.get(6)?,
        financing_term_months: row.get(7)?, risk_level: row.get(8)?,
        status: row.get(9)?, current_handler: row.get(10)?, version: row.get(11)?,
        required_evidence: serde_json::from_str(&row.get::<_, String>(12)?).unwrap_or(json!([])),
        submitted_evidence: serde_json::from_str(&row.get::<_, String>(13)?).unwrap_or(json!([])),
        last_handler_id: row.get(14)?, last_opinion: row.get(15)?, last_result: row.get(16)?,
        created_by: row.get(17)?, created_at: row.get(18)?, updated_at: row.get(19)?,
        current_handler_name: row.get(20)?, current_handler_role: row.get(21)?,
        last_handler_name: row.get(22)?, last_handler_role: row.get(23)?,
        created_by_name: row.get(24)?,
    })).unwrap();
    let apps: Vec<FinancingApplication> = rows.filter_map(|r| r.ok()).collect();
    Json(json!({ "applications": apps }))
}

#[get("/applications/<id>")]
fn get_application(db: &State<Db>, id: String) -> Result<Json<Value>, (Status, Json<Value>)> {
    let conn = db.lock().unwrap();
    let app = get_app(&conn, &id).ok_or((Status::NotFound, Json(json!({"error": "申请单不存在"}))))?;
    let mut stmt = conn.prepare("SELECT r.id, r.application_id, r.operator_id, u.display_name, r.operator_role,
        r.action, r.from_status, r.to_status, r.from_risk_level, r.to_risk_level,
        r.opinion, r.result, r.version_before, r.version_after, r.created_at
        FROM operation_records r LEFT JOIN users u ON r.operator_id = u.id
        WHERE r.application_id = ?1 ORDER BY r.created_at ASC").unwrap();
    let rows = stmt.query_map(params![id], |row| Ok(OperationRecord {
        id: row.get(0)?, application_id: row.get(1)?, operator_id: row.get(2)?,
        operator_name: row.get(3)?, operator_role: row.get(4)?, action: row.get(5)?,
        from_status: row.get(6)?, to_status: row.get(7)?, from_risk_level: row.get(8)?,
        to_risk_level: row.get(9)?, opinion: row.get(10)?, result: row.get(11)?,
        version_before: row.get(12)?, version_after: row.get(13)?, created_at: row.get(14)?,
    })).unwrap();
    let records: Vec<OperationRecord> = rows.filter_map(|r| r.ok()).collect();
    Ok(Json(json!({ "application": app, "records": records })))
}

#[get("/statistics")]
fn statistics(db: &State<Db>) -> Json<Value> {
    let conn = db.lock().unwrap();
    let mut count_by_status: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut stmt = conn.prepare("SELECT status, COUNT(*) FROM financing_applications GROUP BY status").unwrap();
    for r in stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))).unwrap() {
        if let Ok((k, v)) = r { count_by_status.insert(k, v); }
    }
    let mut count_by_risk: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    stmt = conn.prepare("SELECT risk_level, COUNT(*) FROM financing_applications GROUP BY risk_level").unwrap();
    for r in stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))).unwrap() {
        if let Ok((k, v)) = r { count_by_risk.insert(k, v); }
    }
    let total: i64 = conn.query_row("SELECT COUNT(*) FROM financing_applications", [], |r| r.get(0)).unwrap_or(0);
    let total_amount: f64 = conn.query_row("SELECT COALESCE(SUM(financing_amount),0) FROM financing_applications", [], |r| r.get(0)).unwrap_or(0.0);
    let high_risk_count: i64 = conn.query_row("SELECT COUNT(*) FROM financing_applications WHERE risk_level IN ('HIGH','CRITICAL')", [], |r| r.get(0)).unwrap_or(0);
    let archived_amount: f64 = conn.query_row("SELECT COALESCE(SUM(financing_amount),0) FROM financing_applications WHERE status='ARCHIVED'", [], |r| r.get(0)).unwrap_or(0.0);

    let handler_queue: Vec<Value> = conn.prepare("SELECT u.id, u.display_name, u.role, COUNT(a.id)
        FROM users u LEFT JOIN financing_applications a ON a.current_handler = u.id
        GROUP BY u.id ORDER BY u.role, u.display_name").unwrap()
        .query_map([], |row| Ok(json!({
            "user_id": row.get::<_, String>(0)?,
            "display_name": row.get::<_, String>(1)?,
            "role": row.get::<_, String>(2)?,
            "queue_count": row.get::<_, i64>(3)?,
        }))).unwrap().filter_map(|r| r.ok()).collect();

    Json(json!({
        "total": total,
        "total_amount": total_amount,
        "archived_amount": archived_amount,
        "high_risk_count": high_risk_count,
        "count_by_status": count_by_status,
        "count_by_risk": count_by_risk,
        "handler_queue": handler_queue,
    }))
}

#[post("/applications", format = "json", data = "<req>")]
fn create_application(db: &State<Db>, req: Json<CreateApplicationRequest>) -> Result<Json<Value>, (Status, Json<Value>)> {
    let conn = db.lock().unwrap();
    let op = get_user(&conn, &req.operator_id).ok_or((Status::BadRequest, Json(json!({"error": "操作人不存在"}))))?;
    if op.role != "REGISTRAR" {
        return Err((Status::Forbidden, Json(json!({"error": "仅融资申请登记员可创建申请单"}))));
    }
    if !valid_risk(&req.risk_level) {
        return Err((Status::BadRequest, Json(json!({"error": "风险等级无效"}))));
    }
    if req.financing_amount <= 0.0 || req.financing_term_months <= 0 {
        return Err((Status::BadRequest, Json(json!({"error": "融资金额和期限必须为正数"}))));
    }

    let now = now_str();
    let id = Uuid::new_v4().to_string();
    let no = format!("RZZ-{}-{:04}", chrono::Local::now().format("%Y%m%d"), (rand_u32_simple() % 9999) + 1);
    let req_ev = serde_json::to_string(&req.required_evidence).unwrap();
    let subm_ev = serde_json::to_string(&req.submitted_evidence).unwrap();

    conn.execute("INSERT INTO financing_applications (id, application_no, applicant_name, applicant_id_card,
        company_name, company_credit_code, financing_amount, financing_term_months,
        risk_level, status, current_handler, version, required_evidence, submitted_evidence,
        last_handler_id, last_opinion, last_result, created_by, created_at, updated_at)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)",
        params![id, no, req.applicant_name, req.applicant_id_card,
        req.company_name, req.company_credit_code, req.financing_amount, req.financing_term_months,
        req.risk_level, "DRAFT", op.id, 1, req_ev, subm_ev,
        None::<String>, None::<String>, None::<String>, op.id, now, now]
    ).map_err(|e| (Status::InternalServerError, Json(json!({"error": e.to_string()}))))?;

    insert_record(&conn, &id, &op.id, &op.role, "CREATE",
        None, Some("DRAFT"), None, Some(&req.risk_level),
        Some("融资申请单创建成功"), "SUCCESS", 0, 1).map_err(|e| (Status::InternalServerError, Json(json!({"error": e}))))?;

    Ok(Json(json!({ "id": id, "application_no": no, "status": "DRAFT", "version": 1 })))
}

#[post("/applications/submit", format = "json", data = "<req>")]
fn submit_application(db: &State<Db>, req: Json<SubmitApplicationRequest>) -> Result<Json<Value>, (Status, Json<Value>)> {
    let conn = db.lock().unwrap();
    let op = get_user(&conn, &req.operator_id).ok_or((Status::BadRequest, Json(json!({"error": "操作人不存在"}))))?;
    if op.role != "REGISTRAR" {
        return Err((Status::Forbidden, Json(json!({"error": "仅登记员可提交申请单"}))));
    }
    let app = get_app(&conn, &req.application_id).ok_or((Status::NotFound, Json(json!({"error": "申请单不存在"}))))?;
    if app.version != req.expected_version {
        insert_record(&conn, &app.id, &op.id, &op.role, "SUBMIT",
            Some(&app.status), Some(&app.status), Some(&app.risk_level), Some(&app.risk_level),
            Some(&format!("版本冲突，期望v{}实际v{}，请刷新后重试", req.expected_version, app.version)),
            "VERSION_CONFLICT", app.version, app.version).map_err(|e| (Status::InternalServerError, Json(json!({"error": e}))))?;
        return Err((Status::Conflict, Json(json!({
            "error": "版本冲突，请刷新页面后重试",
            "expected_version": req.expected_version,
            "actual_version": app.version,
        }))));
    }
    if app.current_handler != op.id {
        return Err((Status::Forbidden, Json(json!({"error": "您不是当前处理人，无法提交"}))));
    }
    if !matches!(app.status.as_str(), "DRAFT" | "RETURNED_FOR_CORRECTION" | "EVIDENCE_MISSING") {
        return Err((Status::BadRequest, Json(json!({"error": format!("当前状态 {} 不允许提交操作", app.status)}))));
    }

    let (submitted_ev_value, submitted_ev_str) = if let Some(ev) = &req.submitted_evidence {
        (json!(ev), serde_json::to_string(ev).unwrap())
    } else {
        (app.submitted_evidence.clone(), serde_json::to_string(&app.submitted_evidence).unwrap())
    };

    let (ok_ev, missing) = check_required_evidence(&app.required_evidence, &submitted_ev_value);
    if !ok_ev && app.status == "DRAFT" {
        return Err((Status::BadRequest, Json(json!({"error": format!("缺少必填证据: {}", missing.join(", "))}))));
    }

    let action = if app.status == "DRAFT" { "SUBMIT" } else { "CORRECT" };
    let result = if app.status == "DRAFT" { "SUBMITTED" } else { "CORRECTED" };
    let old_status = app.status.clone();
    let new_version = app.version + 1;

    let auditor_id = conn.query_row::<String, _, _>(
        "SELECT id FROM users WHERE role='AUDITOR' LIMIT 1", [], |r| r.get(0)
    ).map_err(|_| (Status::InternalServerError, Json(json!({"error": "未找到审核主管"}))))?;

    update_app_status(&conn, &app.id, "PENDING_VERIFICATION", &auditor_id,
        Some(&op.id), req.opinion.as_deref(), Some(result), None,
        Some(&submitted_ev_str), new_version
    ).map_err(|e| (Status::InternalServerError, Json(json!({"error": e}))))?;

    insert_record(&conn, &app.id, &op.id, &op.role, action,
        Some(&old_status), Some("PENDING_VERIFICATION"), Some(&app.risk_level), Some(&app.risk_level),
        req.opinion.as_deref(), result, app.version, new_version
    ).map_err(|e| (Status::InternalServerError, Json(json!({"error": e}))))?;

    Ok(Json(json!({
        "id": app.id, "status": "PENDING_VERIFICATION", "version": new_version,
        "current_handler": auditor_id, "result": result,
    })))
}

#[post("/applications/process", format = "json", data = "<req>")]
fn process_application(db: &State<Db>, req: Json<ProcessApplicationRequest>) -> Result<Json<Value>, (Status, Json<Value>)> {
    let conn = db.lock().unwrap();
    let op = get_user(&conn, &req.operator_id).ok_or((Status::BadRequest, Json(json!({"error": "操作人不存在"}))))?;
    let app = get_app(&conn, &req.application_id).ok_or((Status::NotFound, Json(json!({"error": "申请单不存在"}))))?;

    if app.version != req.expected_version {
        let risk = app.risk_level.clone();
        let st = app.status.clone();
        insert_record(&conn, &app.id, &op.id, &op.role, &req.action,
            Some(&st), Some(&st), Some(&risk), Some(&risk),
            Some(&format!("版本冲突，期望v{}实际v{}，请刷新后重试", req.expected_version, app.version)),
            "VERSION_CONFLICT", app.version, app.version).map_err(|e| (Status::InternalServerError, Json(json!({"error": e}))))?;
        return Err((Status::Conflict, Json(json!({
            "error": "版本冲突，请刷新页面后重试",
            "expected_version": req.expected_version,
            "actual_version": app.version,
        }))));
    }

    if app.current_handler != op.id {
        return Err((Status::Forbidden, Json(json!({"error": "您不是当前处理人"}))));
    }

    if let Some(nrl) = &req.new_risk_level {
        if !valid_risk(nrl) { return Err((Status::BadRequest, Json(json!({"error": "风险等级无效"})))); }
    }

    let new_risk = req.new_risk_level.clone().unwrap_or_else(|| app.risk_level.clone());
    let risk_changed = new_risk != app.risk_level;
    let risk_action = if risk_changed {
        if risk_order(&new_risk) > risk_order(&app.risk_level) { Some("RISK_UPGRADE") }
        else { Some("RISK_DOWNGRADE") }
    } else { None };

    let (new_status, next_handler_role, action_str, result_str) = match (op.role.as_str(), app.status.as_str(), req.action.as_str()) {
        ("AUDITOR", "PENDING_VERIFICATION", "VERIFY_PASS") => {
            ("VERIFICATION_PASSED", None, "VERIFY_PASS", "VERIFIED".to_string())
        }
        ("AUDITOR", "PENDING_VERIFICATION", "VERIFY_PASS_AND_FORWARD") => {
            ("REVIEW_PENDING", Some("REVIEWER"), "VERIFY_PASS", "REVIEW_PENDING".to_string())
        }
        ("AUDITOR", "PENDING_VERIFICATION", "VERIFY_FAIL_EVIDENCE") => {
            ("EVIDENCE_MISSING", Some("REGISTRAR"), "VERIFY_FAIL_EVIDENCE", "EVIDENCE_MISSING".to_string())
        }
        ("AUDITOR", "PENDING_VERIFICATION", "VERIFY_FAIL_OVERDUE") => {
            ("OVERDUE", Some("AUDITOR"), "VERIFY_FAIL_OVERDUE", "OVERDUE".to_string())
        }
        ("AUDITOR", "PENDING_VERIFICATION", "VERIFY_RETURN_CORRECTION") => {
            ("RETURNED_FOR_CORRECTION", Some("REGISTRAR"), "VERIFY_RETURN_CORRECTION", "RETURNED".to_string())
        }
        ("AUDITOR", "PENDING_VERIFICATION", "VERIFY_CONFLICT") => {
            ("STATUS_CONFLICT", Some("AUDITOR"), "VERIFY_CONFLICT", "CONFLICT".to_string())
        }
        ("AUDITOR", "STATUS_CONFLICT", "VERIFY_PASS_AND_FORWARD") => {
            ("REVIEW_PENDING", Some("REVIEWER"), "VERIFY_PASS", "REVIEW_PENDING".to_string())
        }
        ("AUDITOR", "OVERDUE", "VERIFY_PASS_AND_FORWARD") => {
            ("REVIEW_PENDING", Some("REVIEWER"), "VERIFY_PASS", "REVIEW_PENDING".to_string())
        }
        ("AUDITOR", "VERIFICATION_PASSED", "FORWARD") => {
            ("REVIEW_PENDING", Some("REVIEWER"), "VERIFY_PASS", "REVIEW_PENDING".to_string())
        }
        ("REVIEWER", "REVIEW_PENDING", "REVIEW_PASS_ARCHIVE") => {
            ("ARCHIVED", Some("REVIEWER"), "REVIEW_PASS_ARCHIVE", "ARCHIVED".to_string())
        }
        ("REVIEWER", "REVIEW_PENDING", "REVIEW_REJECT") => {
            ("REJECTED", Some("REVIEWER"), "REVIEW_REJECT", "REJECTED".to_string())
        }
        _ => return Err((Status::BadRequest, Json(json!({"error": format!("角色{}在状态{}下不允许操作{}", op.role, app.status, req.action)}))))
    };

    let next_handler = if let Some(role) = next_handler_role {
        if role == op.role {
            op.id.clone()
        } else if role == "REGISTRAR" {
            app.created_by.clone()
        } else {
            conn.query_row::<String, _, _>(
                "SELECT id FROM users WHERE role=?1 LIMIT 1", params![role], |r| r.get(0)
            ).map_err(|_| (Status::InternalServerError, Json(json!({"error": format!("未找到{}", role)}))))?
        }
    } else {
        op.id.clone()
    };

    let new_version = app.version + 1;
    let old_status = app.status.clone();
    let old_risk = app.risk_level.clone();

    if risk_changed {
        let ra = risk_action.unwrap();
        let rr = if ra == "RISK_UPGRADE" { "RISK_UPGRADED" } else { "RISK_DOWNGRADED" };
        insert_record(&conn, &app.id, &op.id, &op.role, ra,
            Some(&old_status), Some(&old_status), Some(&old_risk), Some(&new_risk),
            Some(&format!("风险等级变更：{} -> {}。原因：{}", old_risk, new_risk, req.opinion)),
            rr, app.version, app.version
        ).map_err(|e| (Status::InternalServerError, Json(json!({"error": e}))))?;
    }

    update_app_status(&conn, &app.id, new_status, &next_handler,
        Some(&op.id), Some(&req.opinion), Some(&result_str), Some(&new_risk),
        None, new_version
    ).map_err(|e| (Status::InternalServerError, Json(json!({"error": e}))))?;

    insert_record(&conn, &app.id, &op.id, &op.role, action_str,
        Some(&old_status), Some(new_status), Some(&old_risk), Some(&new_risk),
        Some(&req.opinion), &result_str, app.version, new_version
    ).map_err(|e| (Status::InternalServerError, Json(json!({"error": e}))))?;

    Ok(Json(json!({
        "id": app.id, "status": new_status, "version": new_version,
        "current_handler": next_handler, "risk_level": new_risk, "result": result_str,
    })))
}

#[post("/applications/audit", format = "json", data = "<req>")]
fn audit_application(db: &State<Db>, req: Json<AuditRequest>) -> Result<Json<Value>, (Status, Json<Value>)> {
    let conn = db.lock().unwrap();
    let op = get_user(&conn, &req.operator_id).ok_or((Status::BadRequest, Json(json!({"error": "操作人不存在"}))))?;
    let app = get_app(&conn, &req.application_id).ok_or((Status::NotFound, Json(json!({"error": "申请单不存在"}))))?;

    if app.version != req.expected_version {
        let risk = app.risk_level.clone();
        let st = app.status.clone();
        insert_record(&conn, &app.id, &op.id, &op.role, if req.pass { "AUDIT_PASS" } else { "AUDIT_FAIL" },
            Some(&st), Some(&st), Some(&risk), Some(&risk),
            Some(&format!("版本冲突，期望v{}实际v{}，请刷新后重试", req.expected_version, app.version)),
            "VERSION_CONFLICT", app.version, app.version).map_err(|e| (Status::InternalServerError, Json(json!({"error": e}))))?;
        return Err((Status::Conflict, Json(json!({
            "error": "版本冲突，请刷新页面后重试",
            "expected_version": req.expected_version,
            "actual_version": app.version,
        }))));
    }

    if op.role != "REVIEWER" {
        return Err((Status::Forbidden, Json(json!({"error": "仅复核负责人可执行复核操作"}))));
    }
    if app.status != "REVIEW_PENDING" {
        return Err((Status::BadRequest, Json(json!({"error": format!("当前状态{}不是待复核状态", app.status)}))));
    }
    if app.current_handler != op.id {
        return Err((Status::Forbidden, Json(json!({"error": "您不是当前处理人"}))));
    }

    let (new_risk, risk_changed, risk_action_str) = match &req.new_risk_level {
        Some(nrl) if valid_risk(nrl) && nrl != &app.risk_level => {
            let ra = if risk_order(nrl) > risk_order(&app.risk_level) { "RISK_UPGRADE" } else { "RISK_DOWNGRADE" };
            (nrl.clone(), true, Some(ra))
        }
        _ => (app.risk_level.clone(), false, None)
    };

    let new_version = app.version + 1;
    let old_status = app.status.clone();
    let old_risk = app.risk_level.clone();

    let new_status = if req.pass { "ARCHIVED" } else { "REJECTED" };
    let main_action = if req.pass { "REVIEW_PASS_ARCHIVE" } else { "REVIEW_REJECT" };
    let main_result = if req.pass { "ARCHIVED" } else { "REJECTED" };

    if risk_changed {
        let ra = risk_action_str.unwrap();
        let rr = if ra == "RISK_UPGRADE" { "RISK_UPGRADED" } else { "RISK_DOWNGRADED" };
        insert_record(&conn, &app.id, &op.id, &op.role, ra,
            Some(&old_status), Some(&old_status), Some(&old_risk), Some(&new_risk),
            Some(&format!("复核阶段风险变更：{} -> {}。说明：{}", old_risk, new_risk, req.remark)),
            rr, app.version, app.version
        ).map_err(|e| (Status::InternalServerError, Json(json!({"error": e}))))?;
    }

    update_app_status(&conn, &app.id, new_status, &op.id,
        Some(&op.id), Some(&req.remark), Some(main_result), Some(&new_risk),
        None, new_version
    ).map_err(|e| (Status::InternalServerError, Json(json!({"error": e}))))?;

    insert_record(&conn, &app.id, &op.id, &op.role, main_action,
        Some(&old_status), Some(new_status), Some(&old_risk), Some(&new_risk),
        Some(&req.remark), main_result, app.version, new_version
    ).map_err(|e| (Status::InternalServerError, Json(json!({"error": e}))))?;

    Ok(Json(json!({
        "id": app.id, "status": new_status, "version": new_version,
        "current_handler": op.id, "risk_level": new_risk, "result": main_result,
    })))
}

fn rand_u32_simple() -> u32 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or(Duration::from_secs(0));
    (d.as_nanos() % 1000000) as u32
}

fn init_db(db_path: &str) -> Connection {
    let is_new = !std::path::Path::new(db_path).exists();
    let conn = Connection::open(db_path).expect("数据库打开失败");
    conn.execute_batch(include_str!("../schema.sql")).expect("建表失败");
    if is_new {
        conn.execute_batch(include_str!("../seed_data.sql")).expect("样例数据初始化失败");
        println!("数据库初始化完成，包含样例数据");
    }
    conn
}

#[launch]
fn rocket() -> _ {
    let db_path = std::env::var("DB_PATH").unwrap_or_else(|_| "data/scf.db".to_string());
    let _ = std::fs::create_dir_all("data");
    let conn = init_db(&db_path);

    let rocket_port: u16 = std::env::var("ROCKET_PORT").ok()
        .and_then(|s| s.parse().ok()).unwrap_or(8004);

    let cors = CorsOptions {
        allowed_origins: AllowedOrigins::all(),
        allowed_methods: ["GET", "POST", "OPTIONS"].iter().map(|s| s.parse().unwrap()).collect(),
        allowed_headers: rocket_cors::AllowedHeaders::all(),
        allow_credentials: true,
        ..Default::default()
    }.to_cors().unwrap();

    rocket::build()
        .configure(rocket::Config {
            port: rocket_port,
            address: std::net::IpAddr::V4(std::net::Ipv4Addr::new(0, 0, 0, 0)),
            ..rocket::Config::default()
        })
        .manage(Mutex::new(conn))
        .attach(cors)
        .mount("/api", routes![
            list_users, list_applications, get_application, statistics,
            create_application, submit_application, process_application, audit_application
        ])
}
