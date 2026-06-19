use crate::auth::AuthUser;
use crate::db::DbPool;
use crate::models::{ApiResponse, OperationLog};
use rocket::serde::json::Json;
use rocket::State;

#[get("/?<record_id>&<user_id>&<action>&<page>&<page_size>")]
pub fn list_logs(
    pool: &State<DbPool>,
    _user: AuthUser,
    record_id: Option<String>,
    user_id: Option<String>,
    action: Option<String>,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Json<ApiResponse<serde_json::Value>> {
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(50).clamp(1, 200);
    let offset = (page - 1) * page_size;

    let mut sql = "SELECT id, record_id, user_id, user_name, user_role, action, action_target, detail, old_status, new_status, evidence_note, created_at FROM operation_logs WHERE 1=1".to_string();
    let mut params: Vec<String> = vec![];
    if let Some(rid) = &record_id {
        sql.push_str(" AND record_id = ?");
        params.push(rid.clone());
    }
    if let Some(uid) = &user_id {
        sql.push_str(" AND user_id = ?");
        params.push(uid.clone());
    }
    if let Some(ac) = &action {
        sql.push_str(" AND action LIKE ?");
        params.push(format!("%{}%", ac));
    }
    sql.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

    let conn = pool.lock();
    let mut stmt = conn.prepare(&sql).unwrap();
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|x| x as &dyn rusqlite::ToSql).collect();
    let mut all_params: Vec<&dyn rusqlite::ToSql> = vec![];
    all_params.extend(param_refs);
    all_params.push(&page_size as &dyn rusqlite::ToSql);
    all_params.push(&offset as &dyn rusqlite::ToSql);

    let rows = stmt.query_map(all_params.as_slice(), |row| {
        Ok(OperationLog {
            id: row.get(0)?,
            record_id: row.get(1).ok(),
            user_id: row.get(2)?,
            user_name: row.get(3)?,
            user_role: row.get(4)?,
            action: row.get(5)?,
            action_target: row.get(6)?,
            detail: row.get(7).ok(),
            old_status: row.get(8).ok(),
            new_status: row.get(9).ok(),
            evidence_note: row.get(10).ok(),
            created_at: row.get(11)?,
        })
    }).unwrap();
    let items: Vec<OperationLog> = rows.filter_map(|r| r.ok()).collect();

    let cnt_sql = "SELECT COUNT(*) FROM operation_logs WHERE 1=1";
    let cnt_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|x| x as &dyn rusqlite::ToSql).collect();
    let total: i64 = conn.query_row(&cnt_sql, cnt_refs.as_slice(), |row| row.get(0)).unwrap_or(0);

    Json(ApiResponse::ok(
        serde_json::json!({
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }),
        "获取操作日志成功",
    ))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![list_logs]
}
