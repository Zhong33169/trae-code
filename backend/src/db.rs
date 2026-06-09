use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::params;
use std::error::Error;

pub type DbPool = Pool<SqliteConnectionManager>;

pub fn init_pool(database_url: &str) -> Result<DbPool, Box<dyn Error>> {
    let manager = SqliteConnectionManager::file(database_url);
    let pool = Pool::builder().max_size(10).build(manager)?;
    Ok(pool)
}

pub fn init_db(pool: &DbPool) -> Result<(), Box<dyn Error>> {
    let conn = pool.get()?;

    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            real_name TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS nursing_plans (
            id TEXT PRIMARY KEY,
            plan_no TEXT UNIQUE NOT NULL,
            elder_name TEXT NOT NULL,
            elder_gender TEXT NOT NULL,
            elder_age INTEGER NOT NULL,
            room_no TEXT NOT NULL,
            bed_no TEXT NOT NULL,
            admission_date TEXT,
            
            assessment_status TEXT NOT NULL DEFAULT 'pending',
            assessment_content TEXT,
            assessment_by TEXT,
            assessment_at TEXT,
            
            plan_content TEXT,
            plan_level TEXT,
            
            family_confirm_status TEXT NOT NULL DEFAULT 'pending',
            family_confirm_by TEXT,
            family_confirm_at TEXT,
            family_confirm_remark TEXT,
            
            status TEXT NOT NULL DEFAULT 'draft',
            current_step TEXT NOT NULL DEFAULT 'registration',
            
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS handover_records (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            shift TEXT NOT NULL,
            handover_by TEXT NOT NULL,
            takeover_by TEXT NOT NULL,
            confirm_time TEXT NOT NULL,
            handover_content TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (plan_id) REFERENCES nursing_plans(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS operation_logs (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            operator_id TEXT NOT NULL,
            operator_name TEXT NOT NULL,
            action TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT,
            reason TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_plans_status ON nursing_plans(status);
        CREATE INDEX IF NOT EXISTS idx_plans_current_step ON nursing_plans(current_step);
        CREATE INDEX IF NOT EXISTS idx_handover_plan ON handover_records(plan_id);
        CREATE INDEX IF NOT EXISTS idx_logs_plan ON operation_logs(plan_id);
        "#,
    )?;

    seed_users(&conn)?;

    Ok(())
}

fn seed_users(conn: &rusqlite::Connection) -> Result<(), Box<dyn Error>> {
    use sha2::{Sha256, Digest};
    
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
        .unwrap_or(0);
    
    if count > 0 {
        return Ok(());
    }

    let users = vec![
        ("registrar1", "登记员小王", "registrar", "123456"),
        ("auditor1", "审核主管李", "auditor", "123456"),
        ("reviewer1", "复核院长张", "reviewer", "123456"),
    ];

    for (username, real_name, role, password) in users {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        let password_hash = hex::encode(hasher.finalize());

        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO users (id, username, password_hash, real_name, role) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, username, password_hash, real_name, role],
        )?;
    }

    Ok(())
}
