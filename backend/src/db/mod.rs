use rusqlite::{Connection, Result, params};
use std::sync::Mutex;
use argon2::{Argon2, PasswordHasher, password_hash::{SaltString, rand_core::OsRng}};

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    pub fn init_schema(&self) -> Result<()> {
        let schema = include_str!("schema.sql");
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(schema)?;
        Ok(())
    }

    pub fn seed_data(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        let pwd_hash = hash_password("123456");

        conn.execute(
            "INSERT OR IGNORE INTO users (id, username, password_hash, role, name) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![1, "registrar1", &pwd_hash, "registrar", "张登记员"],
        )?;
        conn.execute(
            "INSERT OR IGNORE INTO users (id, username, password_hash, role, name) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![2, "auditor1", &pwd_hash, "auditor", "李审核主管"],
        )?;
        conn.execute(
            "INSERT OR IGNORE INTO users (id, username, password_hash, role, name) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![3, "reviewer1", &pwd_hash, "reviewer", "王复核负责人"],
        )?;

        let ticket_sql = "INSERT OR IGNORE INTO complaint_tickets
            (id, ticket_no, title, content, complainant, contact, status, priority, source,
             is_exception, exception_reason, deadline, created_by, handler_id, reviewer_id,
             result_summary, return_reason, audit_remark)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)";

        conn.execute(ticket_sql, params![
            1, "TS202606001", "家政服务人员迟到问题", "预约上午9点上门服务，结果10点半才到，影响当天安排。",
            "陈先生", Some("13800138001"), "pending_audit", "normal", "online",
            0, None as Option<String>, Some("2026-06-25 18:00:00"),
            1, None as Option<i64>, None as Option<i64>,
            None as Option<String>, None as Option<String>, None as Option<String>
        ])?;

        conn.execute(ticket_sql, params![
            2, "TS202606002", "保洁服务质量不满意", "家政阿姨打扫不干净，厨房油污还有残留，要求重新服务。",
            "刘女士", Some("13900139002"), "processing", "high", "phone",
            0, None as Option<String>, Some("2026-06-22 18:00:00"),
            1, Some(2), None as Option<i64>,
            Some("已联系服务站站长，安排重新上门保洁。"), None as Option<String>, None as Option<String>
        ])?;

        conn.execute(ticket_sql, params![
            3, "TS202606003", "保姆私自调整服务时间", "保姆未经同意将服务时间从下午改到上午，造成家中无人。",
            "赵先生", Some("13700137003"), "pending_review", "normal", "online",
            0, None as Option<String>, Some("2026-06-23 18:00:00"),
            1, Some(2), None as Option<i64>,
            Some("已对保姆进行批评教育，扣除当月奖金50元，赠送客户一次免费深度保洁。客户表示接受。"),
            None as Option<String>, Some("处理及时，客户满意。")
        ])?;

        conn.execute(ticket_sql, params![
            4, "TS202606004", "月嫂专业技能不足", "雇佣的月嫂不会给新生儿洗澡，换尿布也不熟练，要求更换。",
            "孙女士", Some("13600136004"), "archived", "high", "online",
            0, None as Option<String>, Some("2026-06-15 18:00:00"),
            1, Some(2), Some(3),
            Some("已为客户更换资深月嫂，并退还30%服务费作为补偿。"),
            None as Option<String>, Some("复核通过，处理流程规范，客户反馈良好。")
        ])?;

        conn.execute(ticket_sql, params![
            5, "TS202606005", "家电清洗损坏财物", "清洗空调时弄坏了客厅灯罩，要求赔偿。",
            "周先生", Some("13500135005"), "returned", "high", "online",
            1, Some("缺少损坏物品照片及购买凭证"), Some("2026-06-28 18:00:00"),
            1, Some(2), None as Option<i64>,
            None as Option<String>,
            Some("缺少损坏物品现场照片及购买凭证，请补充材料后重新提交。"),
            None as Option<String>
        ])?;

        conn.execute(ticket_sql, params![
            6, "TS202606006", "搬家服务物品损坏", "搬家过程中衣柜被刮花，镜子碎了一面，要求赔偿。",
            "吴女士", Some("13400134006"), "pending_audit", "urgent", "phone",
            1, Some("工单已超时未处理"), Some("2026-06-18 18:00:00"),
            1, None as Option<i64>, None as Option<i64>,
            None as Option<String>, None as Option<String>, None as Option<String>
        ])?;

        conn.execute(ticket_sql, params![
            7, "TS202606007", "育儿嫂服务态度差", "育儿嫂对孩子不耐烦，经常玩手机不专心。",
            "郑先生", Some("13300133007"), "returned", "high", "online",
            1, Some("复核退回，处理结果不充分"), Some("2026-06-26 18:00:00"),
            1, Some(2), None as Option<i64>,
            Some("已批评教育育儿嫂。"),
            Some("仅批评教育不足以解决问题，请重新评估处理方案，给出具体改进措施和对客户的补偿方案。"),
            Some("第一次审核通过，但复核认为处理力度不够，退回重办。")
        ])?;

        conn.execute(ticket_sql, params![
            8, "TS202606008", "钟点工做饭不合口味", "钟点工做的饭菜味道不好，老人孩子都不爱吃。",
            "冯女士", Some("13200132008"), "draft", "low", "online",
            0, None as Option<String>, Some("2026-06-30 18:00:00"),
            1, None as Option<i64>, None as Option<i64>,
            None as Option<String>, None as Option<String>, None as Option<String>
        ])?;

        let attach_sql = "INSERT OR IGNORE INTO ticket_attachments (id, ticket_id, filename, file_path, file_size, uploaded_by)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)";
        conn.execute(attach_sql, params![1, 1, "预约记录截图.png", "/uploads/1/appointment.png", 102400, 1])?;
        conn.execute(attach_sql, params![2, 4, "服务评价表.pdf", "/uploads/4/evaluation.pdf", 204800, 1])?;
        conn.execute(attach_sql, params![3, 5, "初步描述.txt", "/uploads/5/description.txt", 1024, 1])?;

        let audit_sql = "INSERT OR IGNORE INTO audit_logs (id, ticket_id, user_id, action, detail, is_failure, failure_reason)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)";
        conn.execute(audit_sql, params![1, Some(1), 1, "create_ticket", Some("创建投诉工单"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![2, Some(2), 1, "create_ticket", Some("创建投诉工单"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![3, Some(2), 2, "start_process", Some("审核主管开始办理"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![4, Some(3), 1, "create_ticket", Some("创建投诉工单"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![5, Some(3), 2, "start_process", Some("审核主管开始办理"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![6, Some(3), 2, "submit_review", Some("提交复核"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![7, Some(4), 1, "create_ticket", Some("创建投诉工单"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![8, Some(4), 2, "start_process", Some("审核主管开始办理"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![9, Some(4), 2, "submit_review", Some("提交复核"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![10, Some(4), 3, "archive", Some("复核通过，归档"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![11, Some(5), 1, "create_ticket", Some("创建投诉工单"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![12, Some(5), 2, "return_ticket_auditor", Some("退回补正：缺少材料"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![13, Some(6), 1, "create_ticket", Some("创建投诉工单"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![14, Some(7), 1, "create_ticket", Some("创建投诉工单"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![15, Some(7), 2, "start_process", Some("审核主管开始办理"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![16, Some(7), 2, "submit_review", Some("提交复核"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![17, Some(7), 3, "return_ticket_reviewer", Some("复核退回：处理结果不充分"), 0, None as Option<String>])?;
        conn.execute(audit_sql, params![18, Some(8), 1, "create_ticket", Some("创建草稿工单"), 0, None as Option<String>])?;

        conn.execute(
            "INSERT OR IGNORE INTO import_batches (id, batch_no, source, total_count, success_count, fail_count, imported_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![1, "BATCH20260601", "offline_excel", 5, 3, 2, 1],
        )?;

        let record_sql = "INSERT OR IGNORE INTO import_records (id, batch_id, ticket_id, original_ticket_no, original_data, status, diff_detail, error_message)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)";
        conn.execute(record_sql, params![1, 1, None as Option<i64>, "OFF-001", Some(r#"{"title":"测试导入1"}"#), "success", None as Option<String>, None as Option<String>])?;
        conn.execute(record_sql, params![2, 1, None as Option<i64>, "OFF-002", Some(r#"{"title":"测试导入2"}"#), "duplicate", None as Option<String>, Some("工单号已存在")])?;
        conn.execute(record_sql, params![3, 1, None as Option<i64>, "OFF-003", Some(r#"{"title":"测试导入3"}"#), "conflict", Some("状态不一致"), Some("线上状态与线下状态冲突")])?;
        conn.execute(record_sql, params![4, 1, None as Option<i64>, "OFF-004", Some(r#"{"title":"测试导入4"}"#), "failed", None as Option<String>, Some("数据格式错误")])?;
        conn.execute(record_sql, params![5, 1, None as Option<i64>, "OFF-005", Some(r#"{"title":"测试导入5"}"#), "success", None as Option<String>, None as Option<String>])?;

        Ok(())
    }

    pub fn init_and_seed(&self) -> Result<()> {
        self.init_schema()?;
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM complaint_tickets",
            [],
            |row| row.get(0),
        )?;
        drop(conn);
        if count == 0 {
            self.seed_data()?;
        }
        Ok(())
    }
}

pub fn init_db(db_path: &str) -> Result<Database> {
    let db = Database::new(db_path)?;
    db.init_and_seed()?;
    Ok(db)
}

fn hash_password(password: &str) -> String {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2.hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .unwrap_or_default()
}
