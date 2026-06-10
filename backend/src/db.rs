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

    // 样例申请数据
    // ============================================================
    // 1. 草稿（朝阳路店，缺全部凭证，v1）
    // ============================================================
    {
        let app_no = "RP2026060100001";
        let items = serde_json::json!([
            {"sku": "SKU001", "name": "矿泉水550ml", "quantity": 100, "unit": "瓶"},
            {"sku": "SKU002", "name": "方便面红烧牛肉", "quantity": 50, "unit": "袋"}
        ]).to_string();
        let ev_store: Option<&str> = None;
        let ev_delivery: Option<&str> = None;
        let ev_reg: Option<&str> = None;
        let remarks = Some("草稿状态，尚未填写凭证。登记员中途保存，待补全。".to_string());

        conn.execute(
            "INSERT INTO replenishment_applications 
             (application_no, store_id, status, current_version, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, created_by, updated_by)
             VALUES (?1, 1, 'draft', 1, ?2, ?3, ?4, ?5, ?6, 1, 1)",
            params![app_no, items, ev_store, ev_delivery, ev_reg, remarks],
        )?;
        let app_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 1, NULL, 'draft', ?2, ?3, ?4, ?5, ?6, 'create', 1)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks],
        )?;
    }

    // ============================================================
    // 2. 完整补正重提流程（中关村店，v5 reviewed状态，完整历史）
    //    v1 创建(draft) → v2 提交 → v3 审核驳回(needs_correction) 
    //    → v4 补正(保留needs_correction) → v5 重提 → v6 审核通过
    // ============================================================
    {
        let app_no = "RP2026060100002";
        let items_v1 = serde_json::json!([
            {"sku": "SKU003", "name": "牛奶250ml", "quantity": 80, "unit": "盒"},
            {"sku": "SKU004", "name": "面包全麦", "quantity": 30, "unit": "个"}
        ]).to_string();
        let items_v4 = serde_json::json!([
            {"sku": "SKU003", "name": "牛奶250ml", "quantity": 100, "unit": "盒"},
            {"sku": "SKU004", "name": "面包全麦", "quantity": 40, "unit": "个"},
            {"sku": "SKU004A", "name": "酸奶原味", "quantity": 50, "unit": "杯"}
        ]).to_string();

        let ev_store_v1: Option<&str> = Some("门店补货单-BJ002-0601-初版.jpg");
        let ev_delivery_v1: Option<&str> = None; // 故意缺失
        let ev_reg_v1: Option<&str> = Some("补货申请登记-BJ002-0601.png");

        let ev_store_v4: Option<&str> = Some("门店补货单-BJ002-0601-修正版.jpg");
        let ev_delivery_v4: Option<&str> = Some("配送确认单-PS20260601001.pdf");
        let ev_reg_v4: Option<&str> = Some("补货申请登记-BJ002-0601-更新版.png");

        let remarks_v1 = Some("中关村店日常补货，初版登记。".to_string());
        let remarks_v3 = Some("缺少配送确认单，请补正；商品数量建议调整并补充酸奶品类。".to_string());
        let remarks_v4 = Some("已补充配送确认单，牛奶数量调整为100盒，新增酸奶品类。".to_string());
        let remarks_v6 = Some("补正内容完整，审核通过。".to_string());

        // 当前状态 reviewed，版本 6
        conn.execute(
            "INSERT INTO replenishment_applications 
             (application_no, store_id, status, current_version, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, created_by, updated_by)
             VALUES (?1, 2, 'reviewed', 6, ?2, ?3, ?4, ?5, ?6, 1, 2)",
            params![app_no, items_v4, ev_store_v4, ev_delivery_v4, ev_reg_v4, remarks_v6],
        )?;
        let app_id = conn.last_insert_rowid();

        // v1: 创建 draft
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 1, NULL, 'draft', ?2, ?3, ?4, ?5, ?6, 'create', 1)",
            params![app_id, items_v1, ev_store_v1, ev_delivery_v1, ev_reg_v1, remarks_v1],
        )?;

        // v2: 提交 pending_review
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 2, 'draft', 'pending_review', ?2, ?3, ?4, ?5, ?6, 'submit', 1)",
            params![app_id, items_v1, ev_store_v1, ev_delivery_v1, ev_reg_v1, remarks_v1],
        )?;

        // v3: 审核驳回 needs_correction
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 3, 'pending_review', 'needs_correction', ?2, ?3, ?4, ?5, ?6, 'review_reject', 2)",
            params![app_id, items_v1, ev_store_v1, ev_delivery_v1, ev_reg_v1, remarks_v3],
        )?;

        // v4: 补正（状态保持 needs_correction）
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 4, 'needs_correction', 'needs_correction', ?2, ?3, ?4, ?5, ?6, 'correct', 1)",
            params![app_id, items_v4, ev_store_v4, ev_delivery_v4, ev_reg_v4, remarks_v4],
        )?;

        // v5: 重新提交 pending_review
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 5, 'needs_correction', 'pending_review', ?2, ?3, ?4, ?5, ?6, 'submit', 1)",
            params![app_id, items_v4, ev_store_v4, ev_delivery_v4, ev_reg_v4, remarks_v4],
        )?;

        // v6: 审核通过 reviewed
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 6, 'pending_review', 'reviewed', ?2, ?3, ?4, ?5, ?6, 'review_approve', 2)",
            params![app_id, items_v4, ev_store_v4, ev_delivery_v4, ev_reg_v4, remarks_v6],
        )?;
    }

    // ============================================================
    // 3. 已归档完整流程（南京路店，v7 archived）
    //    v1 张三创建 → v2 张三提交 → v3 李四审核驳回(洗衣液数量偏大)
    //    → v4 张三补正(确认数量)correct → v5 张三重提submit → v6 李四审核通过 → v7 王五复核归档
    // ============================================================
    {
        let app_no = "RP2026060100003";
        let items = serde_json::json!([
            {"sku": "SKU009", "name": "纸巾抽式", "quantity": 50, "unit": "包"},
            {"sku": "SKU010", "name": "洗衣液500ml", "quantity": 25, "unit": "瓶"}
        ]).to_string();
        let ev_store = Some("门店补货单-SH001-0530.jpg");
        let ev_delivery = Some("配送确认单-PS20260530001.pdf");
        let ev_reg = Some("补货申请登记-SH001-0530.png");
        let remarks_create = Some("南京路店月度常规补货。".to_string());
        let remarks_reject = Some("洗衣液数量偏大，请与门店确认是否误填，补正后重提。".to_string());
        let remarks_correct = Some("已致电南京路店店长王某某核实：月末促销备货，洗衣液25瓶确为实际需求。".to_string());
        let remarks_resubmit = Some("补正完成，重新提交审核。".to_string());
        let remarks_review = Some("已核实补正记录，材料齐全，审核通过。".to_string());
        let remarks_final = Some("流程合规，审核通过，已归档。".to_string());

        // 当前状态 archived，版本 7
        conn.execute(
            "INSERT INTO replenishment_applications 
             (application_no, store_id, status, current_version, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, created_by, updated_by)
             VALUES (?1, 4, 'archived', 7, ?2, ?3, ?4, ?5, ?6, 1, 3)",
            params![app_no, items, ev_store, ev_delivery, ev_reg, remarks_final],
        )?;
        let app_id = conn.last_insert_rowid();

        // v1: 张三创建 draft
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 1, NULL, 'draft', ?2, ?3, ?4, ?5, ?6, 'create', 1)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks_create],
        )?;
        // v2: 张三提交 pending_review
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 2, 'draft', 'pending_review', ?2, ?3, ?4, ?5, ?6, 'submit', 1)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks_create],
        )?;
        // v3: 李四审核驳回 needs_correction
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 3, 'pending_review', 'needs_correction', ?2, ?3, ?4, ?5, ?6, 'review_reject', 2)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks_reject],
        )?;
        // v4: 张三补正 correct（状态保持 needs_correction）
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 4, 'needs_correction', 'needs_correction', ?2, ?3, ?4, ?5, ?6, 'correct', 1)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks_correct],
        )?;
        // v5: 张三重提 pending_review
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 5, 'needs_correction', 'pending_review', ?2, ?3, ?4, ?5, ?6, 'submit', 1)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks_resubmit],
        )?;
        // v6: 李四审核通过 reviewed
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 6, 'pending_review', 'reviewed', ?2, ?3, ?4, ?5, ?6, 'review_approve', 2)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks_review],
        )?;
        // v7: 王五复核归档 archived
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 7, 'reviewed', 'archived', ?2, ?3, ?4, ?5, ?6, 'final_approve', 3)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks_final],
        )?;
    }

    // ============================================================
    // 4. 需补正状态（国贸店，v4，被连锁复核驳回）
    // ============================================================
    {
        let app_no = "RP2026060100004";
        let items = serde_json::json!([
            {"sku": "SKU005", "name": "薯片原味", "quantity": 60, "unit": "袋"},
            {"sku": "SKU006", "name": "巧克力牛奶", "quantity": 40, "unit": "块"}
        ]).to_string();
        let ev_store = Some("门店补货单-BJ003-0601.jpg");
        let ev_delivery: Option<&str> = None; // 复核后发现配送确认单过期
        let ev_reg = Some("补货申请登记-BJ003-0601.png");
        let remarks_final = Some("连锁复核发现配送确认单已过期，需重新提供最新版。".to_string());

        conn.execute(
            "INSERT INTO replenishment_applications 
             (application_no, store_id, status, current_version, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, created_by, updated_by)
             VALUES (?1, 3, 'needs_correction', 4, ?2, ?3, ?4, ?5, ?6, 1, 3)",
            params![app_no, items, ev_store, ev_delivery, ev_reg, remarks_final],
        )?;
        let app_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 1, NULL, 'draft', ?2, ?3, ?4, ?5, ?6, 'create', 1)",
            params![app_id, items, ev_store, Some("旧配送单-过期.pdf"), ev_reg, Some("周末促销补货".to_string())],
        )?;
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 2, 'draft', 'pending_review', ?2, ?3, ?4, ?5, ?6, 'submit', 1)",
            params![app_id, items, ev_store, Some("旧配送单-过期.pdf"), ev_reg, Some("周末促销补货".to_string())],
        )?;
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 3, 'pending_review', 'reviewed', ?2, ?3, ?4, ?5, ?6, 'review_approve', 2)",
            params![app_id, items, ev_store, Some("旧配送单-过期.pdf"), ev_reg, Some("材料齐全，审核通过。".to_string())],
        )?;
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 4, 'reviewed', 'needs_correction', ?2, ?3, ?4, ?5, ?6, 'final_reject', 3)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks_final],
        )?;
    }

    // ============================================================
    // 5. 待审核（陆家嘴店，v2 pending_review）
    // ============================================================
    {
        let app_no = "RP2026060100005";
        let items = serde_json::json!([
            {"sku": "SKU011", "name": "口香糖薄荷", "quantity": 200, "unit": "条"},
            {"sku": "SKU012", "name": "薄荷糖", "quantity": 150, "unit": "盒"}
        ]).to_string();
        let ev_store = Some("门店补货单-SH002-0601.jpg");
        let ev_delivery = Some("配送确认单-PS20260601003.pdf");
        let ev_reg = Some("补货申请登记-SH002-0601.png");
        let remarks = Some("陆家嘴店糖果类补货，夏季促销备货。".to_string());

        conn.execute(
            "INSERT INTO replenishment_applications 
             (application_no, store_id, status, current_version, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, created_by, updated_by)
             VALUES (?1, 5, 'pending_review', 2, ?2, ?3, ?4, ?5, ?6, 1, 1)",
            params![app_no, items, ev_store, ev_delivery, ev_reg, remarks],
        )?;
        let app_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 1, NULL, 'draft', ?2, ?3, ?4, ?5, ?6, 'create', 1)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks],
        )?;
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 2, 'draft', 'pending_review', ?2, ?3, ?4, ?5, ?6, 'submit', 1)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks],
        )?;
    }

    // ============================================================
    // 6. 审核通过待复核（五道口店不存在，用朝阳路店？不，只有5个门店。
    //    用 SH001 的另外一个？不，SH001 已归档了。让我用 BJ003（国贸店）做第二条。
    // ============================================================
    {
        let app_no = "RP2026060100006";
        let items = serde_json::json!([
            {"sku": "SKU014", "name": "冰淇淋香草味", "quantity": 80, "unit": "杯"},
            {"sku": "SKU015", "name": "冰淇淋巧克力味", "quantity": 70, "unit": "杯"}
        ]).to_string();
        let ev_store = Some("门店补货单-BJ003-0601-冰淇淋.jpg");
        let ev_delivery = Some("冷链配送确认-PS20260601002.pdf");
        let ev_reg = Some("补货登记-夏季冷饮备货.png");
        let remarks = Some("国贸店夏季冷饮集中补货，已审核通过，待连锁复核归档。".to_string());

        conn.execute(
            "INSERT INTO replenishment_applications 
             (application_no, store_id, status, current_version, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, created_by, updated_by)
             VALUES (?1, 3, 'reviewed', 3, ?2, ?3, ?4, ?5, ?6, 1, 2)",
            params![app_no, items, ev_store, ev_delivery, ev_reg, remarks],
        )?;
        let app_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 1, NULL, 'draft', ?2, ?3, ?4, ?5, ?6, 'create', 1)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, Some("国贸店夏季冷饮备货-草稿。".to_string())],
        )?;
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 2, 'draft', 'pending_review', ?2, ?3, ?4, ?5, ?6, 'submit', 1)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, Some("已补齐冷链凭证，提交审核。".to_string())],
        )?;
        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 3, 'pending_review', 'reviewed', ?2, ?3, ?4, ?5, ?6, 'review_approve', 2)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks],
        )?;
    }

    // ============================================================
    // 7. 草稿（中关村店第二条，v1，缺部分凭证）
    // ============================================================
    {
        let app_no = "RP2026060100007";
        let items = serde_json::json!([
            {"sku": "SKU013", "name": "酸奶原味", "quantity": 60, "unit": "杯"}
        ]).to_string();
        let ev_store = Some("门店补货单-BJ002-0602.jpg");
        let ev_delivery: Option<&str> = None;
        let ev_reg: Option<&str> = None;
        let remarks = Some("未完成草稿：仅填写门店补货凭证，配送和登记待补。".to_string());

        conn.execute(
            "INSERT INTO replenishment_applications 
             (application_no, store_id, status, current_version, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, created_by, updated_by)
             VALUES (?1, 2, 'draft', 1, ?2, ?3, ?4, ?5, ?6, 1, 1)",
            params![app_no, items, ev_store, ev_delivery, ev_reg, remarks],
        )?;
        let app_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO application_versions 
             (application_id, version, status_from, status_to, items, 
              evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
              remarks, action, performed_by)
             VALUES (?1, 1, NULL, 'draft', ?2, ?3, ?4, ?5, ?6, 'create', 1)",
            params![app_id, items, ev_store, ev_delivery, ev_reg, remarks],
        )?;
    }

    Ok(())
}

pub fn hash_password(password: &str) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())
}
