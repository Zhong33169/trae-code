use axum::{
    extract::State,
    http::HeaderMap,
    Json,
};

use crate::errors::{AppError, AppResult};
use crate::middleware::{get_plan_by_id, add_operation_log, check_evidences_complete, get_claims};
use crate::models::*;
use crate::state::AppState;

fn check_version(plan: &MediaPlan, expected_version: i64) -> AppResult<()> {
    if plan.version != expected_version {
        return Err(AppError::VersionConflict(format!(
            "版本冲突：当前版本为 v{}，你基于 v{} 操作，请刷新后重试",
            plan.version, expected_version
        )));
    }
    Ok(())
}

async fn write_audit_log(
    pool: &sqlx::SqlitePool,
    plan_id: &str,
    user_id: &str,
    operation: &str,
    old_status: Option<&str>,
    new_status: Option<&str>,
    remark: Option<&str>,
) -> (Option<String>, String) {
    use uuid::Uuid;
    let log_id = Uuid::new_v4().to_string();
    let result = sqlx::query(
        r#"
        INSERT INTO operation_logs (id, plan_id, operator_id, operation, old_status, new_status, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&log_id)
    .bind(plan_id)
    .bind(user_id)
    .bind(operation)
    .bind(old_status)
    .bind(new_status)
    .bind(remark)
    .execute(pool)
    .await;

    match result {
        Ok(_) => (Some(log_id), "success".to_string()),
        Err(_) => (None, "failed".to_string()),
    }
}

pub async fn batch_review(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<BatchReviewRequest>,
) -> AppResult<Json<BatchReviewResponse>> {
    let claims = get_claims(&headers, &state).await?;

    let mut results = Vec::new();
    let mut success_count = 0;
    let mut failed_count = 0;
    let mut retry_count = 0;

    let allowed_roles: &[&str] = match req.action.as_str() {
        "approve" => &[roles::AUDITOR],
        "reject" => &[roles::AUDITOR],
        "review" => &[roles::REVIEWER],
        "submit" => &[roles::REGISTRAR],
        _ => {
            return Err(AppError::Validation(format!(
                "未知的批量操作: {}",
                req.action
            )))
        }
    };

    if !allowed_roles.contains(&claims.role.as_str()) {
        return Err(AppError::WrongRole(format!(
            "当前角色 '{}' 无权限执行批量 '{}' 操作",
            roles::role_name(&claims.role),
            req.action
        )));
    }

    for item in &req.items {
        let result = process_single_plan(
            &state.pool,
            &claims,
            &item.plan_id,
            item.version,
            &req.action,
            req.remark.as_deref(),
        ).await;

        match result {
            Ok(batch_item) => {
                if batch_item.success {
                    success_count += 1;
                } else if batch_item.need_retry {
                    retry_count += 1;
                } else {
                    failed_count += 1;
                }
                results.push(batch_item);
            }
            Err(e) => {
                failed_count += 1;
                let (audit_log_id, audit_status) = write_audit_log(
                    &state.pool,
                    &item.plan_id,
                    &claims.user_id,
                    &format!("batch_{}_failed", req.action),
                    None,
                    None,
                    Some(&format!("处理异常：{}", e)),
                ).await;

                results.push(BatchResultItem {
                    plan_id: item.plan_id.clone(),
                    plan_no: "未知".to_string(),
                    success: false,
                    status: "error".to_string(),
                    message: e.to_string(),
                    need_retry: false,
                    audit_log_id,
                    audit_status,
                });
            }
        }
    }

    Ok(Json(BatchReviewResponse {
        total: results.len(),
        success: success_count,
        failed: failed_count,
        need_retry: retry_count,
        results,
    }))
}

async fn process_single_plan(
    pool: &sqlx::SqlitePool,
    claims: &Claims,
    plan_id: &str,
    client_version: i64,
    action: &str,
    remark: Option<&str>,
) -> AppResult<BatchResultItem> {
    let plan_result = get_plan_by_id(pool, plan_id).await;

    let plan = match plan_result {
        Ok(p) => p,
        Err(e) => {
            let (audit_log_id, audit_status) = write_audit_log(
                pool,
                plan_id,
                &claims.user_id,
                &format!("batch_{}_failed", action),
                None,
                None,
                Some(&format!("获取计划单失败：{}", e)),
            ).await;

            return Ok(BatchResultItem {
                plan_id: plan_id.to_string(),
                plan_no: "未知".to_string(),
                success: false,
                status: "error".to_string(),
                message: e.to_string(),
                need_retry: false,
                audit_log_id,
                audit_status,
            });
        }
    };

    let op_prefix = match action {
        "approve" => "batch_approve",
        "reject" => "batch_reject",
        "review" => "batch_review",
        "submit" => "batch_submit",
        _ => action,
    };

    let result = match action {
        "approve" => do_approve(pool, claims, &plan, client_version, remark).await,
        "reject" => do_reject(pool, claims, &plan, client_version, remark.unwrap_or("批量驳回")).await,
        "review" => do_review(pool, claims, &plan, client_version, remark).await,
        "submit" => do_submit(pool, claims, &plan, client_version).await,
        _ => return Err(AppError::Validation(format!("未知操作: {}", action))),
    };

    match result {
        Ok(p) => {
            let msg = match action {
                "approve" => "审核通过",
                "reject" => "审核驳回",
                "review" => "复核通过",
                "submit" => "提交成功",
                _ => "操作成功",
            };

            let (audit_log_id, audit_status) = write_audit_log(
                pool,
                plan_id,
                &claims.user_id,
                &op_prefix,
                Some(&plan.status),
                Some(&p.status),
                Some(msg),
            ).await;

            Ok(BatchResultItem {
                plan_id: plan_id.to_string(),
                plan_no: p.plan_no.clone(),
                success: true,
                status: p.status,
                message: msg.to_string(),
                need_retry: false,
                audit_log_id,
                audit_status,
            })
        }
        Err(e) => {
            let need_retry = matches!(e, AppError::VersionConflict(_)) || matches!(e, AppError::MissingEvidence(_));

            let op_type = if need_retry {
                format!("{}_retry", op_prefix)
            } else {
                format!("{}_failed", op_prefix)
            };

            let (audit_log_id, audit_status) = write_audit_log(
                pool,
                plan_id,
                &claims.user_id,
                &op_type,
                Some(&plan.status),
                Some(&plan.status),
                Some(&e.to_string()),
            ).await;

            Ok(BatchResultItem {
                plan_id: plan_id.to_string(),
                plan_no: plan.plan_no.clone(),
                success: false,
                status: plan.status,
                message: e.to_string(),
                need_retry,
                audit_log_id,
                audit_status,
            })
        }
    }
}

async fn do_approve(
    pool: &sqlx::SqlitePool,
    claims: &Claims,
    plan: &MediaPlan,
    client_version: i64,
    remark: Option<&str>,
) -> AppResult<MediaPlan> {
    check_version(plan, client_version)?;

    if plan.status != plan_status::PENDING_AUDIT && plan.status != plan_status::REVIEW_REJECTED {
        return Err(AppError::InvalidStatus(format!(
            "当前状态 '{}' 不允许审核通过",
            plan_status::status_name(&plan.status)
        )));
    }

    let new_version = plan.version + 1;
    let old_status = plan.status.clone();

    let result = sqlx::query(
        r#"
        UPDATE media_plans
        SET status = 'audit_approved',
            version = ?,
            approved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
        "#
    )
    .bind(new_version)
    .bind(&plan.id)
    .bind(client_version)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        let latest = get_plan_by_id(pool, &plan.id).await?;
        return Err(AppError::VersionConflict(format!(
            "版本冲突：当前版本为 v{}，请刷新后重试",
            latest.version
        )));
    }

    add_operation_log(
        pool,
        &plan.id,
        &claims.user_id,
        "approve",
        Some(&old_status),
        Some("audit_approved"),
        remark,
    ).await?;

    let new_version2 = new_version + 1;
    sqlx::query(
        r#"
        UPDATE media_plans
        SET status = 'pending_review',
            version = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#
    )
    .bind(new_version2)
    .bind(&plan.id)
    .execute(pool)
    .await?;

    add_operation_log(
        pool,
        &plan.id,
        &claims.user_id,
        "send_to_review",
        Some("audit_approved"),
        Some("pending_review"),
        Some("审核通过，自动送入复核"),
    ).await?;

    let plan = get_plan_by_id(pool, &plan.id).await?;
    Ok(plan)
}

async fn do_reject(
    pool: &sqlx::SqlitePool,
    claims: &Claims,
    plan: &MediaPlan,
    client_version: i64,
    reason: &str,
) -> AppResult<MediaPlan> {
    check_version(plan, client_version)?;

    if plan.status != plan_status::PENDING_AUDIT && plan.status != plan_status::REVIEW_REJECTED {
        return Err(AppError::InvalidStatus(format!(
            "当前状态 '{}' 不允许审核驳回",
            plan_status::status_name(&plan.status)
        )));
    }

    let new_version = plan.version + 1;
    let old_status = plan.status.clone();

    let result = sqlx::query(
        r#"
        UPDATE media_plans
        SET status = 'audit_rejected',
            version = ?,
            updated_at = CURRENT_TIMESTAMP,
            reject_reason = ?
        WHERE id = ? AND version = ?
        "#
    )
    .bind(new_version)
    .bind(reason)
    .bind(&plan.id)
    .bind(client_version)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        let latest = get_plan_by_id(pool, &plan.id).await?;
        return Err(AppError::VersionConflict(format!(
            "版本冲突：当前版本为 v{}，请刷新后重试",
            latest.version
        )));
    }

    add_operation_log(
        pool,
        &plan.id,
        &claims.user_id,
        "reject",
        Some(&old_status),
        Some("audit_rejected"),
        Some(reason),
    ).await?;

    let plan = get_plan_by_id(pool, &plan.id).await?;
    Ok(plan)
}

async fn do_review(
    pool: &sqlx::SqlitePool,
    claims: &Claims,
    plan: &MediaPlan,
    client_version: i64,
    remark: Option<&str>,
) -> AppResult<MediaPlan> {
    check_version(plan, client_version)?;

    if plan.status != plan_status::PENDING_REVIEW {
        return Err(AppError::InvalidStatus(format!(
            "当前状态 '{}' 不允许复核",
            plan_status::status_name(&plan.status)
        )));
    }

    let new_version = plan.version + 1;
    let old_status = plan.status.clone();

    let result = sqlx::query(
        r#"
        UPDATE media_plans
        SET status = 'review_approved',
            version = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
        "#
    )
    .bind(new_version)
    .bind(&plan.id)
    .bind(client_version)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        let latest = get_plan_by_id(pool, &plan.id).await?;
        return Err(AppError::VersionConflict(format!(
            "版本冲突：当前版本为 v{}，请刷新后重试",
            latest.version
        )));
    }

    add_operation_log(
        pool,
        &plan.id,
        &claims.user_id,
        "review",
        Some(&old_status),
        Some("review_approved"),
        remark,
    ).await?;

    let plan = get_plan_by_id(pool, &plan.id).await?;
    Ok(plan)
}

async fn do_submit(
    pool: &sqlx::SqlitePool,
    claims: &Claims,
    plan: &MediaPlan,
    client_version: i64,
) -> AppResult<MediaPlan> {
    check_version(plan, client_version)?;

    if plan.created_by != claims.user_id {
        return Err(AppError::Forbidden("只能提交自己创建的计划单".to_string()));
    }

    if plan.status != plan_status::DRAFT && plan.status != plan_status::AUDIT_REJECTED {
        return Err(AppError::InvalidStatus(format!(
            "当前状态 '{}' 不允许提交",
            plan_status::status_name(&plan.status)
        )));
    }

    let has_evidences = check_evidences_complete(pool, &plan.id).await?;
    if !has_evidences {
        return Err(AppError::MissingEvidence(
            "提交前请至少上传一份证据材料".to_string()
        ));
    }

    let new_version = plan.version + 1;
    let old_status = plan.status.clone();

    let result = sqlx::query(
        r#"
        UPDATE media_plans
        SET status = 'pending_audit',
            version = ?,
            submitted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP,
            reject_reason = NULL
        WHERE id = ? AND version = ?
        "#
    )
    .bind(new_version)
    .bind(&plan.id)
    .bind(client_version)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        let latest = get_plan_by_id(pool, &plan.id).await?;
        return Err(AppError::VersionConflict(format!(
            "版本冲突：当前版本为 v{}，请刷新后重试",
            latest.version
        )));
    }

    add_operation_log(
        pool,
        &plan.id,
        &claims.user_id,
        "submit",
        Some(&old_status),
        Some("pending_audit"),
        Some("提交审核"),
    ).await?;

    let plan = get_plan_by_id(pool, &plan.id).await?;
    Ok(plan)
}
