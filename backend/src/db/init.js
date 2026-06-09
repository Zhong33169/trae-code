const { getDb } = require('./index');
const config = require('../config');

const init = async () => {
  console.log('正在初始化数据库...');
  const db = await getDb();

  const createTables = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      store_id TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'branch',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS prescription_orders (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL UNIQUE,
      patient_name TEXT NOT NULL,
      patient_phone TEXT,
      drug_name TEXT NOT NULL,
      drug_spec TEXT,
      quantity INTEGER NOT NULL,
      risk_level TEXT NOT NULL DEFAULT 'low',
      status TEXT NOT NULL DEFAULT 'draft',
      current_handler TEXT,
      current_handler_role TEXT,
      store_id TEXT NOT NULL,
      registrar_id TEXT NOT NULL,
      auditor_id TEXT,
      reviewer_id TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      deadline TEXT,
      last_opinion TEXT,
      last_result TEXT,
      last_handler TEXT,
      last_handler_role TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS evidences (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT,
      uploaded_by TEXT,
      uploaded_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      action TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      opinion TEXT,
      result TEXT,
      version_from INTEGER,
      version_to INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status ON prescription_orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_risk ON prescription_orders(risk_level);
    CREATE INDEX IF NOT EXISTS idx_orders_store ON prescription_orders(store_id);
    CREATE INDEX IF NOT EXISTS idx_logs_order ON operation_logs(order_id);
    CREATE INDEX IF NOT EXISTS idx_evidences_order ON evidences(order_id);
  `;

  db.exec(createTables);
  db.saveToDisk();
  console.log('数据表创建完成');

  const stores = [
    { id: 'store-hq', name: '连锁药房总店', type: 'headquarters' },
    { id: 'store-001', name: '连锁药房朝阳店', type: 'branch' },
    { id: 'store-002', name: '连锁药房海淀店', type: 'branch' }
  ];

  const storeStmt = db.prepare('INSERT OR IGNORE INTO stores (id, name, type) VALUES (?, ?, ?)');
  stores.forEach(s => storeStmt.run(s.id, s.name, s.type));
  db.saveToDisk();
  console.log('门店数据初始化完成');

  const users = [
    { id: 'user-reg-1', name: '李登记', role: 'registrar', store_id: 'store-001' },
    { id: 'user-reg-2', name: '王登记', role: 'registrar', store_id: 'store-002' },
    { id: 'user-aud-1', name: '张审核', role: 'auditor', store_id: 'store-001' },
    { id: 'user-aud-2', name: '刘审核', role: 'auditor', store_id: 'store-002' },
    { id: 'user-rev-1', name: '陈复核', role: 'reviewer', store_id: 'store-hq' }
  ];

  const userStmt = db.prepare('INSERT OR IGNORE INTO users (id, name, role, store_id) VALUES (?, ?, ?, ?)');
  users.forEach(u => userStmt.run(u.id, u.name, u.role, u.store_id));
  db.saveToDisk();
  console.log('用户数据初始化完成');

  const orders = [
    ['order-001', 'RX20260601001', '张三', '13800138001', '阿莫西林胶囊', '0.25g*24粒', 2, 'low', 'pending_audit', 'user-aud-1', 'auditor', 'store-001', 'user-reg-1', null, null, null, null, null, '李登记', 'registrar', 1],
    ['order-002', 'RX20260601002', '李四', '13800138002', '头孢克肟分散片', '0.1g*6片', 3, 'medium', 'pending_audit', 'user-aud-1', 'auditor', 'store-001', 'user-reg-1', null, null, null, null, null, '李登记', 'registrar', 1],
    ['order-003', 'RX20260601003', '王五', '13800138003', '阿奇霉素片', '0.25g*6片', 1, 'high', 'pending_audit', 'user-aud-1', 'auditor', 'store-001', 'user-reg-1', null, null, '2026-06-10 18:00:00', null, null, '李登记', 'registrar', 1],
    ['order-004', 'RX20260601004', '赵六', '13800138004', '左氧氟沙星片', '0.5g*4片', 2, 'high', 'returned', 'user-reg-1', 'registrar', 'store-001', 'user-reg-1', 'user-aud-1', null, null, '缺少处方原件照片，且患者身份证信息不完整，请补正后重新提交', 'returned', '张审核', 'auditor', 2],
    ['order-005', 'RX20260601005', '钱七', '13800138005', '罗红霉素胶囊', '0.15g*12粒', 1, 'medium', 'pending_review', 'user-rev-1', 'reviewer', 'store-001', 'user-reg-1', 'user-aud-1', null, null, '处方真实有效，证据齐全，审核通过', 'passed', '张审核', 'auditor', 1],
    ['order-006', 'RX20260601006', '孙八', '13800138006', '布洛芬缓释胶囊', '0.3g*20粒', 1, 'low', 'archived', null, null, 'store-001', 'user-reg-1', 'user-aud-1', 'user-rev-1', null, '复核通过，归档保存', 'archived', '陈复核', 'reviewer', 1],
    ['order-007', 'RX20260601007', '周九', '13800138007', '盐酸二甲双胍片', '0.5g*30片', 2, 'medium', 'overdue', 'user-aud-2', 'auditor', 'store-002', 'user-reg-2', null, null, '2026-06-01 18:00:00', null, null, '王登记', 'registrar', 1],
    ['order-008', 'RX20260601008', '吴十', '13800138008', '缬沙坦胶囊', '80mg*7粒', 4, 'high', 'auditing', 'user-aud-2', 'auditor', 'store-002', 'user-reg-2', null, null, '2026-06-15 18:00:00', null, null, '王登记', 'registrar', 1],
    ['order-009', 'RX20260601009', '郑十一', '13800138009', '硝苯地平控释片', '30mg*7片', 2, 'low', 'draft', 'user-reg-2', 'registrar', 'store-002', 'user-reg-2', null, null, null, null, null, null, null, 1],
    ['order-010', 'RX20260601010', '冯十二', '13800138010', '阿托伐他汀钙片', '20mg*7片', 3, 'medium', 'rejected', null, null, 'store-002', 'user-reg-2', 'user-aud-2', 'user-rev-1', null, '处方疑似伪造，药品与诊断不符，不予通过', 'rejected', '陈复核', 'reviewer', 2]
  ];

  const orderStmt = db.prepare(`
    INSERT OR IGNORE INTO prescription_orders
    (id, order_no, patient_name, patient_phone, drug_name, drug_spec, quantity,
     risk_level, status, current_handler, current_handler_role, store_id,
     registrar_id, auditor_id, reviewer_id, deadline, last_opinion, last_result,
     last_handler, last_handler_role, version)
    VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  orders.forEach(o => orderStmt.run(...o));
  db.saveToDisk();
  console.log('处方订单样例数据初始化完成');

  const evidences = [
    ['ev-001', 'order-001', 'prescription', '处方单照片.jpg', 'user-reg-1'],
    ['ev-002', 'order-001', 'id_card', '患者身份证.jpg', 'user-reg-1'],
    ['ev-003', 'order-002', 'prescription', '处方单照片.jpg', 'user-reg-1'],
    ['ev-004', 'order-002', 'medical_record', '门诊病历.pdf', 'user-reg-1'],
    ['ev-005', 'order-003', 'prescription', '处方单照片.jpg', 'user-reg-1'],
    ['ev-006', 'order-003', 'id_card', '患者身份证.jpg', 'user-reg-1'],
    ['ev-007', 'order-003', 'insurance_card', '医保卡照片.jpg', 'user-reg-1'],
    ['ev-008', 'order-005', 'prescription', '处方单照片.jpg', 'user-reg-1'],
    ['ev-009', 'order-005', 'id_card', '患者身份证.jpg', 'user-reg-1'],
    ['ev-010', 'order-005', 'medical_record', '诊断证明.jpg', 'user-reg-1'],
    ['ev-011', 'order-006', 'prescription', '处方单照片.jpg', 'user-reg-1'],
    ['ev-012', 'order-006', 'id_card', '患者身份证.jpg', 'user-reg-1'],
    ['ev-013', 'order-007', 'prescription', '处方单照片.jpg', 'user-reg-2'],
    ['ev-014', 'order-008', 'prescription', '处方单照片.jpg', 'user-reg-2'],
    ['ev-015', 'order-008', 'id_card', '患者身份证.jpg', 'user-reg-2'],
    ['ev-016', 'order-010', 'prescription', '处方单照片.jpg', 'user-reg-2']
  ];

  const evStmt = db.prepare(`
    INSERT OR IGNORE INTO evidences (id, order_id, type, name, uploaded_by)
    VALUES (?, ?, ?, ?, ?)
  `);

  evidences.forEach(e => evStmt.run(...e));
  db.saveToDisk();
  console.log('证据附件样例数据初始化完成');

  const logs = [
    ['log-001', 'order-001', 'submit', 'user-reg-1', '李登记', 'registrar', 'draft', 'pending_audit', '处方信息已录入，请审核', 'submitted', 1, 1],
    ['log-002', 'order-002', 'submit', 'user-reg-1', '李登记', 'registrar', 'draft', 'pending_audit', '处方信息已录入，请审核', 'submitted', 1, 1],
    ['log-003', 'order-003', 'submit', 'user-reg-1', '李登记', 'registrar', 'draft', 'pending_audit', '高风险处方，请优先审核', 'submitted', 1, 1],
    ['log-004', 'order-004', 'submit', 'user-reg-1', '李登记', 'registrar', 'draft', 'pending_audit', '处方信息已录入，请审核', 'submitted', 1, 1],
    ['log-005', 'order-004', 'return', 'user-aud-1', '张审核', 'auditor', 'pending_audit', 'returned', '缺少处方原件照片，且患者身份证信息不完整，请补正后重新提交', 'returned', 1, 2],
    ['log-006', 'order-005', 'submit', 'user-reg-1', '李登记', 'registrar', 'draft', 'pending_audit', '处方信息已录入，请审核', 'submitted', 1, 1],
    ['log-007', 'order-005', 'audit_pass', 'user-aud-1', '张审核', 'auditor', 'pending_audit', 'pending_review', '处方真实有效，证据齐全，审核通过', 'passed', 1, 1],
    ['log-008', 'order-006', 'submit', 'user-reg-1', '李登记', 'registrar', 'draft', 'pending_audit', '处方信息已录入，请审核', 'submitted', 1, 1],
    ['log-009', 'order-006', 'audit_pass', 'user-aud-1', '张审核', 'auditor', 'pending_audit', 'pending_review', '审核通过，请复核', 'passed', 1, 1],
    ['log-010', 'order-006', 'review_archive', 'user-rev-1', '陈复核', 'reviewer', 'pending_review', 'archived', '复核通过，归档保存', 'archived', 1, 1],
    ['log-011', 'order-007', 'submit', 'user-reg-2', '王登记', 'registrar', 'draft', 'pending_audit', '处方信息已录入，请审核', 'submitted', 1, 1],
    ['log-012', 'order-008', 'submit', 'user-reg-2', '王登记', 'registrar', 'draft', 'pending_audit', '高风险处方，请优先审核', 'submitted', 1, 1],
    ['log-013', 'order-008', 'start_audit', 'user-aud-2', '刘审核', 'auditor', 'pending_audit', 'auditing', null, 'processing', 1, 1],
    ['log-014', 'order-010', 'submit', 'user-reg-2', '王登记', 'registrar', 'draft', 'pending_audit', '处方信息已录入，请审核', 'submitted', 1, 1],
    ['log-015', 'order-010', 'audit_pass', 'user-aud-2', '刘审核', 'auditor', 'pending_audit', 'pending_review', '审核通过，请复核', 'passed', 1, 1],
    ['log-016', 'order-010', 'review_reject', 'user-rev-1', '陈复核', 'reviewer', 'pending_review', 'rejected', '处方疑似伪造，药品与诊断不符，不予通过', 'rejected', 1, 2]
  ];

  const logStmt = db.prepare(`
    INSERT OR IGNORE INTO operation_logs
    (id, order_id, action, operator_id, operator_name, operator_role,
     from_status, to_status, opinion, result, version_from, version_to)
    VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  logs.forEach(l => logStmt.run(...l));
  db.saveToDisk();
  console.log('操作日志样例数据初始化完成');

  console.log('\n✅ 数据库初始化完成！');
  console.log(`📍 数据库路径: ${config.db.path}`);
};

init().catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
