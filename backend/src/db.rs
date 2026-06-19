use sqlx::SqlitePool;

pub async fn init_db(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            real_name TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS media_plans (
            id TEXT PRIMARY KEY,
            plan_no TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            client_name TEXT NOT NULL,
            status TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            created_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            submitted_at DATETIME,
            approved_at DATETIME,
            reviewed_at DATETIME,
            archived_at DATETIME,
            remark TEXT,
            reject_reason TEXT,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS media_schedules (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            media_name TEXT NOT NULL,
            ad_position TEXT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            frequency TEXT NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES media_plans(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS budgets (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            item_name TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES media_plans(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS evidences (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            evidence_type TEXT NOT NULL,
            name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (plan_id) REFERENCES media_plans(id) ON DELETE CASCADE,
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS operation_logs (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            operator_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT,
            remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (plan_id) REFERENCES media_plans(id),
            FOREIGN KEY (operator_id) REFERENCES users(id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_media_plans_status ON media_plans(status);
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_media_plans_created_by ON media_plans(created_by);
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
