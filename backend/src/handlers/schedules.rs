use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};

use crate::errors::AppResult;
use crate::middleware::get_claims;
use crate::models::MediaSchedule;
use crate::state::AppState;

pub async fn list_schedules(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(plan_id): Path<String>,
) -> AppResult<Json<Vec<MediaSchedule>>> {
    let _claims = get_claims(&headers, &state).await?;

    let schedules = sqlx::query_as::<_, MediaSchedule>(
        "SELECT * FROM media_schedules WHERE plan_id = ? ORDER BY start_date"
    )
    .bind(&plan_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(schedules))
}
