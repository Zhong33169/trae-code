use anyhow::{anyhow, Result};

use crate::db::DbPool;
use crate::models::*;

async fn get_order(pool: &DbPool, id: &str) -> Result<Option<SparePartOrder>> {
    let row: Option<SparePartOrderDb> = sqlx::query_as::<_, SparePartOrderDb>(
        "SELECT * FROM spare_part_orders WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(SparePartOrder::from))
}

async fn get_user(pool: &DbPool, id: &str) -> Result<Option<User>> {
    let row: Option<User> = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

async fn add_process_record(
    pool: &DbPool,
    order_id: &str,
    handler: &User,
    action: &str,
    opinion: &str,
    from_status: &str,
    to_status: &str,
) -> Result<()> {
    let id = new_uuid();
    sqlx::query(
        r#"
        INSERT INTO process_records (
            id, order_id, handler_id, handler_name, handler_role,
            action, opinion, from_status, to_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(order_id)
    .bind(&handler.id)
    .bind(&handler.name)
    .bind(&handler.role)
    .bind(action)
    .bind(opinion)
    .bind(from_status)
    .bind(to_status)
    .bind(&now_iso())
    .execute(pool)
    .await?;
    Ok(())
}

async fn update_order_status(
    pool: &DbPool,
    order_id: &str,
    new_status: &str,
    handler_id: &str,
    handler_name: &str,
    handler_role: &str,
    new_version: i64,
    extra_fields: &[(&str, Option<String>)],
) -> Result<()> {
    let mut set_clause = vec![
        "status = ?".to_string(),
        "current_handler_id = ?".to_string(),
        "current_handler_name = ?".to_string(),
        "current_handler_role = ?".to_string(),
        "version = ?".to_string(),
        "updated_at = ?".to_string(),
    ];
    for (field, _) in extra_fields {
        set_clause.push(format!("{} = ?", field));
    }

    let sql = format!(
        "UPDATE spare_part_orders SET {} WHERE id = ?",
        set_clause.join(", ")
    );

    let now_str = now_iso();
    let mut query = sqlx::query(&sql);
    query = query
        .bind(new_status)
        .bind(handler_id)
        .bind(handler_name)
        .bind(handler_role)
        .bind(new_version)
        .bind(now_str.as_str());

    for (_, value) in extra_fields {
        query = query.bind(value.as_deref());
    }
    query = query.bind(order_id);

    query.execute(pool).await?;
    Ok(())
}

fn validate_version(order: &SparePartOrder, req_version: i64) -> Result<(), String> {
    if order.version != req_version {
        return Err(format!(
            "版本冲突：当前版本为 {}，您提交的版本为 {}，请刷新后重试",
            order.version, req_version
        ));
    }
    Ok(())
}

fn validate_handler(order: &SparePartOrder, handler: &User) -> Result<(), String> {
    if order.current_handler_id != handler.id {
        return Err(format!(
            "处理人不匹配：当前处理人为 {}，您没有权限处理此单据",
            order.current_handler_name
        ));
    }
    if order.current_handler_role != handler.role {
        return Err("角色不匹配：您的角色与当前处理角色不符".to_string());
    }
    Ok(())
}

fn validate_evidence(
    order: &SparePartOrder,
    new_evidence: Option<&[EvidenceItem]>,
    require_count: usize,
) -> Result<(), String> {
    let current_count = order.evidence.len();
    let total = if let Some(ev) = new_evidence {
        current_count + ev.len()
    } else {
        current_count
    };
    if total < require_count {
        return Err(format!(
            "证据不足：至少需要 {} 份证据材料，当前仅有 {} 份",
            require_count, total
        ));
    }
    Ok(())
}

async fn record_failure(
    pool: &DbPool,
    order: &SparePartOrder,
    handler: &User,
    action: &str,
    reason: &str,
) {
    let _ = add_process_record(
        pool,
        &order.id,
        handler,
        action,
        reason,
        &order.status,
        &order.status,
    )
    .await;
}

pub async fn handle_submit(
    pool: &DbPool,
    req: &ActionRequest,
) -> Result<SparePartOrder> {
    let order = get_order(pool, &req.order_id)
        .await?
        .ok_or_else(|| anyhow!("单据不存在"))?;
    let handler = get_user(pool, &req.handler_id)
        .await?
        .ok_or_else(|| anyhow!("用户不存在"))?;

    if let Err(msg) = validate_version(&order, req.version) {
        record_failure(pool, &order, &handler, "提交失败-版本冲突", &msg).await;
        return Err(anyhow!(msg));
    }
    if let Err(msg) = validate_handler(&order, &handler) {
        record_failure(pool, &order, &handler, "提交失败-处理人不匹配", &msg).await;
        return Err(anyhow!(msg));
    }

    let allowed = [
        OrderStatus::Draft.as_str(),
        OrderStatus::VerifyReturned.as_str(),
        OrderStatus::AppealRejectedCorrection.as_str(),
        OrderStatus::ReviewReturned.as_str(),
    ];
    if !allowed.contains(&order.status.as_str()) {
        let msg = format!("当前状态 {} 不允许提交登记", order.status);
        record_failure(pool, &order, &handler, "提交失败-状态不允许", &msg).await;
        return Err(anyhow!(msg));
    }

    if handler.role != UserRole::Registrar.as_str() {
        let msg = "只有备件更换登记员可以提交登记".to_string();
        record_failure(pool, &order, &handler, "提交失败-角色不匹配", &msg).await;
        return Err(anyhow!(msg));
    }

    if let Err(msg) = validate_evidence(&order, req.evidence.as_deref(), 2) {
        record_failure(pool, &order, &handler, "提交失败-证据不足", &msg).await;
        return Err(anyhow!(msg));
    }

    let appeal_required = [
        OrderStatus::VerifyReturned.as_str(),
        OrderStatus::AppealRejectedCorrection.as_str(),
        OrderStatus::ReviewReturned.as_str(),
    ];
    if appeal_required.contains(&order.status.as_str()) {
        let reason = req.appeal_reason.as_deref().unwrap_or("").trim();
        if reason.is_empty() {
            let msg = match order.status.as_str() {
                s if s == OrderStatus::VerifyReturned.as_str() => {
                    "核验退回后提交申诉必须填写申诉理由".to_string()
                }
                _ => "补正重提必须填写补正说明".to_string(),
            };
            record_failure(pool, &order, &handler, "提交失败-理由为空", &msg).await;
            return Err(anyhow!(msg));
        }
    }

    let evidence = if let Some(ev) = &req.evidence {
        let mut merged = order.evidence.clone();
        merged.extend(ev.clone());
        merged
    } else {
        order.evidence.clone()
    };
    let evidence_json = serde_json::to_string(&evidence)?;

    let is_missing = evidence.len() < 3;
    let new_version = order.version + 1;

    let (to_status, action, to_handler_id, to_handler_name, to_handler_role) =
        if order.status == OrderStatus::AppealRejectedCorrection.as_str()
            || order.status == OrderStatus::ReviewReturned.as_str()
        {
            (
                OrderStatus::AppealResubmitted.as_str().to_string(),
                if order.status == OrderStatus::ReviewReturned.as_str() {
                    "复核退回补正后重新提交"
                } else {
                    "申诉补正后重新提交"
                },
                "user_reviewer_1".to_string(),
                "赵复核负责人".to_string(),
                UserRole::Reviewer.as_str().to_string(),
            )
        } else if order.status == OrderStatus::VerifyReturned.as_str() {
            (
                OrderStatus::AppealSubmitted.as_str().to_string(),
                "申诉提交",
                "user_reviewer_1".to_string(),
                "赵复核负责人".to_string(),
                UserRole::Reviewer.as_str().to_string(),
            )
        } else {
            (
                OrderStatus::Registered.as_str().to_string(),
                "提交登记",
                "user_auditor_1".to_string(),
                "王审核主管".to_string(),
                UserRole::Auditor.as_str().to_string(),
            )
        };

    let opinion = if appeal_required.contains(&order.status.as_str()) {
        req.appeal_reason.clone().unwrap_or_default()
    } else {
        req.opinion.clone().unwrap_or_default()
    };

    let original_status = if order.status == OrderStatus::VerifyReturned.as_str()
        || order.status == OrderStatus::AppealRejectedCorrection.as_str()
        || order.status == OrderStatus::ReviewReturned.as_str()
    {
        Some(order.status.clone())
    } else {
        None
    };

    sqlx::query(
        r#"
        UPDATE spare_part_orders SET
            status = ?,
            current_handler_id = ?,
            current_handler_name = ?,
            current_handler_role = ?,
            version = ?,
            evidence = ?,
            is_evidence_missing = ?,
            appeal_reason = COALESCE(?, appeal_reason),
            original_status = COALESCE(?, original_status),
            updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&to_status)
    .bind(&to_handler_id)
    .bind(&to_handler_name)
    .bind(&to_handler_role)
    .bind(new_version)
    .bind(&evidence_json)
    .bind(is_missing)
    .bind(req.appeal_reason.as_deref())
    .bind(original_status.as_deref())
    .bind(&now_iso())
    .bind(&req.order_id)
    .execute(pool)
    .await?;

    add_process_record(
        pool,
        &req.order_id,
        &handler,
        &action,
        &opinion,
        &order.status,
        &to_status,
    )
    .await?;

    get_order(pool, &req.order_id)
        .await?
        .ok_or_else(|| anyhow!("更新后读取单据失败"))
}

pub async fn handle_verify(
    pool: &DbPool,
    req: &ActionRequest,
    pass: bool,
) -> Result<SparePartOrder> {
    let order = get_order(pool, &req.order_id)
        .await?
        .ok_or_else(|| anyhow!("单据不存在"))?;
    let handler = get_user(pool, &req.handler_id)
        .await?
        .ok_or_else(|| anyhow!("用户不存在"))?;

    if let Err(msg) = validate_version(&order, req.version) {
        record_failure(pool, &order, &handler, "核验失败-版本冲突", &msg).await;
        return Err(anyhow!(msg));
    }
    if let Err(msg) = validate_handler(&order, &handler) {
        record_failure(pool, &order, &handler, "核验失败-处理人不匹配", &msg).await;
        return Err(anyhow!(msg));
    }

    if handler.role != UserRole::Auditor.as_str() {
        let msg = "只有备件更换审核主管可以办理核验".to_string();
        record_failure(pool, &order, &handler, "核验失败-角色不匹配", &msg).await;
        return Err(anyhow!(msg));
    }

    let allowed_statuses = [
        OrderStatus::Registered.as_str(),
        OrderStatus::Verifying.as_str(),
    ];
    if !allowed_statuses.contains(&order.status.as_str()) {
        let msg = format!("当前状态 {} 不允许办理核验", order.status);
        record_failure(pool, &order, &handler, "核验失败-状态不允许", &msg).await;
        return Err(anyhow!(msg));
    }

    let opinion = req.opinion.clone().unwrap_or_default();
    let new_version = order.version + 1;

    let (to_status, action, to_handler_id, to_handler_name, to_handler_role, extra) = if pass {
        if let Err(msg) = validate_evidence(&order, None, 2) {
            record_failure(pool, &order, &handler, "核验失败-证据不足", &msg).await;
            return Err(anyhow!(msg));
        }
        (
            OrderStatus::Reviewing.as_str().to_string(),
            "核验通过提交复核",
            "user_reviewer_1".to_string(),
            "赵复核负责人".to_string(),
            UserRole::Reviewer.as_str().to_string(),
            Vec::<(&str, Option<String>)>::new(),
        )
    } else {
        if opinion.trim().is_empty() {
            let msg = "退回必须填写处理意见".to_string();
            record_failure(pool, &order, &handler, "核验失败-意见为空", &msg).await;
            return Err(anyhow!(msg));
        }
        (
            OrderStatus::VerifyReturned.as_str().to_string(),
            "核验退回补正",
            order.registrar_id.clone(),
            order.registrar_name.clone(),
            UserRole::Registrar.as_str().to_string(),
            vec![("reject_reason", Some(opinion.clone()))],
        )
    };

    update_order_status(
        pool,
        &req.order_id,
        &to_status,
        &to_handler_id,
        &to_handler_name,
        &to_handler_role,
        new_version,
        &extra,
    )
    .await?;

    add_process_record(
        pool,
        &req.order_id,
        &handler,
        &action,
        &opinion,
        &order.status,
        &to_status,
    )
    .await?;

    get_order(pool, &req.order_id)
        .await?
        .ok_or_else(|| anyhow!("更新后读取单据失败"))
}

pub async fn handle_review(
    pool: &DbPool,
    req: &ActionRequest,
    decision: &str,
) -> Result<SparePartOrder> {
    let order = get_order(pool, &req.order_id)
        .await?
        .ok_or_else(|| anyhow!("单据不存在"))?;
    let handler = get_user(pool, &req.handler_id)
        .await?
        .ok_or_else(|| anyhow!("用户不存在"))?;

    if let Err(msg) = validate_version(&order, req.version) {
        record_failure(pool, &order, &handler, "复核失败-版本冲突", &msg).await;
        return Err(anyhow!(msg));
    }
    if let Err(msg) = validate_handler(&order, &handler) {
        record_failure(pool, &order, &handler, "复核失败-处理人不匹配", &msg).await;
        return Err(anyhow!(msg));
    }

    if handler.role != UserRole::Reviewer.as_str() {
        let msg = "只有复核负责人可以办理复核".to_string();
        record_failure(pool, &order, &handler, "复核失败-角色不匹配", &msg).await;
        return Err(anyhow!(msg));
    }

    let allowed_statuses = [
        OrderStatus::AppealSubmitted.as_str(),
        OrderStatus::AppealAccepted.as_str(),
        OrderStatus::AppealResubmitted.as_str(),
        OrderStatus::Reviewing.as_str(),
    ];
    if !allowed_statuses.contains(&order.status.as_str()) {
        let msg = format!("当前状态 {} 不允许办理复核", order.status);
        record_failure(pool, &order, &handler, "复核失败-状态不允许", &msg).await;
        return Err(anyhow!(msg));
    }

    let opinion = req.opinion.clone().unwrap_or_default();
    let new_version = order.version + 1;

    let (to_status, action, to_handler_id, to_handler_name, to_handler_role, extra) =
        match decision {
            "confirm" => {
                if let Err(msg) = validate_evidence(&order, None, 2) {
                    record_failure(pool, &order, &handler, "复核失败-证据不足", &msg).await;
                    return Err(anyhow!(msg));
                }
                (
                    OrderStatus::ReviewConfirmed.as_str().to_string(),
                    "复核确认通过",
                    handler.id.clone(),
                    handler.name.clone(),
                    UserRole::Reviewer.as_str().to_string(),
                    vec![("review_opinion", Some(opinion.clone()))],
                )
            }
            "return" => {
                if opinion.trim().is_empty() {
                    let msg = "退回必须填写处理意见".to_string();
                    record_failure(pool, &order, &handler, "复核失败-意见为空", &msg).await;
                    return Err(anyhow!(msg));
                }
                (
                    OrderStatus::ReviewReturned.as_str().to_string(),
                    "复核退回补正",
                    order.registrar_id.clone(),
                    order.registrar_name.clone(),
                    UserRole::Registrar.as_str().to_string(),
                    vec![("reject_reason", Some(opinion.clone()))],
                )
            }
            "accept" => {
                if order.status != OrderStatus::AppealSubmitted.as_str() {
                    let msg = "只有申诉提交状态可以受理申诉".to_string();
                    record_failure(pool, &order, &handler, "复核失败-状态不允许", &msg).await;
                    return Err(anyhow!(msg));
                }
                (
                    OrderStatus::AppealAccepted.as_str().to_string(),
                    "申诉受理进入复核",
                    handler.id.clone(),
                    handler.name.clone(),
                    UserRole::Reviewer.as_str().to_string(),
                    Vec::<(&str, Option<String>)>::new(),
                )
            }
            "reject_correction" => {
                if order.status != OrderStatus::AppealSubmitted.as_str()
                    && order.status != OrderStatus::AppealAccepted.as_str()
                {
                    let msg = "只有申诉提交/受理状态可以驳回补正".to_string();
                    record_failure(pool, &order, &handler, "复核失败-状态不允许", &msg).await;
                    return Err(anyhow!(msg));
                }
                if opinion.trim().is_empty() {
                    let msg = "驳回补正必须填写处理意见".to_string();
                    record_failure(pool, &order, &handler, "复核失败-意见为空", &msg).await;
                    return Err(anyhow!(msg));
                }
                (
                    OrderStatus::AppealRejectedCorrection.as_str().to_string(),
                    "复核驳回补正",
                    order.registrar_id.clone(),
                    order.registrar_name.clone(),
                    UserRole::Registrar.as_str().to_string(),
                    vec![("reject_reason", Some(opinion.clone()))],
                )
            }
            _ => {
                let msg = format!("未知的复核决定: {}", decision);
                record_failure(pool, &order, &handler, "复核失败-未知决定", &msg).await;
                return Err(anyhow!(msg));
            }
        };

    update_order_status(
        pool,
        &req.order_id,
        &to_status,
        &to_handler_id,
        &to_handler_name,
        &to_handler_role,
        new_version,
        &extra,
    )
    .await?;

    add_process_record(
        pool,
        &req.order_id,
        &handler,
        &action,
        &opinion,
        &order.status,
        &to_status,
    )
    .await?;

    get_order(pool, &req.order_id)
        .await?
        .ok_or_else(|| anyhow!("更新后读取单据失败"))
}

pub async fn handle_archive(
    pool: &DbPool,
    req: &ActionRequest,
) -> Result<SparePartOrder> {
    let order = get_order(pool, &req.order_id)
        .await?
        .ok_or_else(|| anyhow!("单据不存在"))?;
    let handler = get_user(pool, &req.handler_id)
        .await?
        .ok_or_else(|| anyhow!("用户不存在"))?;

    if let Err(msg) = validate_version(&order, req.version) {
        record_failure(pool, &order, &handler, "归档失败-版本冲突", &msg).await;
        return Err(anyhow!(msg));
    }
    if let Err(msg) = validate_handler(&order, &handler) {
        record_failure(pool, &order, &handler, "归档失败-处理人不匹配", &msg).await;
        return Err(anyhow!(msg));
    }

    if handler.role != UserRole::Reviewer.as_str() {
        let msg = "只有复核负责人可以办理归档".to_string();
        record_failure(pool, &order, &handler, "归档失败-角色不匹配", &msg).await;
        return Err(anyhow!(msg));
    }

    let allowed = [
        OrderStatus::ReviewConfirmed.as_str(),
        OrderStatus::VerifyPassed.as_str(),
    ];
    if !allowed.contains(&order.status.as_str()) {
        let msg = format!("当前状态 {} 不允许归档", order.status);
        record_failure(pool, &order, &handler, "归档失败-状态不允许", &msg).await;
        return Err(anyhow!(msg));
    }

    let opinion = req.opinion.clone().unwrap_or_else(|| "复核通过，同意归档。".to_string());
    let new_version = order.version + 1;

    update_order_status(
        pool,
        &req.order_id,
        OrderStatus::Archived.as_str(),
        &handler.id,
        &handler.name,
        &handler.role,
        new_version,
        &[("review_opinion", Some(opinion.clone()))],
    )
    .await?;

    add_process_record(
        pool,
        &req.order_id,
        &handler,
        "复核归档",
        &opinion,
        &order.status,
        OrderStatus::Archived.as_str(),
    )
    .await?;

    get_order(pool, &req.order_id)
        .await?
        .ok_or_else(|| anyhow!("更新后读取单据失败"))
}

pub async fn list_users(pool: &DbPool) -> Result<Vec<User>> {
    let rows: Vec<User> = sqlx::query_as::<_, User>("SELECT * FROM users ORDER BY role, id")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn list_orders(
    pool: &DbPool,
    status: Option<&str>,
    role: Option<&str>,
    user_id: Option<&str>,
) -> Result<OrderListResponse> {
    let mut sql = "SELECT * FROM spare_part_orders WHERE 1=1".to_string();
    let mut args: Vec<String> = Vec::new();

    if let Some(s) = status {
        sql.push_str(" AND status = ?");
        args.push(s.to_string());
    }
    if let Some(r) = role {
        sql.push_str(" AND current_handler_role = ?");
        args.push(r.to_string());
    }
    if let Some(u) = user_id {
        sql.push_str(" AND current_handler_id = ?");
        args.push(u.to_string());
    }
    sql.push_str(" ORDER BY updated_at DESC");

    let mut query = sqlx::query_as::<_, SparePartOrderDb>(&sql);
    for a in &args {
        query = query.bind(a);
    }
    let rows: Vec<SparePartOrderDb> = query.fetch_all(pool).await?;

    let orders: Vec<SparePartOrder> = rows.into_iter().map(SparePartOrder::from).collect();
    let total = orders.len() as i64;

    let stats = compute_stats(pool).await?;

    Ok(OrderListResponse {
        orders,
        total,
        stats,
    })
}

async fn compute_stats(pool: &DbPool) -> Result<OrderStats> {
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM spare_part_orders")
        .fetch_one(pool)
        .await?;

    let registered: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM spare_part_orders WHERE status IN ('registered', 'verifying')",
    )
    .fetch_one(pool)
    .await?;

    let verifying: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM spare_part_orders WHERE status = 'verifying'",
    )
    .fetch_one(pool)
    .await?;

    let reviewing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM spare_part_orders WHERE status IN ('reviewing', 'review_confirmed', 'appeal_accepted', 'appeal_resubmitted')",
    )
    .fetch_one(pool)
    .await?;

    let appeal: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM spare_part_orders WHERE status IN ('appeal_submitted', 'appeal_accepted', 'appeal_rejected_correction', 'appeal_resubmitted')",
    )
    .fetch_one(pool)
    .await?;

    let archived: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM spare_part_orders WHERE status = 'archived'",
    )
    .fetch_one(pool)
    .await?;

    let overdue: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM spare_part_orders WHERE is_overdue = 1 AND status != 'archived'",
    )
    .fetch_one(pool)
    .await?;

    let evidence_missing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM spare_part_orders WHERE is_evidence_missing = 1 AND status != 'archived'",
    )
    .fetch_one(pool)
    .await?;

    Ok(OrderStats {
        total,
        registered,
        verifying,
        reviewing,
        appeal,
        archived,
        overdue,
        evidence_missing,
    })
}

pub async fn get_order_detail(pool: &DbPool, id: &str) -> Result<SparePartOrder> {
    get_order(pool, id)
        .await?
        .ok_or_else(|| anyhow!("单据不存在"))
}

pub async fn get_order_records(pool: &DbPool, order_id: &str) -> Result<Vec<ProcessRecord>> {
    let rows: Vec<ProcessRecord> = sqlx::query_as::<_, ProcessRecord>(
        "SELECT * FROM process_records WHERE order_id = ? ORDER BY created_at ASC"
    )
    .bind(order_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create_order(
    pool: &DbPool,
    req: &CreateOrderRequest,
) -> Result<SparePartOrder> {
    let user = get_user(pool, &req.registrar_id)
        .await?
        .ok_or_else(|| anyhow!("登记员不存在"))?;

    if user.role != UserRole::Registrar.as_str() {
        return Err(anyhow!("只有登记员可以创建单据".to_string(),));
    }

    let id = new_uuid();
    let order_no = format!(
        "BJ-{}-{:04}",
        chrono::Utc::now().format("%Y"),
        (chrono::Utc::now().timestamp() % 10000) as i32
    );
    let evidence_json = serde_json::to_string(&req.evidence.clone().unwrap_or_default())?;
    let is_evidence_missing = req.evidence.as_ref().map(|e| e.len() < 2).unwrap_or(true);

    let now = now_iso();

    sqlx::query(
        r#"
        INSERT INTO spare_part_orders (
            id, order_no, title, part_name, part_model, quantity, reason,
            station_name, status, current_handler_id, current_handler_name,
            current_handler_role, version, evidence, registrar_id, registrar_name,
            is_evidence_missing, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&order_no)
    .bind(&req.title)
    .bind(&req.part_name)
    .bind(&req.part_model)
    .bind(req.quantity)
    .bind(&req.reason)
    .bind(&req.station_name)
    .bind(OrderStatus::Draft.as_str())
    .bind(&user.id)
    .bind(&user.name)
    .bind(&user.role)
    .bind(1i64)
    .bind(&evidence_json)
    .bind(&user.id)
    .bind(&user.name)
    .bind(is_evidence_missing)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;

    add_process_record(
        pool,
        &id,
        &user,
        "创建草稿",
        "",
        "",
        OrderStatus::Draft.as_str(),
    )
    .await?;

    get_order(pool, &id)
        .await?
        .ok_or_else(|| anyhow!("创建单据失败"))
}
