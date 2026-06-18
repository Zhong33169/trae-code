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
            title TEXT,
            status TEXT NOT NULL,
            diff_json TEXT,
            error_msg TEXT,
            topic_id TEXT,
            process_status TEXT DEFAULT 'pending',
            process_remark TEXT,
            processed_by TEXT,
            processed_by_name TEXT,
            processed_at TEXT,
            decision_summary TEXT,
            field_snapshot_old TEXT,
            field_snapshot_new TEXT,
            process_stage TEXT
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            topic_id TEXT,
            import_batch_id TEXT,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            action TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT,
            detail TEXT,
            created_at TEXT NOT NULL,
            decision_summary TEXT,
            process_stage TEXT,
            field_snapshot_old TEXT,
            field_snapshot_new TEXT
        );
        "#,
    )?;

    // 字段补齐（兼容旧库）
    let conn = Connection::open("data/topics.db")?;
    let _ = conn.execute_batch(
        "ALTER TABLE import_records ADD COLUMN title TEXT;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE audit_logs ADD COLUMN import_batch_id TEXT;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE import_records ADD COLUMN process_status TEXT DEFAULT 'pending';",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE import_records ADD COLUMN process_remark TEXT;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE import_records ADD COLUMN processed_by TEXT;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE import_records ADD COLUMN processed_by_name TEXT;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE import_records ADD COLUMN processed_at TEXT;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE import_records ADD COLUMN decision_summary TEXT;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE import_records ADD COLUMN field_snapshot_old TEXT;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE import_records ADD COLUMN field_snapshot_new TEXT;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE import_records ADD COLUMN process_stage TEXT;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE audit_logs ADD COLUMN decision_summary TEXT;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE audit_logs ADD COLUMN process_stage TEXT;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE audit_logs ADD COLUMN field_snapshot_old TEXT;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE audit_logs ADD COLUMN field_snapshot_new TEXT;",
    );

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
        "INSERT INTO audit_logs (id, topic_id, import_batch_id, user_id, user_name, action, old_status, new_status, detail, created_at, decision_summary, process_stage, field_snapshot_old, field_snapshot_new) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,NULL,NULL,NULL,NULL)",
        rusqlite::params![
            Uuid::new_v4().to_string(), rejected_id, None as Option<String>, reviewer_id, "李审核", "reject",
            "registered", "rejected", "退回原因：线索不充分、方向模糊", now
        ],
    )?;

    // ===== 演示数据：离线台账回填历史批次（含成功/冲突/失败） =====
    let demo_batch_id = Uuid::new_v4().to_string();
    let demo_batch_no = format!("IMP{}001", (Utc::now() - chrono::Duration::hours(2)).format("%Y%m%d%H%M"));
    let demo_import_time = (Utc::now() - chrono::Duration::hours(2)).to_rfc3339();
    let demo_offline_topic_id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO import_batches (id, batch_no, source, operator_id, imported_at, total_count, success_count, conflict_count, error_count, remark) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        rusqlite::params![
            demo_batch_id, demo_batch_no, "5月历史台账补录（演示）", register_id, demo_import_time,
            5, 1, 3, 1, "演示批次：含成功1条、冲突3条（待处理/已提交/已处理）、失败1条"
        ],
    )?;

    // 成功：新增一条离线导入选题（缺材料标签，用于验收演示）
    conn.execute(
        "INSERT INTO topics (id, topic_no, title, source, reporter, department, deadline, status, content, register_id, register_at, anomaly_tag, created_from, import_batch_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'offline',?13)",
        rusqlite::params![
            demo_offline_topic_id, "XT202505101", "五一劳动节劳模系列报道",
            "5月线下台账", "周记者", "时政部",
            (Utc::now() - chrono::Duration::days(10)).to_rfc3339(),
            "registered", "五一劳动节期间劳模先进事迹系列报道。",
            register_id, demo_import_time, "missing_material", demo_batch_id
        ],
    )?;
    conn.execute(
        "INSERT INTO import_records (id, batch_id, topic_no, title, status, diff_json, error_msg, topic_id, process_status, process_remark, processed_by, processed_by_name, processed_at, decision_summary, field_snapshot_old, field_snapshot_new, process_stage) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'not_applicable',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)",
        rusqlite::params![
            Uuid::new_v4().to_string(), demo_batch_id, "XT202505101", "五一劳动节劳模系列报道",
            "success", None as Option<String>, None as Option<String>, demo_offline_topic_id
        ],
    )?;
    conn.execute(
        "INSERT INTO audit_logs (id, topic_id, import_batch_id, user_id, user_name, action, old_status, new_status, detail, created_at, decision_summary, process_stage, field_snapshot_old, field_snapshot_new) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,NULL,NULL,NULL,NULL)",
        rusqlite::params![
            Uuid::new_v4().to_string(), demo_offline_topic_id, demo_batch_id,
            register_id, "张登记", "import_create",
            None as Option<String>, Some("registered"),
            "离线台账回填成功导入：批次演示批次，来源 5月历史台账补录（演示）",
            demo_import_time
        ],
    )?;

    // 冲突-待处理：XT202506001 已在线上存在，记录差异，状态 pending
    let conflict_diff = serde_json::json!({
        "title": { "old": "关于加强基层宣传工作的专题报道", "new": "基层宣传工作专题报道（线下版）" },
        "reporter": { "old": "刘记者", "new": "演示记者B" },
        "department": { "old": "时政部", "new": "宣传部" }
    }).to_string();
    let conflict_snapshot_old = serde_json::json!({
        "title": "关于加强基层宣传工作的专题报道",
        "reporter": "刘记者",
        "department": "时政部"
    }).to_string();
    let conflict_snapshot_new = serde_json::json!({
        "title": "基层宣传工作专题报道（线下版）",
        "reporter": "演示记者B",
        "department": "宣传部"
    }).to_string();
    conn.execute(
        "INSERT INTO import_records (id, batch_id, topic_no, title, status, diff_json, error_msg, topic_id, process_status, process_remark, processed_by, processed_by_name, processed_at, decision_summary, field_snapshot_old, field_snapshot_new, process_stage) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'pending',NULL,NULL,NULL,NULL,NULL,?9,?10,NULL)",
        rusqlite::params![
            Uuid::new_v4().to_string(), demo_batch_id, "XT202506001",
            "基层宣传工作专题报道（线下版）", "conflict",
            conflict_diff,
            "选题单编号已存在，存在线上线下状态冲突或重复回填，未覆盖",
            normal_id,
            conflict_snapshot_old,
            conflict_snapshot_new
        ],
    )?;
    conn.execute(
        "INSERT INTO audit_logs (id, topic_id, import_batch_id, user_id, user_name, action, old_status, new_status, detail, created_at, decision_summary, process_stage, field_snapshot_old, field_snapshot_new) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,NULL,NULL,NULL,NULL)",
        rusqlite::params![
            Uuid::new_v4().to_string(), normal_id, demo_batch_id,
            register_id, "张登记", "import_conflict",
            None as Option<String>, None as Option<String>,
            "离线台账回填冲突：选题单 XT202506001 已存在，未覆盖",
            demo_import_time
        ],
    )?;

    // 冲突-已提交：XT202506002 已在线上存在，已由登记员提交等待审核
    let conflict_submitted_diff = serde_json::json!({
        "reporter": { "old": "陈记者", "new": "线下登记记者" },
        "deadline": { "old": "2025-06-15T23:59:59+08:00", "new": "2025-06-10T23:59:59+08:00" }
    }).to_string();
    let submitted_time = (Utc::now() - chrono::Duration::hours(2)).to_rfc3339();
    let submitted_snapshot_old = serde_json::json!({"reporter":"陈记者","deadline":"2025-06-15T23:59:59+08:00"}).to_string();
    let submitted_snapshot_new = serde_json::json!({"reporter":"线下登记记者","deadline":"2025-06-10T23:59:59+08:00"}).to_string();
    let submitted_summary = "登记员张登记提交冲突处理申请，选题XT202506002，备注：线下台账核对确认，记者和截止日期信息以下发的纸质台账为准，请主管审核";
    conn.execute(
        "INSERT INTO import_records (id, batch_id, topic_no, title, status, diff_json, error_msg, topic_id, process_status, process_remark, processed_by, processed_by_name, processed_at, decision_summary, field_snapshot_old, field_snapshot_new, process_stage) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'submitted',?9,?10,?11,?12,?13,?14,?15,'submit')",
        rusqlite::params![
            Uuid::new_v4().to_string(), demo_batch_id, "XT202506002",
            "2025年文化产业发展论坛报道", "conflict",
            conflict_submitted_diff,
            "选题单编号已存在，存在线上线下状态冲突或重复回填，未覆盖",
            missing_id,
            "线下台账核对确认，记者和截止日期信息以下发的纸质台账为准，请主管审核",
            register_id, "张登记", submitted_time,
            submitted_summary,
            submitted_snapshot_old,
            submitted_snapshot_new
        ],
    )?;
    conn.execute(
        "INSERT INTO audit_logs (id, topic_id, import_batch_id, user_id, user_name, action, old_status, new_status, detail, created_at, decision_summary, process_stage, field_snapshot_old, field_snapshot_new) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'submit',?12,?13)",
        rusqlite::params![
            Uuid::new_v4().to_string(), missing_id, demo_batch_id,
            register_id, "张登记", "conflict_submit",
            Some("pending"), Some("submitted"),
            "离线回填冲突已提交审核：线下台账核对确认，记者和截止日期信息以下发的纸质台账为准，请主管审核",
            submitted_time,
            submitted_summary,
            submitted_snapshot_old,
            submitted_snapshot_new
        ],
    )?;

    // 冲突-已处理：XT202506003 已在线上存在，已由审核主管采纳线下数据
    let conflict_resolved_diff = serde_json::json!({
        "title": { "old": "上半年经济形势分析报道", "new": "线下最终定稿标题" },
        "department": { "old": "经济部", "new": "经济部（线下确认）" }
    }).to_string();
    let resolved_time = (Utc::now() - chrono::Duration::days(1)).to_rfc3339();
    let resolved_snapshot_old = serde_json::json!({"title":"上半年经济形势分析报道","department":"经济部"}).to_string();
    let resolved_snapshot_new = serde_json::json!({"title":"线下最终定稿标题","department":"经济部（线下确认）"}).to_string();
    let resolved_summary = "审核主管王主管采纳线下数据覆盖线上，选题XT202506003，影响字段[title,department]，备注：经与纸质台账核对，线下信息准确，采纳线下数据覆盖线上";
    conn.execute(
        "INSERT INTO import_records (id, batch_id, topic_no, title, status, diff_json, error_msg, topic_id, process_status, process_remark, processed_by, processed_by_name, processed_at, decision_summary, field_snapshot_old, field_snapshot_new, process_stage) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'resolved',?9,?10,?11,?12,?13,?14,?15,'resolve')",
        rusqlite::params![
            Uuid::new_v4().to_string(), demo_batch_id, "XT202506003",
            "线下最终定稿标题", "conflict",
            conflict_resolved_diff,
            "选题单编号已存在，存在线上线下状态冲突或重复回填，未覆盖",
            overdue_id,
            "经与纸质台账核对，线下信息准确，采纳线下数据覆盖线上",
            reviewer_id, "王主管", resolved_time,
            resolved_summary,
            resolved_snapshot_old,
            resolved_snapshot_new
        ],
    )?;
    conn.execute(
        "INSERT INTO audit_logs (id, topic_id, import_batch_id, user_id, user_name, action, old_status, new_status, detail, created_at, decision_summary, process_stage, field_snapshot_old, field_snapshot_new) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'resolve',?12,?13)",
        rusqlite::params![
            Uuid::new_v4().to_string(), overdue_id, demo_batch_id,
            reviewer_id, "王主管", "conflict_resolve",
            Some("submitted"), Some("resolved"),
            "离线回填冲突已处理（采纳线下）：经与纸质台账核对，线下信息准确，采纳线下数据覆盖线上",
            resolved_time,
            resolved_summary,
            resolved_snapshot_old,
            resolved_snapshot_new
        ],
    )?;

    // 失败：非法状态值
    conn.execute(
        "INSERT INTO import_records (id, batch_id, topic_no, title, status, diff_json, error_msg, topic_id, process_status, process_remark, processed_by, processed_by_name, processed_at, decision_summary, field_snapshot_old, field_snapshot_new, process_stage) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'pending',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)",
        rusqlite::params![
            Uuid::new_v4().to_string(), demo_batch_id, "XT202505202",
            "文明城市创建复查报道", "error",
            None as Option<String>,
            "非法状态值：published",
            None as Option<String>
        ],
    )?;
    conn.execute(
        "INSERT INTO audit_logs (id, topic_id, import_batch_id, user_id, user_name, action, old_status, new_status, detail, created_at, decision_summary, process_stage, field_snapshot_old, field_snapshot_new) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,NULL,NULL,NULL,NULL)",
        rusqlite::params![
            Uuid::new_v4().to_string(), None as Option<String>, demo_batch_id,
            register_id, "张登记", "import_error",
            None as Option<String>, None as Option<String>,
            "离线台账回填失败：选题单 XT202505202，非法状态值：published",
            demo_import_time
        ],
    )?;

    Ok(())
}
