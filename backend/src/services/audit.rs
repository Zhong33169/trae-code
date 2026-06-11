use sqlx::SqlitePool;
use uuid::Uuid;
use crate::models::AuditLog;

pub async fn log_action(
    pool: &SqlitePool,
    creative_demand_id: Option<&str>,
    user_id: &str,
    user_name: &str,
    user_role: &str,
    action: &str,
    old_status: Option<&str>,
    new_status: Option<&str>,
    details: Option<&str>,
    ip_address: Option<&str>,
) -> Result<(), sqlx::Error> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO audit_logs 
        (id, creative_demand_id, user_id, user_name, user_role, action, 
         old_status, new_status, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(id)
    .bind(creative_demand_id)
    .bind(user_id)
    .bind(user_name)
    .bind(user_role)
    .bind(action)
    .bind(old_status)
    .bind(new_status)
    .bind(details)
    .bind(ip_address)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn list_audit_logs(
    pool: &SqlitePool,
    creative_demand_id: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<Vec<AuditLog>, sqlx::Error> {
    let mut query = "SELECT * FROM audit_logs WHERE 1=1".to_string();
    let mut params: Vec<String> = Vec::new();

    if let Some(cid) = creative_demand_id {
        query.push_str(" AND creative_demand_id = ?");
        params.push(cid.to_string());
    }

    query.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

    let mut q = sqlx::query_as::<_, AuditLog>(&query);
    for p in &params {
        q = q.bind(p);
    }
    q = q.bind(limit).bind(offset);

    let logs = q.fetch_all(pool).await?;
    Ok(logs)
}
