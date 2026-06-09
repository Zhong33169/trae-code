use rocket::serde::json::Json;
use rocket::State;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::*;

fn generate_plan_no() -> String {
    use chrono::Local;
    let now = Local::now();
    let date_str = now.format("%Y%m%d").to_string();
    let rand = Uuid::new_v4().to_string().chars().take(4).collect::<String>();
    format!("HL{}{}", date_str, rand.to_uppercase())
}

fn add_operation_log(
    conn: &rusqlite::Connection,
    plan_id: &str,
    operator_id: &str,
    operator_name: &str,
    action: &str,
    from_status: Option<&str>,
    to_status: Option<&str>,
    reason: Option<&str>,
) -> Result<(), AppError> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        r#"INSERT INTO operation_logs (id, plan_id, operator_id, operator_name, action, from_status, to_status, reason)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"#,
        rusqlite::params![
            id,
            plan_id,
            operator_id,
            operator_name,
            action,
            from_status,
            to_status,
            reason
        ],
    )?;
    Ok(())
}

fn get_plan_by_id(conn: &rusqlite::Connection, id: &str) -> Result<NursingPlan, AppError> {
    let plan = conn.query_row(
        "SELECT * FROM nursing_plans WHERE id = ?1",
        [id],
        |row| {
            Ok(NursingPlan {
                id: row.get(0)?,
                plan_no: row.get(1)?,
                elder_name: row.get(2)?,
                elder_gender: row.get(3)?,
                elder_age: row.get(4)?,
                room_no: row.get(5)?,
                bed_no: row.get(6)?,
                admission_date: row.get(7)?,
                assessment_status: row.get(8)?,
                assessment_content: row.get(9)?,
                assessment_by: row.get(10)?,
                assessment_at: row.get(11)?,
                plan_content: row.get(12)?,
                plan_level: row.get(13)?,
                family_confirm_status: row.get(14)?,
                family_confirm_by: row.get(15)?,
                family_confirm_at: row.get(16)?,
                family_confirm_remark: row.get(17)?,
                status: row.get(18)?,
                current_step: row.get(19)?,
                created_by: row.get(20)?,
                created_at: row.get(21)?,
                updated_at: row.get(22)?,
            })
        },
    )
    .map_err(|_| AppError::NotFound("护理计划单不存在".into()))?;
    Ok(plan)
}

fn validate_handover(handover: &HandoverInfo) -> Result<(), AppError> {
    if handover.shift.trim().is_empty() {
        return Err(AppError::Validation("班次不能为空".into()));
    }
    if handover.handover_by.trim().is_empty() {
        return Err(AppError::Validation("交出人不能为空".into()));
    }
    if handover.takeover_by.trim().is_empty() {
        return Err(AppError::Validation("接收人不能为空".into()));
    }
    if handover.confirm_time.trim().is_empty() {
        return Err(AppError::Validation("确认时间不能为空".into()));
    }
    Ok(())
}

fn add_handover_record(
    conn: &rusqlite::Connection,
    plan_id: &str,
    handover: &HandoverInfo,
) -> Result<(), AppError> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        r#"INSERT INTO handover_records (id, plan_id, shift, handover_by, takeover_by, confirm_time, handover_content)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"#,
        rusqlite::params![
            id,
            plan_id,
            handover.shift,
            handover.handover_by,
            handover.takeover_by,
            handover.confirm_time,
            handover.handover_content
        ],
    )?;
    Ok(())
}

#[get("/list?<status>&<page>&<page_size>")]
pub async fn list_plans(
    pool: &State<DbPool>,
    _auth: AuthUser,
    status: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> AppResult<PlanListResponse> {
    let conn = pool.get()?;
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;

    let mut sql_total = "SELECT COUNT(*) FROM nursing_plans".to_string();
    let mut sql_query = "SELECT * FROM nursing_plans".to_string();
    let mut params: Vec<String> = Vec::new();

    if let Some(s) = status.as_ref() {
        if !s.is_empty() && s != "all" {
            sql_total.push_str(" WHERE status = ?1");
            sql_query.push_str(" WHERE status = ?1");
            params.push(s.clone());
        }
    }

    sql_query.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

    let total: i64 = if params.is_empty() {
        conn.query_row(&sql_total, [], |row| row.get(0))?
    } else {
        conn.query_row(&sql_total, &[&params[0]], |row| row.get(0))?
    };

    let mut stmt = conn.prepare(&sql_query)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params
        .iter()
        .map(|p| p as &dyn rusqlite::ToSql)
        .chain(vec![
            &page_size as &dyn rusqlite::ToSql,
            &offset as &dyn rusqlite::ToSql,
        ])
        .collect();

    let plans_iter = stmt.query_map(&param_refs[..], |row| {
        Ok(NursingPlan {
            id: row.get(0)?,
            plan_no: row.get(1)?,
            elder_name: row.get(2)?,
            elder_gender: row.get(3)?,
            elder_age: row.get(4)?,
            room_no: row.get(5)?,
            bed_no: row.get(6)?,
            admission_date: row.get(7)?,
            assessment_status: row.get(8)?,
            assessment_content: row.get(9)?,
            assessment_by: row.get(10)?,
            assessment_at: row.get(11)?,
            plan_content: row.get(12)?,
            plan_level: row.get(13)?,
            family_confirm_status: row.get(14)?,
            family_confirm_by: row.get(15)?,
            family_confirm_at: row.get(16)?,
            family_confirm_remark: row.get(17)?,
            status: row.get(18)?,
            current_step: row.get(19)?,
            created_by: row.get(20)?,
            created_at: row.get(21)?,
            updated_at: row.get(22)?,
        })
    })?;

    let mut items = Vec::new();
    for plan in plans_iter {
        items.push(plan?);
    }

    Ok(Json(ApiResponse {
        success: true,
        message: "OK".into(),
        data: Some(PlanListResponse { total, items }),
    }))
}

#[get("/<id>")]
pub async fn get_plan(
    pool: &State<DbPool>,
    _auth: AuthUser,
    id: &str,
) -> AppResult<NursingPlan> {
    let conn = pool.get()?;
    let plan = get_plan_by_id(&conn, id)?;

    Ok(Json(ApiResponse {
        success: true,
        message: "OK".into(),
        data: Some(plan),
    }))
}

#[post("/create", data = "<req>")]
pub async fn create_plan(
    pool: &State<DbPool>,
    auth: AuthUser,
    req: Json<CreatePlanRequest>,
) -> AppResult<NursingPlan> {
    if auth.role != "registrar" {
        return Err(AppError::Permission("只有登记员可以创建护理计划单".into()));
    }

    if req.elder_name.trim().is_empty() {
        return Err(AppError::Validation("老人姓名不能为空".into()));
    }
    if req.elder_age <= 0 {
        return Err(AppError::Validation("年龄必须大于0".into()));
    }

    let conn = pool.get()?;
    let id = Uuid::new_v4().to_string();
    let plan_no = generate_plan_no();

    conn.execute(
        r#"INSERT INTO nursing_plans (
            id, plan_no, elder_name, elder_gender, elder_age, room_no, bed_no,
            admission_date, plan_content, plan_level, status, current_step, created_by
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)"#,
        rusqlite::params![
            id,
            plan_no,
            req.elder_name,
            req.elder_gender,
            req.elder_age,
            req.room_no,
            req.bed_no,
            req.admission_date,
            req.plan_content,
            req.plan_level,
            "draft",
            "registration",
            auth.id
        ],
    )?;

    add_operation_log(
        &conn,
        &id,
        &auth.id,
        &auth.real_name,
        "创建",
        None,
        Some("draft"),
        None,
    )?;

    let plan = get_plan_by_id(&conn, &id)?;

    Ok(Json(ApiResponse {
        success: true,
        message: "创建成功".into(),
        data: Some(plan),
    }))
}

#[put("/<id>", data = "<req>")]
pub async fn update_plan(
    pool: &State<DbPool>,
    auth: AuthUser,
    id: &str,
    req: Json<UpdatePlanRequest>,
) -> AppResult<NursingPlan> {
    if auth.role != "registrar" {
        return Err(AppError::Permission("只有登记员可以编辑护理计划单".into()));
    }

    let conn = pool.get()?;
    let plan = get_plan_by_id(&conn, id)?;

    if plan.status != "draft" && plan.status != "returned" {
        return Err(AppError::StateTransition(
            "只有草稿或被退回状态的计划可以编辑".into(),
        ));
    }

    conn.execute(
        r#"UPDATE nursing_plans SET
            elder_name = COALESCE(?1, elder_name),
            elder_gender = COALESCE(?2, elder_gender),
            elder_age = COALESCE(?3, elder_age),
            room_no = COALESCE(?4, room_no),
            bed_no = COALESCE(?5, bed_no),
            admission_date = COALESCE(?6, admission_date),
            plan_content = COALESCE(?7, plan_content),
            plan_level = COALESCE(?8, plan_level),
            updated_at = datetime('now')
            WHERE id = ?9"#,
        rusqlite::params![
            req.elder_name,
            req.elder_gender,
            req.elder_age,
            req.room_no,
            req.bed_no,
            req.admission_date,
            req.plan_content,
            req.plan_level,
            id
        ],
    )?;

    add_operation_log(
        &conn,
        id,
        &auth.id,
        &auth.real_name,
        "编辑",
        Some(&plan.status),
        None,
        None,
    )?;

    let updated = get_plan_by_id(&conn, id)?;

    Ok(Json(ApiResponse {
        success: true,
        message: "更新成功".into(),
        data: Some(updated),
    }))
}

#[put("/<id>/assessment", data = "<req>")]
pub async fn update_assessment(
    pool: &State<DbPool>,
    auth: AuthUser,
    id: &str,
    req: Json<AssessmentUpdateRequest>,
) -> AppResult<NursingPlan> {
    if auth.role != "registrar" && auth.role != "auditor" {
        return Err(AppError::Permission("没有权限修改入住评估".into()));
    }

    if req.assessment_status != "pending"
        && req.assessment_status != "completed"
        && req.assessment_status != "cancelled"
    {
        return Err(AppError::Validation(
            "评估状态只能是 pending、completed 或 cancelled".into(),
        ));
    }

    let conn = pool.get()?;
    let plan = get_plan_by_id(&conn, id)?;

    let old_status = plan.assessment_status.clone();

    conn.execute(
        r#"UPDATE nursing_plans SET
            assessment_status = ?1,
            assessment_content = ?2,
            assessment_by = ?3,
            assessment_at = datetime('now'),
            updated_at = datetime('now')
            WHERE id = ?4"#,
        rusqlite::params![
            req.assessment_status,
            req.assessment_content,
            auth.real_name,
            id
        ],
    )?;

    add_operation_log(
        &conn,
        id,
        &auth.id,
        &auth.real_name,
        &format!("更新入住评估（{}→{}）", old_status, req.assessment_status),
        None,
        None,
        None,
    )?;

    let updated = get_plan_by_id(&conn, id)?;

    Ok(Json(ApiResponse {
        success: true,
        message: "入住评估更新成功".into(),
        data: Some(updated),
    }))
}

#[put("/<id>/family-confirm", data = "<req>")]
pub async fn update_family_confirm(
    pool: &State<DbPool>,
    auth: AuthUser,
    id: &str,
    req: Json<FamilyConfirmRequest>,
) -> AppResult<NursingPlan> {
    if auth.role != "registrar" && auth.role != "auditor" {
        return Err(AppError::Permission("没有权限修改家属确认".into()));
    }

    if req.family_confirm_status != "pending"
        && req.family_confirm_status != "confirmed"
        && req.family_confirm_status != "rejected"
    {
        return Err(AppError::Validation(
            "家属确认状态只能是 pending、confirmed 或 rejected".into(),
        ));
    }

    let conn = pool.get()?;
    let plan = get_plan_by_id(&conn, id)?;
    let old_status = plan.family_confirm_status.clone();

    conn.execute(
        r#"UPDATE nursing_plans SET
            family_confirm_status = ?1,
            family_confirm_by = ?2,
            family_confirm_remark = ?3,
            family_confirm_at = datetime('now'),
            updated_at = datetime('now')
            WHERE id = ?4"#,
        rusqlite::params![
            req.family_confirm_status,
            req.family_confirm_by,
            req.family_confirm_remark,
            id
        ],
    )?;

    add_operation_log(
        &conn,
        id,
        &auth.id,
        &auth.real_name,
        &format!(
            "更新家属确认（{}→{}）",
            old_status, req.family_confirm_status
        ),
        None,
        None,
        None,
    )?;

    let updated = get_plan_by_id(&conn, id)?;

    Ok(Json(ApiResponse {
        success: true,
        message: "家属确认更新成功".into(),
        data: Some(updated),
    }))
}

#[post("/<id>/transition", data = "<req>")]
pub async fn transition_status(
    pool: &State<DbPool>,
    auth: AuthUser,
    id: &str,
    req: Json<StatusTransitionRequest>,
) -> AppResult<NursingPlan> {
    let conn = pool.get()?;
    let plan = get_plan_by_id(&conn, id)?;

    let from_status = plan.status.clone();
    let action = req.action.as_str();

    let to_status = match (plan.status.as_str(), action, auth.role.as_str()) {
        ("draft", "submit", "registrar") => Ok("pending_audit"),
        ("returned", "resubmit", "registrar") => Ok("pending_audit"),
        ("pending_audit", "approve", "auditor") => Ok("pending_review"),
        ("pending_audit", "reject", "auditor") => Ok("returned"),
        ("pending_review", "archive", "reviewer") => Ok("archived"),
        ("pending_review", "reject", "reviewer") => Ok("returned"),
        _ => Err(AppError::StateTransition(format!(
            "当前状态 {} 无法执行 {} 操作（角色：{}）",
            plan.status, action, auth.role
        ))),
    }?;

    if action == "submit" || action == "resubmit" {
        if plan.assessment_status != "completed" {
            return Err(AppError::StateTransition(
                "入住评估未完成，不能提交审核".into(),
            ));
        }
        if plan.family_confirm_status != "confirmed" {
            return Err(AppError::StateTransition(
                "家属未确认，不能提交审核".into(),
            ));
        }
        if plan.plan_content.is_none() || plan.plan_content.as_ref().unwrap().trim().is_empty() {
            return Err(AppError::StateTransition(
                "护理计划内容不能为空，不能提交审核".into(),
            ));
        }
    }

    if action == "approve" || action == "archive" {
        match &req.handover {
            Some(handover) => {
                validate_handover(handover)?;
                add_handover_record(&conn, id, handover)?;
            }
            None => {
                return Err(AppError::Validation(
                    "进入下一步前必须填写交接信息（班次、交出人、接收人、确认时间）".into(),
                ));
            }
        }
    }

    conn.execute(
        "UPDATE nursing_plans SET status = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![to_status, id],
    )?;

    let action_desc = match action {
        "submit" => "提交审核",
        "resubmit" => "重新提交",
        "approve" => "审核通过",
        "reject" => "退回",
        "archive" => "复核归档",
        _ => action,
    };

    let reason_str = req.reason.clone().unwrap_or_default();
    let final_reason = if reason_str.is_empty() {
        None
    } else {
        Some(reason_str.as_str())
    };

    add_operation_log(
        &conn,
        id,
        &auth.id,
        &auth.real_name,
        action_desc,
        Some(&from_status),
        Some(to_status),
        final_reason,
    )?;

    let updated = get_plan_by_id(&conn, id)?;

    let message = match action {
        "reject" => format!("已退回：{}", req.reason.clone().unwrap_or_default()),
        "approve" => "审核通过，已流转至复核环节".into(),
        "archive" => "复核归档完成".into(),
        _ => format!("状态已更新为 {}", to_status),
    };

    Ok(Json(ApiResponse {
        success: true,
        message,
        data: Some(updated),
    }))
}

#[get("/<id>/logs")]
pub async fn get_operation_logs(
    pool: &State<DbPool>,
    _auth: AuthUser,
    id: &str,
) -> AppResult<Vec<OperationLog>> {
    let conn = pool.get()?;

    let mut stmt = conn.prepare(
        "SELECT id, plan_id, operator_id, operator_name, action, from_status, to_status, reason, created_at
         FROM operation_logs WHERE plan_id = ?1 ORDER BY created_at DESC",
    )?;

    let logs_iter = stmt.query_map([id], |row| {
        Ok(OperationLog {
            id: row.get(0)?,
            plan_id: row.get(1)?,
            operator_id: row.get(2)?,
            operator_name: row.get(3)?,
            action: row.get(4)?,
            from_status: row.get(5)?,
            to_status: row.get(6)?,
            reason: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;

    let mut logs = Vec::new();
    for log in logs_iter {
        logs.push(log?);
    }

    Ok(Json(ApiResponse {
        success: true,
        message: "OK".into(),
        data: Some(logs),
    }))
}

#[get("/<id>/handovers")]
pub async fn get_handover_records(
    pool: &State<DbPool>,
    _auth: AuthUser,
    id: &str,
) -> AppResult<Vec<HandoverRecord>> {
    let conn = pool.get()?;

    let mut stmt = conn.prepare(
        "SELECT id, plan_id, shift, handover_by, takeover_by, confirm_time, handover_content, created_at
         FROM handover_records WHERE plan_id = ?1 ORDER BY created_at DESC",
    )?;

    let records_iter = stmt.query_map([id], |row| {
        Ok(HandoverRecord {
            id: row.get(0)?,
            plan_id: row.get(1)?,
            shift: row.get(2)?,
            handover_by: row.get(3)?,
            takeover_by: row.get(4)?,
            confirm_time: row.get(5)?,
            handover_content: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;

    let mut records = Vec::new();
    for record in records_iter {
        records.push(record?);
    }

    Ok(Json(ApiResponse {
        success: true,
        message: "OK".into(),
        data: Some(records),
    }))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![
        list_plans,
        get_plan,
        create_plan,
        update_plan,
        update_assessment,
        update_family_confirm,
        transition_status,
        get_operation_logs,
        get_handover_records
    ]
}
