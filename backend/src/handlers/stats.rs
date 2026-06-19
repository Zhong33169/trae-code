use crate::auth::{node_label, status_label, AuthUser};
use crate::db::DbPool;
use crate::models::{ApiResponse, NodeStat, Statistics, StatusStat, TrendItem};
use rocket::serde::json::Json;
use rocket::State;

fn query_i64(conn: &rusqlite::Connection, sql: &str, params: &[&dyn rusqlite::ToSql]) -> i64 {
    conn.query_row(sql, params, |row| row.get(0)).unwrap_or(0)
}

#[get("/overview")]
pub fn overview(pool: &State<DbPool>, _user: AuthUser) -> Json<ApiResponse<Statistics>> {
    let conn = pool.lock();

    let total_records = query_i64(&conn, "SELECT COUNT(*) FROM seed_records", &[]);
    let pending_count = query_i64(&conn, "SELECT COUNT(*) FROM seed_records WHERE overall_status = 'pending'", &[]);
    let processing_count = query_i64(&conn, "SELECT COUNT(*) FROM seed_records WHERE overall_status IN ('processing','approved')", &[]);
    let completed_count = query_i64(&conn, "SELECT COUNT(*) FROM seed_records WHERE overall_status = 'completed'", &[]);
    let rejected_count = query_i64(&conn, "SELECT COUNT(*) FROM seed_records WHERE overall_status = 'correction'", &[]);
    let timeout_count = query_i64(&conn, "SELECT COUNT(DISTINCT record_id) FROM node_tracking WHERE is_timeout = 1 AND status != 'completed'", &[]);

    let status_rows = [
        ("pending", pending_count),
        ("processing", processing_count),
        ("completed", completed_count),
        ("rejected", rejected_count),
    ];
    let by_status: Vec<StatusStat> = status_rows
        .iter()
        .map(|(s, c)| StatusStat {
            status: s.to_string(),
            status_label: status_label(s).to_string(),
            count: *c,
        })
        .collect();

    let nodes = ["registration", "audit", "pond_entry", "survival_observe", "archive_review", "done"];
    let mut by_node: Vec<NodeStat> = vec![];
    for n in &nodes {
        let c = query_i64(
            &conn,
            "SELECT COUNT(*) FROM seed_records WHERE current_node = ?1",
            &[&n as &dyn rusqlite::ToSql],
        );
        let tc = query_i64(
            &conn,
            "SELECT COUNT(*) FROM node_tracking WHERE node_type = ?1 AND is_timeout = 1 AND status != 'completed'",
            &[&n as &dyn rusqlite::ToSql],
        );
        by_node.push(NodeStat {
            node: n.to_string(),
            node_label: node_label(n).to_string(),
            count: c,
            timeout_count: tc,
        });
    }

    let mut recent_trend: Vec<TrendItem> = vec![];
    for offset in 0i64..7 {
        use chrono::{Duration, Utc};
        let day = (Utc::now() - Duration::days(offset)).format("%Y-%m-%d").to_string();
        let like_start = format!("{}%", day);
        let new_count = query_i64(
            &conn,
            "SELECT COUNT(*) FROM seed_records WHERE created_at LIKE ?1",
            &[&like_start as &dyn rusqlite::ToSql],
        );
        let completed_count = query_i64(
            &conn,
            "SELECT COUNT(*) FROM seed_records WHERE archive_time LIKE ?1",
            &[&like_start as &dyn rusqlite::ToSql],
        );
        recent_trend.push(TrendItem { date: day, new_count, completed_count });
    }
    recent_trend.reverse();

    Json(ApiResponse::ok(
        Statistics {
            total_records,
            pending_count,
            processing_count,
            completed_count,
            rejected_count,
            timeout_count,
            by_status,
            by_node,
            recent_trend,
        },
        "获取统计数据成功",
    ))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![overview]
}
