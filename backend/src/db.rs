use anyhow::Result;
use chrono::Utc;
use rusqlite::Connection;
use uuid::Uuid;

pub fn get_conn() -> Connection {
    Connection::open("data/topics.db").expect("打开数据库失败")
}

pub fn init_db() -> Result<()> {
    std::fs::create_dir_all("data")?;
    let conn = Connection::open("data/topics.db")?;

    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            display_name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS topics (
            id TEXT PRIMARY KEY,
            topic_no TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            source TEXT NOT NULL,
            reporter TEXT NOT NULL,
            department TEXT NOT NULL,
            deadline TEXT,
            status TEXT NOT NULL,
            content TEXT,
            register_id TEXT NOT NULL,
            register_at TEXT NOT NULL,
            reviewer_id TEXT,
            review_at TEXT,
            review_result TEXT,
            review_comment TEXT,
            archiver_id TEXT,
            archive_at TEXT,
            archive_comment TEXT,
            reject_reason TEXT,
            anomaly_tag TEXT,
            created_from TEXT DEFAULT 'online',
            import_batch_id TEXT
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_type TEXT,
            file_size INTEGER,
            uploaded_by TEXT NOT NULL,
            uploaded_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS import_batches (
            id TEXT PRIMARY KEY,
            batch_no TEXT UNIQUE NOT NULL,
            source TEXT NOT NULL,
            operator_id TEXT NOT NULL,
            imported_at TEXT NOT NULL,
            total_count INTEGER NOT NULL,
            success_count INTEGER NOT NULL,
            conflict_count INTEGER NOT NULL,
            error_count INTEGER NOT NULL,
            remark TEXT
        );

        CREATE TABLE IF NOT EXISTS import_records (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            topic_no TEXT NOT NULL,
            status TEXT NOT NULL,
            diff_json TEXT,
            error_msg TEXT,
            topic_id TEXT
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            topic_id TEXT,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            action TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT,
            detail TEXT,
            created_at TEXT NOT NULL
        );
        "#,
    )?;

    Ok(())
}

pub fn seed_demo_data() -> Result<()> {
    let conn = Connection::open("data/topics.db")?;

    let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    let now = Utc::now().to_rfc3339();

    let register_id = Uuid::new_v4().to_string();
    let reviewer_id = Uuid::new_v4().to_string();
    let archiver_id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO users (id, username, password, role, display_name, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![register_id, "registrar", "123456", "registrar", "张登记", now],
    )?;
    conn.execute(
        "INSERT INTO users (id, username, password, role, display_name, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![reviewer_id, "reviewer", "123456", "reviewer", "李审核", now],
    )?;
    conn.execute(
        "INSERT INTO users (id, username, password, role, display_name, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![archiver_id, "archiver", "123456", "archiver", "王复核", now],
    )?;

    let normal_id = Uuid::new_v4().to_string();
    let missing_id = Uuid::new_v4().to_string();
    let overdue_id = Uuid::new_v4().to_string();
    let rejected_id = Uuid::new_v4().to_string();

    let overdue_deadline = Utc::now() - chrono::Duration::days(3);

    conn.execute(
        "INSERT INTO topics (id, topic_no, title, source, reporter, department, deadline, status, content, register_id, register_at, anomaly_tag) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        rusqlite::params![
            normal_id, "XT202506001", "关于加强基层宣传工作的专题报道", "市委宣传部通知", "刘记者", "时政部",
            (Utc::now() + chrono::Duration::days(7)).to_rfc3339(),
            "registered", "按照市委宣传部部署，深入基层采访宣传工作典型案例。", register_id, now, "normal"
        ],
    )?;

    conn.execute(
        "INSERT INTO topics (id, topic_no, title, source, reporter, department, deadline, status, content, register_id, register_at, anomaly_tag) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        rusqlite::params![
            missing_id, "XT202506002", "城市更新专题调研报道", "采编例会提议", "陈记者", "城建部",
            (Utc::now() + chrono::Duration::days(5)).to_rfc3339(),
            "registered", "围绕老旧小区改造、城市更新进展进行深度报道。", register_id, now, "missing_material"
        ],
    )?;

    conn.execute(
        "INSERT INTO topics (id, topic_no, title, source, reporter, department, deadline, status, content, register_id, register_at, anomaly_tag) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        rusqlite::params![
            overdue_id, "XT202506003", "上半年经济形势分析报道", "总编室指令", "赵记者", "经济部",
            overdue_deadline.to_rfc3339(),
            "registered", "对上半年全市经济运行数据和趋势进行分析报道。", register_id, now, "overdue"
        ],
    )?;

    conn.execute(
        "INSERT INTO topics (id, topic_no, title, source, reporter, department, deadline, status, content, register_id, register_at, reviewer_id, review_at, review_result, review_comment, reject_reason, anomaly_tag) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",
        rusqlite::params![
            rejected_id, "XT202506004", "文明城市创建暗访报道", "群众热线线索", "孙记者", "社会部",
            (Utc::now() + chrono::Duration::days(10)).to_rfc3339(),
            "rejected", "根据群众反映，对文明城市创建中的短板进行暗访调查。",
            register_id, now, reviewer_id, now, "rejected",
            "线索来源不清，选题方向不明确，需补充具体线索材料后重新提交。",
            "线索不充分、方向模糊", "rejected"
        ],
    )?;

    conn.execute(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, action, old_status, new_status, detail, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        rusqlite::params![
            Uuid::new_v4().to_string(), rejected_id, reviewer_id, "李审核", "reject",
            "registered", "rejected", "退回原因：线索不充分、方向模糊", now
        ],
    )?;

    Ok(())
}
