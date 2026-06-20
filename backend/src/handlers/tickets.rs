use actix_web::{web, HttpResponse, Responder};
use crate::db::Database;
use crate::middleware::auth::{AuthUser, require_role};
use crate::models::*;
use chrono::Utc;
use rusqlite::params;

fn row_to_ticket(row: &rusqlite::Row) -> rusqlite::Result<ComplaintTicket> {
    Ok(ComplaintTicket {
        id: row.get(0)?,
        ticket_no: row.get(1)?,
        title: row.get(2)?,
        content: row.get(3)?,
        complainant: row.get(4)?,
        contact: row.get(5)?,
        status: row.get(6)?,
        priority: row.get(7)?,
        source: row.get(8)?,
        is_exception: row.get::<_, i64>(9)? != 0,
        exception_reason: row.get(10)?,
        deadline: row.get(11)?,
        created_by: row.get(12)?,
        created_by_name: row.get(13)?,
        handler_id: row.get(14)?,
        handler_name: row.get(15)?,
        reviewer_id: row.get(16)?,
        reviewer_name: row.get(17)?,
        result_summary: row.get(18)?,
        return_reason: row.get(19)?,
        audit_remark: row.get(20)?,
        import_batch_id: row.get(21)?,
        created_at: row.get(22)?,
        updated_at: row.get(23)?,
    })
}

fn add_audit_log(db: &Database, ticket_id: Option<i64>, user_id: i64, action: &str, detail: Option<&str>, is_failure: bool, failure_reason: Option<&str>) {
    let conn = db.conn.lock().unwrap();
    let _ = conn.execute(
        "INSERT INTO audit_logs (ticket_id, user_id, action, detail, is_failure, failure_reason) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![ticket_id, user_id, action, detail, if is_failure { 1 } else { 0 }, failure_reason],
    );
}

fn compute_exception_flags(db: &Database, ticket_id: i64) {
    let conn = db.conn.lock().unwrap();
    let result = conn.query_row(
        "SELECT deadline, status, return_reason FROM complaint_tickets WHERE id = ?1",
        params![ticket_id],
        |row| {
            Ok((
                row.get::<_, Option<chrono::DateTime<chrono::Utc>>>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        },
    );

    if let Ok((deadline, status, return_reason)) = result {
        let is_overdue = if let Some(dl) = deadline {
            Utc::now() > dl && status != "archived"
        } else {
            false
        };
        let is_returned = status == "returned";
        let is_exception = is_overdue || is_returned;

        let exception_reason = if is_overdue && is_returned {
            Some("工单已超时且被退回".to_string())
        } else if is_overdue {
            Some("工单已超时未处理".to_string())
        } else if is_returned {
            return_reason.map(|r| format!("工单被退回：{}", r))
        } else {
            None
        };

        let _ = conn.execute(
            "UPDATE complaint_tickets SET is_exception = ?1, exception_reason = ?2 WHERE id = ?3",
            params![
                if is_exception { 1 } else { 0 },
                exception_reason,
                ticket_id
            ],
        );
    }
}

fn get_ticket_by_id(db: &Database, ticket_id: i64) -> Option<ComplaintTicket> {
    let conn = db.conn.lock().unwrap();
    let sql = "SELECT t.id, t.ticket_no, t.title, t.content, t.complainant, t.contact,
                      t.status, t.priority, t.source, t.is_exception, t.exception_reason,
                      t.deadline, t.created_by, cu.name as created_by_name,
                      t.handler_id, hu.name as handler_name,
                      t.reviewer_id, ru.name as reviewer_name,
                      t.result_summary, t.return_reason, t.audit_remark,
                      t.import_batch_id, t.created_at, t.updated_at
               FROM complaint_tickets t
               LEFT JOIN users cu ON t.created_by = cu.id
               LEFT JOIN users hu ON t.handler_id = hu.id
               LEFT JOIN users ru ON t.reviewer_id = ru.id
               WHERE t.id = ?1";
    conn.query_row(sql, params![ticket_id], row_to_ticket).ok()
}

pub async fn list_tickets(
    params: web::Query<TicketListParams>,
    db: web::Data<Database>,
    _auth_user: AuthUser,
) -> impl Responder {
    let page = params.page.unwrap_or(1);
    let page_size = params.page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;

    let mut conditions: Vec<String> = Vec::new();
    let mut params_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(status) = &params.status {
        conditions.push("t.status = ?".to_string());
        params_values.push(Box::new(status.clone()));
    }

    if let Some(is_exception) = params.is_exception {
        conditions.push("t.is_exception = ?".to_string());
        params_values.push(Box::new(if is_exception { 1 } else { 0 }));
    }

    if let Some(keyword) = &params.keyword {
        conditions.push("(t.title LIKE ? OR t.ticket_no LIKE ? OR t.complainant LIKE ?)".to_string());
        let kw = format!("%{}%", keyword);
        params_values.push(Box::new(kw.clone()));
        params_values.push(Box::new(kw.clone()));
        params_values.push(Box::new(kw));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let conn = db.conn.lock().unwrap();

    let count_sql = format!("SELECT COUNT(*) FROM complaint_tickets t {}", where_clause);
    let where_params: Vec<&dyn rusqlite::ToSql> = params_values.iter().map(|p| p.as_ref()).collect();
    let total: i64 = conn.query_row(&count_sql, where_params.as_slice(), |row| row.get(0))
        .unwrap_or(0);

    let sql = format!(
        "SELECT t.id, t.ticket_no, t.title, t.content, t.complainant, t.contact,
                t.status, t.priority, t.source, t.is_exception, t.exception_reason,
                t.deadline, t.created_by, cu.name as created_by_name,
                t.handler_id, hu.name as handler_name,
                t.reviewer_id, ru.name as reviewer_name,
                t.result_summary, t.return_reason, t.audit_remark,
                t.import_batch_id, t.created_at, t.updated_at
         FROM complaint_tickets t
         LEFT JOIN users cu ON t.created_by = cu.id
         LEFT JOIN users hu ON t.handler_id = hu.id
         LEFT JOIN users ru ON t.reviewer_id = ru.id
         {}
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?",
        where_clause
    );

    let mut all_params: Vec<&dyn rusqlite::ToSql> = params_values.iter().map(|p| p.as_ref()).collect();
    all_params.push(&page_size);
    all_params.push(&offset);

    let mut stmt = conn.prepare(&sql).unwrap();
    let tickets: Vec<ComplaintTicket> = stmt.query_map(all_params.as_slice(), row_to_ticket)
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    HttpResponse::Ok().json(ApiResponse::success(TicketListResponse {
        total,
        items: tickets,
        page,
        page_size,
    }))
}

pub async fn get_ticket(
    path: web::Path<i64>,
    db: web::Data<Database>,
    _auth_user: AuthUser,
) -> impl Responder {
    let ticket_id = path.into_inner();
    compute_exception_flags(&db, ticket_id);
    match get_ticket_by_id(&db, ticket_id) {
        Some(ticket) => HttpResponse::Ok().json(ApiResponse::success(ticket)),
        None => HttpResponse::NotFound().json(ApiResponse::<()>::error("工单不存在")),
    }
}

pub async fn create_ticket(
    req: web::Json<CreateTicketRequest>,
    db: web::Data<Database>,
    auth_user: AuthUser,
) -> impl Responder {
    if let Err(resp) = require_role(&auth_user, &["registrar"]) {
        return resp;
    }

    let ticket_no = format!("TS{}", chrono::Local::now().format("%Y%m%d%H%M%S"));
    let priority = req.priority.clone().unwrap_or_else(|| "normal".to_string());
    let source = req.source.clone().unwrap_or_else(|| "online".to_string());
    let deadline = req.deadline.clone();

    let conn = db.conn.lock().unwrap();
    let result = conn.execute(
        "INSERT INTO complaint_tickets (ticket_no, title, content, complainant, contact, status, priority, source, deadline, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, 'pending_audit', ?6, ?7, ?8, ?9)",
        params![ticket_no, req.title, req.content, req.complainant, req.contact, priority, source, deadline, auth_user.user_id],
    );

    match result {
        Ok(_) => {
            let id = conn.last_insert_rowid();
            drop(conn);
            add_audit_log(&db, Some(id), auth_user.user_id, "create_ticket", Some("创建投诉工单并提交"), false, None);
            compute_exception_flags(&db, id);
            match get_ticket_by_id(&db, id) {
                Some(ticket) => HttpResponse::Ok().json(ApiResponse::success(ticket)),
                None => HttpResponse::InternalServerError().json(ApiResponse::<()>::error("创建后查询失败")),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&format!("创建失败: {}", e))),
    }
}

pub async fn update_ticket(
    path: web::Path<i64>,
    req: web::Json<UpdateTicketRequest>,
    db: web::Data<Database>,
    auth_user: AuthUser,
) -> impl Responder {
    let ticket_id = path.into_inner();
    let conn = db.conn.lock().unwrap();

    let current_status: String = match conn.query_row(
        "SELECT status FROM complaint_tickets WHERE id = ?1",
        params![ticket_id],
        |row| row.get(0),
    ) {
        Ok(s) => s,
        Err(_) => return HttpResponse::NotFound().json(ApiResponse::<()>::error("工单不存在")),
    };

    if current_status != "draft" && current_status != "returned" {
        if auth_user.role != "registrar" {
            return HttpResponse::Forbidden().json(ApiResponse::<()>::error("只有登记员可以编辑工单"));
        }
    }

    let mut updates: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    let mut idx = 1;

    macro_rules! add_update {
        ($field:expr, $val:expr) => {
            if let Some(val) = $val {
                updates.push(format!("{} = ?{}", $field, idx));
                params.push(Box::new(val.clone()));
                idx += 1;
            }
        };
    }

    add_update!("title", &req.title);
    add_update!("content", &req.content);
    add_update!("complainant", &req.complainant);
    add_update!("contact", &req.contact);
    add_update!("priority", &req.priority);
    add_update!("deadline", &req.deadline);

    if updates.is_empty() {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::error("没有需要更新的字段"));
    }

    updates.push(format!("updated_at = CURRENT_TIMESTAMP"));
    params.push(Box::new(ticket_id));

    let sql = format!("UPDATE complaint_tickets SET {} WHERE id = ?{}", updates.join(", "), idx);
    let result = conn.execute(&sql, params.iter().map(|p| p.as_ref()).collect::<Vec<_>>().as_slice());

    match result {
        Ok(_) => {
            drop(conn);
            add_audit_log(&db, Some(ticket_id), auth_user.user_id, "update_ticket", Some("更新工单信息"), false, None);
            compute_exception_flags(&db, ticket_id);
            match get_ticket_by_id(&db, ticket_id) {
                Some(ticket) => HttpResponse::Ok().json(ApiResponse::success(ticket)),
                None => HttpResponse::NotFound().json(ApiResponse::<()>::error("工单不存在")),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&format!("更新失败: {}", e))),
    }
}

pub async fn start_process(
    path: web::Path<i64>,
    db: web::Data<Database>,
    auth_user: AuthUser,
) -> impl Responder {
    if let Err(resp) = require_role(&auth_user, &["auditor"]) {
        return resp;
    }

    let ticket_id = path.into_inner();
    let conn = db.conn.lock().unwrap();

    let current_status: String = match conn.query_row(
        "SELECT status FROM complaint_tickets WHERE id = ?1",
        params![ticket_id],
        |row| row.get(0),
    ) {
        Ok(s) => s,
        Err(_) => return HttpResponse::NotFound().json(ApiResponse::<()>::error("工单不存在")),
    };

    if current_status != "pending_audit" {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::error("只有待审核状态的工单可以开始办理"));
    }

    let result = conn.execute(
        "UPDATE complaint_tickets SET status = 'processing', handler_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![auth_user.user_id, ticket_id],
    );

    match result {
        Ok(_) => {
            drop(conn);
            add_audit_log(&db, Some(ticket_id), auth_user.user_id, "start_process", Some("审核主管开始办理"), false, None);
            compute_exception_flags(&db, ticket_id);
            match get_ticket_by_id(&db, ticket_id) {
                Some(ticket) => HttpResponse::Ok().json(ApiResponse::success(ticket)),
                None => HttpResponse::NotFound().json(ApiResponse::<()>::error("工单不存在")),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&format!("操作失败: {}", e))),
    }
}

pub async fn submit_review(
    path: web::Path<i64>,
    req: web::Json<ProcessRequest>,
    db: web::Data<Database>,
    auth_user: AuthUser,
) -> impl Responder {
    if let Err(resp) = require_role(&auth_user, &["auditor"]) {
        return resp;
    }

    let ticket_id = path.into_inner();
    let conn = db.conn.lock().unwrap();

    let current_status: String = match conn.query_row(
        "SELECT status FROM complaint_tickets WHERE id = ?1",
        params![ticket_id],
        |row| row.get(0),
    ) {
        Ok(s) => s,
        Err(_) => return HttpResponse::NotFound().json(ApiResponse::<()>::error("工单不存在")),
    };

    if current_status != "processing" {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::error("只有办理中状态的工单可以提交复核"));
    }

    let result = conn.execute(
        "UPDATE complaint_tickets SET status = 'pending_review', result_summary = ?1, audit_remark = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![req.result_summary, req.audit_remark, ticket_id],
    );

    match result {
        Ok(_) => {
            drop(conn);
            add_audit_log(&db, Some(ticket_id), auth_user.user_id, "submit_review", Some("提交复核"), false, None);
            compute_exception_flags(&db, ticket_id);
            match get_ticket_by_id(&db, ticket_id) {
                Some(ticket) => HttpResponse::Ok().json(ApiResponse::success(ticket)),
                None => HttpResponse::NotFound().json(ApiResponse::<()>::error("工单不存在")),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&format!("操作失败: {}", e))),
    }
}

pub async fn return_ticket(
    path: web::Path<i64>,
    req: web::Json<ReturnRequest>,
    db: web::Data<Database>,
    auth_user: AuthUser,
) -> impl Responder {
    let ticket_id = path.into_inner();
    let conn = db.conn.lock().unwrap();

    let current_status: String = match conn.query_row(
        "SELECT status FROM complaint_tickets WHERE id = ?1",
        params![ticket_id],
        |row| row.get(0),
    ) {
        Ok(s) => s,
        Err(_) => return HttpResponse::NotFound().json(ApiResponse::<()>::error("工单不存在")),
    };

    let allowed = match auth_user.role.as_str() {
        "auditor" => current_status == "pending_audit" || current_status == "processing",
        "reviewer" => current_status == "pending_review",
        _ => false,
    };

    if !allowed {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::error("当前状态不允许退回"));
    }

    let exception_reason = format!("工单被退回：{}", req.return_reason);

    let result = conn.execute(
        "UPDATE complaint_tickets SET status = 'returned', return_reason = ?1, is_exception = 1, exception_reason = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![req.return_reason, exception_reason, ticket_id],
    );

    match result {
        Ok(_) => {
            let action = if auth_user.role == "auditor" {
                "return_ticket_auditor"
            } else {
                "return_ticket_reviewer"
            };
            drop(conn);
            add_audit_log(&db, Some(ticket_id), auth_user.user_id, action, Some(&format!("退回原因：{}", req.return_reason)), false, None);
            match get_ticket_by_id(&db, ticket_id) {
                Some(ticket) => HttpResponse::Ok().json(ApiResponse::success(ticket)),
                None => HttpResponse::NotFound().json(ApiResponse::<()>::error("工单不存在")),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&format!("操作失败: {}", e))),
    }
}

pub async fn resubmit_ticket(
    path: web::Path<i64>,
    db: web::Data<Database>,
    auth_user: AuthUser,
) -> impl Responder {
    if let Err(resp) = require_role(&auth_user, &["registrar"]) {
        return resp;
    }

    let ticket_id = path.into_inner();
    let conn = db.conn.lock().unwrap();

    let current_status: String = match conn.query_row(
        "SELECT status FROM complaint_tickets WHERE id = ?1",
        params![ticket_id],
        |row| row.get(0),
    ) {
        Ok(s) => s,
        Err(_) => return HttpResponse::NotFound().json(ApiResponse::<()>::error("工单不存在")),
    };

    if current_status != "returned" && current_status != "draft" {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::error("只有退回或草稿状态的工单可以重新提交"));
    }

    let was_returned = current_status == "returned";

    let result = conn.execute(
        "UPDATE complaint_tickets SET status = 'pending_audit', return_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![ticket_id],
    );

    match result {
        Ok(_) => {
            drop(conn);
            let detail = if was_returned {
                "补正后重新提交审核"
            } else {
                "提交审核"
            };
            add_audit_log(&db, Some(ticket_id), auth_user.user_id, "resubmit_ticket", Some(detail), false, None);
            compute_exception_flags(&db, ticket_id);
            match get_ticket_by_id(&db, ticket_id) {
                Some(ticket) => HttpResponse::Ok().json(ApiResponse::success(ticket)),
                None => HttpResponse::NotFound().json(ApiResponse::<()>::error("工单不存在")),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&format!("操作失败: {}", e))),
    }
}

pub async fn archive_ticket(
    path: web::Path<i64>,
    req: web::Json<ProcessRequest>,
    db: web::Data<Database>,
    auth_user: AuthUser,
) -> impl Responder {
    if let Err(resp) = require_role(&auth_user, &["reviewer"]) {
        return resp;
    }

    let ticket_id = path.into_inner();
    let conn = db.conn.lock().unwrap();

    let current_status: String = match conn.query_row(
        "SELECT status FROM complaint_tickets WHERE id = ?1",
        params![ticket_id],
        |row| row.get(0),
    ) {
        Ok(s) => s,
        Err(_) => return HttpResponse::NotFound().json(ApiResponse::<()>::error("工单不存在")),
    };

    if current_status != "pending_review" {
        return HttpResponse::BadRequest().json(ApiResponse::<()>::error("只有待复核状态的工单可以归档"));
    }

    let result = conn.execute(
        "UPDATE complaint_tickets SET status = 'archived', reviewer_id = ?1, audit_remark = ?2, is_exception = 0, exception_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![auth_user.user_id, req.audit_remark, ticket_id],
    );

    match result {
        Ok(_) => {
            drop(conn);
            add_audit_log(&db, Some(ticket_id), auth_user.user_id, "archive", Some("复核通过，归档"), false, None);
            match get_ticket_by_id(&db, ticket_id) {
                Some(ticket) => HttpResponse::Ok().json(ApiResponse::success(ticket)),
                None => HttpResponse::NotFound().json(ApiResponse::<()>::error("工单不存在")),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::error(&format!("操作失败: {}", e))),
    }
}

pub async fn get_status_transitions(
    _db: web::Data<Database>,
    _auth_user: AuthUser,
) -> impl Responder {
    let transitions = vec![
        StatusTransition {
            from: "draft".to_string(),
            to: "pending_audit".to_string(),
            action: "提交审核".to_string(),
            allowed_roles: vec!["registrar".to_string()],
        },
        StatusTransition {
            from: "pending_audit".to_string(),
            to: "processing".to_string(),
            action: "开始办理".to_string(),
            allowed_roles: vec!["auditor".to_string()],
        },
        StatusTransition {
            from: "pending_audit".to_string(),
            to: "returned".to_string(),
            action: "退回补正".to_string(),
            allowed_roles: vec!["auditor".to_string()],
        },
        StatusTransition {
            from: "processing".to_string(),
            to: "pending_review".to_string(),
            action: "提交复核".to_string(),
            allowed_roles: vec!["auditor".to_string()],
        },
        StatusTransition {
            from: "processing".to_string(),
            to: "returned".to_string(),
            action: "退回补正".to_string(),
            allowed_roles: vec!["auditor".to_string()],
        },
        StatusTransition {
            from: "pending_review".to_string(),
            to: "archived".to_string(),
            action: "复核归档".to_string(),
            allowed_roles: vec!["reviewer".to_string()],
        },
        StatusTransition {
            from: "pending_review".to_string(),
            to: "returned".to_string(),
            action: "复核退回".to_string(),
            allowed_roles: vec!["reviewer".to_string()],
        },
        StatusTransition {
            from: "returned".to_string(),
            to: "pending_audit".to_string(),
            action: "补正后重提".to_string(),
            allowed_roles: vec!["registrar".to_string()],
        },
    ];

    HttpResponse::Ok().json(ApiResponse::success(transitions))
}
