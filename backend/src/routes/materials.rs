use rocket::{State, serde::json::Json, Route, get, post, put, delete, routes};
use crate::DbConn;
use crate::models::material::{
    LitigationMaterial, StatusLogEntry, CreateMaterialRequest, UpdateMaterialRequest,
    ReviewMaterialRequest, VerifyMaterialRequest, TakeTaskRequest,
};
use crate::models::attachment::{
    Attachment, AddAttachmentRequest, RejectAttachmentRequest, ValidateAttachmentRequest,
    has_required_attachments, missing_required_count,
};
use crate::models::batch::{
    BatchProcessRequest, BatchProcessResponse, BatchResultItem,
};
use crate::models::common::{ApiResponse, StatsSummary};
use crate::models::user::role_can;
use rusqlite::{params, Connection};
use uuid::Uuid;
use chrono::Local;
use serde_json;

pub fn routes() -> Vec<Route> {
    routes![
        list_materials, get_material, create_material, update_material,
        take_review_task, review_material, take_verify_task, verify_material,
        archive_material, resubmit_material,
        list_attachments, add_attachment, delete_attachment,
        reject_attachment, validate_attachment,
        list_status_logs, get_stats, batch_process, list_batch_tasks,
    ]
}

fn get_user_role(db: &Connection, user_id: &str) -> String {
    db.query_row(
        "SELECT role FROM users WHERE id = ?1",
        params![user_id],
        |row| row.get::<_, String>(0),
    ).unwrap_or_default()
}

fn get_user_name(db: &Connection, user_id: &str) -> String {
    db.query_row(
        "SELECT real_name FROM users WHERE id = ?1",
        params![user_id],
        |row| row.get::<_, String>(0),
    ).unwrap_or_default()
}

fn insert_status_log(db: &Connection,
    material_id: &str, from_status: Option<&str>, to_status: &str,
    operator_id: &str, operator_name: &str, action: &str, remark: Option<&str>)
{
    let id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();
    db.execute(
        "INSERT INTO material_status_logs (id, material_id, from_status, to_status, operator_id, operator_name, action, remark, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![id, material_id, from_status, to_status, operator_id, operator_name, action, remark, now],
    ).ok();
}

fn insert_audit(db: &Connection,
    material_id: Option<&str>, attachment_id: Option<&str>,
    operator_id: &str, operator_name: &str, operator_role: &str,
    action: &str, action_detail: Option<&str>, result: &str,
    fail_reason: Option<&str>, batch_id: Option<&str>)
{
    let id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();
    db.execute(
        "INSERT INTO audit_logs 
         (id, material_id, attachment_id, operator_id, operator_name, operator_role,
          action, action_detail, result, fail_reason, batch_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![id, material_id, attachment_id, operator_id, operator_name, operator_role,
                action, action_detail, result, fail_reason, batch_id, now],
    ).ok();
}

fn load_attachments(db: &Connection, material_id: &str) -> Vec<Attachment> {
    let mut stmt = db.prepare(
        "SELECT a.id, a.material_id, a.file_name, a.file_type, a.file_size,
                a.uploaded_by, u1.real_name, a.uploaded_at,
                a.is_required, a.status, a.reject_reason,
                a.rejected_by, u2.real_name, a.rejected_at
         FROM attachments a
         LEFT JOIN users u1 ON a.uploaded_by = u1.id
         LEFT JOIN users u2 ON a.rejected_by = u2.id
         WHERE a.material_id = ?1
         ORDER BY a.is_required DESC, a.uploaded_at ASC"
    ).unwrap();

    stmt.query_map(params![material_id], |row| {
        Ok(Attachment {
            id: row.get(0)?,
            material_id: row.get(1)?,
            file_name: row.get(2)?,
            file_type: row.get(3)?,
            file_size: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
            uploaded_by: row.get(5)?,
            uploaded_by_name: row.get(6)?,
            uploaded_at: row.get(7)?,
            is_required: row.get::<_, i64>(8)? != 0,
            status: row.get(9)?,
            reject_reason: row.get(10)?,
            rejected_by: row.get(11)?,
            rejected_by_name: row.get(12)?,
            rejected_at: row.get(13)?,
        })
    }).unwrap().filter_map(|r| r.ok()).collect()
}

fn load_status_logs(db: &Connection, material_id: &str) -> Vec<StatusLogEntry> {
    let mut stmt = db.prepare(
        "SELECT id, material_id, from_status, to_status, operator_id, operator_name,
                action, remark, created_at
         FROM material_status_logs
         WHERE material_id = ?1
         ORDER BY created_at ASC"
    ).unwrap();

    stmt.query_map(params![material_id], |row| {
        Ok(StatusLogEntry {
            id: row.get(0)?,
            material_id: row.get(1)?,
            from_status: row.get(2)?,
            to_status: row.get(3)?,
            operator_id: row.get(4)?,
            operator_name: row.get(5)?,
            action: row.get(6)?,
            remark: row.get(7)?,
            created_at: row.get(8)?,
        })
    }).unwrap().filter_map(|r| r.ok()).collect()
}

fn check_overdue(deadline: &Option<String>) -> (bool, i64) {
    if let Some(dl) = deadline {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(dl) {
            let now = Local::now();
            if now > dt {
                let diff = now - dt.with_timezone(&Local);
                return (true, diff.num_hours());
            }
        }
    }
    (false, 0)
}

fn load_material_from_row(db: &Connection, row: &rusqlite::Row<'_>) -> rusqlite::Result<LitigationMaterial> {
    let material_id: String = row.get(0)?;
    let (is_overdue, overdue_hours) = check_overdue(&row.get::<_, Option<String>>(11)?);
    
    Ok(LitigationMaterial {
        id: material_id.clone(),
        case_no: row.get(1)?,
        case_name: row.get(2)?,
        plaintiff: row.get(3)?,
        defendant: row.get(4)?,
        court_name: row.get(5)?,
        case_type: row.get(6)?,
        status: row.get(7)?,
        priority: row.get(8)?,
        deadline: row.get(11)?,
        registered_by: row.get(12)?,
        registered_by_name: row.get(13)?,
        registered_at: row.get(14)?,
        reviewed_by: row.get(15)?,
        reviewed_by_name: row.get(16)?,
        reviewed_at: row.get(17)?,
        verified_by: row.get(18)?,
        verified_by_name: row.get(19)?,
        verified_at: row.get(20)?,
        archived_by: row.get(21)?,
        archived_by_name: row.get(22)?,
        archived_at: row.get(23)?,
        reject_reason: row.get(24)?,
        audit_remark: row.get(25)?,
        is_overdue,
        overdue_hours,
        attachments: Some(load_attachments(db, &material_id)),
        status_logs: Some(load_status_logs(db, &material_id)),
    })
}

fn material_select_sql() -> &'static str {
    "SELECT m.id, m.case_no, m.case_name, m.plaintiff, m.defendant, m.court_name,
            m.case_type, m.status, m.priority, m.is_overdue, m.overdue_hours,
            m.deadline,
            m.registered_by, u1.real_name, m.registered_at,
            m.reviewed_by, u2.real_name, m.reviewed_at,
            m.verified_by, u3.real_name, m.verified_at,
            m.archived_by, u4.real_name, m.archived_at,
            m.reject_reason, m.audit_remark
     FROM litigation_materials m
     LEFT JOIN users u1 ON m.registered_by = u1.id
     LEFT JOIN users u2 ON m.reviewed_by = u2.id
     LEFT JOIN users u3 ON m.verified_by = u3.id
     LEFT JOIN users u4 ON m.archived_by = u4.id"
}

#[get("/?<status>&<keyword>&<case_type>&<priority>&<is_overdue>&<operator_role>&<operator_id>")]
pub fn list_materials(
    conn: &State<DbConn>,
    status: Option<String>, keyword: Option<String>, case_type: Option<String>,
    priority: Option<String>, is_overdue: Option<bool>,
    operator_role: Option<String>, operator_id: Option<String>,
) -> Json<ApiResponse<Vec<LitigationMaterial>>> {
    let db = conn.conn.lock().unwrap();
    
    let mut sql = material_select_sql().to_string();
    let mut conditions: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    
    if let Some(s) = &status {
        if !s.is_empty() {
            conditions.push("m.status = ?".to_string());
            param_values.push(Box::new(s.clone()));
        }
    }
    if let Some(ct) = &case_type {
        if !ct.is_empty() {
            conditions.push("m.case_type = ?".to_string());
            param_values.push(Box::new(ct.clone()));
        }
    }
    if let Some(p) = &priority {
        if !p.is_empty() {
            conditions.push("m.priority = ?".to_string());
            param_values.push(Box::new(p.clone()));
        }
    }
    if let Some(io) = is_overdue {
        if io {
            conditions.push("m.deadline IS NOT NULL AND datetime(m.deadline) < datetime('now', '+08:00')".to_string());
        }
    }
    if let Some(k) = &keyword {
        if !k.is_empty() {
            let like = format!("%{}%", k);
            conditions.push("(m.case_no LIKE ? OR m.case_name LIKE ? OR m.plaintiff LIKE ? OR m.defendant LIKE ?)".to_string());
            param_values.push(Box::new(like.clone()));
            param_values.push(Box::new(like.clone()));
            param_values.push(Box::new(like.clone()));
            param_values.push(Box::new(like));
        }
    }
    if let Some(or) = &operator_role {
        if !or.is_empty() {
            match or.as_str() {
                "registrar" => {
                    if let Some(oid) = &operator_id {
                        conditions.push("(m.registered_by = ? OR m.status = 'returned')".to_string());
                        param_values.push(Box::new(oid.clone()));
                    }
                }
                "reviewer" => {
                    conditions.push("(m.status IN ('registered','returned','reviewing'))".to_string());
                }
                "verifier" => {
                    conditions.push("(m.status IN ('review_passed','verifying','verified','archived'))".to_string());
                }
                _ => {}
            }
        }
    }
    
    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }
    sql.push_str(" ORDER BY 
        CASE m.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
        CASE WHEN m.deadline IS NOT NULL AND datetime(m.deadline) < datetime('now', '+08:00') THEN 0 ELSE 1 END,
        m.registered_at DESC");

    let mut stmt = db.prepare(&sql).unwrap();
    let params_refs: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|b| b.as_ref()).collect();
    
    let rows = stmt.query_map(params_refs.as_slice(), |row| load_material_from_row(&db, row)).unwrap();
    let materials: Vec<LitigationMaterial> = rows.filter_map(|r| r.ok()).collect();
    
    let total = materials.len() as i64;
    Json(ApiResponse::ok_with_total(materials, total, "查询成功"))
}

#[get("/<id>")]
pub fn get_material(conn: &State<DbConn>, id: String) -> Json<ApiResponse<LitigationMaterial>> {
    let db = conn.conn.lock().unwrap();
    
    let mut stmt = db.prepare(&format!("{} WHERE m.id = ?1", material_select_sql())).unwrap();
    
    match stmt.query_row(params![id], |row| load_material_from_row(&db, row)) {
        Ok(m) => Json(ApiResponse::ok(m, "查询成功")),
        Err(_) => Json(ApiResponse::err("材料单不存在")),
    }
}

#[post("/", format = "json", data = "<req>")]
pub fn create_material(conn: &State<DbConn>, req: Json<CreateMaterialRequest>) -> Json<ApiResponse<LitigationMaterial>> {
    let db = conn.conn.lock().unwrap();
    
    let role = get_user_role(&db, &req.operator_id);
    if !role_can(&role, "register") {
        return Json(ApiResponse::err("当前角色无权发起登记"));
    }

    let id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();
    let operator_name = get_user_name(&db, &req.operator_id);
    let priority = req.priority.clone().unwrap_or_else(|| "normal".into());

    let result = db.execute(
        "INSERT INTO litigation_materials
         (id, case_no, case_name, plaintiff, defendant, court_name, case_type,
          status, priority, deadline, registered_by, registered_at, is_overdue, overdue_hours)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 0, 0)",
        params![id, req.case_no, req.case_name, req.plaintiff, req.defendant,
                req.court_name, req.case_type, "registered", priority, req.deadline,
                req.operator_id, now],
    );

    match result {
        Ok(_) => {
            insert_status_log(&db, &id, None, "registered", &req.operator_id, &operator_name,
                "register", Some("新建诉讼材料登记"));
            let (overdue, _) = check_overdue(&req.deadline);
            insert_audit(&db, Some(&id), None, &req.operator_id, &operator_name, &role,
                "register", Some(&format!("登记案件 {}", req.case_no)),
                if overdue { "fail" } else { "success" },
                if overdue { Some("已超过截止日期，系统自动标记为超期") } else { None }, None);

            let mut stmt = db.prepare(&format!("{} WHERE m.id = ?1", material_select_sql())).unwrap();
            match stmt.query_row(params![id], |row| load_material_from_row(&db, row)) {
                Ok(m) => Json(ApiResponse::ok(m, "登记成功")),
                Err(e) => Json(ApiResponse::err(&format!("查询失败: {}", e))),
            }
        }
        Err(e) => Json(ApiResponse::err(&format!("登记失败: {}", e))),
    }
}

#[put("/<id>", format = "json", data = "<req>")]
pub fn update_material(
    conn: &State<DbConn>, id: String, req: Json<UpdateMaterialRequest>,
) -> Json<ApiResponse<LitigationMaterial>> {
    let db = conn.conn.lock().unwrap();
    
    let cur_status: String = db.query_row(
        "SELECT status FROM litigation_materials WHERE id = ?1",
        params![id],
        |row| row.get(0),
    ).unwrap_or_default();

    if cur_status == "registered" || cur_status == "returned" {
        if let Some(cn) = &req.case_name {
            db.execute("UPDATE litigation_materials SET case_name = ?1 WHERE id = ?2",
                params![cn, id]).ok();
        }
        if let Some(p) = &req.plaintiff {
            db.execute("UPDATE litigation_materials SET plaintiff = ?1 WHERE id = ?2",
                params![p, id]).ok();
        }
        if let Some(d) = &req.defendant {
            db.execute("UPDATE litigation_materials SET defendant = ?1 WHERE id = ?2",
                params![d, id]).ok();
        }
        if let Some(c) = &req.court_name {
            db.execute("UPDATE litigation_materials SET court_name = ?1 WHERE id = ?2",
                params![c, id]).ok();
        }
        if let Some(t) = &req.case_type {
            db.execute("UPDATE litigation_materials SET case_type = ?1 WHERE id = ?2",
                params![t, id]).ok();
        }
        if let Some(p) = &req.priority {
            db.execute("UPDATE litigation_materials SET priority = ?1 WHERE id = ?2",
                params![p, id]).ok();
        }
        if let Some(dl) = &req.deadline {
            db.execute("UPDATE litigation_materials SET deadline = ?1 WHERE id = ?2",
                params![dl, id]).ok();
        }

        let mut stmt = db.prepare(&format!("{} WHERE m.id = ?1", material_select_sql())).unwrap();
        match stmt.query_row(params![id], |row| load_material_from_row(&db, row)) {
            Ok(m) => Json(ApiResponse::ok(m, "更新成功")),
            Err(e) => Json(ApiResponse::err(&format!("查询失败: {}", e))),
        }
    } else {
        Json(ApiResponse::err(&format!("当前状态 {} 不可修改基础信息", cur_status)))
    }
}

#[post("/<id>/take_review", format = "json", data = "<req>")]
pub fn take_review_task(conn: &State<DbConn>, id: String, req: Json<TakeTaskRequest>) -> Json<ApiResponse<LitigationMaterial>> {
    let db = conn.conn.lock().unwrap();
    
    let role = get_user_role(&db, &req.operator_id);
    if !role_can(&role, "review") {
        return Json(ApiResponse::err("当前角色无权审核"));
    }

    let cur_status: String = db.query_row(
        "SELECT status FROM litigation_materials WHERE id = ?1",
        params![id], |row| row.get(0),
    ).unwrap_or_default();

    if cur_status != "registered" && cur_status != "returned" {
        return Json(ApiResponse::err(&format!("当前状态 {} 不可领取审核", cur_status)));
    }

    let attachments = load_attachments(&db, &id);
    if cur_status == "returned" && !has_required_attachments(&attachments) {
        let missing = missing_required_count(&attachments);
        return Json(ApiResponse::err(&format!("仍有 {} 个必填附件缺失或被驳回，请先补正后再提交审核", missing)));
    }

    let now = Local::now().to_rfc3339();
    let operator_name = get_user_name(&db, &req.operator_id);
    
    db.execute(
        "UPDATE litigation_materials SET status = 'reviewing', reviewed_by = ?1, reviewed_at = ?2, reject_reason = NULL WHERE id = ?3",
        params![req.operator_id, now, id],
    ).ok();

    insert_status_log(&db, &id, Some(&cur_status), "reviewing", &req.operator_id, &operator_name,
        "start_review", Some("领取审核任务"));
    insert_audit(&db, Some(&id), None, &req.operator_id, &operator_name, &role,
        "start_review", Some("领取审核任务"), "success", None, None);

    let mut stmt = db.prepare(&format!("{} WHERE m.id = ?1", material_select_sql())).unwrap();
    match stmt.query_row(params![id], |row| load_material_from_row(&db, row)) {
        Ok(m) => Json(ApiResponse::ok(m, "已领取审核任务")),
        Err(e) => Json(ApiResponse::err(&format!("{}", e))),
    }
}

#[post("/<id>/review", format = "json", data = "<req>")]
pub fn review_material(conn: &State<DbConn>, id: String, req: Json<ReviewMaterialRequest>) -> Json<ApiResponse<LitigationMaterial>> {
    let db = conn.conn.lock().unwrap();
    
    let role = get_user_role(&db, &req.operator_id);
    if !role_can(&role, "review") {
        return Json(ApiResponse::err("当前角色无权审核"));
    }

    let cur_status: String = db.query_row(
        "SELECT status FROM litigation_materials WHERE id = ?1",
        params![id], |row| row.get(0),
    ).unwrap_or_default();

    if cur_status != "reviewing" {
        return Json(ApiResponse::err(&format!("当前状态 {} 不可执行审核", cur_status)));
    }

    let operator_name = get_user_name(&db, &req.operator_id);
    let now = Local::now().to_rfc3339();

    if req.pass {
        let attachments = load_attachments(&db, &id);
        if !has_required_attachments(&attachments) {
            return Json(ApiResponse::err("存在必填附件缺失或被驳回，审核不能通过"));
        }

        db.execute(
            "UPDATE litigation_materials SET status = 'review_passed', audit_remark = ?1 WHERE id = ?2",
            params![req.audit_remark, id],
        ).ok();

        insert_status_log(&db, &id, Some("reviewing"), "review_passed", &req.operator_id, &operator_name,
            "pass_review", req.audit_remark.as_deref());
        insert_audit(&db, Some(&id), None, &req.operator_id, &operator_name, &role,
            "pass_review", Some("材料完整，审核通过"), "success", None, None);
    } else {
        db.execute(
            "UPDATE litigation_materials SET status = 'returned', reject_reason = ?1, audit_remark = ?2 WHERE id = ?3",
            params![req.reject_reason, req.audit_remark, id],
        ).ok();

        insert_status_log(&db, &id, Some("reviewing"), "returned", &req.operator_id, &operator_name,
            "return_material", req.reject_reason.as_deref());
        insert_audit(&db, Some(&id), None, &req.operator_id, &operator_name, &role,
            "return_material", Some("退回补正材料"), "fail",
            req.reject_reason.as_deref(), None);
    }

    let mut stmt = db.prepare(&format!("{} WHERE m.id = ?1", material_select_sql())).unwrap();
    match stmt.query_row(params![id], |row| load_material_from_row(&db, row)) {
        Ok(m) => Json(ApiResponse::ok(m, if req.pass { "审核通过" } else { "已退回补正" })),
        Err(e) => Json(ApiResponse::err(&format!("{}", e))),
    }
}

#[post("/<id>/take_verify", format = "json", data = "<req>")]
pub fn take_verify_task(conn: &State<DbConn>, id: String, req: Json<TakeTaskRequest>) -> Json<ApiResponse<LitigationMaterial>> {
    let db = conn.conn.lock().unwrap();
    
    let role = get_user_role(&db, &req.operator_id);
    if !role_can(&role, "verify") {
        return Json(ApiResponse::err("当前角色无权复核"));
    }

    let cur_status: String = db.query_row(
        "SELECT status FROM litigation_materials WHERE id = ?1",
        params![id], |row| row.get(0),
    ).unwrap_or_default();

    if cur_status != "review_passed" {
        return Json(ApiResponse::err(&format!("当前状态 {} 不可领取复核", cur_status)));
    }

    let now = Local::now().to_rfc3339();
    let operator_name = get_user_name(&db, &req.operator_id);
    
    db.execute(
        "UPDATE litigation_materials SET status = 'verifying', verified_by = ?1, verified_at = ?2 WHERE id = ?3",
        params![req.operator_id, now, id],
    ).ok();

    insert_status_log(&db, &id, Some("review_passed"), "verifying", &req.operator_id, &operator_name,
        "start_verify", Some("领取复核任务"));
    insert_audit(&db, Some(&id), None, &req.operator_id, &operator_name, &role,
        "start_verify", Some("领取复核任务"), "success", None, None);

    let mut stmt = db.prepare(&format!("{} WHERE m.id = ?1", material_select_sql())).unwrap();
    match stmt.query_row(params![id], |row| load_material_from_row(&db, row)) {
        Ok(m) => Json(ApiResponse::ok(m, "已领取复核任务")),
        Err(e) => Json(ApiResponse::err(&format!("{}", e))),
    }
}

#[post("/<id>/verify", format = "json", data = "<req>")]
pub fn verify_material(conn: &State<DbConn>, id: String, req: Json<VerifyMaterialRequest>) -> Json<ApiResponse<LitigationMaterial>> {
    let db = conn.conn.lock().unwrap();
    
    let role = get_user_role(&db, &req.operator_id);
    if !role_can(&role, "verify") {
        return Json(ApiResponse::err("当前角色无权复核"));
    }

    let cur_status: String = db.query_row(
        "SELECT status FROM litigation_materials WHERE id = ?1",
        params![id], |row| row.get(0),
    ).unwrap_or_default();

    if cur_status != "verifying" {
        return Json(ApiResponse::err(&format!("当前状态 {} 不可执行复核", cur_status)));
    }

    let operator_name = get_user_name(&db, &req.operator_id);

    if req.pass {
        let now = Local::now().to_rfc3339();
        let should_archive = req.archive.unwrap_or(false);
        let final_status = if should_archive { "archived" } else { "verified" };
        
        if should_archive {
            db.execute(
                "UPDATE litigation_materials SET status = 'archived', audit_remark = ?1, archived_by = ?2, archived_at = ?3 WHERE id = ?4",
                params![req.audit_remark, req.operator_id, now, id],
            ).ok();

            insert_status_log(&db, &id, Some("verifying"), "verified", &req.operator_id, &operator_name,
                "pass_verify", req.audit_remark.as_deref());
            insert_status_log(&db, &id, Some("verified"), "archived", &req.operator_id, &operator_name,
                "archive", Some("复核通过后直接归档"));
            insert_audit(&db, Some(&id), None, &req.operator_id, &operator_name, &role,
                "archive", Some("复核通过并归档"), "success", None, None);
        } else {
            db.execute(
                "UPDATE litigation_materials SET status = 'verified', audit_remark = ?1 WHERE id = ?2",
                params![req.audit_remark, id],
            ).ok();

            insert_status_log(&db, &id, Some("verifying"), "verified", &req.operator_id, &operator_name,
                "pass_verify", req.audit_remark.as_deref());
            insert_audit(&db, Some(&id), None, &req.operator_id, &operator_name, &role,
                "pass_verify", Some("材料复核通过"), "success", None, None);
        }
    } else {
        db.execute(
            "UPDATE litigation_materials SET status = 'returned', reject_reason = ?1, audit_remark = ?2 WHERE id = ?3",
            params![req.reject_reason, req.audit_remark, id],
        ).ok();

        insert_status_log(&db, &id, Some("verifying"), "returned", &req.operator_id, &operator_name,
            "reject_verify", req.reject_reason.as_deref());
        insert_audit(&db, Some(&id), None, &req.operator_id, &operator_name, &role,
            "reject_verify", Some("复核不通过退回"), "fail",
            req.reject_reason.as_deref(), None);
    }

    let mut stmt = db.prepare(&format!("{} WHERE m.id = ?1", material_select_sql())).unwrap();
    match stmt.query_row(params![id], |row| load_material_from_row(&db, row)) {
        Ok(m) => Json(ApiResponse::ok(m, if req.pass { "复核通过" } else { "复核不通过" })),
        Err(e) => Json(ApiResponse::err(&format!("{}", e))),
    }
}

#[post("/<id>/archive", format = "json", data = "<req>")]
pub fn archive_material(conn: &State<DbConn>, id: String, req: Json<TakeTaskRequest>) -> Json<ApiResponse<LitigationMaterial>> {
    let db = conn.conn.lock().unwrap();
    
    let role = get_user_role(&db, &req.operator_id);
    if !role_can(&role, "archive") {
        return Json(ApiResponse::err("当前角色无权归档"));
    }

    let cur_status: String = db.query_row(
        "SELECT status FROM litigation_materials WHERE id = ?1",
        params![id], |row| row.get(0),
    ).unwrap_or_default();

    if cur_status != "verified" {
        return Json(ApiResponse::err(&format!("当前状态 {} 不可归档", cur_status)));
    }

    let operator_name = get_user_name(&db, &req.operator_id);
    let now = Local::now().to_rfc3339();

    db.execute(
        "UPDATE litigation_materials SET status = 'archived', archived_by = ?1, archived_at = ?2 WHERE id = ?3",
        params![req.operator_id, now, id],
    ).ok();

    insert_status_log(&db, &id, Some("verified"), "archived", &req.operator_id, &operator_name,
        "archive", Some("完成归档"));
    insert_audit(&db, Some(&id), None, &req.operator_id, &operator_name, &role,
        "archive", Some("完成归档"), "success", None, None);

    let mut stmt = db.prepare(&format!("{} WHERE m.id = ?1", material_select_sql())).unwrap();
    match stmt.query_row(params![id], |row| load_material_from_row(&db, row)) {
        Ok(m) => Json(ApiResponse::ok(m, "已归档")),
        Err(e) => Json(ApiResponse::err(&format!("{}", e))),
    }
}

#[post("/<id>/resubmit", format = "json", data = "<req>")]
pub fn resubmit_material(conn: &State<DbConn>, id: String, req: Json<TakeTaskRequest>) -> Json<ApiResponse<LitigationMaterial>> {
    let db = conn.conn.lock().unwrap();
    
    let role = get_user_role(&db, &req.operator_id);
    if !role_can(&role, "register") {
        return Json(ApiResponse::err("当前角色无权重新提交"));
    }

    let cur_status: String = db.query_row(
        "SELECT status FROM litigation_materials WHERE id = ?1",
        params![id], |row| row.get(0),
    ).unwrap_or_default();

    if cur_status != "returned" {
        return Json(ApiResponse::err(&format!("当前状态 {} 不可重新提交", cur_status)));
    }

    let attachments = load_attachments(&db, &id);
    if !has_required_attachments(&attachments) {
        let missing = missing_required_count(&attachments);
        return Json(ApiResponse::err(&format!("仍有 {} 个必填附件缺失或被驳回，请先补正", missing)));
    }

    let operator_name = get_user_name(&db, &req.operator_id);
    db.execute(
        "UPDATE litigation_materials SET status = 'registered', reject_reason = NULL WHERE id = ?1",
        params![id],
    ).ok();

    insert_status_log(&db, &id, Some("returned"), "registered", &req.operator_id, &operator_name,
        "resubmit", Some("补齐附件后重新提交"));
    insert_audit(&db, Some(&id), None, &req.operator_id, &operator_name, &role,
        "resubmit", Some("补正后重新提交审核"), "success", None, None);

    let mut stmt = db.prepare(&format!("{} WHERE m.id = ?1", material_select_sql())).unwrap();
    match stmt.query_row(params![id], |row| load_material_from_row(&db, row)) {
        Ok(m) => Json(ApiResponse::ok(m, "已重新提交")),
        Err(e) => Json(ApiResponse::err(&format!("{}", e))),
    }
}

#[get("/<id>/attachments")]
pub fn list_attachments(conn: &State<DbConn>, id: String) -> Json<ApiResponse<Vec<Attachment>>> {
    let db = conn.conn.lock().unwrap();
    let atts = load_attachments(&db, &id);
    Json(ApiResponse::ok(atts, "查询成功"))
}

#[post("/<id>/attachments", format = "json", data = "<req>")]
pub fn add_attachment(conn: &State<DbConn>, id: String, req: Json<AddAttachmentRequest>) -> Json<ApiResponse<Attachment>> {
    let db = conn.conn.lock().unwrap();
    
    let role = get_user_role(&db, &req.operator_id);
    if !role_can(&role, "manage_attachment") {
        return Json(ApiResponse::err("当前角色无权添加附件"));
    }

    let cur_status: String = db.query_row(
        "SELECT status FROM litigation_materials WHERE id = ?1",
        params![id], |row| row.get(0),
    ).unwrap_or_default();

    if !(cur_status == "registered" || cur_status == "returned" || cur_status == "reviewing") {
        return Json(ApiResponse::err(&format!("当前状态 {} 不可添加附件", cur_status)));
    }

    let att_id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();
    let operator_name = get_user_name(&db, &req.operator_id);
    let is_required = req.is_required.unwrap_or(true);

    db.execute(
        "INSERT INTO attachments (id, material_id, file_name, file_type, file_size, uploaded_by, uploaded_at, is_required, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'valid')",
        params![att_id, id, req.file_name, req.file_type, req.file_size.unwrap_or(1024),
                req.operator_id, now, if is_required { 1 } else { 0 }],
    ).ok();

    insert_audit(&db, Some(&id), Some(&att_id), &req.operator_id, &operator_name, &role,
        "add_attachment", Some(&format!("添加附件：{}", req.file_name)),
        "success", None, None);

    let result = db.query_row(
        "SELECT a.id, a.material_id, a.file_name, a.file_type, a.file_size,
                a.uploaded_by, u.real_name, a.uploaded_at,
                a.is_required, a.status, a.reject_reason,
                a.rejected_by, NULL, a.rejected_at
         FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id
         WHERE a.id = ?1",
        params![att_id],
        |row| Ok(Attachment {
            id: row.get(0)?,
            material_id: row.get(1)?,
            file_name: row.get(2)?,
            file_type: row.get(3)?,
            file_size: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
            uploaded_by: row.get(5)?,
            uploaded_by_name: row.get(6)?,
            uploaded_at: row.get(7)?,
            is_required: row.get::<_, i64>(8)? != 0,
            status: row.get(9)?,
            reject_reason: row.get(10)?,
            rejected_by: row.get(11)?,
            rejected_by_name: row.get(12)?,
            rejected_at: row.get(13)?,
        }),
    );

    match result {
        Ok(a) => Json(ApiResponse::ok(a, "附件已添加")),
        Err(e) => Json(ApiResponse::err(&format!("{}", e))),
    }
}

#[delete("/<id>/attachments/<att_id>")]
pub fn delete_attachment(conn: &State<DbConn>, id: String, att_id: String) -> Json<ApiResponse<()>> {
    let db = conn.conn.lock().unwrap();
    
    let (m_status, is_rejected): (String, String) = db.query_row(
        "SELECT m.status, a.status FROM attachments a JOIN litigation_materials m ON a.material_id = m.id WHERE a.id = ?1",
        params![att_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
    ).unwrap_or_default();

    if !(m_status == "registered" || m_status == "returned") {
        return Json(ApiResponse::err("当前状态不可删除附件"));
    }
    if is_rejected == "rejected" {
        return Json(ApiResponse::err("被驳回的附件不可删除，可重新上传新附件替换"));
    }

    db.execute("DELETE FROM attachments WHERE id = ?1", params![att_id]).ok();
    Json(ApiResponse::ok_msg("附件已删除"))
}

#[post("/<id>/attachments/<att_id>/reject", format = "json", data = "<req>")]
pub fn reject_attachment(
    conn: &State<DbConn>, id: String, att_id: String, req: Json<RejectAttachmentRequest>,
) -> Json<ApiResponse<Attachment>> {
    let db = conn.conn.lock().unwrap();
    
    let role = get_user_role(&db, &req.operator_id);
    if !role_can(&role, "reject_attachment") {
        return Json(ApiResponse::err("当前角色无权驳回附件"));
    }

    let now = Local::now().to_rfc3339();
    let operator_name = get_user_name(&db, &req.operator_id);
    let file_name: String = db.query_row(
        "SELECT file_name FROM attachments WHERE id = ?1",
        params![att_id], |row| row.get(0),
    ).unwrap_or_default();

    db.execute(
        "UPDATE attachments SET status = 'rejected', reject_reason = ?1, rejected_by = ?2, rejected_at = ?3 WHERE id = ?4",
        params![req.reject_reason, req.operator_id, now, att_id],
    ).ok();

    insert_audit(&db, Some(&id), Some(&att_id), &req.operator_id, &operator_name, &role,
        "reject_attachment", Some(&format!("驳回附件：{}", file_name)),
        "fail", Some(&req.reject_reason), None);

    let result = db.query_row(
        "SELECT a.id, a.material_id, a.file_name, a.file_type, a.file_size,
                a.uploaded_by, u1.real_name, a.uploaded_at,
                a.is_required, a.status, a.reject_reason,
                a.rejected_by, u2.real_name, a.rejected_at
         FROM attachments a
         LEFT JOIN users u1 ON a.uploaded_by = u1.id
         LEFT JOIN users u2 ON a.rejected_by = u2.id
         WHERE a.id = ?1",
        params![att_id],
        |row| Ok(Attachment {
            id: row.get(0)?,
            material_id: row.get(1)?,
            file_name: row.get(2)?,
            file_type: row.get(3)?,
            file_size: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
            uploaded_by: row.get(5)?,
            uploaded_by_name: row.get(6)?,
            uploaded_at: row.get(7)?,
            is_required: row.get::<_, i64>(8)? != 0,
            status: row.get(9)?,
            reject_reason: row.get(10)?,
            rejected_by: row.get(11)?,
            rejected_by_name: row.get(12)?,
            rejected_at: row.get(13)?,
        }),
    );

    match result {
        Ok(a) => Json(ApiResponse::ok(a, "附件已驳回")),
        Err(e) => Json(ApiResponse::err(&format!("{}", e))),
    }
}

#[post("/<id>/attachments/<att_id>/validate", format = "json", data = "<req>")]
pub fn validate_attachment(
    conn: &State<DbConn>, id: String, att_id: String, req: Json<ValidateAttachmentRequest>,
) -> Json<ApiResponse<Attachment>> {
    let db = conn.conn.lock().unwrap();
    
    let role = get_user_role(&db, &req.operator_id);
    if !role_can(&role, "review") {
        return Json(ApiResponse::err("当前角色无权恢复附件状态"));
    }

    db.execute(
        "UPDATE attachments SET status = 'valid', reject_reason = NULL, rejected_by = NULL, rejected_at = NULL WHERE id = ?1",
        params![att_id],
    ).ok();

    let result = db.query_row(
        "SELECT a.id, a.material_id, a.file_name, a.file_type, a.file_size,
                a.uploaded_by, u1.real_name, a.uploaded_at,
                a.is_required, a.status, a.reject_reason,
                a.rejected_by, u2.real_name, a.rejected_at
         FROM attachments a
         LEFT JOIN users u1 ON a.uploaded_by = u1.id
         LEFT JOIN users u2 ON a.rejected_by = u2.id
         WHERE a.id = ?1",
        params![att_id],
        |row| Ok(Attachment {
            id: row.get(0)?,
            material_id: row.get(1)?,
            file_name: row.get(2)?,
            file_type: row.get(3)?,
            file_size: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
            uploaded_by: row.get(5)?,
            uploaded_by_name: row.get(6)?,
            uploaded_at: row.get(7)?,
            is_required: row.get::<_, i64>(8)? != 0,
            status: row.get(9)?,
            reject_reason: row.get(10)?,
            rejected_by: row.get(11)?,
            rejected_by_name: row.get(12)?,
            rejected_at: row.get(13)?,
        }),
    );

    match result {
        Ok(a) => Json(ApiResponse::ok(a, "附件已恢复有效")),
        Err(e) => Json(ApiResponse::err(&format!("{}", e))),
    }
}

#[get("/<id>/logs")]
pub fn list_status_logs(conn: &State<DbConn>, id: String) -> Json<ApiResponse<Vec<StatusLogEntry>>> {
    let db = conn.conn.lock().unwrap();
    let logs = load_status_logs(&db, &id);
    Json(ApiResponse::ok(logs, "查询成功"))
}

#[get("/stats/summary")]
pub fn get_stats(conn: &State<DbConn>) -> Json<ApiResponse<StatsSummary>> {
    let db = conn.conn.lock().unwrap();
    
    let count_by_status = |s: &str| -> i64 {
        db.query_row(
            "SELECT COUNT(*) FROM litigation_materials WHERE status = ?1",
            params![s], |row| row.get(0),
        ).unwrap_or(0)
    };

    let total: i64 = db.query_row("SELECT COUNT(*) FROM litigation_materials", [], |row| row.get(0)).unwrap_or(0);
    let overdue: i64 = db.query_row(
        "SELECT COUNT(*) FROM litigation_materials WHERE deadline IS NOT NULL AND datetime(deadline) < datetime('now', '+08:00') AND status NOT IN ('archived')",
        [], |row| row.get(0),
    ).unwrap_or(0);

    let att_issue: i64 = db.query_row(
        "SELECT COUNT(DISTINCT m.id) FROM litigation_materials m
         JOIN attachments a ON a.material_id = m.id
         WHERE a.is_required = 1 AND a.status = 'rejected'
         AND m.status NOT IN ('archived')",
        [], |row| row.get(0),
    ).unwrap_or(0);

    Json(ApiResponse::ok(StatsSummary {
        total,
        registered: count_by_status("registered"),
        reviewing: count_by_status("reviewing"),
        review_passed: count_by_status("review_passed"),
        returned: count_by_status("returned"),
        verifying: count_by_status("verifying"),
        verified: count_by_status("verified"),
        archived: count_by_status("archived"),
        overdue,
        has_attachment_issues: att_issue,
    }, "查询成功"))
}

#[post("/batch/process", format = "json", data = "<req>")]
pub fn batch_process(conn: &State<DbConn>, req: Json<BatchProcessRequest>) -> Json<ApiResponse<BatchProcessResponse>> {
    let db = conn.conn.lock().unwrap();
    
    let role = get_user_role(&db, &req.operator_id);
    if !role_can(&role, "batch_process") {
        return Json(ApiResponse::err("当前角色无权批量处理"));
    }

    let operator_name = get_user_name(&db, &req.operator_id);
    let batch_id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();
    
    let mut details: Vec<BatchResultItem> = Vec::new();
    let mut success_count = 0usize;
    let mut fail_count = 0usize;
    let mut skip_count = 0usize;
    let total_count = req.material_ids.len();

    for mid in &req.material_ids {
        let (case_no, case_name, cur_status): (String, String, String) = db.query_row(
            "SELECT case_no, case_name, status FROM litigation_materials WHERE id = ?1",
            params![mid], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).unwrap_or_else(|_| (String::new(), String::new(), String::new()));

        if case_no.is_empty() {
            fail_count += 1;
            details.push(BatchResultItem {
                material_id: mid.clone(), case_no: "未知".into(), case_name: "未知".into(),
                result: "失败".into(), reason: Some("材料单不存在".into()),
            });
            continue;
        }

        let attachments = load_attachments(&db, mid);
        let att_ok = has_required_attachments(&attachments);

        match req.action.as_str() {
            "pass_review" => {
                if role != "reviewer" {
                    skip_count += 1;
                    details.push(BatchResultItem {
                        material_id: mid.clone(), case_no, case_name,
                        result: "跳过".into(), reason: Some("角色权限不符".into()),
                    });
                    continue;
                }
                if cur_status != "registered" && cur_status != "reviewing" && cur_status != "returned" {
                    skip_count += 1;
                    details.push(BatchResultItem {
                        material_id: mid.clone(), case_no, case_name,
                        result: "跳过".into(),
                        reason: Some(format!("当前状态为\"{}\"，不可批量审核通过", cur_status)),
                    });
                    continue;
                }
                if !att_ok {
                    fail_count += 1;
                    let missing = missing_required_count(&attachments);
                    let reason = format!("必填附件异常：{} 项缺失或被驳回，需补正后才能批量通过", missing);
                    insert_audit(&db, Some(mid), None, &req.operator_id, &operator_name, &role,
                        "batch_pass_review", Some("批量审核"), "fail", Some(&reason), Some(&batch_id));
                    details.push(BatchResultItem {
                        material_id: mid.clone(), case_no, case_name,
                        result: "失败".into(), reason: Some(reason),
                    });
                    continue;
                }

                db.execute(
                    "UPDATE litigation_materials SET status = 'review_passed', reviewed_by = ?1, reviewed_at = ?2, audit_remark = ?3 WHERE id = ?4",
                    params![req.operator_id, now, req.audit_remark, mid],
                ).ok();
                insert_status_log(&db, mid, Some(&cur_status), "review_passed", &req.operator_id, &operator_name,
                    "pass_review", req.audit_remark.as_deref());
                insert_audit(&db, Some(mid), None, &req.operator_id, &operator_name, &role,
                    "batch_pass_review", Some("批量审核通过"), "success", None, Some(&batch_id));
                success_count += 1;
                details.push(BatchResultItem {
                    material_id: mid.clone(), case_no, case_name,
                    result: "成功".into(), reason: Some("附件齐全，审核通过".into()),
                });
            }
            "pass_verify" => {
                if role != "verifier" {
                    skip_count += 1;
                    details.push(BatchResultItem {
                        material_id: mid.clone(), case_no, case_name,
                        result: "跳过".into(), reason: Some("角色权限不符".into()),
                    });
                    continue;
                }
                if !(cur_status == "review_passed" || cur_status == "verifying") {
                    skip_count += 1;
                    details.push(BatchResultItem {
                        material_id: mid.clone(), case_no, case_name,
                        result: "跳过".into(),
                        reason: Some(format!("当前状态为\"{}\"，不可批量复核", cur_status)),
                    });
                    continue;
                }
                db.execute(
                    "UPDATE litigation_materials SET status = 'verified', verified_by = ?1, verified_at = ?2, audit_remark = ?3 WHERE id = ?4",
                    params![req.operator_id, now, req.audit_remark, mid],
                ).ok();
                insert_status_log(&db, mid, Some(&cur_status), "verified", &req.operator_id, &operator_name,
                    "pass_verify", req.audit_remark.as_deref());
                insert_audit(&db, Some(mid), None, &req.operator_id, &operator_name, &role,
                    "batch_pass_verify", Some("批量复核通过"), "success", None, Some(&batch_id));
                success_count += 1;
                details.push(BatchResultItem {
                    material_id: mid.clone(), case_no, case_name,
                    result: "成功".into(), reason: Some("复核通过".into()),
                });
            }
            "archive" => {
                if role != "verifier" {
                    skip_count += 1;
                    details.push(BatchResultItem {
                        material_id: mid.clone(), case_no, case_name,
                        result: "跳过".into(), reason: Some("角色权限不符".into()),
                    });
                    continue;
                }
                if cur_status != "verified" {
                    skip_count += 1;
                    details.push(BatchResultItem {
                        material_id: mid.clone(), case_no, case_name,
                        result: "跳过".into(),
                        reason: Some(format!("当前状态为\"{}\"，不可归档", cur_status)),
                    });
                    continue;
                }
                db.execute(
                    "UPDATE litigation_materials SET status = 'archived', archived_by = ?1, archived_at = ?2 WHERE id = ?3",
                    params![req.operator_id, now, mid],
                ).ok();
                insert_status_log(&db, mid, Some(&cur_status), "archived", &req.operator_id, &operator_name,
                    "archive", req.audit_remark.as_deref());
                insert_audit(&db, Some(mid), None, &req.operator_id, &operator_name, &role,
                    "batch_archive", Some("批量归档"), "success", None, Some(&batch_id));
                success_count += 1;
                details.push(BatchResultItem {
                    material_id: mid.clone(), case_no, case_name,
                    result: "成功".into(), reason: Some("归档完成".into()),
                });
            }
            _ => {
                fail_count += 1;
                details.push(BatchResultItem {
                    material_id: mid.clone(), case_no, case_name,
                    result: "失败".into(), reason: Some("未知批量动作".into()),
                });
            }
        }
    }

    let result_details = serde_json::to_string(&details).ok();
    db.execute(
        "INSERT INTO batch_tasks (id, batch_name, operator_id, operator_name, total_count, success_count, fail_count, skip_count, result_details, status, created_at, completed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'completed', ?10, ?11)",
        params![batch_id, req.batch_name, req.operator_id, operator_name,
                total_count as i64, success_count as i64, fail_count as i64, skip_count as i64,
                result_details, now, now],
    ).ok();

    Json(ApiResponse::ok(BatchProcessResponse {
        batch_id,
        total_count,
        success_count,
        fail_count,
        skip_count,
        details,
        status: "completed".into(),
    }, "批量处理完成"))
}

#[get("/batch/list")]
pub fn list_batch_tasks(conn: &State<DbConn>) -> Json<ApiResponse<Vec<crate::models::batch::BatchTask>>> {
    let db = conn.conn.lock().unwrap();
    
    let mut stmt = db.prepare(
        "SELECT id, batch_name, operator_id, operator_name, total_count, success_count, fail_count, skip_count, result_details, status, created_at, completed_at
         FROM batch_tasks ORDER BY created_at DESC LIMIT 100"
    ).unwrap();

    let rows = stmt.query_map([], |row| {
        Ok(crate::models::batch::BatchTask {
            id: row.get(0)?,
            batch_name: row.get(1)?,
            operator_id: row.get(2)?,
            operator_name: row.get(3)?,
            total_count: row.get(4)?,
            success_count: row.get(5)?,
            fail_count: row.get(6)?,
            skip_count: row.get(7)?,
            result_details: row.get(8)?,
            status: row.get(9)?,
            created_at: row.get(10)?,
            completed_at: row.get(11)?,
        })
    }).unwrap();

    let tasks: Vec<_> = rows.filter_map(|r| r.ok()).collect();
    Json(ApiResponse::ok(tasks, "查询成功"))
}
