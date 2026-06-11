use sqlx::SqlitePool;
use anyhow::Result;

pub async fn init_db(pool: &SqlitePool) -> Result<()> {
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
            creative_demand_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_role TEXT NOT NULL,
            scan_result TEXT NOT NULL,
            error_message TEXT,
            scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (creative_demand_id) REFERENCES creative_demands(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
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
