use sqlx::SqlitePool;
use anyhow::Result;

pub async fn init_db(pool: &SqlitePool) -> Result<()> {
    migrate_scan_records_table(pool).await?;
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
    let columns: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM pragma_table_info('scan_records') ORDER BY cid"
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if columns.is_empty() {
        return Ok(());
    }

    let has_user_name = columns.contains(&"user_name".to_string());
    let has_error_code = columns.contains(&"error_code".to_string());
    
    let mut has_nullable_demand_id = false;
    if let Some(idx) = columns.iter().position(|c| c == "creative_demand_id") {
        let notnull: Option<i64> = sqlx::query_scalar(
            "SELECT notnull FROM pragma_table_info('scan_records') WHERE cid = ?"
        )
        .bind(idx as i64)
        .fetch_one(pool)
        .await
        .unwrap_or(Some(1));
        has_nullable_demand_id = notnull.unwrap_or(1) == 0;
    }

    if has_user_name && has_error_code && has_nullable_demand_id {
        return Ok(());
    }

    sqlx::query("PRAGMA foreign_keys = OFF").execute(pool).await?;

    sqlx::query("DROP TABLE IF EXISTS scan_records_new").execute(pool).await?;
    sqlx::query("DROP INDEX IF EXISTS idx_scan_records_creative_demand").execute(pool).await?;
    sqlx::query("DROP INDEX IF EXISTS idx_scan_records_user").execute(pool).await?;

    sqlx::query(
        r#"
        CREATE TABLE scan_records_new (
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

    let old_columns: Vec<String> = columns.iter()
        .filter(|c| {
            matches!(c.as_str(), 
                "id" | "creative_demand_id" | "user_id" | "user_name" | 
                "user_role" | "scan_result" | "error_code" | "error_message" | "scanned_at"
            )
        })
        .cloned()
        .collect();

    let col_str = old_columns.join(", ");
    let copy_sql = format!(
        "INSERT INTO scan_records_new ({}) SELECT {} FROM scan_records",
        col_str, col_str
    );
    sqlx::query(&copy_sql).execute(pool).await?;

    if !has_user_name {
        sqlx::query(
            "UPDATE scan_records_new SET user_name = (SELECT name FROM users WHERE users.id = scan_records_new.user_id) WHERE user_name IS NULL OR user_name = ''"
        ).execute(pool).await?;
    }

    if !has_error_code {
        sqlx::query(
            "UPDATE scan_records_new SET error_code = CASE 
                WHEN scan_result = 'failed' AND error_message LIKE '%无效%' THEN 'INVALID_CODE'
                WHEN scan_result = 'failed' AND error_message LIKE '%重复%' THEN 'DUPLICATE_SCAN'
                WHEN scan_result = 'failed' AND error_message LIKE '%处理人%' THEN 'WRONG_HANDLER'
                ELSE error_code 
            END"
        ).execute(pool).await?;
    }

    sqlx::query("DROP TABLE IF EXISTS scan_records").execute(pool).await?;
    sqlx::query("ALTER TABLE scan_records_new RENAME TO scan_records").execute(pool).await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_scan_records_creative_demand ON scan_records(creative_demand_id)"
    ).execute(pool).await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_scan_records_user ON scan_records(user_id)"
    ).execute(pool).await?;

    sqlx::query("PRAGMA foreign_keys = ON").execute(pool).await?;

    Ok(())
}
