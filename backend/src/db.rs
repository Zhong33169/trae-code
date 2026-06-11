use sqlx::SqlitePool;
use anyhow::Result;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MigrationStatus {
    pub name: String,
    pub status: String,
    pub error_message: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

pub async fn init_db(pool: &SqlitePool) -> Result<()> {
    init_migration_audit_table(pool).await?;
    
    match migrate_scan_records_table(pool).await {
        Ok(_) => {
            let _ = record_migration_success(pool, "scan_records").await;
        }
        Err(e) => {
            let err_msg = e.to_string();
            let _ = record_migration_failure(pool, "scan_records", &err_msg).await;
            return Err(e);
        }
    }
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS creative_demands (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            client_name TEXT NOT NULL,
            status TEXT NOT NULL,
            current_handler_role TEXT NOT NULL,
            current_handler_id TEXT,
            brief_materials TEXT,
            brief_deadline DATETIME,
            brief_opinion TEXT,
            schedule_materials TEXT,
            schedule_deadline DATETIME,
            schedule_opinion TEXT,
            confirmation_materials TEXT,
            confirmation_deadline DATETIME,
            confirmation_opinion TEXT,
            attachments TEXT,
            remarks TEXT,
            processing_result TEXT,
            return_reason TEXT,
            created_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            version INTEGER DEFAULT 1,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS scan_records (
            id TEXT PRIMARY KEY,
            creative_demand_id TEXT,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            user_role TEXT NOT NULL,
            scan_result TEXT NOT NULL,
            error_code TEXT,
            error_message TEXT,
            scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_scan_records_creative_demand ON scan_records(creative_demand_id)
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_scan_records_user ON scan_records(user_id)
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            creative_demand_id TEXT,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            user_role TEXT NOT NULL,
            action TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT,
            details TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (creative_demand_id) REFERENCES creative_demands(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS status_transitions (
            id TEXT PRIMARY KEY,
            creative_demand_id TEXT NOT NULL,
            from_status TEXT NOT NULL,
            to_status TEXT NOT NULL,
            handler_role TEXT NOT NULL,
            handler_id TEXT NOT NULL,
            comments TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (creative_demand_id) REFERENCES creative_demands(id),
            FOREIGN KEY (handler_id) REFERENCES users(id)
        )
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_creative_demands_status ON creative_demands(status)
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_creative_demands_code ON creative_demands(code)
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_audit_logs_creative_demand ON audit_logs(creative_demand_id)
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_scan_records_creative_demand ON scan_records(creative_demand_id)
        "#
    ).execute(pool).await?;

    Ok(())
}

pub async fn seed_initial_data(pool: &SqlitePool) -> Result<()> {
    let registrar_pw = bcrypt::hash("registrar123", 4).unwrap();
    let supervisor_pw = bcrypt::hash("supervisor123", 4).unwrap();
    let reviewer_pw = bcrypt::hash("reviewer123", 4).unwrap();

    let users = vec![
        ("u1", "registrar", &registrar_pw, "张登记", "registrar"),
        ("u2", "supervisor", &supervisor_pw, "李主管", "supervisor"),
        ("u3", "reviewer", &reviewer_pw, "王复核", "reviewer"),
    ];

    for (id, username, pw_hash, name, role) in users {
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO users (id, username, password_hash, name, role)
            VALUES (?, ?, ?, ?, ?)
            "#
        )
        .bind(id)
        .bind(username)
        .bind(pw_hash)
        .bind(name)
        .bind(role)
        .execute(pool)
        .await?;
    }

    let sample_demands = vec![
        ("cd001", "CD202406001", "夏季促销活动主视觉设计", "品牌A公司", "pending_registrar", "registrar"),
        ("cd002", "CD202406002", "新品发布会KV设计", "品牌B公司", "pending_supervisor", "supervisor"),
        ("cd003", "CD202406003", "618活动页面设计", "品牌C公司", "pending_reviewer", "reviewer"),
        ("cd004", "CD202406004", "双11预热海报系列", "品牌D公司", "completed", "registrar"),
        ("cd005", "CD202406005", "会员日活动创意", "品牌E公司", "rejected", "supervisor"),
    ];

    for (id, code, title, client, status, handler_role) in sample_demands {
        let created_by = match handler_role {
            "registrar" => "u1",
            "supervisor" => "u2",
            _ => "u3",
        };

        sqlx::query(
            r#"
            INSERT OR IGNORE INTO creative_demands 
            (id, code, title, client_name, status, current_handler_role, created_by, 
             brief_materials, schedule_materials, confirmation_materials,
             brief_opinion, schedule_opinion, confirmation_opinion,
             remarks, attachments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(id)
        .bind(code)
        .bind(title)
        .bind(client)
        .bind(status)
        .bind(handler_role)
        .bind(created_by)
        .bind("[\"brief_doc.pdf\"]")
        .bind("[\"schedule.xlsx\"]")
        .bind("[\"confirmation.pdf\"]")
        .bind("brief接收意见已填写")
        .bind("创意排期确认")
        .bind("客户确认通过")
        .bind("初始备注信息")
        .bind("[\"attachment1.jpg\", \"attachment2.pdf\"]")
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn migrate_scan_records_table(pool: &SqlitePool) -> Result<()> {
    let old_columns: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM pragma_table_info('scan_records') ORDER BY cid"
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if old_columns.is_empty() {
        return Ok(());
    }

    let has_user_name = old_columns.iter().any(|c| c == "user_name");
    let has_user_role = old_columns.iter().any(|c| c == "user_role");
    let has_error_code = old_columns.iter().any(|c| c == "error_code");
    
    let mut has_nullable_demand_id = false;
    if let Some(idx) = old_columns.iter().position(|c| c == "creative_demand_id") {
        let notnull: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT notnull FROM pragma_table_info('scan_records') WHERE cid = ?"
        )
        .bind(idx as i64)
        .fetch_one(pool)
        .await
        .unwrap_or(1);
        has_nullable_demand_id = notnull == 0;
    }

    if has_user_name && has_user_role && has_error_code && has_nullable_demand_id {
        return Ok(());
    }

    let mut conn = pool.acquire().await?;

    sqlx::query("PRAGMA busy_timeout = 5000").execute(&mut *conn).await.ok();
    sqlx::query("PRAGMA foreign_keys = OFF").execute(&mut *conn).await.ok();

    let migrate_result = migrate_scan_records_with_conn(&mut conn, &old_columns, has_error_code).await;

    let _ = sqlx::query("PRAGMA foreign_keys = ON").execute(&mut *conn).await;

    match migrate_result {
        Ok(_) => Ok(()),
        Err(e) => {
            Err(anyhow::anyhow!("MIGRATION_SCAN_RECORDS_FAILED: {}", e))
        }
    }
}

async fn migrate_scan_records_with_conn(
    conn: &mut sqlx::SqliteConnection,
    old_columns: &[String],
    has_error_code: bool,
) -> Result<(), anyhow::Error> {
    let backup_table = "scan_records_backup";

    sqlx::query("PRAGMA journal_mode = WAL").execute(&mut *conn).await.ok();
    sqlx::query("DROP TABLE IF EXISTS scan_records_new").execute(&mut *conn).await?;
    sqlx::query(&format!("DROP TABLE IF EXISTS {}", backup_table)).execute(&mut *conn).await?;
    sqlx::query("DROP INDEX IF EXISTS idx_scan_records_creative_demand").execute(&mut *conn).await?;
    sqlx::query("DROP INDEX IF EXISTS idx_scan_records_user").execute(&mut *conn).await?;

    sqlx::query(
        r#"
        CREATE TABLE scan_records_new (
            id TEXT PRIMARY KEY,
            creative_demand_id TEXT,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL DEFAULT '未知用户',
            user_role TEXT NOT NULL DEFAULT 'unknown',
            scan_result TEXT NOT NULL DEFAULT 'failed',
            error_code TEXT,
            error_message TEXT,
            scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    ).execute(&mut *conn).await?;

    let col_id      = old_columns.iter().any(|c| c == "id");
    let col_did     = old_columns.iter().any(|c| c == "creative_demand_id");
    let col_uid     = old_columns.iter().any(|c| c == "user_id");
    let col_uname   = old_columns.iter().any(|c| c == "user_name");
    let col_urole   = old_columns.iter().any(|c| c == "user_role");
    let col_result  = old_columns.iter().any(|c| c == "scan_result");
    let col_ecode   = old_columns.iter().any(|c| c == "error_code");
    let col_emsg    = old_columns.iter().any(|c| c == "error_message");
    let col_time    = old_columns.iter().any(|c| c == "scanned_at");

    let mut dst_cols: Vec<&str> = Vec::new();
    let mut src_exprs: Vec<String> = Vec::new();

    if col_id { dst_cols.push("id"); src_exprs.push("id".to_string()); }
    if col_did { dst_cols.push("creative_demand_id"); src_exprs.push("creative_demand_id".to_string()); }
    if col_uid { dst_cols.push("user_id"); src_exprs.push("user_id".to_string()); }

    dst_cols.push("user_name");
    if col_uname {
        src_exprs.push("COALESCE(NULLIF(user_name, ''), '未知用户')".to_string());
    } else {
        src_exprs.push("COALESCE((SELECT name FROM users WHERE users.id = scan_records.user_id), '未知用户')".to_string());
    }

    dst_cols.push("user_role");
    if col_urole {
        src_exprs.push("COALESCE(NULLIF(user_role, ''), 'unknown')".to_string());
    } else {
        src_exprs.push("COALESCE((SELECT role FROM users WHERE users.id = scan_records.user_id), 'unknown')".to_string());
    }

    dst_cols.push("scan_result");
    if col_result {
        src_exprs.push("COALESCE(scan_result, 'failed')".to_string());
    } else {
        src_exprs.push("'failed'".to_string());
    }

    if col_ecode { dst_cols.push("error_code"); src_exprs.push("error_code".to_string()); }
    if col_emsg  { dst_cols.push("error_message"); src_exprs.push("error_message".to_string()); }
    if col_time  { dst_cols.push("scanned_at"); src_exprs.push("scanned_at".to_string()); }

    let copy_sql = format!(
        "INSERT INTO scan_records_new ({}) SELECT {} FROM scan_records",
        dst_cols.join(", "),
        src_exprs.join(", ")
    );
    sqlx::query(&copy_sql).execute(&mut *conn).await?;

    if !has_error_code {
        sqlx::query(
            "UPDATE scan_records_new SET error_code = CASE 
                WHEN scan_result = 'failed' AND error_message LIKE '%无效%' THEN 'INVALID_CODE'
                WHEN scan_result = 'failed' AND error_message LIKE '%重复%' THEN 'DUPLICATE_SCAN'
                WHEN scan_result = 'failed' AND error_message LIKE '%处理人%' THEN 'WRONG_HANDLER'
                ELSE NULL
            END WHERE error_code IS NULL"
        ).execute(&mut *conn).await?;
    }

    sqlx::query(&format!(
        "ALTER TABLE scan_records RENAME TO {}", backup_table
    )).execute(&mut *conn).await?;

    let rename_result = sqlx::query("ALTER TABLE scan_records_new RENAME TO scan_records")
        .execute(&mut *conn)
        .await;

    if rename_result.is_err() {
        let _ = sqlx::query(&format!(
            "ALTER TABLE {} RENAME TO scan_records", backup_table
        )).execute(&mut *conn).await;
        return Err(anyhow::anyhow!(
            "重命名新表失败，已回滚旧表: {}",
            rename_result.err().unwrap()
        ));
    }

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_scan_records_creative_demand ON scan_records(creative_demand_id)"
    ).execute(&mut *conn).await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_scan_records_user ON scan_records(user_id)"
    ).execute(&mut *conn).await?;

    sqlx::query(&format!("DROP TABLE IF EXISTS {}", backup_table))
        .execute(&mut *conn)
        .await
        .ok();

    Ok(())
}

async fn init_migration_audit_table(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS migration_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            migration_name TEXT NOT NULL,
            status TEXT NOT NULL,
            step_name TEXT,
            error_message TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    ).execute(pool).await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_migration_audit_name ON migration_audit(migration_name)"
    ).execute(pool).await?;

    Ok(())
}

async fn record_migration_step(
    pool: &SqlitePool,
    name: &str,
    status: &str,
    step: Option<&str>,
    error: Option<&str>,
    details: Option<&str>,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO migration_audit (migration_name, status, step_name, error_message, details) 
         VALUES (?, ?, ?, ?, ?)"
    )
    .bind(name)
    .bind(status)
    .bind(step)
    .bind(error)
    .bind(details)
    .execute(pool)
    .await?;
    Ok(())
}

async fn record_migration_success(pool: &SqlitePool, name: &str) -> Result<()> {
    record_migration_step(pool, name, "success", None, None, None).await
}

async fn record_migration_failure(pool: &SqlitePool, name: &str, error: &str) -> Result<()> {
    record_migration_step(pool, name, "failed", None, Some(error), None).await
}

pub async fn get_migration_status(pool: &SqlitePool, name: &str) -> Result<Option<MigrationStatus>> {
    let row: Option<(String, String, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        r#"
        SELECT migration_name, status, error_message, 
               MIN(created_at) as started_at, 
               MAX(created_at) as completed_at
        FROM migration_audit
        WHERE migration_name = ?
        GROUP BY migration_name, status
        ORDER BY created_at DESC
        LIMIT 1
        "#
    )
    .bind(name)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|(name, status, error_msg, started, completed)| MigrationStatus {
        name,
        status,
        error_message: error_msg,
        started_at: started,
        completed_at: completed,
    }))
}

pub fn is_migration_error(error_msg: &str) -> bool {
    error_msg.starts_with("MIGRATION_")
}

pub fn format_migration_error(error_msg: &str) -> String {
    if error_msg.starts_with("MIGRATION_SCAN_RECORDS_FAILED:") {
        let details = error_msg.strip_prefix("MIGRATION_SCAN_RECORDS_FAILED:").unwrap_or("").trim();
        format!(
            "扫码记录表迁移失败：{}\n\n请尝试：\n1. 备份数据库文件\n2. 删除旧的 scan_records 表\n3. 重启服务让系统自动重建",
            details
        )
    } else {
        error_msg.to_string()
    }
}
