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
            return_reason TEXT,
            
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

        CREATE TABLE IF NOT EXISTS batch_operations (
            id TEXT PRIMARY KEY,
            batch_no TEXT UNIQUE NOT NULL,
            action TEXT NOT NULL,
            operator_id TEXT NOT NULL,
            operator_name TEXT NOT NULL,
            total_count INTEGER NOT NULL DEFAULT 0,
            success_count INTEGER NOT NULL DEFAULT 0,
            fail_count INTEGER NOT NULL DEFAULT 0,
            reason TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS batch_items (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            plan_id TEXT NOT NULL,
            plan_no TEXT NOT NULL,
            elder_name TEXT NOT NULL,
            success INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            from_status TEXT,
            to_status TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_plans_status ON nursing_plans(status);
        CREATE INDEX IF NOT EXISTS idx_plans_current_step ON nursing_plans(current_step);
        CREATE INDEX IF NOT EXISTS idx_handover_plan ON handover_records(plan_id);
        CREATE INDEX IF NOT EXISTS idx_logs_plan ON operation_logs(plan_id);
        CREATE INDEX IF NOT EXISTS idx_batch_items_batch ON batch_items(batch_id);
        "#,
    )?;

    seed_users(&conn)?;
    seed_sample_plans(&conn)?;

    let _ = conn.execute_batch(
        "ALTER TABLE nursing_plans ADD COLUMN return_reason TEXT;"
    );

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

fn seed_sample_plans(conn: &rusqlite::Connection) -> Result<(), Box<dyn Error>> {
    use chrono::{Local, Duration};
    
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM nursing_plans", [], |row| row.get(0))
        .unwrap_or(0);
    
    if count > 0 {
        return Ok(());
    }

    let registrar_id: String = conn.query_row(
        "SELECT id FROM users WHERE username = 'registrar1'",
        [],
        |row| row.get(0)
    ).unwrap_or_default();

    let sample_data = vec![
        ("李奶奶", "女", 82, "101", "A", "自理", "draft", "pending", "pending"),
        ("王爷爷", "男", 76, "102", "B", "半自理", "draft", "completed", "confirmed"),
        ("张奶奶", "女", 88, "201", "A", "完全失能", "pending_audit", "completed", "confirmed"),
        ("刘爷爷", "男", 79, "202", "B", "半自理", "pending_audit", "completed", "confirmed"),
        ("陈奶奶", "女", 91, "301", "A", "特护", "pending_review", "completed", "confirmed"),
        ("赵爷爷", "男", 85, "302", "B", "完全失能", "archived", "completed", "confirmed"),
        ("孙奶奶", "女", 78, "103", "A", "半自理", "returned", "completed", "confirmed"),
        ("周爷爷", "男", 83, "203", "B", "自理", "pending_audit", "completed", "confirmed"),
        ("吴奶奶", "女", 90, "303", "A", "完全失能", "draft", "completed", "pending"),
        ("郑爷爷", "男", 75, "104", "B", "自理", "archived", "completed", "confirmed"),
        ("冯奶奶", "女", 87, "204", "A", "半自理", "pending_review", "completed", "confirmed"),
        ("钱爷爷", "男", 81, "304", "B", "特护", "returned", "completed", "confirmed"),
    ];

    let plan_contents = vec![
        "每日测量血压、体温，协助进食三餐，定时翻身",
        "协助日常起居，每周洗澡两次，每日散步30分钟",
        "24小时专人护理，鼻饲喂养，定期吸痰",
        "生活基本自理，提醒服药，每周体检一次",
    ];

    for (i, (name, gender, age, room, bed, level, status, assess_status, family_status)) in sample_data.iter().enumerate() {
        let id = uuid::Uuid::new_v4().to_string();
        let date_str = Local::now()
            .checked_sub_signed(Duration::days(i as i64))
            .unwrap_or(Local::now())
            .format("%Y%m%d")
            .to_string();
        let rand = uuid::Uuid::new_v4().to_string().chars().take(4).collect::<String>();
        let plan_no = format!("HL{}{}", date_str, rand.to_uppercase());

        let assess_by = if *assess_status == "completed" { Some("登记员小王") } else { None };
        let assess_at = if *assess_status == "completed" {
            Some(Local::now().checked_sub_signed(Duration::days(i as i64 + 1)).unwrap_or(Local::now()).format("%Y-%m-%d %H:%M:%S").to_string())
        } else { None };

        let family_by = if *family_status == "confirmed" { Some(format!("{}家属", name)) } else { None };
        let family_at = if *family_status == "confirmed" {
            Some(Local::now().checked_sub_signed(Duration::days(i as i64)).unwrap_or(Local::now()).format("%Y-%m-%d %H:%M:%S").to_string())
        } else { None };

        let plan_content = plan_contents[i % plan_contents.len()].to_string();

        conn.execute(
            r#"INSERT INTO nursing_plans (
                id, plan_no, elder_name, elder_gender, elder_age, room_no, bed_no,
                admission_date, assessment_status, assessment_content, assessment_by, assessment_at,
                plan_content, plan_level, family_confirm_status, family_confirm_by, family_confirm_at,
                family_confirm_remark, status, current_step, created_by, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, datetime('now'), datetime('now'))"#,
            rusqlite::params![
                id,
                plan_no,
                name,
                gender,
                *age,
                room,
                bed,
                Some("2024-01-15"),
                assess_status,
                if *assess_status == "completed" { Some(format!("{}老人身体状况评估正常，生活{}", name, level)) } else { None },
                assess_by,
                assess_at,
                plan_content,
                Some(level.to_string()),
                family_status,
                family_by,
                family_at,
                if *family_status == "confirmed" { Some("家属已确认并同意护理方案") } else { None },
                status,
                "registration",
                registrar_id
            ],
        )?;

        let log_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            r#"INSERT INTO operation_logs (id, plan_id, operator_id, operator_name, action, from_status, to_status, reason)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"#,
            rusqlite::params![
                log_id,
                id,
                registrar_id,
                "登记员小王",
                "创建",
                None::<String>,
                Some("draft"),
                None::<String>
            ],
        )?;

        if *status != "draft" {
            let log_id2 = uuid::Uuid::new_v4().to_string();
            conn.execute(
                r#"INSERT INTO operation_logs (id, plan_id, operator_id, operator_name, action, from_status, to_status, reason)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"#,
                rusqlite::params![
                    log_id2,
                    id,
                    registrar_id,
                    "登记员小王",
                    "提交审核",
                    Some("draft"),
                    Some("pending_audit"),
                    None::<String>
                ],
            )?;
        }

        if *status == "pending_review" || *status == "archived" || *status == "returned" {
            let handover_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                r#"INSERT INTO handover_records (id, plan_id, shift, handover_by, takeover_by, confirm_time, handover_content)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"#,
                rusqlite::params![
                    handover_id,
                    id,
                    "早班",
                    "登记员小王",
                    "审核主管李",
                    Local::now().checked_sub_signed(Duration::days(i as i64)).unwrap_or(Local::now()).format("%Y-%m-%d 08:00:00").to_string(),
                    Some("交班时老人情况稳定，按计划执行护理")
                ],
            )?;
        }
    }

    Ok(())
}
