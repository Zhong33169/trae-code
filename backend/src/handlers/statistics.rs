use rocket::serde::json::Json;
use rocket::State;

use crate::auth::AuthUser;
use crate::db::DbPool;
use crate::error::AppResult;
use crate::models::*;

#[get("/summary")]
pub async fn summary(pool: &State<DbPool>, _auth: AuthUser) -> AppResult<StatisticsResponse> {
    let conn = pool.get()?;

    let total: i64 = conn.query_row("SELECT COUNT(*) FROM nursing_plans", [], |row| row.get(0))?;

    let draft: i64 = conn.query_row(
        "SELECT COUNT(*) FROM nursing_plans WHERE status = 'draft'",
        [],
        |row| row.get(0),
    )?;

    let pending_audit: i64 = conn.query_row(
        "SELECT COUNT(*) FROM nursing_plans WHERE status = 'pending_audit'",
        [],
        |row| row.get(0),
    )?;

    let audited: i64 = 0;

    let pending_review: i64 = conn.query_row(
        "SELECT COUNT(*) FROM nursing_plans WHERE status = 'pending_review'",
        [],
        |row| row.get(0),
    )?;

    let archived: i64 = conn.query_row(
        "SELECT COUNT(*) FROM nursing_plans WHERE status = 'archived'",
        [],
        |row| row.get(0),
    )?;

    let returned: i64 = conn.query_row(
        "SELECT COUNT(*) FROM nursing_plans WHERE status = 'returned'",
        [],
        |row| row.get(0),
    )?;

    let mut shift_stmt = conn.prepare(
        "SELECT shift, COUNT(*) FROM handover_records GROUP BY shift ORDER BY shift",
    )?;
    let shift_iter = shift_stmt.query_map([], |row| {
        Ok(ShiftStat {
            shift: row.get(0)?,
            count: row.get(1)?,
        })
    })?;
    let mut by_shift = Vec::new();
    for s in shift_iter {
        by_shift.push(s?);
    }

    let mut level_stmt = conn.prepare(
        "SELECT COALESCE(plan_level, '未设定'), COUNT(*) FROM nursing_plans GROUP BY plan_level ORDER BY plan_level",
    )?;
    let level_iter = level_stmt.query_map([], |row| {
        Ok(LevelStat {
            level: row.get(0)?,
            count: row.get(1)?,
        })
    })?;
    let mut by_level = Vec::new();
    for l in level_iter {
        by_level.push(l?);
    }

    Ok(Json(ApiResponse {
        success: true,
        message: "OK".into(),
        data: Some(StatisticsResponse {
            total_plans: total,
            draft,
            pending_audit,
            audited,
            pending_review,
            archived,
            returned,
            by_shift,
            by_level,
        }),
    }))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![summary]
}
