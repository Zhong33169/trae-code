use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use crate::errors::{AppError, AppResult};
use crate::models::Claims;
use crate::state::AppState;
use axum::http::HeaderMap;

pub async fn get_claims(headers: &HeaderMap, state: &AppState) -> AppResult<Claims> {
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("缺少 Authorization 头".to_string()))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("Authorization 格式错误，应为 Bearer token".to_string()))?;

    let decoding_key = DecodingKey::from_secret(state.jwt_secret.as_ref());
    let token_data = decode::<Claims>(
        token,
        &decoding_key,
        &Validation::new(Algorithm::HS256),
    )?;

    Ok(token_data.claims)
}

pub async fn get_plan_by_id(pool: &sqlx::SqlitePool, id: &str) -> AppResult<crate::models::MediaPlan> {
    let plan = sqlx::query_as::<_, crate::models::MediaPlan>(
        "SELECT * FROM media_plans WHERE id = ?"
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(plan)
}

pub async fn check_evidences_complete(pool: &sqlx::SqlitePool, plan_id: &str) -> AppResult<bool> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM evidences WHERE plan_id = ?"
    )
    .bind(plan_id)
    .fetch_one(pool)
    .await?;

    Ok(count > 0)
}

pub async fn add_operation_log(
    pool: &sqlx::SqlitePool,
    plan_id: &str,
    operator_id: &str,
    operation: &str,
    old_status: Option<&str>,
    new_status: Option<&str>,
    remark: Option<&str>,
) -> AppResult<()> {
    use uuid::Uuid;
    sqlx::query(
        r#"
        INSERT INTO operation_logs (id, plan_id, operator_id, operation, old_status, new_status, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(Uuid::new_v4().to_string())
    .bind(plan_id)
    .bind(operator_id)
    .bind(operation)
    .bind(old_status)
    .bind(new_status)
    .bind(remark)
    .execute(pool)
    .await?;
    Ok(())
}
