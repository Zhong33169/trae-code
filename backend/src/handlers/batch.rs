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
                results.push(BatchResultItem {
                    plan_id: item.plan_id.clone(),
                    plan_no: "未知".to_string(),
                    success: false,
                    status: "error".to_string(),
                    message: e.to_string(),
                    need_retry: false,
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
    let plan = get_plan_by_id(pool, plan_id).await?;

    match action {
        "approve" => {
            let result = do_approve(pool, claims, &plan, client_version, remark).await;
            match result {
                Ok(p) => Ok(BatchResultItem {
                    plan_id: plan_id.to_string(),
                    plan_no: p.plan_no.clone(),
                    success: true,
                    status: p.status,
                    message: "审核通过".to_string(),
                    need_retry: false,
                }),
                Err(e) => {
                    let need_retry = matches!(e, AppError::VersionConflict(_));
                    Ok(BatchResultItem {
                        plan_id: plan_id.to_string(),
                        plan_no: plan.plan_no.clone(),
                        success: false,
                        status: plan.status,
                        message: e.to_string(),
                        need_retry,
                    })
                }
            }
        }
        "reject" => {
            let result = do_reject(pool, claims, &plan, client_version, remark.unwrap_or("批量驳回")).await;
            match result {
                Ok(p) => Ok(BatchResultItem {
                    plan_id: plan_id.to_string(),
                    plan_no: p.plan_no.clone(),
                    success: true,
                    status: p.status,
                    message: "审核驳回".to_string(),
                    need_retry: false,
                }),
                Err(e) => {
                    let need_retry = matches!(e, AppError::VersionConflict(_));
                    Ok(BatchResultItem {
                        plan_id: plan_id.to_string(),
                        plan_no: plan.plan_no.clone(),
                        success: false,
                        status: plan.status,
                        message: e.to_string(),
                        need_retry,
                    })
                }
            }
        }
        "review" => {
            let result = do_review(pool, claims, &plan, client_version, remark).await;
            match result {
                Ok(p) => Ok(BatchResultItem {
                    plan_id: plan_id.to_string(),
                    plan_no: p.plan_no.clone(),
                    success: true,
                    status: p.status,
                    message: "复核通过".to_string(),
                    need_retry: false,
                }),
                Err(e) => {
                    let need_retry = matches!(e, AppError::VersionConflict(_));
                    Ok(BatchResultItem {
                        plan_id: plan_id.to_string(),
                        plan_no: plan.plan_no.clone(),
                        success: false,
                        status: plan.status,
                        message: e.to_string(),
                        need_retry,
                    })
                }
            }
        }
        "submit" => {
            let result = do_submit(pool, claims, &plan, client_version).await;
            match result {
                Ok(p) => Ok(BatchResultItem {
                    plan_id: plan_id.to_string(),
                    plan_no: p.plan_no.clone(),
                    success: true,
                    status: p.status,
                    message: "提交成功".to_string(),
                    need_retry: false,
                }),
                Err(e) => {
                    let need_retry = matches!(e, AppError::VersionConflict(_)) || matches!(e, AppError::MissingEvidence(_));
                    Ok(BatchResultItem {
                        plan_id: plan_id.to_string(),
                        plan_no: plan.plan_no.clone(),
                        success: false,
                        status: plan.status,
                        message: e.to_string(),
                        need_retry,
                    })
                }
            }
        }
        _ => Err(AppError::Validation(format!("未知操作: {}", action))),
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
