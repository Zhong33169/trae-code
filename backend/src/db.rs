use rusqlite::{params, Connection, Result};
use std::sync::Mutex;
use once_cell::sync::Lazy;

pub static DB_CONN: Lazy<Mutex<Connection>> = Lazy::new(|| {
    let conn = Connection::open("data/replenishment.db").expect("Failed to open database");
    conn.execute_batch("
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;
    ").unwrap();
    init_schema(&conn).expect("Failed to initialize schema");
    seed_data(&conn).expect("Failed to seed data");
    Mutex::new(conn)
});

fn init_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('registrar', 'reviewer', 'final_reviewer')),
            display_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS stores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_no TEXT UNIQUE NOT NULL,
            store_name TEXT NOT NULL,
            address TEXT
        );

        CREATE TABLE IF NOT EXISTS replenishment_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_no TEXT UNIQUE NOT NULL,
            store_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft' 
                CHECK (status IN ('draft', 'pending_review', 'reviewed', 'needs_correction', 'archived')),
            current_version INTEGER NOT NULL DEFAULT 1,
            items TEXT NOT NULL,
            evidence_store_replenishment TEXT,
            evidence_delivery_confirmation TEXT,
            evidence_registration TEXT,
            remarks TEXT,
            created_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_by INTEGER,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS application_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            version INTEGER NOT NULL,
            status_from TEXT,
            status_to TEXT NOT NULL,
            items TEXT,
            evidence_store_replenishment TEXT,
            evidence_delivery_confirmation TEXT,
            evidence_registration TEXT,
            remarks TEXT,
            action TEXT NOT NULL,
            performed_by INTEGER NOT NULL,
            performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (application_id) REFERENCES replenishment_applications(id),
            FOREIGN KEY (performed_by) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_applications_status ON replenishment_applications(status);
        CREATE INDEX IF NOT EXISTS idx_versions_app ON application_versions(application_id);
        "
    )?;
    Ok(())
}

fn seed_data(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(b"123456");
    let password_hash = format!("{:x}", hasher.finalize());

    conn.execute(
        "INSERT INTO users (username, password_hash, role, display_name) VALUES (?1, ?2, 'registrar', ?3)",
        params!["zhangsan", password_hash, "张三"],
    )?;

    conn.execute(
        "INSERT INTO users (username, password_hash, role, display_name) VALUES (?1, ?2, 'reviewer', ?3)",
        params!["lisi", password_hash, "李四"],
    )?;

    conn.execute(
        "INSERT INTO users (username, password_hash, role, display_name) VALUES (?1, ?2, 'final_reviewer', ?3)",
        params!["wangwu", password_hash, "王五"],
    )?;

    let stores = vec![
        ("BJ001", "朝阳路店", "北京市朝阳区朝阳路1号"),
        ("BJ002", "中关村店", "北京市海淀区中关村大街10号"),
        ("BJ003", "国贸店", "北京市朝阳区国贸中心B1层"),
        ("SH001", "南京路店", "上海市黄浦区南京东路100号"),
        ("SH002", "陆家嘴店", "上海市浦东新区陆家嘴环路50号"),
    ];

    for (no, name, addr) in stores {
        conn.execute(
            "INSERT INTO stores (store_no, store_name, address) VALUES (?1, ?2, ?3)",
            params![no, name, addr],
        )?;
    }

    let sample_apps = vec![
        (
            "RP2026060100001", 1, "draft", 1,
            serde_json::json!([
                {"sku": "SKU001", "name": "矿泉水550ml", "quantity": 100, "unit": "瓶"},
                {"sku": "SKU002", "name": "方便面红烧牛肉", "quantity": 50, "unit": "袋"}
            ]).to_string(),
            None, None, None,
            Some("草稿状态，尚未提交".to_string()),
            1,
        ),
        (
            "RP2026060100002", 2, "pending_review", 2,
            serde_json::json!([
                {"sku": "SKU003", "name": "牛奶250ml", "quantity": 80, "unit": "盒"},
                {"sku": "SKU004", "name": "面包全麦", "quantity": 30, "unit": "个"}
            ]).to_string(),
            Some("门店补货单-BJ002-0601.jpg"),
            Some("配送确认单-PS20260601001.pdf"),
            Some("补货申请登记-BJ002-0601.png"),
            Some("中关村店日常补货".to_string()),
            1,
        ),
        (
            "RP2026060100003", 1, "reviewed", 3,
            serde_json::json!([
                {"sku": "SKU005", "name": "薯片原味", "quantity": 60, "unit": "袋"},
                {"sku": "SKU006", "name": "巧克力牛奶", "quantity": 40, "unit": "块"}
            ]).to_string(),
            Some("门店补货单-BJ001-0601.jpg"),
            Some("配送确认单-PS20260601002.pdf"),
            Some("补货申请登记-BJ001-0601.png"),
            Some("朝阳路店周末促销补货".to_string()),
            1,
        ),
        (
            "RP2026060100004", 3, "needs_correction", 3,
            serde_json::json!([
                {"sku": "SKU007", "name": "可乐330ml", "quantity": 120, "unit": "罐"},
                {"sku": "SKU008", "name": "雪碧330ml", "quantity": 100, "unit": "罐"}
            ]).to_string(),
            Some("门店补货单-BJ003-0531.jpg"),
            None,
            Some("补货申请登记-BJ003-0531.png"),
            Some("缺少配送确认单，请补正后重新提交".to_string()),
            1,
        ),
        (
            "RP2026060100005", 4, "archived", 5,
            serde_json::json!([
                {"sku": "SKU009", "name": "纸巾抽式", "quantity": 50, "unit": "包"},
                {"sku": "SKU010", "name": "洗衣液500ml", "quantity": 25, "unit": "瓶"}
            ]).to_string(),
            Some("门店补货单-SH001-0530.jpg"),
            Some("配送确认单-PS20260530001.pdf"),
            Some("补货申请登记-SH001-0530.png"),
            Some("南京路店月度常规补货，已归档".to_string()),
            1,
        ),
        (
            "RP2026060100006", 5, "pending_review", 2,
            serde_json::json!([
                {"sku": "SKU011", "name": "口香糖薄荷", "quantity": 200, "unit": "条"},
                {"sku": "SKU012", "name": "薄荷糖", "quantity": 150, "unit": "盒"}
            ]).to_string(),
            Some("门店补货单-SH002-0601.jpg"),
            Some("配送确认单-PS20260601003.pdf"),
            Some("补货申请登记-SH002-0601.png"),
            Some("陆家嘴店糖果类补货".to_string()),
            1,
        ),
        (
            "RP2026060100007", 2, "draft", 1,
            serde_json::json!([
                {"sku": "SKU013", "name": "酸奶原味", "quantity": 60, "unit": "杯"}
            ]).to_string(),
            None, None, None,
            Some("未完成的草稿，缺少凭证".to_string()),
            1,
        ),
    ];

    for (app_no, store_id, status, version, items, ev_store, ev_delivery, ev_reg, remarks, created_by) in sample_apps {
        conn.execute(
            "INSERT INTO replenishment_applications 
             (application_no, store_id, status, current_version, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, created_by, updated_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
            params![app_no, store_id, status, version, items, ev_store, ev_delivery, ev_reg, remarks, created_by],
        )?;

        let app_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 1, NULL, 'draft', ?2, ?3, ?4, ?5, ?6, 'create', ?7)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks, created_by],
        )?;

        if status != "draft" {
            let action = match status {
                "pending_review" => "submit",
                "reviewed" => "review_approve",
                "needs_correction" => "review_reject",
                "archived" => "final_approve",
                _ => "create",
            };
            let performed_by = match status {
                "pending_review" => created_by,
                "reviewed" => 2,
                "needs_correction" => 2,
                "archived" => 3,
                _ => created_by,
            };

            if version >= 2 {
                conn.execute(
                    "INSERT INTO application_versions 
                     (application_id, version, status_from, status_to, items, 
                      evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
                      remarks, action, performed_by)
                     VALUES (?1, 2, 'draft', 'pending_review', ?2, ?3, ?4, ?5, ?6, 'submit', ?7)",
                    params![app_id, items, ev_store, ev_delivery, ev_reg, remarks, created_by],
                )?;
            }

            if version >= 3 && (status == "reviewed" || status == "needs_correction") {
                let new_status = if status == "reviewed" { "reviewed" } else { "needs_correction" };
                let act = if status == "reviewed" { "review_approve" } else { "review_reject" };
                conn.execute(
                    "INSERT INTO application_versions 
                     (application_id, version, status_from, status_to, items, 
                      evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
                      remarks, action, performed_by)
                     VALUES (?1, 3, 'pending_review', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![app_id, new_status, items, ev_store, ev_delivery, ev_reg, remarks, act, 2],
                )?;
            }

            if version >= 4 && status == "needs_correction" {
                conn.execute(
                    "INSERT INTO application_versions 
                     (application_id, version, status_from, status_to, items, 
                      evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
                      remarks, action, performed_by)
                     VALUES (?1, 4, 'needs_correction', 'pending_review', ?2, ?3, ?4, ?5, ?6, 'correct', ?7)",
                    params![app_id, items, ev_store, ev_delivery, ev_reg, remarks, created_by],
                )?;
            }

            if version >= 5 && status == "archived" {
                conn.execute(
                    "INSERT INTO application_versions 
                     (application_id, version, status_from, status_to, items, 
                      evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
                      remarks, action, performed_by)
                     VALUES (?1, 3, 'pending_review', 'reviewed', ?2, ?3, ?4, ?5, ?6, 'review_approve', ?7)",
                    params![app_id, items, ev_store, ev_delivery, ev_reg, remarks, 2],
                )?;
                conn.execute(
                    "INSERT INTO application_versions 
                     (application_id, version, status_from, status_to, items, 
                      evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
                      remarks, action, performed_by)
                     VALUES (?1, 5, 'reviewed', 'archived', ?2, ?3, ?4, ?5, ?6, 'final_approve', ?7)",
                    params![app_id, items, ev_store, ev_delivery, ev_reg, remarks, 3],
                )?;
            }
        }
    }

    Ok(())
}

pub fn hash_password(password: &str) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())
}
