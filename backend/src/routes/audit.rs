use rocket::{State, serde::json::Json, Route, get, routes};
use crate::DbConn;
use crate::models::audit::AuditLog;
use crate::models::common::ApiResponse;

pub fn routes() -> Vec<Route> {
    routes![list_audit_logs, get_fail_reasons]
}

#[get("/?<material_id>&<operator_id>&<result>&<keyword>")]
pub fn list_audit_logs(
    conn: &State<DbConn>,
    material_id: Option<String>,
    operator_id: Option<String>,
    result: Option<String>,
    keyword: Option<String>,
) -> Json<ApiResponse<Vec<AuditLog>>> {
    let db = conn.conn.lock().unwrap();
    
    let mut sql = "SELECT a.id, a.material_id, a.attachment_id, a.operator_id, a.operator_name,
                          a.operator_role, a.action, a.action_detail, a.result, a.fail_reason,
                          a.batch_id, a.created_at,
                          m.case_no, m.case_name,
                          att.file_name
                   FROM audit_logs a
                   LEFT JOIN litigation_materials m ON a.material_id = m.id
                   LEFT JOIN attachments att ON a.attachment_id = att.id".to_string();
    let mut conditions: Vec<String> = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(mid) = &material_id {
        if !mid.is_empty() {
            conditions.push("a.material_id = ?".to_string());
            params_vec.push(Box::new(mid.clone()));
        }
    }
    if let Some(oid) = &operator_id {
        if !oid.is_empty() {
            conditions.push("a.operator_id = ?".to_string());
            params_vec.push(Box::new(oid.clone()));
        }
    }
    if let Some(r) = &result {
        if !r.is_empty() {
            conditions.push("a.result = ?".to_string());
            params_vec.push(Box::new(r.clone()));
        }
    }
    if let Some(k) = &keyword {
        if !k.is_empty() {
            let like = format!("%{}%", k);
            conditions.push("(a.fail_reason LIKE ? OR a.action_detail LIKE ? OR a.operator_name LIKE ? OR m.case_no LIKE ? OR m.case_name LIKE ?)".to_string());
            for _ in 0..5 {
                params_vec.push(Box::new(like.clone()));
            }
        }
    }

    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }
    sql.push_str(" ORDER BY a.created_at DESC LIMIT 500");

    let mut stmt = db.prepare(&sql).unwrap();
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let rows = stmt.query_map(params_refs.as_slice(), |row| {
        Ok(AuditLog {
            id: row.get(0)?,
            material_id: row.get(1)?,
            attachment_id: row.get(2)?,
            operator_id: row.get(3)?,
            operator_name: row.get(4)?,
            operator_role: row.get(5)?,
            action: row.get(6)?,
            action_detail: row.get(7)?,
            result: row.get(8)?,
            fail_reason: row.get(9)?,
            batch_id: row.get(10)?,
            created_at: row.get(11)?,
            material_case_no: row.get(12)?,
            material_case_name: row.get(13)?,
            attachment_file_name: row.get(14)?,
        })
    }).unwrap();

    let logs: Vec<AuditLog> = rows.filter_map(|r| r.ok()).collect();
    let total = logs.len() as i64;
    Json(ApiResponse::ok_with_total(logs, total, "查询成功"))
}

#[get("/fail_reasons")]
pub fn get_fail_reasons(conn: &State<DbConn>) -> Json<ApiResponse<Vec<AuditLog>>> {
    let db = conn.conn.lock().unwrap();
    
    let mut stmt = db.prepare(
        "SELECT a.id, a.material_id, a.attachment_id, a.operator_id, a.operator_name,
                a.operator_role, a.action, a.action_detail, a.result, a.fail_reason,
                a.batch_id, a.created_at,
                m.case_no, m.case_name,
                att.file_name
         FROM audit_logs a
         LEFT JOIN litigation_materials m ON a.material_id = m.id
         LEFT JOIN attachments att ON a.attachment_id = att.id
         WHERE a.result = 'fail' AND a.fail_reason IS NOT NULL
         ORDER BY a.created_at DESC LIMIT 200"
    ).unwrap();

    let rows = stmt.query_map([], |row| {
        Ok(AuditLog {
            id: row.get(0)?,
            material_id: row.get(1)?,
            attachment_id: row.get(2)?,
            operator_id: row.get(3)?,
            operator_name: row.get(4)?,
            operator_role: row.get(5)?,
            action: row.get(6)?,
            action_detail: row.get(7)?,
            result: row.get(8)?,
            fail_reason: row.get(9)?,
            batch_id: row.get(10)?,
            created_at: row.get(11)?,
            material_case_no: row.get(12)?,
            material_case_name: row.get(13)?,
            attachment_file_name: row.get(14)?,
        })
    }).unwrap();

    let logs: Vec<AuditLog> = rows.filter_map(|r| r.ok()).collect();
    let total = logs.len() as i64;
    Json(ApiResponse::ok_with_total(logs, total, "查询成功"))
}
