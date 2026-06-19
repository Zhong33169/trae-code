use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};

use crate::errors::AppResult;
use crate::middleware::get_claims;
use crate::models::Evidence;
use crate::state::AppState;

pub async fn list_evidences(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(plan_id): Path<String>,
) -> AppResult<Json<Vec<Evidence>>> {
    let _claims = get_claims(&headers, &state).await?;

    let evidences = sqlx::query_as::<_, Evidence>(
        "SELECT * FROM evidences WHERE plan_id = ? ORDER BY uploaded_at DESC"
    )
    .bind(&plan_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(evidences))
}
