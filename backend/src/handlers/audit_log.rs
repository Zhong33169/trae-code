use axum::{
    extract::{State, Query, Extension},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::{AppState, middleware::auth::AuthUser};
use crate::services::audit;

#[derive(Debug, Deserialize)]
pub struct LogQuery {
    pub creative_demand_id: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<LogQuery>,
    Extension(_auth_user): Extension<Arc<AuthUser>>,
) -> Response {
    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(50);
    let offset = (page - 1) * page_size;

    let logs = audit::list_audit_logs(
        &state.pool,
        query.creative_demand_id.as_deref(),
        page_size,
        offset,
    ).await;

    match logs {
        Ok(l) => {
            Json(serde_json::json!({
                "items": l,
                "page": page,
                "page_size": page_size,
            })).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": format!("查询失败: {}", e),
                "code": "QUERY_FAILED"
            }))
        ).into_response(),
    }
}
