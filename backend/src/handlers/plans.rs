use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};

use crate::errors::{AppError, AppResult};
use crate::middleware::{get_plan_by_id, add_operation_log, check_evidences_complete, get_claims};
use crate::models::*;
use crate::state::AppState;

fn require_role(claims: &Claims, allowed_roles: &[&str]) -> AppResult<()> {
    if !allowed_roles.contains(&claims.role.as_str()) {
        return Err(AppError::WrongRole(format!(
            "当前角色 '{}' 无权限执行此操作，需要角色: {:?}",
            roles::role_name(&claims.role),
            allowed_roles.iter().map(|r| roles::role_name(r)).collect::<Vec<_>>()
        )));
    }
    Ok(())
}

fn check_version(plan: &MediaPlan, expected_version: i64) -> AppResult<()> {
    if plan.version != expected_version {
        return Err(AppError::VersionConflict(format!(
            "版本冲突：当前版本为 v{}，你基于 v{} 操作，请刷新后重试",
            plan.version, expected_version
        )));
    }
    Ok(())
}

pub async fn list_plans(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<PlanListQuery>,
) -> AppResult<Json<Vec<MediaPlan>>> {
    let _claims = get_claims(&headers, &state).await?;

    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(50);
    let offset = (page - 1) * page_size;

    let plans = if let Some(status) = query.status {
        sqlx::query_as::<_, MediaPlan>(
            "SELECT * FROM media_plans WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
        )
        .bind(status)
        .bind(page_size as i64)
        .bind(offset as i64)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, MediaPlan>(
            "SELECT * FROM media_plans ORDER BY created_at DESC LIMIT ? OFFSET ?"
        )
        .bind(page_size as i64)
        .bind(offset as i64)
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(plans))
}

pub async fn todo_list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> AppResult<Json<Vec<MediaPlan>>> {
    let claims = get_claims(&headers, &state).await?;

    let plans = match claims.role.as_str() {
        roles::REGISTRAR => {
            sqlx::query_as::<_, MediaPlan>(
                r#"
                SELECT * FROM media_plans
                WHERE status IN ('draft', 'audit_rejected')
                  AND created_by = ?
                ORDER BY updated_at DESC
                "#
            )
            .bind(&claims.user_id)
            .fetch_all(&state.pool)
            .await?
        }
        roles::AUDITOR => {
            sqlx::query_as::<_, MediaPlan>(
                r#"
                SELECT * FROM media_plans
                WHERE status IN ('pending_audit', 'review_rejected')
                ORDER BY updated_at DESC
                "#
            )
            .fetch_all(&state.pool)
            .await?
        }
        roles::REVIEWER => {
            sqlx::query_as::<_, MediaPlan>(
                r#"
                SELECT * FROM media_plans
                WHERE status = 'pending_review'
                ORDER BY updated_at DESC
                "#
            )
            .fetch_all(&state.pool)
            .await?
        }
        _ => vec![],
    };

    Ok(Json(plans))
}

pub async fn get_plan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> AppResult<Json<PlanDetailResponse>> {
    let _claims = get_claims(&headers, &state).await?;

    let plan = get_plan_by_id(&state.pool, &id).await?;

    let schedules = sqlx::query_as::<_, MediaSchedule>(
        "SELECT * FROM media_schedules WHERE plan_id = ? ORDER BY start_date"
    )
    .bind(&id)
    .fetch_all(&state.pool)
    .await?;

    let budgets = sqlx::query_as::<_, Budget>(
        "SELECT * FROM budgets WHERE plan_id = ? ORDER BY amount DESC"
    )
    .bind(&id)
    .fetch_all(&state.pool)
    .await?;

    let evidences = sqlx::query_as::<_, Evidence>(
        "SELECT * FROM evidences WHERE plan_id = ? ORDER BY uploaded_at DESC"
    )
    .bind(&id)
    .fetch_all(&state.pool)
    .await?;

    let creator: Option<User> = sqlx::query_as::<_, User>(
        "SELECT id, username, password_hash, real_name, role, created_at, updated_at FROM users WHERE id = ?"
    )
    .bind(&plan.created_by)
    .fetch_optional(&state.pool)
    .await?;

    let created_by_name = creator.map(|u| u.real_name).unwrap_or_else(|| "未知".to_string());

    Ok(Json(PlanDetailResponse {
        plan,
        schedules,
        budgets,
        evidences,
        created_by_name,
    }))
}

pub async fn create_plan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreatePlanRequest>,
) -> AppResult<Json<MediaPlan>> {
    let claims = get_claims(&headers, &state).await?;
    require_role(&claims, &[roles::REGISTRAR])?;

    let id = uuid::Uuid::new_v4().to_string();
    let plan_no = format!("MP{}", chrono::Local::now().format("%Y%m%d%H%M%S"));

    sqlx::query(
        r#"
        INSERT INTO media_plans (id, plan_no, title, client_name, status, version, created_by, remark)
        VALUES (?, ?, ?, ?, 'draft', 1, ?, ?)
        "#
    )
    .bind(&id)
    .bind(&plan_no)
    .bind(&req.title)
    .bind(&req.client_name)
    .bind(&claims.user_id)
    .bind(req.remark.as_deref())
    .execute(&state.pool)
    .await?;

    let plan = get_plan_by_id(&state.pool, &id).await?;

    add_operation_log(
        &state.pool,
        &id,
        &claims.user_id,
        "create",
        None,
        Some("draft"),
        Some("创建媒介计划单"),
    ).await?;

    Ok(Json(plan))
}

pub async fn update_plan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdatePlanRequest>,
) -> AppResult<Json<MediaPlan>> {
    let claims = get_claims(&headers, &state).await?;
    require_role(&claims, &[roles::REGISTRAR])?;

    let plan = get_plan_by_id(&state.pool, &id).await?;
    check_version(&plan, req.version)?;

    if plan.status != plan_status::DRAFT && plan.status != plan_status::AUDIT_REJECTED {
        return Err(AppError::InvalidStatus(format!(
            "当前状态 '{}' 不允许编辑，只有草稿或审核驳回状态可以编辑",
            plan_status::status_name(&plan.status)
        )));
    }

    if plan.created_by != claims.user_id {
        return Err(AppError::Forbidden("只能编辑自己创建的计划单".to_string()));
    }

    let new_version = plan.version + 1;

    sqlx::query(
        r#"
        UPDATE media_plans
        SET title = COALESCE(?, title),
            client_name = COALESCE(?, client_name),
            remark = COALESCE(?, remark),
            version = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#
    )
    .bind(req.title.as_deref())
    .bind(req.client_name.as_deref())
    .bind(req.remark.as_deref())
    .bind(new_version)
    .bind(&id)
    .execute(&state.pool)
    .await?;

    let plan = get_plan_by_id(&state.pool, &id).await?;

    add_operation_log(
        &state.pool,
        &id,
        &claims.user_id,
        "update",
        Some(&plan.status),
        Some(&plan.status),
        Some("更新媒介计划单"),
    ).await?;

    Ok(Json(plan))
}

pub async fn submit_plan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> AppResult<Json<MediaPlan>> {
    let claims = get_claims(&headers, &state).await?;
    require_role(&claims, &[roles::REGISTRAR])?;

    let plan = get_plan_by_id(&state.pool, &id).await?;

    if plan.created_by != claims.user_id {
        return Err(AppError::Forbidden("只能提交自己创建的计划单".to_string()));
    }

    if plan.status != plan_status::DRAFT && plan.status != plan_status::AUDIT_REJECTED {
        return Err(AppError::InvalidStatus(format!(
            "当前状态 '{}' 不允许提交，只有草稿或审核驳回状态可以提交",
            plan_status::status_name(&plan.status)
        )));
    }

    let has_evidences = check_evidences_complete(&state.pool, &id).await?;
    if !has_evidences {
        return Err(AppError::MissingEvidence(
            "提交前请至少上传一份证据材料".to_string()
        ));
    }

    let new_version = plan.version + 1;
    let old_status = plan.status.clone();

    sqlx::query(
        r#"
        UPDATE media_plans
        SET status = 'pending_audit',
            version = ?,
            submitted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP,
            reject_reason = NULL
        WHERE id = ?
        "#
    )
    .bind(new_version)
    .bind(&id)
    .execute(&state.pool)
    .await?;

    let plan = get_plan_by_id(&state.pool, &id).await?;

    add_operation_log(
        &state.pool,
        &id,
        &claims.user_id,
        "submit",
        Some(&old_status),
        Some("pending_audit"),
        Some("提交审核"),
    ).await?;

    Ok(Json(plan))
}

pub async fn approve_plan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<ApproveRequest>,
) -> AppResult<Json<MediaPlan>> {
    let claims = get_claims(&headers, &state).await?;
    require_role(&claims, &[roles::AUDITOR])?;

    let plan = get_plan_by_id(&state.pool, &id).await?;
    check_version(&plan, req.version)?;

    if plan.status != plan_status::PENDING_AUDIT && plan.status != plan_status::REVIEW_REJECTED {
        return Err(AppError::InvalidStatus(format!(
            "当前状态 '{}' 不允许审核通过，只有待审核或复核驳回状态可以审核",
            plan_status::status_name(&plan.status)
        )));
    }

    let new_version = plan.version + 1;
    let old_status = plan.status.clone();

    sqlx::query(
        r#"
        UPDATE media_plans
        SET status = 'audit_approved',
            version = ?,
            approved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#
    )
    .bind(new_version)
    .bind(&id)
    .execute(&state.pool)
    .await?;

    let plan = get_plan_by_id(&state.pool, &id).await?;

    add_operation_log(
        &state.pool,
        &id,
        &claims.user_id,
        "approve",
        Some(&old_status),
        Some("audit_approved"),
        req.remark.as_deref(),
    ).await?;

    let new_version2 = plan.version + 1;
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
    .bind(&id)
    .execute(&state.pool)
    .await?;

    let plan = get_plan_by_id(&state.pool, &id).await?;

    add_operation_log(
        &state.pool,
        &id,
        &claims.user_id,
        "send_to_review",
        Some("audit_approved"),
        Some("pending_review"),
        Some("审核通过，自动送入复核"),
    ).await?;

    Ok(Json(plan))
}

pub async fn reject_plan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<RejectRequest>,
) -> AppResult<Json<MediaPlan>> {
    let claims = get_claims(&headers, &state).await?;
    require_role(&claims, &[roles::AUDITOR])?;

    let plan = get_plan_by_id(&state.pool, &id).await?;
    check_version(&plan, req.version)?;

    if plan.status != plan_status::PENDING_AUDIT && plan.status != plan_status::REVIEW_REJECTED {
        return Err(AppError::InvalidStatus(format!(
            "当前状态 '{}' 不允许审核驳回，只有待审核或复核驳回状态可以审核",
            plan_status::status_name(&plan.status)
        )));
    }

    let new_version = plan.version + 1;
    let old_status = plan.status.clone();

    sqlx::query(
        r#"
        UPDATE media_plans
        SET status = 'audit_rejected',
            version = ?,
            updated_at = CURRENT_TIMESTAMP,
            reject_reason = ?
        WHERE id = ?
        "#
    )
    .bind(new_version)
    .bind(&req.reason)
    .bind(&id)
    .execute(&state.pool)
    .await?;

    let plan = get_plan_by_id(&state.pool, &id).await?;

    add_operation_log(
        &state.pool,
        &id,
        &claims.user_id,
        "reject",
        Some(&old_status),
        Some("audit_rejected"),
        Some(&req.reason),
    ).await?;

    Ok(Json(plan))
}

pub async fn review_plan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<ReviewRequest>,
) -> AppResult<Json<MediaPlan>> {
    let claims = get_claims(&headers, &state).await?;
    require_role(&claims, &[roles::REVIEWER])?;

    let plan = get_plan_by_id(&state.pool, &id).await?;
    check_version(&plan, req.version)?;

    if plan.status != plan_status::PENDING_REVIEW {
        return Err(AppError::InvalidStatus(format!(
            "当前状态 '{}' 不允许复核，只有待复核状态可以复核",
            plan_status::status_name(&plan.status)
        )));
    }

    let new_version = plan.version + 1;
    let old_status = plan.status.clone();

    sqlx::query(
        r#"
        UPDATE media_plans
        SET status = 'review_approved',
            version = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#
    )
    .bind(new_version)
    .bind(&id)
    .execute(&state.pool)
    .await?;

    let plan = get_plan_by_id(&state.pool, &id).await?;

    add_operation_log(
        &state.pool,
        &id,
        &claims.user_id,
        "review",
        Some(&old_status),
        Some("review_approved"),
        req.remark.as_deref(),
    ).await?;

    Ok(Json(plan))
}

pub async fn archive_plan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> AppResult<Json<MediaPlan>> {
    let claims = get_claims(&headers, &state).await?;
    require_role(&claims, &[roles::REVIEWER])?;

    let plan = get_plan_by_id(&state.pool, &id).await?;

    if plan.status != plan_status::REVIEW_APPROVED {
        return Err(AppError::InvalidStatus(format!(
            "当前状态 '{}' 不允许归档，只有复核通过状态可以归档",
            plan_status::status_name(&plan.status)
        )));
    }

    let new_version = plan.version + 1;
    let old_status = plan.status.clone();

    sqlx::query(
        r#"
        UPDATE media_plans
        SET status = 'archived',
            version = ?,
            archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#
    )
    .bind(new_version)
    .bind(&id)
    .execute(&state.pool)
    .await?;

    let plan = get_plan_by_id(&state.pool, &id).await?;

    add_operation_log(
        &state.pool,
        &id,
        &claims.user_id,
        "archive",
        Some(&old_status),
        Some("archived"),
        Some("归档"),
    ).await?;

    Ok(Json(plan))
}
