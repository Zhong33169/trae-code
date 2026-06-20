use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rocket::State;
use std::fs;

pub type DbPool = Pool<SqliteConnectionManager>;

pub async fn init_db(rocket: rocket::Rocket<rocket::Build>) -> rocket::Rocket<rocket::Build> {
    let manager = SqliteConnectionManager::file("scf_platform.db");
    let pool = Pool::new(manager).expect("Failed to create DB pool");

    {
        let conn = pool.get().expect("Failed to get DB connection");
        let schema = fs::read_to_string("schema.sql").expect("Failed to read schema.sql");
        conn.execute_batch(&schema).expect("Failed to init schema");
    }

    seed_data(&pool);

    rocket.manage(pool)
}

fn seed_data(pool: &DbPool) {
    let conn = pool.get().expect("Failed to get connection");

    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM roles", [], |row| row.get(0))
        .unwrap_or(0);

    if count > 0 {
        return;
    }

    conn.execute_batch(
        r#"
        INSERT INTO roles (role_code, role_name, description) VALUES
        ('registrar', '应收确权登记员', '负责发起和补正确权登记'),
        ('auditor', '应收确权审核主管', '负责审核确权登记'),
        ('reviewer', '平台复核负责人', '负责最终复核归档');

        INSERT INTO users (username, password_hash, real_name, role_id, status) VALUES
        ('registrar01', '$2b$12$7Hk5J4L6M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1A2B3C4D5E6F7G8H9', '张登记', 1, 1),
        ('auditor01', '$2b$12$7Hk5J4L6M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1A2B3C4D5E6F7G8H9', '李审核', 2, 1),
        ('reviewer01', '$2b$12$7Hk5J4L6M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1A2B3C4D5E6F7G8H9', '王复核', 3, 1);

        INSERT INTO accounts_receivable (ar_no, buyer_name, supplier_name, amount, invoice_no, invoice_date, due_date, status, remark, created_by) VALUES
        ('AR2025060001', '上海贸易有限公司', '深圳制造集团', 500000.00, 'INV20250601', '2025-06-01', '2025-09-01', 'confirmed', '常规贸易应收', 1),
        ('AR2025060002', '北京科技公司', '广州电子厂', 1200000.00, 'INV20250602', '2025-06-05', '2025-10-05', 'pending', '电子元器件采购', 1),
        ('AR2025060003', '杭州电商平台', '东莞服装工厂', 800000.00, 'INV20250603', '2025-06-10', '2025-09-10', 'pending', '夏季服装订单', 1),
        ('AR2025060004', '南京物流公司', '苏州包装材料', 350000.00, 'INV20250604', '2025-06-12', '2025-08-12', 'confirmed', '包装材料供应', 1),
        ('AR2025060005', '成都食品集团', '武汉农产品', 920000.00, 'INV20250605', '2025-06-15', '2025-11-15', 'pending', '农产品采购', 1);

        INSERT INTO confirmation_orders (order_no, ar_id, ar_no, buyer_name, supplier_name, amount, confirm_amount, status, current_handler_role, reject_reason, advance_reason, shift, handover_from, handover_to, handover_time, created_by) VALUES
        ('CO2025060001', 1, 'AR2025060001', '上海贸易有限公司', '深圳制造集团', 500000.00, 500000.00, 'archived', 'reviewer', NULL, '材料齐全，确权无误', '早班', 1, 2, '2025-06-16 09:00:00', 1),
        ('CO2025060002', 2, 'AR2025060002', '北京科技公司', '广州电子厂', 1200000.00, NULL, 'pending_audit', 'auditor', NULL, '合同发票一致', '中班', 1, 2, '2025-06-18 14:30:00', 1),
        ('CO2025060003', 4, 'AR2025060004', '南京物流公司', '苏州包装材料', 350000.00, 350000.00, 'pending_review', 'reviewer', NULL, '审核通过', '晚班', 2, 3, '2025-06-19 20:15:00', 1),
        ('CO2025060004', 3, 'AR2025060003', '杭州电商平台', '东莞服装工厂', 800000.00, NULL, 'returned', 'registrar', '发票金额与合同不符，请补正', NULL, NULL, NULL, NULL, NULL, 1);

        INSERT INTO payment_verifications (verify_no, order_id, order_no, payment_amount, payment_date, payer_name, bank_slip_no, remark, status, created_by) VALUES
        ('PV2025060001', 1, 'CO2025060001', 500000.00, '2025-08-28', '上海贸易有限公司', 'BK20250828001', '提前回款，已核销', 'verified', 3);

        INSERT INTO operation_logs (user_id, user_name, action, target_type, target_id, target_no, from_status, to_status, remark, ip_address) VALUES
        (1, '张登记', '创建', 'confirmation_order', 1, 'CO2025060001', 'draft', 'pending_audit', '提交确权申请', '192.168.1.10'),
        (2, '李审核', '审核通过', 'confirmation_order', 1, 'CO2025060001', 'pending_audit', 'pending_review', '材料核实无误', '192.168.1.11'),
        (3, '王复核', '复核归档', 'confirmation_order', 1, 'CO2025060001', 'pending_review', 'archived', '归档完成', '192.168.1.12'),
        (1, '张登记', '创建', 'confirmation_order', 2, 'CO2025060002', 'draft', 'pending_audit', '提交确权申请', '192.168.1.10');
        "#,
    )
    .expect("Failed to seed data");

    // 修复密码哈希为真实可用的值
    let pw = bcrypt::hash("123456", 12).unwrap();
    conn.execute(
        "UPDATE users SET password_hash = ?1",
        rusqlite::params![pw],
    )
    .ok();
}

pub fn get_pool(state: &State<DbPool>) -> &DbPool {
    state.inner()
}
