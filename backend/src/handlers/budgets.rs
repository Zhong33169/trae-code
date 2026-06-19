use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};

use crate::errors::AppResult;
use crate::middleware::get_claims;
use crate::models::Budget;
use crate::state::AppState;

pub async fn list_budgets(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(plan_id): Path<String>,
) -> AppResult<Json<Vec<Budget>>> {
    let _claims = get_claims(&headers, &state).await?;

    let budgets = sqlx::query_as::<_, Budget>(
        "SELECT * FROM budgets WHERE plan_id = ? ORDER BY amount DESC"
    )
    .bind(&plan_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(budgets))
}
