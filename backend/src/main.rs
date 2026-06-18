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
use std::env;

type Db = Mutex<Connection>;

/* ======================= 统一响应结构 ======================= */

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ApiResponse<T: Serialize + Clone> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
    error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    risk_level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    current_handler: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    current_handler_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_opinion: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_result: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

fn ok<T: Serialize + Clone>(data: T) -> Json<ApiResponse<T>> {
    Json(ApiResponse {
        success: true, data: Some(data), error: None, error_code: None,
        status: None, version: None, risk_level: None, current_handler: None,
        current_handler_name: None, last_opinion: None, last_result: None, message: None,
    })
}

fn ok_op<T: Serialize + Clone>(
    data: T,
    status: Option<&str>,
    version: Option<i64>,
    risk_level: Option<&str>,
    handler: Option<&str>,
    handler_name: Option<&str>,
    op: Option<&str>,
    res: Option<&str>,
) -> Json<ApiResponse<T>> {
    Json(ApiResponse {
        success: true,
        data: Some(data),
        error: None, error_code: None,
        status: status.map(|s| s.to_string()),
        version,
        risk_level: risk_level.map(|s| s.to_string()),
        current_handler: handler.map(|s| s.to_string()),
        current_handler_name: handler_name.map(|s| s.to_string()),
        last_opinion: op.map(|s| s.to_string()),
        last_result: res.map(|s| s.to_string()),
        message: None,
    })
}

fn err_json<T: Serialize + Clone>(
    status: Status,
    code: &str,
    msg: &str,
    cur_status: Option<&str>,
    cur_version: Option<i64>,
) -> (Status, Json<ApiResponse<T>>) {
    (status, Json(ApiResponse {
        success: false, data: None,
        error: Some(msg.to_string()),
        error_code: Some(code.to_string()),
        status: cur_status.map(|s| s.to_string()),
        version: cur_version,
        risk_level: None, current_handler: None,
        current_handler_name: None, last_opinion: None,
        last_result: None, message: None,
    }))
}

/* ======================= 核心数据结构 ======================= */

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

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ApplicationDetail {
    application: FinancingApplication,
    records: Vec<OperationRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct StatisticsResponse {
    total: i64,
    total_amount: f64,
    archived_amount: f64,
    high_risk_count: i64,
    count_by_status: std::collections::HashMap<String, i64>,
    count_by_risk: std::collections::HashMap<String, i64>,
    handler_queue: Vec<Value>,
}

/* ======================= 请求结构 ======================= */

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

/* ======================= 工具函数 ======================= */

fn now_str() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%S+08:00").to_string()
}

fn valid_risk(rl: &str) -> bool {
    matches!(rl, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")
}

fn risk_order(rl: &str) -> i32 {
    match rl {
        "LOW" => 1, "MEDIUM" => 2, "HIGH" => 3, "CRITICAL" => 4, _ => 0,
    }
}

fn get_user(conn: &Connection, uid: &str) -> Option<User> {
    conn.query_row(
        "SELECT id, username, display_name, role, created_at FROM users WHERE id = ?1",
        params![uid],
        |row| Ok(User {
            id: row.get(0)?, username: row.get(1)?, display_name: row.get(2)?,
            role: row.get(3)?, created_at: row.get(4)?,
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
        })
    }).optional().ok().flatten()
}

fn list_records(conn: &Connection, aid: &str) -> Vec<OperationRecord> {
    let mut stmt = conn.prepare("SELECT r.id, r.application_id, r.operator_id, u.display_name, r.operator_role,
        r.action, r.from_status, r.to_status, r.from_risk_level, r.to_risk_level,
        r.opinion, r.result, r.version_before, r.version_after, r.created_at
        FROM operation_records r LEFT JOIN users u ON r.operator_id = u.id
        WHERE r.application_id = ?1 ORDER BY r.created_at ASC, r.id ASC").unwrap();
    stmt.query_map(params![aid], |row| Ok(OperationRecord {
        id: row.get(0)?, application_id: row.get(1)?, operator_id: row.get(2)?,
        operator_name: row.get(3)?, operator_role: row.get(4)?, action: row.get(5)?,
        from_status: row.get(6)?, to_status: row.get(7)?, from_risk_level: row.get(8)?,
        to_risk_level: row.get(9)?, opinion: row.get(10)?, result: row.get(11)?,
        version_before: row.get(12)?, version_after: row.get(13)?, created_at: row.get(14)?,
    })).unwrap().filter_map(|r| r.ok()).collect()
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

fn update_app(conn: &Connection, aid: &str, status: &str, handler: &str,
    lh: Option<&str>, lop: Option<&str>, lr: Option<&str>, risk: Option<&str>,
    submitted_ev: Option<&str>, new_version: i64) -> Result<(), String>
{
    let mut sql = String::from("UPDATE financing_applications SET status=?1, current_handler=?2, version=?3, updated_at=?4");
    let mut n = 5i32;
    let mut clauses: Vec<String> = Vec::new();
    let mut pvec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(h) = lh { clauses.push(format!("last_handler_id=?{}", n)); pvec.push(Box::new(h.to_string())); n+=1; }
    if let Some(o) = lop { clauses.push(format!("last_opinion=?{}", n)); pvec.push(Box::new(o.to_string())); n+=1; }
    if let Some(r) = lr { clauses.push(format!("last_result=?{}", n)); pvec.push(Box::new(r.to_string())); n+=1; }
    if let Some(rl) = risk { clauses.push(format!("risk_level=?{}", n)); pvec.push(Box::new(rl.to_string())); n+=1; }
    if let Some(ev) = submitted_ev { clauses.push(format!("submitted_evidence=?{}", n)); pvec.push(Box::new(ev.to_string())); n+=1; }

    if !clauses.is_empty() { sql.push_str(", "); sql.push_str(&clauses.join(", ")); }
    sql.push_str(&format!(" WHERE id=?{}", n));

    let updated_at = now_str();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let mut final_params: Vec<&dyn rusqlite::ToSql> = Vec::new();
    final_params.push(&status); final_params.push(&handler);
    final_params.push(&new_version); final_params.push(&updated_at);
    for p in &pvec { final_params.push(p.as_ref()); }
    final_params.push(&aid);

    stmt.execute(&*final_params).map_err(|e| e.to_string())?;
    Ok(())
}

fn check_required_evidence(req: &Value, subm: &Value) -> (bool, Vec<String>) {
    let req_list: Vec<String> = serde_json::from_value(req.clone()).unwrap_or_default();
    let subm_list: Vec<String> = serde_json::from_value(subm.clone()).unwrap_or_default();
    let mut missing: Vec<String> = Vec::new();
    for r in &req_list {
        if !subm_list.contains(r) { missing.push(r.clone()); }
    }
    (missing.is_empty(), missing)
}

fn rand_u32_simple() -> u32 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or(Duration::from_secs(0));
    (d.as_nanos() % 1000000) as u32
}

fn find_handler_by_role(conn: &Connection, role: &str, fallback: Option<&str>) -> Result<(String, Option<String>), String> {
    let r = conn.query_row::<(String, String), _, _>(
        "SELECT id, display_name FROM users WHERE role=?1 LIMIT 1", params![role],
        |row| Ok((row.get(0)?, row.get(1)?))
    );
    match r {
        Ok((id, name)) => Ok((id, Some(name))),
        Err(_) => {
            if let Some(fb) = fallback {
                let name = conn.query_row::<String, _, _>(
                    "SELECT display_name FROM users WHERE id=?1", params![fb], |r| r.get(0)
                ).ok();
                Ok((fb.to_string(), name))
            } else {
                Err(format!("未找到角色{}的用户", role))
            }
        }
    }
}

/* ======================= API 接口 ======================= */

#[get("/users")]
fn list_users(db: &State<Db>) -> Json<ApiResponse<Vec<User>>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, username, display_name, role, created_at FROM users ORDER BY role, username").unwrap();
    let rows = stmt.query_map([], |row| Ok(User {
        id: row.get(0)?, username: row.get(1)?, display_name: row.get(2)?,
        role: row.get(3)?, created_at: row.get(4)?,
    })).unwrap();
    let users: Vec<User> = rows.filter_map(|r| r.ok()).collect();
    ok(users)
}

#[get("/applications?<role>&<handler>&<status>&<risk>&<keyword>")]
fn list_applications(db: &State<Db>, role: Option<String>, handler: Option<String>,
    status: Option<String>, risk: Option<String>, keyword: Option<String>)
    -> Json<ApiResponse<Vec<FinancingApplication>>>
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
            sql.push_str(" AND a.created_by IN (SELECT id FROM users WHERE role='REGISTRAR')");
        } else if r == "AUDITOR" {
            sql.push_str(" AND a.status IN ('PENDING_VERIFICATION','OVERDUE','STATUS_CONFLICT','VERIFICATION_PASSED','EVIDENCE_MISSING')");
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
    sql.push_str(" ORDER BY CASE a.status
        WHEN 'PENDING_VERIFICATION' THEN 1
        WHEN 'OVERDUE' THEN 2
        WHEN 'STATUS_CONFLICT' THEN 3
        WHEN 'REVIEW_PENDING' THEN 4
        WHEN 'RETURNED_FOR_CORRECTION' THEN 5
        WHEN 'EVIDENCE_MISSING' THEN 6
        WHEN 'VERIFICATION_PASSED' THEN 7
        WHEN 'DRAFT' THEN 8
        WHEN 'ARCHIVED' THEN 9
        WHEN 'REJECTED' THEN 10
        ELSE 99 END, a.created_at DESC, a.updated_at DESC");

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
    ok(apps)
}

#[get("/applications/<id>")]
fn get_application(db: &State<Db>, id: String)
    -> (Status, Json<ApiResponse<ApplicationDetail>>)
{
    let conn = db.lock().unwrap();
    match get_app(&conn, &id) {
        Some(app) => {
            let records = list_records(&conn, &id);
            let detail = ApplicationDetail { application: app.clone(), records };
            let mut resp = ApiResponse {
                success: true, data: Some(detail), error: None, error_code: None,
                status: Some(app.status), version: Some(app.version),
                risk_level: Some(app.risk_level),
                current_handler: Some(app.current_handler),
                current_handler_name: app.current_handler_name.clone(),
                last_opinion: app.last_opinion.clone(),
                last_result: app.last_result.clone(),
                message: None,
            };
            resp.data = Some(resp.data.take().unwrap());
            (Status::Ok, Json(resp))
        }
        None => err_json(Status::NotFound, "NOT_FOUND", "申请单不存在", None, None),
    }
}

#[get("/statistics")]
fn get_statistics(db: &State<Db>) -> Json<ApiResponse<StatisticsResponse>> {
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
        AND a.status NOT IN ('ARCHIVED','REJECTED')
        GROUP BY u.id ORDER BY u.role, u.display_name").unwrap()
        .query_map([], |row| Ok(json!({
            "user_id": row.get::<_, String>(0)?,
            "display_name": row.get::<_, String>(1)?,
            "role": row.get::<_, String>(2)?,
            "queue_count": row.get::<_, i64>(3)?,
        }))).unwrap().filter_map(|r| r.ok()).collect();

    ok(StatisticsResponse {
        total, total_amount, archived_amount, high_risk_count,
        count_by_status, count_by_risk, handler_queue,
    })
}

#[post("/applications", format = "json", data = "<req>")]
fn create_application(db: &State<Db>, req: Json<CreateApplicationRequest>)
    -> (Status, Json<ApiResponse<Value>>)
{
    let conn = db.lock().unwrap();
    let op = match get_user(&conn, &req.operator_id) {
        Some(u) => u,
        None => return err_json(Status::BadRequest, "INVALID_OPERATOR", "操作人不存在", None, None),
    };
    if op.role != "REGISTRAR" {
        return err_json(Status::Forbidden, "ROLE_FORBIDDEN",
            &format!("仅融资申请登记员可创建申请单，当前角色{}", op.role), None, None);
    }
    if !valid_risk(&req.risk_level) {
        return err_json(Status::BadRequest, "INVALID_RISK", "风险等级无效", None, None);
    }
    if req.financing_amount <= 0.0 || req.financing_term_months <= 0 {
        return err_json(Status::BadRequest, "INVALID_INPUT", "融资金额和期限必须为正数", None, None);
    }
    if req.applicant_name.is_empty() || req.company_name.is_empty() {
        return err_json(Status::BadRequest, "INVALID_INPUT", "申请人与企业名称必填", None, None);
    }
    if req.required_evidence.is_empty() {
        return err_json(Status::BadRequest, "INVALID_INPUT", "至少选择一项必填证据", None, None);
    }

    let now = now_str();
    let id = Uuid::new_v4().to_string();
    let no = format!("RZZ-{}-{:04}",
        chrono::Local::now().format("%Y%m%d"), (rand_u32_simple() % 9999) + 1);
    let req_ev = serde_json::to_string(&req.required_evidence).unwrap();
    let subm_ev = serde_json::to_string(&req.submitted_evidence).unwrap();
    let status = "DRAFT";
    let version: i64 = 1;

    match conn.execute("INSERT INTO financing_applications (id, application_no, applicant_name, applicant_id_card,
        company_name, company_credit_code, financing_amount, financing_term_months,
        risk_level, status, current_handler, version, required_evidence, submitted_evidence,
        last_handler_id, last_opinion, last_result, created_by, created_at, updated_at)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)",
        params![id, no, req.applicant_name, req.applicant_id_card,
        req.company_name, req.company_credit_code, req.financing_amount, req.financing_term_months,
        req.risk_level, status, op.id, version, req_ev, subm_ev,
        None::<String>, None::<String>, None::<String>, op.id, now, now]
    ) {
        Ok(_) => {}
        Err(e) => return err_json(Status::InternalServerError, "DB_ERROR",
            &format!("数据库写入失败: {}", e), None, None),
    };

    if let Err(e) = insert_record(&conn, &id, &op.id, &op.role, "CREATE",
        None, Some(status), None, Some(&req.risk_level),
        Some("融资申请单创建成功"), "SUCCESS", 0, version) {
        return err_json(Status::InternalServerError, "RECORD_FAIL",
            &format!("操作记录写入失败: {}", e), Some(status), Some(version));
    }

    let result = json!({
        "id": id, "application_no": no,
        "success": true,
    });
    (Status::Created, ok_op(result, Some(status), Some(version), Some(&req.risk_level),
        Some(&op.id), Some(&op.display_name), Some("融资申请单创建成功"), Some("SUCCESS")))
}

#[post("/applications/submit", format = "json", data = "<req>")]
fn submit_application(db: &State<Db>, req: Json<SubmitApplicationRequest>)
    -> (Status, Json<ApiResponse<Value>>)
{
    let conn = db.lock().unwrap();
    let op = match get_user(&conn, &req.operator_id) {
        Some(u) => u,
        None => return err_json(Status::BadRequest, "INVALID_OPERATOR", "操作人不存在", None, None),
    };
    let app = match get_app(&conn, &req.application_id) {
        Some(a) => a,
        None => return err_json(Status::NotFound, "NOT_FOUND", "申请单不存在", None, None),
    };

    let cur_st = app.status.clone();
    let cur_v = app.version;
    let cur_rl = app.risk_level.clone();

    if app.version != req.expected_version {
        let _ = insert_record(&conn, &app.id, &op.id, &op.role, "SUBMIT",
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&cur_rl),
            Some(&format!("版本冲突: 期望v{}，实际v{}，请刷新重试", req.expected_version, app.version)),
            "VERSION_CONFLICT", cur_v, cur_v);
        return err_json(Status::Conflict, "VERSION_CONFLICT",
            &format!("版本冲突，请刷新重试 (期望v{}，实际v{})", req.expected_version, cur_v),
            Some(&cur_st), Some(cur_v));
    }
    if op.role != "REGISTRAR" {
        let _ = insert_record(&conn, &app.id, &op.id, &op.role, "SUBMIT",
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&cur_rl),
            Some(&format!("角色校验失败: {}", op.role)), "ROLE_FORBIDDEN", cur_v, cur_v);
        return err_json(Status::Forbidden, "ROLE_FORBIDDEN",
            &format!("仅融资申请登记员可提交，当前角色{}", op.role), Some(&cur_st), Some(cur_v));
    }
    if app.current_handler != op.id {
        let _ = insert_record(&conn, &app.id, &op.id, &op.role, "SUBMIT",
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&cur_rl),
            Some("当前处理人校验失败"), "NOT_HANDLER", cur_v, cur_v);
        return err_json(Status::Forbidden, "NOT_HANDLER",
            &format!("当前处理人是{}，您无权提交", app.current_handler_name.clone().unwrap_or(app.current_handler.clone())),
            Some(&cur_st), Some(cur_v));
    }
    if !matches!(app.status.as_str(), "DRAFT" | "RETURNED_FOR_CORRECTION" | "EVIDENCE_MISSING") {
        let _ = insert_record(&conn, &app.id, &op.id, &op.role, "SUBMIT",
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&cur_rl),
            Some(&format!("状态{}不允许提交", app.status)), "INVALID_STATUS", cur_v, cur_v);
        return err_json(Status::BadRequest, "INVALID_STATUS",
            &format!("当前状态{}不允许提交操作", app.status), Some(&cur_st), Some(cur_v));
    }

    let (submitted_ev_value, submitted_ev_str) = if let Some(ev) = &req.submitted_evidence {
        (json!(ev), serde_json::to_string(ev).unwrap())
    } else {
        (app.submitted_evidence.clone(), serde_json::to_string(&app.submitted_evidence).unwrap())
    };

    let (ok_ev, missing) = check_required_evidence(&app.required_evidence, &submitted_ev_value);
    if !ok_ev {
        let msg = format!("缺少必填证据: {}", missing.iter()
            .map(|s| s.as_str()).collect::<Vec<_>>().join(", "));
        let _ = insert_record(&conn, &app.id, &op.id, &op.role, "SUBMIT",
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&cur_rl),
            Some(&msg), "EVIDENCE_MISSING", cur_v, cur_v);
        return err_json(Status::BadRequest, "EVIDENCE_MISSING", &msg, Some(&cur_st), Some(cur_v));
    }

    let action = if app.status == "DRAFT" { "SUBMIT" } else { "CORRECT" };
    let result = if app.status == "DRAFT" { "SUBMITTED" } else { "CORRECTED" };
    let new_status = "PENDING_VERIFICATION";
    let new_version = cur_v + 1;
    let opinion = req.opinion.as_deref().unwrap_or(
        if app.status == "DRAFT" { "登记完成，提交审核主管核验" } else { "已补正，重新提交核验" }
    );

    let (auditor_id, auditor_name) = match find_handler_by_role(&conn, "AUDITOR", None) {
        Ok(x) => x,
        Err(e) => return err_json(Status::InternalServerError, "HANDLER_NOT_FOUND", &e, Some(&cur_st), Some(cur_v)),
    };

    if let Err(e) = update_app(&conn, &app.id, new_status, &auditor_id,
        Some(&op.id), Some(opinion), Some(result), None,
        Some(&submitted_ev_str), new_version)
    {
        let _ = insert_record(&conn, &app.id, &op.id, &op.role, action,
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&cur_rl),
            Some(&format!("状态更新失败: {}", e)), "DB_ERROR", cur_v, cur_v);
        return err_json(Status::InternalServerError, "DB_ERROR",
            &format!("数据库更新失败: {}", e), Some(&cur_st), Some(cur_v));
    }

    let _ = insert_record(&conn, &app.id, &op.id, &op.role, action,
        Some(&cur_st), Some(new_status), Some(&cur_rl), Some(&cur_rl),
        Some(opinion), result, cur_v, new_version);

    let payload = json!({
        "id": app.id, "application_no": app.application_no,
    });
    (Status::Ok, ok_op(payload, Some(new_status), Some(new_version), Some(&cur_rl),
        Some(&auditor_id), auditor_name.as_deref(), Some(opinion), Some(result)))
}

#[post("/applications/process", format = "json", data = "<req>")]
fn process_application(db: &State<Db>, req: Json<ProcessApplicationRequest>)
    -> (Status, Json<ApiResponse<Value>>)
{
    let conn = db.lock().unwrap();
    let op = match get_user(&conn, &req.operator_id) {
        Some(u) => u,
        None => return err_json(Status::BadRequest, "INVALID_OPERATOR", "操作人不存在", None, None),
    };
    let app = match get_app(&conn, &req.application_id) {
        Some(a) => a,
        None => return err_json(Status::NotFound, "NOT_FOUND", "申请单不存在", None, None),
    };

    let cur_st = app.status.clone();
    let cur_v = app.version;
    let cur_rl = app.risk_level.clone();

    if app.version != req.expected_version {
        let _ = insert_record(&conn, &app.id, &op.id, &op.role, &req.action,
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&cur_rl),
            Some(&format!("版本冲突: 期望v{}，实际v{}，请刷新重试", req.expected_version, cur_v)),
            "VERSION_CONFLICT", cur_v, cur_v);
        return err_json(Status::Conflict, "VERSION_CONFLICT",
            &format!("版本冲突，请刷新重试 (期望v{}，实际v{})", req.expected_version, cur_v),
            Some(&cur_st), Some(cur_v));
    }
    if op.role != "AUDITOR" {
        let _ = insert_record(&conn, &app.id, &op.id, &op.role, &req.action,
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&cur_rl),
            Some("仅审核主管可处理"), "ROLE_FORBIDDEN", cur_v, cur_v);
        return err_json(Status::Forbidden, "ROLE_FORBIDDEN",
            "仅融资申请审核主管可执行核验处理", Some(&cur_st), Some(cur_v));
    }
    if app.current_handler != op.id {
        let _ = insert_record(&conn, &app.id, &op.id, &op.role, &req.action,
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&cur_rl),
            Some("当前处理人校验失败"), "NOT_HANDLER", cur_v, cur_v);
        return err_json(Status::Forbidden, "NOT_HANDLER",
            "您不是当前处理人，无权处理该申请单", Some(&cur_st), Some(cur_v));
    }
    if req.opinion.trim().is_empty() {
        return err_json(Status::BadRequest, "OPINION_REQUIRED",
            "处理意见必须填写", Some(&cur_st), Some(cur_v));
    }

    let target_risk = req.new_risk_level.clone();
    if let Some(nrl) = &target_risk {
        if !valid_risk(nrl) {
            return err_json(Status::BadRequest, "INVALID_RISK", "风险等级无效", Some(&cur_st), Some(cur_v));
        }
    }

    /* 角色+状态下的动作路由 */
    let route: Result<(&str, Option<&str>, &str, &str), (Status, &str, &str)> =
        match (app.status.as_str(), req.action.as_str()) {
            ("PENDING_VERIFICATION", "VERIFY_PASS") =>
                Ok(("VERIFICATION_PASSED", None, "VERIFY_PASS", "VERIFIED")),
            ("PENDING_VERIFICATION", "VERIFY_PASS_AND_FORWARD") =>
                Ok(("REVIEW_PENDING", Some("REVIEWER"), "VERIFY_PASS", "REVIEW_PENDING")),
            ("PENDING_VERIFICATION", "VERIFY_FAIL_EVIDENCE") =>
                Ok(("EVIDENCE_MISSING", Some("REGISTRAR"), "VERIFY_FAIL_EVIDENCE", "EVIDENCE_MISSING")),
            ("PENDING_VERIFICATION", "VERIFY_FAIL_OVERDUE") =>
                Ok(("OVERDUE", Some("AUDITOR"), "VERIFY_FAIL_OVERDUE", "OVERDUE")),
            ("PENDING_VERIFICATION", "VERIFY_RETURN_CORRECTION") =>
                Ok(("RETURNED_FOR_CORRECTION", Some("REGISTRAR"), "VERIFY_RETURN_CORRECTION", "RETURNED")),
            ("PENDING_VERIFICATION", "VERIFY_CONFLICT") =>
                Ok(("STATUS_CONFLICT", Some("AUDITOR"), "VERIFY_CONFLICT", "CONFLICT")),
            ("STATUS_CONFLICT", "VERIFY_PASS_AND_FORWARD") =>
                Ok(("REVIEW_PENDING", Some("REVIEWER"), "VERIFY_PASS", "REVIEW_PENDING")),
            ("OVERDUE", "VERIFY_PASS_AND_FORWARD") =>
                Ok(("REVIEW_PENDING", Some("REVIEWER"), "VERIFY_PASS", "REVIEW_PENDING")),
            ("VERIFICATION_PASSED", "FORWARD") | ("VERIFICATION_PASSED", "VERIFY_PASS_AND_FORWARD") =>
                Ok(("REVIEW_PENDING", Some("REVIEWER"), "VERIFY_PASS", "REVIEW_PENDING")),
            (s, a) => Err((Status::BadRequest, "INVALID_ACTION",
                Box::leak(format!("当前状态{}不允许操作{}", s, a).into_boxed_str()))),
        };

    let (new_status, next_role, action_str, result_str) = match route {
        Ok(r) => r,
        Err((st, code, msg)) => {
            let _ = insert_record(&conn, &app.id, &op.id, &op.role, &req.action,
                Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&cur_rl),
                Some(msg), code, cur_v, cur_v);
            return err_json(st, code, msg, Some(&cur_st), Some(cur_v));
        }
    };

    /* 下一手处理人 */
    let (next_handler_id, next_handler_name) = match next_role {
        None => (op.id.clone(), Some(op.display_name.clone())),
        Some("AUDITOR") => (op.id.clone(), Some(op.display_name.clone())),
        Some("REGISTRAR") => {
            let n = conn.query_row::<String, _, _>(
                "SELECT display_name FROM users WHERE id=?1", params![app.created_by], |r| r.get(0)).ok();
            (app.created_by.clone(), n)
        }
        Some("REVIEWER") => match find_handler_by_role(&conn, "REVIEWER", None) {
            Ok(x) => x,
            Err(e) => return err_json(Status::InternalServerError, "HANDLER_NOT_FOUND", &e, Some(&cur_st), Some(cur_v)),
        }
        Some(r) => return err_json(Status::BadRequest, "HANDLER_NOT_FOUND",
            &format!("未知角色{}", r), Some(&cur_st), Some(cur_v)),
    };

    let final_risk = target_risk.clone().unwrap_or_else(|| cur_rl.clone());
    let risk_changed = final_risk != cur_rl;
    let risk_action = if risk_changed {
        if risk_order(&final_risk) > risk_order(&cur_rl) { "RISK_UPGRADE" } else { "RISK_DOWNGRADE" }
    } else { "" };
    let new_version = cur_v + 1;

    /* 风险变更先单独写入记录（留痕） */
    if risk_changed {
        let rr = if risk_action == "RISK_UPGRADE" { "RISK_UPGRADED" } else { "RISK_DOWNGRADED" };
        let risk_opinion = format!("风险等级由 {} 调整为 {}；原因：{}",
            RISK_LABEL_LOCAL(&cur_rl), RISK_LABEL_LOCAL(&final_risk), req.opinion);
        if let Err(e) = insert_record(&conn, &app.id, &op.id, &op.role, risk_action,
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&final_risk),
            Some(&risk_opinion), rr, cur_v, cur_v)
        {
            return err_json(Status::InternalServerError, "RECORD_FAIL",
                &format!("风险变更记录写入失败: {}", e), Some(&cur_st), Some(cur_v));
        }
    }

    if let Err(e) = update_app(&conn, &app.id, new_status, &next_handler_id,
        Some(&op.id), Some(&req.opinion), Some(result_str), Some(&final_risk),
        None, new_version)
    {
        let _ = insert_record(&conn, &app.id, &op.id, &op.role, action_str,
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&final_risk),
            Some(&format!("状态更新失败: {}", e)), "DB_ERROR", cur_v, cur_v);
        return err_json(Status::InternalServerError, "DB_ERROR",
            &format!("数据库更新失败: {}", e), Some(&cur_st), Some(cur_v));
    }

    if let Err(e) = insert_record(&conn, &app.id, &op.id, &op.role, action_str,
        Some(&cur_st), Some(new_status), Some(&cur_rl), Some(&final_risk),
        Some(&req.opinion), result_str, cur_v, new_version)
    {
        return err_json(Status::InternalServerError, "RECORD_FAIL",
            &format!("操作记录写入失败: {}", e), Some(new_status), Some(new_version));
    }

    let payload = json!({
        "id": app.id, "application_no": app.application_no,
    });
    (Status::Ok, ok_op(payload, Some(new_status), Some(new_version), Some(&final_risk),
        Some(&next_handler_id), next_handler_name.as_deref(),
        Some(&req.opinion), Some(result_str)))
}

fn RISK_LABEL_LOCAL(r: &str) -> &str {
    match r {
        "LOW" => "低风险", "MEDIUM" => "中风险", "HIGH" => "高风险", "CRITICAL" => "极高风险",
        _ => r,
    }
}

#[post("/applications/audit", format = "json", data = "<req>")]
fn audit_application(db: &State<Db>, req: Json<AuditRequest>)
    -> (Status, Json<ApiResponse<Value>>)
{
    let conn = db.lock().unwrap();
    let op = match get_user(&conn, &req.operator_id) {
        Some(u) => u,
        None => return err_json(Status::BadRequest, "INVALID_OPERATOR", "操作人不存在", None, None),
    };
    let app = match get_app(&conn, &req.application_id) {
        Some(a) => a,
        None => return err_json(Status::NotFound, "NOT_FOUND", "申请单不存在", None, None),
    };

    let cur_st = app.status.clone();
    let cur_v = app.version;
    let cur_rl = app.risk_level.clone();

    if app.version != req.expected_version {
        let act = if req.pass { "AUDIT_PASS" } else { "AUDIT_FAIL" };
        let _ = insert_record(&conn, &app.id, &op.id, &op.role, act,
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&cur_rl),
            Some(&format!("版本冲突: 期望v{}，实际v{}", req.expected_version, cur_v)),
            "VERSION_CONFLICT", cur_v, cur_v);
        return err_json(Status::Conflict, "VERSION_CONFLICT",
            &format!("版本冲突，请刷新重试 (期望v{}，实际v{})", req.expected_version, cur_v),
            Some(&cur_st), Some(cur_v));
    }
    if op.role != "REVIEWER" {
        let _ = insert_record(&conn, &app.id, &op.id, &op.role,
            if req.pass { "AUDIT_PASS" } else { "AUDIT_FAIL" },
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&cur_rl),
            Some("仅复核负责人可复核"), "ROLE_FORBIDDEN", cur_v, cur_v);
        return err_json(Status::Forbidden, "ROLE_FORBIDDEN",
            "仅供应链金融平台复核负责人可执行复核归档/驳回", Some(&cur_st), Some(cur_v));
    }
    if app.status != "REVIEW_PENDING" {
        return err_json(Status::BadRequest, "INVALID_STATUS",
            &format!("当前状态{}不是待复核状态", cur_st), Some(&cur_st), Some(cur_v));
    }
    if app.current_handler != op.id {
        return err_json(Status::Forbidden, "NOT_HANDLER",
            &format!("当前处理人是{}，您无权复核",
                app.current_handler_name.clone().unwrap_or(app.current_handler.clone())),
            Some(&cur_st), Some(cur_v));
    }
    if req.remark.trim().is_empty() {
        return err_json(Status::BadRequest, "OPINION_REQUIRED",
            "复核意见必须填写", Some(&cur_st), Some(cur_v));
    }

    let final_risk = req.new_risk_level.clone().unwrap_or_else(|| cur_rl.clone());
    if req.new_risk_level.is_some() && !valid_risk(&final_risk) {
        return err_json(Status::BadRequest, "INVALID_RISK", "风险等级无效", Some(&cur_st), Some(cur_v));
    }
    let risk_changed = final_risk != cur_rl;

    let new_version = cur_v + 1;
    let (new_status, main_action, main_result) = if req.pass {
        ("ARCHIVED", "REVIEW_PASS_ARCHIVE", "ARCHIVED")
    } else {
        ("REJECTED", "REVIEW_REJECT", "REJECTED")
    };

    /* 风险等级变更留痕（复核阶段最终认定） */
    if risk_changed {
        let ra = if risk_order(&final_risk) > risk_order(&cur_rl) { "RISK_UPGRADE" } else { "RISK_DOWNGRADE" };
        let rr = if ra == "RISK_UPGRADE" { "RISK_UPGRADED" } else { "RISK_DOWNGRADED" };
        let risk_opinion = format!("复核阶段最终认定：{} → {}；说明：{}",
            RISK_LABEL_LOCAL(&cur_rl), RISK_LABEL_LOCAL(&final_risk), req.remark);
        if let Err(e) = insert_record(&conn, &app.id, &op.id, &op.role, ra,
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&final_risk),
            Some(&risk_opinion), rr, cur_v, cur_v)
        {
            return err_json(Status::InternalServerError, "RECORD_FAIL",
                &format!("风险变更记录写入失败: {}", e), Some(&cur_st), Some(cur_v));
        }
    }

    if let Err(e) = update_app(&conn, &app.id, new_status, &op.id,
        Some(&op.id), Some(&req.remark), Some(main_result), Some(&final_risk),
        None, new_version)
    {
        let _ = insert_record(&conn, &app.id, &op.id, &op.role, main_action,
            Some(&cur_st), Some(&cur_st), Some(&cur_rl), Some(&final_risk),
            Some(&format!("状态更新失败: {}", e)), "DB_ERROR", cur_v, cur_v);
        return err_json(Status::InternalServerError, "DB_ERROR",
            &format!("数据库更新失败: {}", e), Some(&cur_st), Some(cur_v));
    }

    if let Err(e) = insert_record(&conn, &app.id, &op.id, &op.role, main_action,
        Some(&cur_st), Some(new_status), Some(&cur_rl), Some(&final_risk),
        Some(&req.remark), main_result, cur_v, new_version)
    {
        return err_json(Status::InternalServerError, "RECORD_FAIL",
            &format!("操作记录写入失败: {}", e), Some(new_status), Some(new_version));
    }

    let payload = json!({
        "id": app.id, "application_no": app.application_no,
    });
    (Status::Ok, ok_op(payload, Some(new_status), Some(new_version), Some(&final_risk),
        Some(&op.id), Some(&op.display_name), Some(&req.remark), Some(main_result)))
}

/* ======================= DB 初始化 ======================= */

fn init_db(db_path: &str) -> Connection {
    let is_new = !std::path::Path::new(db_path).exists();
    let conn = Connection::open(db_path).expect("数据库打开失败");
    conn.execute_batch(include_str!("../schema.sql")).expect("建表失败");
    if is_new {
        conn.execute_batch(include_str!("../seed_data.sql")).expect("样例数据初始化失败");
        println!("✅ 数据库初始化完成，已导入 schema + 样例数据");
    } else {
        println!("✅ 数据库已存在，跳过初始化 (path: {})", db_path);
    }
    conn
}

/* ======================= Rocket 启动 ======================= */

#[launch]
fn rocket() -> _ {
    let db_path = env::var("DB_PATH").unwrap_or_else(|_| "data/scf.db".to_string());
    let _ = std::fs::create_dir_all("data");
    let conn = init_db(&db_path);

    let rocket_port: u16 = env::var("ROCKET_PORT").ok()
        .and_then(|s| s.parse().ok())
        .or_else(|| env::var("PORT").ok().and_then(|s| s.parse().ok()))
        .unwrap_or(8004);

    println!("🚀 后端配置: 端口={}, 数据库={}", rocket_port, db_path);

    let cors = CorsOptions {
        allowed_origins: AllowedOrigins::all(),
        allowed_methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"]
            .iter().map(|s| s.parse().unwrap()).collect(),
        allowed_headers: rocket_cors::AllowedHeaders::all(),
        allow_credentials: false,
        max_age: Some(86400),
        ..Default::default()
    }.to_cors().expect("CORS 配置失败");

    rocket::build()
        .configure(rocket::Config {
            port: rocket_port,
            address: std::net::IpAddr::V4(std::net::Ipv4Addr::new(0, 0, 0, 0)),
            log_level: rocket::config::LogLevel::Normal,
            ..rocket::Config::default()
        })
        .manage(Mutex::new(conn))
        .attach(cors)
        .mount("/api", routes![
            list_users, list_applications, get_application, get_statistics,
            create_application, submit_application, process_application, audit_application
        ])
}
