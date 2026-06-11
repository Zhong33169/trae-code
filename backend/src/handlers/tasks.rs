use actix_web::{web, HttpResponse, Responder, HttpRequest, get, post, put};
use sqlx::{SqlitePool, Transaction};
use std::collections::HashMap;

use crate::db::{generate_task_no, new_uuid, now_str};
use crate::middleware::auth::get_current_user;
use crate::models::{
    ApiResponse, AdvanceTaskRequest, BatchAdvanceRequest, BatchAdvanceResult,
    BatchItemResult, CreateTaskRequest,
    JwtClaims, NodeRecord, NodeRecordDetail, NodeType, OperationLog,
    OperationLogDetail, SamplingTask, TaskDetailResponse, TaskListItem,
    TaskListQuery, TaskListResponse, TaskStatus, UpdateTaskRequest,
    calculate_timeout,
};

fn get_client_ip(req: &HttpRequest) -> String {
    req.connection_info()
        .peer_addr()
        .unwrap_or("unknown")
        .to_string()
}

async fn log_operation(
    pool: &SqlitePool,
    task_id: Option<&str>,
    user_id: &str,
    action: &str,
    from_status: Option<&str>,
    to_status: Option<&str>,
    from_node: Option<&str>,
    to_node: Option<&str>,
    detail: Option<&str>,
    ip: Option<&str>,
) {
    let _ = sqlx::query(
        "INSERT INTO operation_logs 
         (id, task_id, user_id, action, from_status, to_status, from_node, to_node, detail, ip_address, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(new_uuid())
    .bind(task_id)
    .bind(user_id)
    .bind(action)
    .bind(from_status)
    .bind(to_status)
    .bind(from_node)
    .bind(to_node)
    .bind(detail)
    .bind(ip)
    .bind(now_str())
    .execute(pool)
    .await;
}

fn get_user_name(users: &HashMap<String, (String, String)>, user_id: &Option<String>) -> Option<String> {
    user_id.as_ref().and_then(|id| {
        users.get(id).map(|(name, _)| name.clone())
    })
}

async fn load_users_map(pool: &SqlitePool) -> HashMap<String, (String, String)> {
    let rows: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT id, real_name, role FROM users"
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut map = HashMap::new();
    for (id, name, role) in rows {
        map.insert(id, (name, role));
    }
    map
}

async fn check_task_owner_or_role(
    pool: &SqlitePool,
    task: &SamplingTask,
    user: &JwtClaims,
    allowed_roles: &[&str],
) -> bool {
    if allowed_roles.contains(&user.role.as_str()) {
        return true;
    }

    if user.role == "registrar" && task.registrar_id.as_deref() == Some(&user.user_id) {
        return true;
    }

    if user.role == "auditor" && task.auditor_id.as_deref() == Some(&user.user_id) {
        return true;
    }

    if user.role == "reviewer" && task.reviewer_id.as_deref() == Some(&user.user_id) {
        return true;
    }

    false
}

fn can_advance(
    current_node: &NodeType,
    user_role: &str,
    action: &str,
) -> (bool, &'static str) {
    match (current_node, user_role, action) {
        (NodeType::OrderSampling, "registrar", "submit") => (true, "提交审核"),
        (NodeType::OrderSampling, "auditor", "reject") => (true, "打回补正"),
        (NodeType::OrderSampling, "auditor", "approve") => (true, "审核通过"),
        (NodeType::SampleConfirmation, "registrar", "submit") => (true, "提交确认"),
        (NodeType::SampleConfirmation, "auditor", "reject") => (true, "打回补正"),
        (NodeType::SampleConfirmation, "auditor", "approve") => (true, "确认通过"),
        (NodeType::ProductionScheduling, "auditor", "submit") => (true, "提交复核"),
        (NodeType::ProductionScheduling, "reviewer", "reject") => (true, "打回补正"),
        (NodeType::ProductionScheduling, "reviewer", "approve") => (true, "复核通过"),
        (NodeType::Archived, _, _) => (false, "已归档任务无法推进"),
        _ => (false, "当前角色无权限执行此操作"),
    }
}

fn get_new_status(
    current_node: &NodeType,
    action: &str,
    is_last_node: bool,
) -> TaskStatus {
    match action {
        "reject" => TaskStatus::Rejected,
        "submit" => TaskStatus::Processing,
        "approve" if is_last_node => TaskStatus::Archived,
        "approve" => TaskStatus::Processing,
        _ => TaskStatus::Processing,
    }
}

#[get("")]
async fn get_tasks(
    pool: web::Data<SqlitePool>,
    query: web::Query<TaskListQuery>,
    req: HttpRequest,
) -> impl Responder {
    let claims = match get_current_user(&req) {
        Some(c) => c,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error(401, "未授权")),
    };

    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;

    let mut sql_conditions = Vec::new();
    let mut params: Vec<String> = Vec::new();

    if let Some(status) = &query.status {
        sql_conditions.push("t.status = ?");
        params.push(status.clone());
    }

    if let Some(current_node) = &query.current_node {
        sql_conditions.push("t.current_node = ?");
        params.push(current_node.clone());
    }

    if let Some(keyword) = &query.keyword {
        sql_conditions.push("(t.task_no LIKE ? OR t.style_no LIKE ? OR t.style_name LIKE ? OR t.customer_name LIKE ?)");
        let kw = format!("%{}%", keyword);
        params.push(kw.clone());
        params.push(kw.clone());
        params.push(kw.clone());
        params.push(kw);
    }

    if let Some(start_date) = &query.start_date {
        sql_conditions.push("DATE(t.created_at) >= ?");
        params.push(start_date.clone());
    }

    if let Some(end_date) = &query.end_date {
        sql_conditions.push("DATE(t.created_at) <= ?");
        params.push(end_date.clone());
    }

    if claims.role == "registrar" {
        sql_conditions.push("t.registrar_id = ?");
        params.push(claims.user_id.clone());
    } else if claims.role == "auditor" {
        sql_conditions.push("(t.auditor_id = ? OR t.auditor_id IS NULL)");
        params.push(claims.user_id.clone());
    } else if claims.role == "reviewer" {
        sql_conditions.push("(t.reviewer_id = ? OR t.reviewer_id IS NULL)");
        params.push(claims.user_id.clone());
    }

    let where_clause = if sql_conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", sql_conditions.join(" AND "))
    };

    let count_sql = format!(
        "SELECT COUNT(*) FROM sampling_tasks t {}",
        where_clause
    );

    let mut count_query = sqlx::query_scalar(&count_sql);
    for p in &params {
        count_query = count_query.bind(p);
    }

    let total: i64 = match count_query.fetch_one(pool.get_ref()).await {
        Ok(c) => c,
        Err(e) => {
            log::error!("Count query error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "查询失败")
            );
        }
    };

    let list_sql = format!(
        "SELECT t.* FROM sampling_tasks t {} ORDER BY t.created_at DESC LIMIT ? OFFSET ?",
        where_clause
    );

    let mut list_query = sqlx::query_as::<_, SamplingTask>(&list_sql);
    for p in &params {
        list_query = list_query.bind(p);
    }
    list_query = list_query.bind(page_size as i64).bind(offset as i64);

    let tasks: Vec<SamplingTask> = match list_query.fetch_all(pool.get_ref()).await {
        Ok(t) => t,
        Err(e) => {
            log::error!("List query error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "查询失败")
            );
        }
    };

    let users_map = load_users_map(pool.get_ref()).await;

    let mut timeout_count = 0;
    let list: Vec<TaskListItem> = tasks.into_iter().map(|task| {
        let is_timeout = task.is_timeout();
        let timeout_hours = task.timeout_hours();
        if is_timeout {
            timeout_count += 1;
        }
        TaskListItem {
            is_timeout,
            timeout_hours,
            registrar_name: get_user_name(&users_map, &task.registrar_id),
            auditor_name: get_user_name(&users_map, &task.auditor_id),
            reviewer_name: get_user_name(&users_map, &task.reviewer_id),
            task,
        }
    }).collect();

    if let Some(is_timeout_filter) = &query.is_timeout {
        if is_timeout_filter == "1" || is_timeout_filter == "true" {
            let filtered: Vec<TaskListItem> = list.into_iter().filter(|item| item.is_timeout).collect();
            let filtered_count = filtered.len() as i64;
            return HttpResponse::Ok().json(ApiResponse::success(TaskListResponse {
                list: filtered,
                total: filtered_count,
                page,
                page_size,
                timeout_count: filtered_count,
            }));
        } else if is_timeout_filter == "0" || is_timeout_filter == "false" {
            let filtered: Vec<TaskListItem> = list.into_iter().filter(|item| !item.is_timeout).collect();
            let filtered_count = filtered.len() as i64;
            return HttpResponse::Ok().json(ApiResponse::success(TaskListResponse {
                list: filtered,
                total: filtered_count,
                page,
                page_size,
                timeout_count: 0,
            }));
        }
    }

    HttpResponse::Ok().json(ApiResponse::success(TaskListResponse {
        list,
        total,
        page,
        page_size,
        timeout_count,
    }))
}

#[get("/{id}")]
async fn get_task_detail(
    pool: web::Data<SqlitePool>,
    id: web::Path<String>,
    req: HttpRequest,
) -> impl Responder {
    let claims = match get_current_user(&req) {
        Some(c) => c,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error(401, "未授权")),
    };

    let task: Option<SamplingTask> = match sqlx::query_as::<_, SamplingTask>(
        "SELECT * FROM sampling_tasks WHERE id = ?"
    )
    .bind(id.as_str())
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(t) => t,
        Err(e) => {
            log::error!("Get task error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "查询失败")
            );
        }
    };

    let task = match task {
        Some(t) => t,
        None => return HttpResponse::NotFound().json(
            ApiResponse::<()>::error(404, "任务不存在")
        ),
    };

    if !check_task_owner_or_role(pool.get_ref(), &task, &claims, &["registrar", "auditor", "reviewer"]).await {
        return HttpResponse::Forbidden().json(
            ApiResponse::<()>::error(403, "无权限查看此任务")
        );
    }

    let users_map = load_users_map(pool.get_ref()).await;

    let node_records_raw: Vec<NodeRecord> = match sqlx::query_as::<_, NodeRecord>(
        "SELECT * FROM node_records WHERE task_id = ? ORDER BY created_at ASC"
    )
    .bind(id.as_str())
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            log::error!("Get node records error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "查询失败")
            );
        }
    };

    let node_records: Vec<NodeRecordDetail> = node_records_raw.into_iter().map(|record| {
        let node_type = NodeType::try_from(record.node_type.as_str()).ok();
        NodeRecordDetail {
            operator_name: get_user_name(&users_map, &Some(record.operator_id.clone())),
            node_name: node_type.map(|n| n.display_name().to_string()),
            record,
        }
    }).collect();

    let operation_logs_raw: Vec<OperationLog> = match sqlx::query_as::<_, OperationLog>(
        "SELECT * FROM operation_logs WHERE task_id = ? ORDER BY created_at DESC"
    )
    .bind(id.as_str())
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(l) => l,
        Err(e) => {
            log::error!("Get operation logs error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "查询失败")
            );
        }
    };

    let operation_logs: Vec<OperationLogDetail> = operation_logs_raw.into_iter().map(|log| {
        OperationLogDetail {
            user_name: get_user_name(&users_map, &Some(log.user_id.clone())),
            log,
        }
    }).collect();

    let is_timeout = task.is_timeout();
    let timeout_hours = task.timeout_hours();

    HttpResponse::Ok().json(ApiResponse::success(TaskDetailResponse {
        is_timeout,
        timeout_hours,
        registrar_name: get_user_name(&users_map, &task.registrar_id),
        auditor_name: get_user_name(&users_map, &task.auditor_id),
        reviewer_name: get_user_name(&users_map, &task.reviewer_id),
        node_records,
        operation_logs,
        task,
    }))
}

#[get("/{id}/logs")]
async fn get_task_logs(
    pool: web::Data<SqlitePool>,
    id: web::Path<String>,
    req: HttpRequest,
) -> impl Responder {
    let claims = match get_current_user(&req) {
        Some(c) => c,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error(401, "未授权")),
    };

    let task: Option<SamplingTask> = match sqlx::query_as::<_, SamplingTask>(
        "SELECT * FROM sampling_tasks WHERE id = ?"
    )
    .bind(id.as_str())
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(t) => t,
        Err(e) => {
            log::error!("Get task error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "查询失败")
            );
        }
    };

    let task = match task {
        Some(t) => t,
        None => return HttpResponse::NotFound().json(
            ApiResponse::<()>::error(404, "任务不存在")
        ),
    };

    if !check_task_owner_or_role(pool.get_ref(), &task, &claims, &["registrar", "auditor", "reviewer"]).await {
        return HttpResponse::Forbidden().json(
            ApiResponse::<()>::error(403, "无权限查看此任务")
        );
    }

    let users_map = load_users_map(pool.get_ref()).await;

    let operation_logs_raw: Vec<OperationLog> = match sqlx::query_as::<_, OperationLog>(
        "SELECT * FROM operation_logs WHERE task_id = ? ORDER BY created_at DESC"
    )
    .bind(id.as_str())
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(l) => l,
        Err(e) => {
            log::error!("Get operation logs error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "查询失败")
            );
        }
    };

    let operation_logs: Vec<OperationLogDetail> = operation_logs_raw.into_iter().map(|log| {
        OperationLogDetail {
            user_name: get_user_name(&users_map, &Some(log.user_id.clone())),
            log,
        }
    }).collect();

    HttpResponse::Ok().json(ApiResponse::success(operation_logs))
}

#[post("")]
async fn create_task(
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
    form: web::Json<CreateTaskRequest>,
) -> impl Responder {
    let claims = match get_current_user(&req) {
        Some(c) => c,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error(401, "未授权")),
    };

    if claims.role != "registrar" {
        return HttpResponse::Forbidden().json(
            ApiResponse::<()>::error(403, "只有登记员可以创建任务")
        );
    }

    let ip = get_client_ip(&req);
    let task_no = match generate_task_no(pool.get_ref()).await {
        Ok(t) => t,
        Err(e) => {
            log::error!("Generate task no error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "生成任务编号失败")
            );
        }
    };

    let task_id = new_uuid();
    let record_id = new_uuid();
    let now = now_str();
    let current_node = NodeType::OrderSampling.to_string();
    let status = TaskStatus::Pending.to_string();

    let mut tx = match pool.get_ref().begin().await {
        Ok(t) => t,
        Err(e) => {
            log::error!("Begin transaction error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "数据库操作失败")
            );
        }
    };

    if let Err(e) = sqlx::query(
        "INSERT INTO sampling_tasks 
         (id, task_no, order_no, style_no, style_name, customer_name, fabric_type, 
          color, size_spec, quantity, current_node, status, priority, deadline, 
          order_sampling_started_at, registrar_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&task_id)
    .bind(&task_no)
    .bind(&form.order_no)
    .bind(&form.style_no)
    .bind(&form.style_name)
    .bind(&form.customer_name)
    .bind(&form.fabric_type)
    .bind(&form.color)
    .bind(&form.size_spec)
    .bind(&form.quantity)
    .bind(&current_node)
    .bind(&status)
    .bind(&form.priority)
    .bind(&form.deadline)
    .bind(&now)
    .bind(&claims.user_id)
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await
    {
        let _ = tx.rollback().await;
        log::error!("Insert task error: {}", e);
        return HttpResponse::InternalServerError().json(
            ApiResponse::<()>::error(500, "创建任务失败")
        );
    }

    if let Err(e) = sqlx::query(
        "INSERT INTO node_records 
         (id, task_id, node_type, operator_id, action, remark, started_at, is_timeout, timeout_hours, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)"
    )
    .bind(&record_id)
    .bind(&task_id)
    .bind(&current_node)
    .bind(&claims.user_id)
    .bind("create")
    .bind(&form.remark)
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await
    {
        let _ = tx.rollback().await;
        log::error!("Insert node record error: {}", e);
        return HttpResponse::InternalServerError().json(
            ApiResponse::<()>::error(500, "创建任务失败")
        );
    }

    if let Err(e) = sqlx::query(
        "INSERT INTO operation_logs 
         (id, task_id, user_id, action, from_status, to_status, from_node, to_node, detail, ip_address, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(new_uuid())
    .bind(&task_id)
    .bind(&claims.user_id)
    .bind("创建任务")
    .bind::<Option<&str>>(None)
    .bind(&status)
    .bind::<Option<&str>>(None)
    .bind(&current_node)
    .bind(&format!("创建打样任务: {}", task_no))
    .bind(&ip)
    .bind(&now)
    .execute(&mut *tx)
    .await
    {
        let _ = tx.rollback().await;
        log::error!("Insert operation log error: {}", e);
        return HttpResponse::InternalServerError().json(
            ApiResponse::<()>::error(500, "创建任务失败")
        );
    }

    if let Err(e) = tx.commit().await {
        log::error!("Commit transaction error: {}", e);
        return HttpResponse::InternalServerError().json(
            ApiResponse::<()>::error(500, "创建任务失败")
        );
    }

    log::info!("Task created: {} by {}", task_no, claims.username);

    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
        "id": task_id,
        "task_no": task_no,
        "message": "任务创建成功"
    })))
}

#[put("/{id}")]
async fn update_task(
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
    id: web::Path<String>,
    form: web::Json<UpdateTaskRequest>,
) -> impl Responder {
    let claims = match get_current_user(&req) {
        Some(c) => c,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error(401, "未授权")),
    };

    if claims.role != "registrar" {
        return HttpResponse::Forbidden().json(
            ApiResponse::<()>::error(403, "只有登记员可以补正任务")
        );
    }

    let ip = get_client_ip(&req);

    let task: Option<SamplingTask> = match sqlx::query_as::<_, SamplingTask>(
        "SELECT * FROM sampling_tasks WHERE id = ?"
    )
    .bind(id.as_str())
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(t) => t,
        Err(e) => {
            log::error!("Get task error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "查询失败")
            );
        }
    };

    let task = match task {
        Some(t) => t,
        None => return HttpResponse::NotFound().json(
            ApiResponse::<()>::error(404, "任务不存在")
        ),
    };

    if task.registrar_id.as_deref() != Some(&claims.user_id) {
        return HttpResponse::Forbidden().json(
            ApiResponse::<()>::error(403, "只能修改自己创建的任务")
        );
    }

    let current_node = match NodeType::try_from(task.current_node.as_str()) {
        Ok(n) => n,
        Err(_) => return HttpResponse::BadRequest().json(
            ApiResponse::<()>::error(400, "任务状态异常")
        ),
    };

    if current_node == NodeType::Archived {
        return HttpResponse::BadRequest().json(
            ApiResponse::<()>::error(400, "已归档任务无法修改")
        );
    }

    if task.status != "rejected" && current_node != NodeType::OrderSampling {
        return HttpResponse::BadRequest().json(
            ApiResponse::<()>::error(400, "只能在被打回或订单打样阶段修改任务")
        );
    }

    let now = now_str();
    let new_status = TaskStatus::Processing.to_string();
    let old_status = task.status.clone();

    let mut tx = match pool.get_ref().begin().await {
        Ok(t) => t,
        Err(e) => {
            log::error!("Begin transaction error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "数据库操作失败")
            );
        }
    };

    let mut update_fields = Vec::new();
    let mut params: Vec<String> = Vec::new();

    if let Some(v) = &form.order_no { update_fields.push("order_no = ?"); params.push(v.clone()); }
    if let Some(v) = &form.style_no { update_fields.push("style_no = ?"); params.push(v.clone()); }
    if let Some(v) = &form.style_name { update_fields.push("style_name = ?"); params.push(v.clone()); }
    if let Some(v) = &form.customer_name { update_fields.push("customer_name = ?"); params.push(v.clone()); }
    if let Some(v) = &form.fabric_type { update_fields.push("fabric_type = ?"); params.push(v.clone()); }
    if let Some(v) = &form.color { update_fields.push("color = ?"); params.push(v.clone()); }
    if let Some(v) = &form.size_spec { update_fields.push("size_spec = ?"); params.push(v.clone()); }
    if let Some(v) = &form.quantity { update_fields.push("quantity = ?"); params.push(v.to_string()); }
    if let Some(v) = &form.priority { update_fields.push("priority = ?"); params.push(v.clone()); }
    if let Some(v) = &form.deadline { update_fields.push("deadline = ?"); params.push(v.clone()); }

    update_fields.push("status = ?");
    update_fields.push("updated_at = ?");
    params.push(new_status.clone());
    params.push(now.clone());
    params.push(id.clone());

    let update_sql = format!(
        "UPDATE sampling_tasks SET {} WHERE id = ?",
        update_fields.join(", ")
    );

    let mut query = sqlx::query(&update_sql);
    for p in &params {
        query = query.bind(p.as_str());
    }

    if let Err(e) = query.execute(&mut *tx).await {
        let _ = tx.rollback().await;
        log::error!("Update task error: {}", e);
        return HttpResponse::InternalServerError().json(
            ApiResponse::<()>::error(500, "更新任务失败")
        );
    }

    if let Err(e) = sqlx::query(
        "UPDATE node_records SET remark = ? WHERE task_id = ? AND node_type = ? AND completed_at IS NULL"
    )
    .bind(&form.remark)
    .bind(id.as_str())
    .bind(task.current_node.as_str())
    .execute(&mut *tx)
    .await
    {
        let _ = tx.rollback().await;
        log::error!("Update node record error: {}", e);
        return HttpResponse::InternalServerError().json(
            ApiResponse::<()>::error(500, "更新任务失败")
        );
    }

    if let Err(e) = sqlx::query(
        "INSERT INTO operation_logs 
         (id, task_id, user_id, action, from_status, to_status, from_node, to_node, detail, ip_address, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(new_uuid())
    .bind(id.as_str())
    .bind(&claims.user_id)
    .bind("补正修改")
    .bind(&old_status)
    .bind(&new_status)
    .bind(task.current_node.as_str())
    .bind(task.current_node.as_str())
    .bind(&format!("补正修改任务信息: {}", task.task_no))
    .bind(&ip)
    .bind(&now)
    .execute(&mut *tx)
    .await
    {
        let _ = tx.rollback().await;
        log::error!("Insert operation log error: {}", e);
        return HttpResponse::InternalServerError().json(
            ApiResponse::<()>::error(500, "更新任务失败")
        );
    }

    if let Err(e) = tx.commit().await {
        log::error!("Commit transaction error: {}", e);
        return HttpResponse::InternalServerError().json(
            ApiResponse::<()>::error(500, "更新任务失败")
        );
    }

    log::info!("Task updated: {} by {}", task.task_no, claims.username);

    HttpResponse::Ok().json(ApiResponse::<()>::success_msg("任务更新成功"))
}

async fn advance_task_internal(
    tx: &mut Transaction<'_, sqlx::Sqlite>,
    task: &SamplingTask,
    claims: &JwtClaims,
    action: &str,
    remark: Option<&str>,
    abnormal_reason: Option<&str>,
    ip: &str,
) -> Result<(String, String, String, String), String> {
    let current_node = match NodeType::try_from(task.current_node.as_str()) {
        Ok(n) => n,
        Err(e) => return Err(format!("任务状态异常: {}", e)),
    };

    let (can_do, action_name) = can_advance(&current_node, &claims.role, action);
    if !can_do {
        return Err(action_name.to_string());
    }

    let is_last_node = current_node.next().is_none();
    let new_status = get_new_status(&current_node, action, is_last_node);

    let next_node = if action == "approve" && !is_last_node {
        current_node.next()
    } else if action == "reject" {
        Some(NodeType::OrderSampling)
    } else {
        None
    };

    let now = now_str();
    let old_status = task.status.clone();
    let old_node = task.current_node.clone();
    let new_node_str = next_node.map(|n| n.to_string()).unwrap_or_else(|| old_node.clone());
    let new_status_str = new_status.to_string();

    let (started_at_field, completed_at_field) = match current_node {
        NodeType::OrderSampling => (
            "order_sampling_started_at",
            "order_sampling_completed_at",
        ),
        NodeType::SampleConfirmation => (
            "sample_confirmation_started_at",
            "sample_confirmation_completed_at",
        ),
        NodeType::ProductionScheduling => (
            "production_scheduling_started_at",
            "production_scheduling_completed_at",
        ),
        NodeType::Archived => return Err("已归档任务无法推进".to_string()),
    };

    let started_at: Option<String> = match current_node {
        NodeType::OrderSampling => task.order_sampling_started_at.clone(),
        NodeType::SampleConfirmation => task.sample_confirmation_started_at.clone(),
        NodeType::ProductionScheduling => task.production_scheduling_started_at.clone(),
        NodeType::Archived => None,
    };

    let (is_timeout, timeout_hours) = match &started_at {
        Some(sa) => calculate_timeout(sa, Some(&now)),
        None => (false, 0),
    };

    let mut update_fields = vec![
        format!("status = '{}'", new_status_str),
        format!("updated_at = '{}'", now),
    ];

    if action == "approve" || action == "submit" {
        update_fields.push(format!("{} = '{}'", completed_at_field, now));
    }

    if action == "approve" {
        if let Some(next) = current_node.next() {
            let next_started_field = match next {
                NodeType::SampleConfirmation => "sample_confirmation_started_at",
                NodeType::ProductionScheduling => "production_scheduling_started_at",
                NodeType::Archived => "archived_at",
                NodeType::OrderSampling => unreachable!("next node cannot be OrderSampling"),
            };
            update_fields.push(format!("{} = '{}'", next_started_field, now));
            update_fields.push(format!("current_node = '{}'", next.to_string()));

            let operator_field = match next {
                NodeType::SampleConfirmation | NodeType::ProductionScheduling => "auditor_id",
                NodeType::Archived => "reviewer_id",
                NodeType::OrderSampling => unreachable!("next node cannot be OrderSampling"),
            };
            update_fields.push(format!("{} = '{}'", operator_field, claims.user_id));
        } else {
            update_fields.push(format!("archived_at = '{}'", now));
            update_fields.push(format!("current_node = '{}'", NodeType::Archived.to_string()));
            update_fields.push(format!("reviewer_id = '{}'", claims.user_id));
        }
    }

    if action == "reject" {
        update_fields.push(format!("current_node = '{}'", NodeType::OrderSampling.to_string()));
        update_fields.push(format!("registrar_id = COALESCE(registrar_id, '{}')", claims.user_id));
    }

    if action == "submit" && current_node == NodeType::OrderSampling {
        update_fields.push(format!("auditor_id = COALESCE(auditor_id, '{}')", claims.user_id));
    }

    let update_sql = format!(
        "UPDATE sampling_tasks SET {} WHERE id = '{}'",
        update_fields.join(", "),
        task.id
    );

    if let Err(e) = sqlx::query(&update_sql).execute(&mut **tx).await {
        return Err(format!("更新任务失败: {}", e));
    }

    if let Err(e) = sqlx::query(
        "UPDATE node_records 
         SET completed_at = ?, is_timeout = ?, timeout_hours = ?, 
             action = ?, remark = COALESCE(?, remark), abnormal_reason = ?
         WHERE task_id = ? AND node_type = ? AND completed_at IS NULL"
    )
    .bind(&now)
    .bind(is_timeout as i32)
    .bind(timeout_hours as i32)
    .bind(action)
    .bind(remark)
    .bind(abnormal_reason)
    .bind(&task.id)
    .bind(&old_node)
    .execute(&mut **tx)
    .await
    {
        return Err(format!("更新节点记录失败: {}", e));
    }

    if action == "approve" {
        if let Some(next) = current_node.next() {
            let new_record_id = new_uuid();
            if let Err(e) = sqlx::query(
                "INSERT INTO node_records 
                 (id, task_id, node_type, operator_id, action, started_at, is_timeout, timeout_hours, created_at) 
                 VALUES (?, ?, ?, ?, 'process', ?, 0, 0, ?)"
            )
            .bind(&new_record_id)
            .bind(&task.id)
            .bind(next.to_string())
            .bind(&claims.user_id)
            .bind(&now)
            .bind(&now)
            .execute(&mut **tx)
            .await
            {
                return Err(format!("创建节点记录失败: {}", e));
            }
        }
    }

    if action == "reject" {
        let new_record_id = new_uuid();
        let reject_started_at = now.clone();
        if let Err(e) = sqlx::query(
            "INSERT INTO node_records 
             (id, task_id, node_type, operator_id, action, remark, abnormal_reason, started_at, is_timeout, timeout_hours, created_at) 
             VALUES (?, ?, ?, ?, 'reject', ?, ?, ?, 0, 0, ?)"
        )
        .bind(&new_record_id)
        .bind(&task.id)
        .bind(NodeType::OrderSampling.to_string())
        .bind(&claims.user_id)
        .bind(remark)
        .bind(abnormal_reason)
        .bind(&reject_started_at)
        .bind(&now)
        .execute(&mut **tx)
        .await
        {
            return Err(format!("创建节点记录失败: {}", e));
        }

        if let Err(e) = sqlx::query(
            "UPDATE sampling_tasks SET order_sampling_started_at = ? WHERE id = ?"
        )
        .bind(&reject_started_at)
        .bind(&task.id)
        .execute(&mut **tx)
        .await
        {
            return Err(format!("更新任务时间失败: {}", e));
        }
    }

    if let Err(e) = sqlx::query(
        "INSERT INTO operation_logs 
         (id, task_id, user_id, action, from_status, to_status, from_node, to_node, detail, ip_address, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(new_uuid())
    .bind(&task.id)
    .bind(&claims.user_id)
    .bind(action_name)
    .bind(&old_status)
    .bind(&new_status_str)
    .bind(&old_node)
    .bind(&new_node_str)
    .bind(&format!("{}任务: {}", action_name, task.task_no))
    .bind(ip)
    .bind(&now)
    .execute(&mut **tx)
    .await
    {
        return Err(format!("记录操作日志失败: {}", e));
    }

    Ok((action_name.to_string(), old_status, new_status_str, new_node_str))
}

#[post("/{id}/advance")]
async fn advance_task(
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
    id: web::Path<String>,
    form: web::Json<AdvanceTaskRequest>,
) -> impl Responder {
    let claims = match get_current_user(&req) {
        Some(c) => c,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error(401, "未授权")),
    };

    let ip = get_client_ip(&req);

    let task: Option<SamplingTask> = match sqlx::query_as::<_, SamplingTask>(
        "SELECT * FROM sampling_tasks WHERE id = ?"
    )
    .bind(id.as_str())
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(t) => t,
        Err(e) => {
            log::error!("Get task error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "查询失败")
            );
        }
    };

    let task = match task {
        Some(t) => t,
        None => return HttpResponse::NotFound().json(
            ApiResponse::<()>::error(404, "任务不存在")
        ),
    };

    let mut tx = match pool.get_ref().begin().await {
        Ok(t) => t,
        Err(e) => {
            log::error!("Begin transaction error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "数据库操作失败")
            );
        }
    };

    let result = advance_task_internal(
        &mut tx,
        &task,
        &claims,
        &form.action,
        form.remark.as_deref(),
        form.abnormal_reason.as_deref(),
        &ip,
    ).await;

    match result {
        Ok((action_name, _, new_status, new_node)) => {
            if let Err(e) = tx.commit().await {
                log::error!("Commit transaction error: {}", e);
                return HttpResponse::InternalServerError().json(
                    ApiResponse::<()>::error(500, "操作失败")
                );
            }
            log::info!("Task advanced: {} - {} by {}", task.task_no, action_name, claims.username);
            HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                "message": format!("{}成功", action_name),
                "new_status": new_status,
                "new_node": new_node
            })))
        }
        Err(e) => {
            let _ = tx.rollback().await;
            HttpResponse::BadRequest().json(ApiResponse::<()>::error(400, &e))
        }
    }
}

#[post("/batch-advance")]
async fn batch_advance_task(
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
    form: web::Json<BatchAdvanceRequest>,
) -> impl Responder {
    let claims = match get_current_user(&req) {
        Some(c) => c,
        None => return HttpResponse::Unauthorized().json(ApiResponse::<()>::error(401, "未授权")),
    };

    if form.task_ids.is_empty() {
        return HttpResponse::BadRequest().json(
            ApiResponse::<()>::error(400, "请选择要操作的任务")
        );
    }

    let ip = get_client_ip(&req);
    let mut success_count: i64 = 0;
    let mut fail_count: i64 = 0;
    let mut results: Vec<BatchItemResult> = Vec::new();

    for task_id in &form.task_ids {
        let task: Option<SamplingTask> = match sqlx::query_as::<_, SamplingTask>(
            "SELECT * FROM sampling_tasks WHERE id = ?"
        )
        .bind(task_id)
        .fetch_optional(pool.get_ref())
        .await
        {
            Ok(t) => t,
            Err(e) => {
                fail_count += 1;
                results.push(BatchItemResult {
                    task_id: task_id.clone(),
                    task_no: task_id.clone(),
                    success: false,
                    error: Some(format!("查询失败: {}", e)),
                    action: None,
                    from_node: None,
                    to_node: None,
                });
                continue;
            }
        };

        let task = match task {
            Some(t) => t,
            None => {
                fail_count += 1;
                results.push(BatchItemResult {
                    task_id: task_id.clone(),
                    task_no: task_id.clone(),
                    success: false,
                    error: Some("任务不存在".to_string()),
                    action: None,
                    from_node: None,
                    to_node: None,
                });
                continue;
            }
        };

        let from_node = task.current_node.clone();

        let mut tx = match pool.get_ref().begin().await {
            Ok(t) => t,
            Err(_) => {
                fail_count += 1;
                results.push(BatchItemResult {
                    task_id: task.id.clone(),
                    task_no: task.task_no.clone(),
                    success: false,
                    error: Some("数据库操作失败".to_string()),
                    action: None,
                    from_node: Some(from_node),
                    to_node: None,
                });
                continue;
            }
        };

        let result = advance_task_internal(
            &mut tx,
            &task,
            &claims,
            &form.action,
            form.remark.as_deref(),
            form.abnormal_reason.as_deref(),
            &ip,
        ).await;

        match result {
            Ok((action_name, from_status, to_status, to_node)) => {
                if tx.commit().await.is_ok() {
                    success_count += 1;
                    log::info!("Batch advance task: {} - {} by {}", task.task_no, action_name, claims.username);
                    results.push(BatchItemResult {
                        task_id: task.id.clone(),
                        task_no: task.task_no.clone(),
                        success: true,
                        error: None,
                        action: Some(action_name),
                        from_node: Some(from_node),
                        to_node: Some(to_node),
                    });
                } else {
                    fail_count += 1;
                    results.push(BatchItemResult {
                        task_id: task.id.clone(),
                        task_no: task.task_no.clone(),
                        success: false,
                        error: Some("提交失败".to_string()),
                        action: None,
                        from_node: Some(from_node),
                        to_node: None,
                    });
                }
            }
            Err(e) => {
                let _ = tx.rollback().await;
                fail_count += 1;
                results.push(BatchItemResult {
                    task_id: task.id.clone(),
                    task_no: task.task_no.clone(),
                    success: false,
                    error: Some(e),
                    action: None,
                    from_node: Some(from_node),
                    to_node: None,
                });
            }
        }
    }

    HttpResponse::Ok().json(ApiResponse::success(BatchAdvanceResult {
        success_count,
        fail_count,
        results,
    }))
}

pub fn init_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/tasks")
            .service(get_tasks)
            .service(get_task_detail)
            .service(get_task_logs)
            .service(create_task)
            .service(update_task)
            .service(advance_task)
            .service(batch_advance_task)
    );
}
