use axum::{
    extract::{Query, State},
    http::HeaderMap,
    Json,
};

use crate::errors::AppResult;
use crate::middleware::get_claims;
use crate::models::*;
use crate::state::AppState;

pub async fn list_operation_logs(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<OperationLogQuery>,
) -> AppResult<Json<OperationLogListResponse>> {
    let _claims = get_claims(&headers, &state).await?;

    let mut conditions: Vec<String> = Vec::new();
    let mut like_conditions: Vec<String> = Vec::new();

    if let Some(ref plan_id) = query.plan_id {
        conditions.push(format!("l.plan_id = '{}'", plan_id.replace('\'', "''")));
    }

    if let Some(ref operation) = query.operation {
        if operation.ends_with('*') {
            let pattern = operation.replace('*', "%").replace('\'', "''");
            conditions.push(format!("l.operation LIKE '{}'", pattern));
        } else {
            conditions.push(format!("l.operation = '{}'", operation.replace('\'', "''")));
        }
    }

    if let Some(ref operator_id) = query.operator_id {
        conditions.push(format!("l.operator_id = '{}'", operator_id.replace('\'', "''")));
    }

    if let Some(ref audit_status) = query.audit_status {
        match audit_status.as_str() {
            "success" => {
                like_conditions.push("l.operation NOT LIKE '%_failed'".into());
                like_conditions.push("l.operation NOT LIKE '%_retry'".into());
            }
            "failed" => {
                like_conditions.push("l.operation LIKE '%_failed'".into());
            }
            "retry" => {
                like_conditions.push("l.operation LIKE '%_retry'".into());
            }
            "abnormal" => {
                like_conditions.push("(l.operation LIKE '%_failed' OR l.operation LIKE '%_retry')".into());
            }
            _ => {}
        }
    }

    let all_conditions: Vec<String> = conditions.into_iter().chain(like_conditions.into_iter()).collect();
    let where_clause = if all_conditions.is_empty() {
        String::from("WHERE 1=1")
    } else {
        format!("WHERE {}", all_conditions.join(" AND "))
    };

    let limit = query.limit.unwrap_or(100).min(500);
    let offset = query.offset.unwrap_or(0);

    let sql = format!(
        "SELECT l.id, l.plan_id, l.operator_id, l.operation, l.old_status, l.new_status, l.remark, l.created_at \
         FROM operation_logs l {} ORDER BY l.created_at DESC LIMIT {} OFFSET {}",
        where_clause, limit, offset
    );
    let count_sql = format!(
        "SELECT COUNT(*) FROM operation_logs l {}",
        where_clause
    );

    let logs = sqlx::query_as::<_, OperationLog>(&sql)
        .fetch_all(&state.pool)
        .await?;

    let total = sqlx::query_scalar::<_, i64>(&count_sql)
        .fetch_one(&state.pool)
        .await?;

    let mut items = Vec::new();
    for log in logs {
        let operator: Option<User> = sqlx::query_as::<_, User>(
            "SELECT id, username, password_hash, real_name, role, created_at, updated_at FROM users WHERE id = ?"
        )
        .bind(&log.operator_id)
        .fetch_optional(&state.pool)
        .await?;
        let operator_name = operator.map(|u| u.real_name).unwrap_or_else(|| "未知".to_string());
        items.push(OperationLogWithOperator {
            id: log.id,
            plan_id: log.plan_id,
            operator_id: log.operator_id,
            operator_name,
            operation: log.operation,
            old_status: log.old_status,
            new_status: log.new_status,
            remark: log.remark,
            created_at: log.created_at,
        });
    }

    Ok(Json(OperationLogListResponse {
        total,
        items,
    }))
}
