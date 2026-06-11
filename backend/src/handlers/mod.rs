use crate::db::DbPool;
use crate::models::*;
use anyhow::{anyhow, Result};
use chrono::Utc;
use sqlx::SqlitePool;

pub async fn login(pool: &DbPool, req: LoginRequest) -> Result<LoginResponse> {
    let user: Option<User> = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE username = ?"
    )
    .bind(&req.username)
    .fetch_optional(pool)
    .await?;

    let user = user.ok_or_else(|| anyhow!("用户名或密码错误"))?;

    if user.password != req.password {
        return Err(anyhow!("用户名或密码错误"));
    }

    let token = format!("token_{}", user.id);
    Ok(LoginResponse {
        token,
        user: UserInfo::from(user),
    })
}

pub async fn get_user_by_id(pool: &DbPool, user_id: &str) -> Result<User> {
    let user: User = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = ?"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(user)
}

pub async fn get_users_by_role(pool: &DbPool, role: &str) -> Result<Vec<User>> {
    let users: Vec<User> = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE role = ? ORDER BY name"
    )
    .bind(role)
    .fetch_all(pool)
    .await?;
    Ok(users)
}

pub async fn list_tickets(
    pool: &DbPool,
    current_user: &User,
    status: Option<String>,
    page: i64,
    page_size: i64,
) -> Result<TicketListResponse> {
    let offset = (page - 1) * page_size;

    let mut count_sql = "SELECT COUNT(*) FROM tickets t JOIN users u ON t.created_by = u.id WHERE 1=1".to_string();
    let mut query_sql = "SELECT t.id, t.title, t.customer_name, t.status, t.created_by, u.name as creator_name, t.created_at, (SELECT status FROM handover_records WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as latest_handover_status, (SELECT handover_time FROM handover_records WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as latest_handover_time FROM tickets t JOIN users u ON t.created_by = u.id WHERE 1=1".to_string();

    let mut params: Vec<String> = Vec::new();

    if current_user.role == "agent" {
        count_sql.push_str(" AND t.created_by = ?");
        query_sql.push_str(" AND t.created_by = ?");
        params.push(current_user.id.clone());
    }

    if let Some(s) = &status {
        if !s.is_empty() {
            count_sql.push_str(" AND t.status = ?");
            query_sql.push_str(" AND t.status = ?");
            params.push(s.clone());
        }
    }

    query_sql.push_str(" ORDER BY t.created_at DESC LIMIT ? OFFSET ?");

    let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
    let mut list_query = sqlx::query_as::<_, TicketListItem>(&query_sql);

    for p in &params {
        count_query = count_query.bind(p);
        list_query = list_query.bind(p);
    }

    list_query = list_query.bind(page_size).bind(offset);

    let total = count_query.fetch_one(pool).await?;
    let items = list_query.fetch_all(pool).await?;

    Ok(TicketListResponse { total, items })
}

pub async fn get_ticket_detail(
    pool: &DbPool,
    ticket_id: &str,
    current_user: &User,
) -> Result<TicketDetail> {
    let ticket: Ticket = sqlx::query_as::<_, Ticket>(
        "SELECT * FROM tickets WHERE id = ?"
    )
    .bind(ticket_id)
    .fetch_one(pool)
    .await?;

    if current_user.role == "agent" && ticket.created_by != current_user.id {
        return Err(anyhow!("无权查看该工单"));
    }

    let creator: User = get_user_by_id(pool, &ticket.created_by).await?;

    let handover_records_raw: Vec<HandoverRecord> = sqlx::query_as::<_, HandoverRecord>(
        "SELECT * FROM handover_records WHERE ticket_id = ? ORDER BY created_at DESC"
    )
    .bind(ticket_id)
    .fetch_all(pool)
    .await?;

    let mut handover_records = Vec::new();
    for record in handover_records_raw {
        let from_user = get_user_by_id(pool, &record.from_user).await?;
        let to_user = get_user_by_id(pool, &record.to_user).await?;
        handover_records.push(HandoverRecordDetail {
            id: record.id,
            ticket_id: record.ticket_id,
            shift: record.shift,
            from_user: record.from_user,
            from_user_name: from_user.name,
            from_role: from_user.role,
            to_user: record.to_user,
            to_user_name: to_user.name,
            to_role: to_user.role,
            handover_time: record.handover_time,
            status: record.status,
            remark: record.remark,
            created_at: record.created_at,
        });
    }

    let logs_raw: Vec<OperationLog> = sqlx::query_as::<_, OperationLog>(
        "SELECT * FROM operation_logs WHERE ticket_id = ? ORDER BY created_at DESC"
    )
    .bind(ticket_id)
    .fetch_all(pool)
    .await?;

    let mut operation_logs = Vec::new();
    for log in logs_raw {
        let user = get_user_by_id(pool, &log.user_id).await?;
        operation_logs.push(OperationLogDetail {
            id: log.id,
            ticket_id: log.ticket_id,
            user_id: log.user_id,
            user_name: user.name,
            action: log.action,
            detail: log.detail,
            created_at: log.created_at,
        });
    }

    Ok(TicketDetail {
        id: ticket.id,
        title: ticket.title,
        customer_name: ticket.customer_name,
        customer_phone: ticket.customer_phone,
        description: ticket.description,
        status: ticket.status,
        created_by: ticket.created_by,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        creator_name: creator.name,
        handover_records,
        operation_logs,
    })
}

pub async fn create_ticket(
    pool: &DbPool,
    req: CreateTicketRequest,
    current_user: &User,
) -> Result<Ticket> {
    let ticket_id = new_id();
    let now = Utc::now();

    sqlx::query(
        "INSERT INTO tickets (id, title, customer_name, customer_phone, description, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&ticket_id)
    .bind(&req.title)
    .bind(&req.customer_name)
    .bind(&req.customer_phone)
    .bind(&req.description)
    .bind("incoming")
    .bind(&current_user.id)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;

    let detail = format!("创建工单（{}：{}）", role_display(&current_user.role), current_user.name);
    add_operation_log(pool, &ticket_id, &current_user.id, "create_ticket", Some(&detail)).await?;

    let ticket: Ticket = sqlx::query_as::<_, Ticket>(
        "SELECT * FROM tickets WHERE id = ?"
    )
    .bind(&ticket_id)
    .fetch_one(pool)
    .await?;

    Ok(ticket)
}

pub async fn update_ticket_status(
    pool: &DbPool,
    ticket_id: &str,
    req: UpdateTicketStatusRequest,
    current_user: &User,
) -> Result<Ticket> {
    let ticket: Ticket = sqlx::query_as::<_, Ticket>(
        "SELECT * FROM tickets WHERE id = ?"
    )
    .bind(ticket_id)
    .fetch_one(pool)
    .await?;

    if current_user.role == "agent" && ticket.created_by != current_user.id {
        return Err(anyhow!("无权操作该工单"));
    }

    validate_status_transition(&ticket.status, &req.status, current_user)?;

    let now = Utc::now();

    sqlx::query(
        "UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&req.status)
    .bind(now)
    .bind(ticket_id)
    .execute(pool)
    .await?;

    let action = format!("status_change:{}->{}", ticket.status, req.status);
    let from_label = status_display(&ticket.status);
    let to_label = status_display(&req.status);
    let remark_str = req.remark.clone().unwrap_or_else(|| String::from(""));
    let detail = if remark_str.is_empty() {
        format!("状态变更：{} → {}（{}：{}）", from_label, to_label, role_display(&current_user.role), current_user.name)
    } else {
        format!("状态变更：{} → {}（{}：{}）：{}", from_label, to_label, role_display(&current_user.role), current_user.name, remark_str)
    };
    add_operation_log(pool, ticket_id, &current_user.id, &action, Some(&detail)).await?;

    let ticket: Ticket = sqlx::query_as::<_, Ticket>(
        "SELECT * FROM tickets WHERE id = ?"
    )
    .bind(ticket_id)
    .fetch_one(pool)
    .await?;

    Ok(ticket)
}

fn validate_status_transition(current: &str, next: &str, user: &User) -> Result<()> {
    let valid_transitions: Vec<(&str, &str, &[&str])> = vec![
        ("incoming", "dispatched", &["qa_manager", "cs_manager"]),
        ("incoming", "closed", &["qa_manager", "cs_manager"]),
        ("dispatched", "return_visit", &["qa_manager", "cs_manager"]),
        ("dispatched", "exception", &["qa_manager", "cs_manager"]),
        ("return_visit", "closed", &["qa_manager", "cs_manager"]),
        ("return_visit", "exception", &["qa_manager", "cs_manager"]),
        ("exception", "dispatched", &["qa_manager", "cs_manager"]),
        ("exception", "closed", &["qa_manager", "cs_manager"]),
        ("closed", "dispatched", &["cs_manager"]),
    ];

    for (from, to, roles) in &valid_transitions {
        if current == *from && next == *to {
            if roles.contains(&user.role.as_str()) {
                return Ok(());
            } else {
                return Err(anyhow!("当前角色（{}）无权将工单从 {} 变更为 {}", role_display(&user.role), current, next));
            }
        }
    }

    Err(anyhow!("无效的状态流转：不允许将工单从「{}」变更为「{}」", status_display(current), status_display(next)))
}

pub fn role_display(role: &str) -> &str {
    match role {
        "agent" => "客服坐席",
        "qa_manager" => "质检主管",
        "cs_manager" => "客服经理",
        _ => role,
    }
}

fn status_display(status: &str) -> &str {
    match status {
        "incoming" => "来电登记",
        "dispatched" => "问题派单",
        "return_visit" => "回访中",
        "closed" => "已关闭",
        "exception" => "异常回传",
        _ => status,
    }
}

pub async fn create_handover(
    pool: &DbPool,
    req: CreateHandoverRequest,
    current_user: &User,
) -> Result<HandoverRecord> {
    if req.shift.is_empty() {
        return Err(anyhow!("请选择班次"));
    }
    if req.to_user.is_empty() {
        return Err(anyhow!("请选择接收人"));
    }

    if current_user.role == "cs_manager" {
        return Err(anyhow!("客服经理是最终确认人，不能提交交接，只能执行签收"));
    }

    let ticket: Ticket = sqlx::query_as::<_, Ticket>(
        "SELECT * FROM tickets WHERE id = ?"
    )
    .bind(&req.ticket_id)
    .fetch_one(pool)
    .await?;

    if current_user.role == "agent" && ticket.created_by != current_user.id {
        return Err(anyhow!("无权操作该工单"));
    }

    let pending_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM handover_records WHERE ticket_id = ? AND status = 'pending'"
    )
    .bind(&req.ticket_id)
    .fetch_one(pool)
    .await?;

    if pending_count > 0 {
        return Err(anyhow!("该工单已有待签收的交接，请先完成签收或异常回传"));
    }

    let to_user = get_user_by_id(pool, &req.to_user).await?;

    let can_handover = match current_user.role.as_str() {
        "agent" => to_user.role == "qa_manager",
        "qa_manager" => to_user.role == "cs_manager",
        _ => return Err(anyhow!("当前角色无权提交交接")),
    };

    if !can_handover {
        return Err(anyhow!("交接接收人角色不正确"));
    }

    if current_user.role == "qa_manager" {
        let prev_accepted: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM handover_records 
             WHERE ticket_id = ? AND status = 'accepted' 
             AND from_user IN (SELECT id FROM users WHERE role = 'agent')
             AND to_user IN (SELECT id FROM users WHERE role = 'qa_manager')"
        )
        .bind(&req.ticket_id)
        .fetch_one(pool)
        .await?;

        if prev_accepted == 0 {
            return Err(anyhow!("上一级交接尚未签收，不能提交给下一级"));
        }
    }

    let handover_id = new_id();
    let now = Utc::now();

    sqlx::query(
        "INSERT INTO handover_records (id, ticket_id, shift, from_user, to_user, handover_time, status, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&handover_id)
    .bind(&req.ticket_id)
    .bind(&req.shift)
    .bind(&current_user.id)
    .bind(&req.to_user)
    .bind(now)
    .bind("pending")
    .bind(&req.remark)
    .bind(now)
    .execute(pool)
    .await?;

    let shift_display = match req.shift.as_str() {
        "morning" => "早班",
        "afternoon" => "中班",
        "night" => "晚班",
        _ => req.shift.as_str(),
    };
    let remark_str = req.remark.clone().unwrap_or_else(|| String::from(""));
    let detail = if remark_str.is_empty() {
        format!("提交交接给 {}（{}：{}）：{}", to_user.name, role_display(&current_user.role), current_user.name, shift_display)
    } else {
        format!("提交交接给 {}（{}：{}）：{}：{}", to_user.name, role_display(&current_user.role), current_user.name, shift_display, remark_str)
    };
    add_operation_log(
        pool,
        &req.ticket_id,
        &current_user.id,
        "handover_submit",
        Some(&detail),
    ).await?;

    let record: HandoverRecord = sqlx::query_as::<_, HandoverRecord>(
        "SELECT * FROM handover_records WHERE id = ?"
    )
    .bind(&handover_id)
    .fetch_one(pool)
    .await?;

    Ok(record)
}

pub async fn accept_handover(
    pool: &DbPool,
    handover_id: &str,
    current_user: &User,
) -> Result<HandoverRecord> {
    let record: HandoverRecord = sqlx::query_as::<_, HandoverRecord>(
        "SELECT * FROM handover_records WHERE id = ?"
    )
    .bind(handover_id)
    .fetch_one(pool)
    .await?;

    if record.status != "pending" {
        return Err(anyhow!("该交接状态不是待签收"));
    }

    if record.to_user != current_user.id {
        return Err(anyhow!("无权确认此交接"));
    }

    sqlx::query(
        "UPDATE handover_records SET status = ? WHERE id = ?"
    )
    .bind("accepted")
    .bind(handover_id)
    .execute(pool)
    .await?;

    let shift_display = match record.shift.as_str() {
        "morning" => "早班",
        "afternoon" => "中班",
        "night" => "晚班",
        _ => record.shift.as_str(),
    };
    let remark_str = record.remark.clone().unwrap_or_else(|| String::from(""));
    let log_detail = if remark_str.is_empty() {
        format!("签收交接（{}）（{}：{}）", shift_display, role_display(&current_user.role), current_user.name)
    } else {
        format!("签收交接（{}）（{}：{}）：{}", shift_display, role_display(&current_user.role), current_user.name, remark_str)
    };
    add_operation_log(
        pool,
        &record.ticket_id,
        &current_user.id,
        "handover_accept",
        Some(&log_detail),
    ).await?;

    let record: HandoverRecord = sqlx::query_as::<_, HandoverRecord>(
        "SELECT * FROM handover_records WHERE id = ?"
    )
    .bind(handover_id)
    .fetch_one(pool)
    .await?;

    Ok(record)
}

pub async fn reject_handover(
    pool: &DbPool,
    handover_id: &str,
    req: HandoverActionRequest,
    current_user: &User,
) -> Result<HandoverRecord> {
    let record: HandoverRecord = sqlx::query_as::<_, HandoverRecord>(
        "SELECT * FROM handover_records WHERE id = ?"
    )
    .bind(handover_id)
    .fetch_one(pool)
    .await?;

    if record.status != "pending" {
        return Err(anyhow!("该交接状态不是待签收"));
    }

    if record.to_user != current_user.id {
        return Err(anyhow!("无权回传此交接"));
    }

    let now = Utc::now();

    sqlx::query(
        "UPDATE handover_records SET status = ?, remark = COALESCE(?, remark) WHERE id = ?"
    )
    .bind("rejected")
    .bind(&req.remark)
    .bind(handover_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?"
    )
    .bind("exception")
    .bind(now)
    .bind(&record.ticket_id)
    .execute(pool)
    .await?;

    let shift_display = match record.shift.as_str() {
        "morning" => "早班",
        "afternoon" => "中班",
        "night" => "晚班",
        _ => record.shift.as_str(),
    };
    let remark = req.remark.unwrap_or_else(|| "异常回传".to_string());
    let reject_log = format!("异常回传（{}）（{}：{}）：{}", shift_display, role_display(&current_user.role), current_user.name, remark);
    add_operation_log(
        pool,
        &record.ticket_id,
        &current_user.id,
        "handover_reject",
        Some(&reject_log),
    ).await?;

    let status_log = format!("工单状态变更为异常回传（{}：{}）", role_display(&current_user.role), current_user.name);
    add_operation_log(
        pool,
        &record.ticket_id,
        &current_user.id,
        "status_change_to_exception",
        Some(&status_log),
    ).await?;

    let record: HandoverRecord = sqlx::query_as::<_, HandoverRecord>(
        "SELECT * FROM handover_records WHERE id = ?"
    )
    .bind(handover_id)
    .fetch_one(pool)
    .await?;

    Ok(record)
}

pub async fn list_my_handovers(
    pool: &DbPool,
    current_user: &User,
    status: Option<String>,
) -> Result<Vec<HandoverRecordDetail>> {
    let mut sql = "SELECT * FROM handover_records WHERE to_user = ?".to_string();
    let mut params: Vec<String> = vec![current_user.id.clone()];

    if let Some(s) = &status {
        if !s.is_empty() {
            sql.push_str(" AND status = ?");
            params.push(s.clone());
        }
    }

    sql.push_str(" ORDER BY created_at DESC");

    let mut query = sqlx::query_as::<_, HandoverRecord>(&sql);
    for p in &params {
        query = query.bind(p);
    }

    let records = query.fetch_all(pool).await?;

    let mut result = Vec::new();
    for record in records {
        let from_user = get_user_by_id(pool, &record.from_user).await?;
        result.push(HandoverRecordDetail {
            id: record.id,
            ticket_id: record.ticket_id,
            shift: record.shift,
            from_user: record.from_user,
            from_user_name: from_user.name,
            from_role: from_user.role,
            to_user: record.to_user,
            to_user_name: current_user.name.clone(),
            to_role: current_user.role.clone(),
            handover_time: record.handover_time,
            status: record.status,
            remark: record.remark,
            created_at: record.created_at,
        });
    }

    Ok(result)
}

pub async fn add_operation_log(
    pool: &DbPool,
    ticket_id: &str,
    user_id: &str,
    action: &str,
    detail: Option<&str>,
) -> Result<()> {
    let log_id = new_id();
    let now = Utc::now();

    sqlx::query(
        "INSERT INTO operation_logs (id, ticket_id, user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&log_id)
    .bind(ticket_id)
    .bind(user_id)
    .bind(action)
    .bind(detail)
    .bind(now)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_operation_logs(
    pool: &DbPool,
    ticket_id: Option<&str>,
    current_user: &User,
) -> Result<Vec<OperationLogDetail>> {
    let mut sql = "SELECT * FROM operation_logs WHERE 1=1".to_string();
    let mut params: Vec<String> = Vec::new();

    if let Some(tid) = ticket_id {
        sql.push_str(" AND ticket_id = ?");
        params.push(tid.to_string());
    }

    if current_user.role == "agent" {
        sql.push_str(" AND ticket_id IN (SELECT id FROM tickets WHERE created_by = ?)");
        params.push(current_user.id.clone());
    }

    sql.push_str(" ORDER BY created_at DESC LIMIT 100");

    let mut query = sqlx::query_as::<_, OperationLog>(&sql);
    for p in &params {
        query = query.bind(p);
    }

    let logs = query.fetch_all(pool).await?;

    let mut result = Vec::new();
    for log in logs {
        let user = get_user_by_id(pool, &log.user_id).await?;
        result.push(OperationLogDetail {
            id: log.id,
            ticket_id: log.ticket_id,
            user_id: log.user_id,
            user_name: user.name,
            action: log.action,
            detail: log.detail,
            created_at: log.created_at,
        });
    }

    Ok(result)
}

pub async fn get_statistics(pool: &DbPool, current_user: &User) -> Result<StatisticsResponse> {
    let mut where_clause = String::new();
    if current_user.role == "agent" {
        where_clause = format!("WHERE created_by = '{}'", current_user.id);
    }

    let total: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM tickets {}", where_clause))
        .fetch_one(pool)
        .await?;

    let incoming: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM tickets {} AND status = 'incoming'", if where_clause.is_empty() { "WHERE 1=1".to_string() } else { where_clause.clone() }))
        .fetch_one(pool)
        .await?;

    let dispatched: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM tickets {} AND status = 'dispatched'", if where_clause.is_empty() { "WHERE 1=1".to_string() } else { where_clause.clone() }))
        .fetch_one(pool)
        .await?;

    let return_visit: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM tickets {} AND status = 'return_visit'", if where_clause.is_empty() { "WHERE 1=1".to_string() } else { where_clause.clone() }))
        .fetch_one(pool)
        .await?;

    let closed: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM tickets {} AND status = 'closed'", if where_clause.is_empty() { "WHERE 1=1".to_string() } else { where_clause.clone() }))
        .fetch_one(pool)
        .await?;

    let exception: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM tickets {} AND status = 'exception'", if where_clause.is_empty() { "WHERE 1=1".to_string() } else { where_clause.clone() }))
        .fetch_one(pool)
        .await?;

    let pending_handover: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM handover_records WHERE to_user = ? AND status = 'pending'"
    )
    .bind(&current_user.id)
    .fetch_one(pool)
    .await?;

    let today_start = Utc::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
    let today_sql = if where_clause.is_empty() {
        format!("SELECT COUNT(*) FROM tickets WHERE created_at >= '{}'", today_start)
    } else {
        format!("SELECT COUNT(*) FROM tickets {} AND created_at >= '{}'", where_clause, today_start)
    };
    let today: i64 = sqlx::query_scalar(&today_sql)
        .fetch_one(pool)
        .await?;

    Ok(StatisticsResponse {
        total_tickets: total,
        incoming_count: incoming,
        dispatched_count: dispatched,
        return_visit_count: return_visit,
        closed_count: closed,
        exception_count: exception,
        pending_handover_count: pending_handover,
        today_tickets: today,
    })
}

pub async fn init_sample_data(pool: &SqlitePool) -> Result<()> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;

    if count > 0 {
        return Ok(());
    }

    let now = Utc::now();

    let users = vec![
        ("agent1", "123456", "agent", "客服小张", "morning"),
        ("agent2", "123456", "agent", "客服小李", "afternoon"),
        ("agent3", "123456", "agent", "客服小王", "night"),
        ("qa1", "123456", "qa_manager", "质检主管老赵", "morning"),
        ("qa2", "123456", "qa_manager", "质检主管老钱", "afternoon"),
        ("cs1", "123456", "cs_manager", "客服经理老孙", "morning"),
    ];

    for (username, password, role, name, shift) in users {
        let id = new_id();
        sqlx::query(
            "INSERT INTO users (id, username, password, role, name, shift, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(username)
        .bind(password)
        .bind(role)
        .bind(name)
        .bind(shift)
        .bind(now)
        .execute(pool)
        .await?;
    }

    let agent1: User = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = 'agent1'")
        .fetch_one(pool)
        .await?;

    let agent2: User = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = 'agent2'")
        .fetch_one(pool)
        .await?;

    let tickets = vec![
        ("网络故障报修", "张三", "13800138001", "家中无法上网，已重启路由器无效", "incoming", &agent1.id),
        ("账单查询", "李四", "13800138002", "查询本月话费明细", "dispatched", &agent1.id),
        ("套餐变更", "王五", "13800138003", "希望升级到5G套餐", "return_visit", &agent2.id),
        ("投诉建议", "赵六", "13800138004", "客服态度不好，投诉", "closed", &agent1.id),
        ("业务办理", "钱七", "13800138005", "办理宽带新装", "exception", &agent2.id),
    ];

    for (title, customer_name, customer_phone, description, status, created_by) in tickets {
        let id = new_id();
        sqlx::query(
            "INSERT INTO tickets (id, title, customer_name, customer_phone, description, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(title)
        .bind(customer_name)
        .bind(customer_phone)
        .bind(description)
        .bind(status)
        .bind(created_by)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        add_operation_log(pool, &id, created_by, "create_ticket", Some("创建工单")).await?;
    }

    Ok(())
}
