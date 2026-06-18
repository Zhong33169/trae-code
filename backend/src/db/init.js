import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'meter_replacement.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.pragma('foreign_keys = OFF');
db.exec(`
  DROP TABLE IF EXISTS audit_logs;
  DROP TABLE IF EXISTS process_records;
  DROP TABLE IF EXISTS attachments;
  DROP TABLE IF EXISTS applications;
  DROP TABLE IF EXISTS offline_ledger;
  DROP TABLE IF EXISTS users;
`);
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    batch_no TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    old_meter_no TEXT NOT NULL,
    new_meter_no TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    operator_id INTEGER,
    reviewer_id INTEGER,
    archivist_id INTEGER,
    offline_ledger_backfilled INTEGER DEFAULT 0,
    offline_ledger_failure_reason TEXT,
    audit_remark TEXT,
    is_timeout INTEGER DEFAULT 0,
    sla_due_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (operator_id) REFERENCES users(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id),
    FOREIGN KEY (archivist_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    uploaded_by INTEGER NOT NULL,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS process_records (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    actor_id INTEGER NOT NULL,
    review_comment TEXT,
    reject_reason TEXT,
    result TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (actor_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    application_id TEXT,
    user_id INTEGER NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    failure_reason TEXT,
    remark TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS offline_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT NOT NULL,
    meter_no TEXT NOT NULL,
    replacement_date TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    remark TEXT,
    UNIQUE(batch_no, meter_no)
  );
`);

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, username, name, role) VALUES (?, ?, ?, ?)
`);
const users = [
  [1, 'meter_operator', '张三', 'meter_operator'],
  [2, 'meter_supervisor', '李四', 'meter_supervisor'],
  [3, 'gas_archivist', '王五', 'gas_archivist']
];
users.forEach(u => insertUser.run(...u));

const insertLedger = db.prepare(`
  INSERT OR IGNORE INTO offline_ledger (batch_no, meter_no, replacement_date, status, remark) VALUES (?, ?, ?, ?, ?)
`);
const ledgerData = [
  ['BATCH202501001', 'OLD-001', '2025-01-15', 'completed', '正常已换表'],
  ['BATCH202501001', 'OLD-002', '2025-01-15', 'completed', '正常已换表'],
  ['BATCH202501002', 'OLD-003', '2025-01-16', 'completed', '正常已换表'],
  ['BATCH202501003', 'OLD-005', '2025-01-17', 'completed', '正常已换表'],
  ['BATCH202501004', 'OLD-004', '2025-01-18', 'completed', '正常已换表'],
  ['BATCH202501006', 'OLD-006', '2025-01-20', 'completed', '正常已换表（超时单对应台账）'],
  ['BATCH202501008', 'OLD-008', null, 'rejected', '线下已判定该表号无需更换，已作废'],
  ['BATCH202501009', 'OLD-009', '2025-01-22', 'completed', '正常已换表']
];
ledgerData.forEach(d => insertLedger.run(...d));

const insertApp = db.prepare(`
  INSERT OR IGNORE INTO applications (
    id, batch_no, customer_name, customer_address, old_meter_no, new_meter_no,
    reason, status, operator_id, reviewer_id, archivist_id,
    offline_ledger_backfilled, offline_ledger_failure_reason, audit_remark,
    is_timeout, sla_due_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertProcess = db.prepare(`
  INSERT OR IGNORE INTO process_records (id, application_id, action, actor_role, actor_id, review_comment, reject_reason, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertAttachment = db.prepare(`
  INSERT OR IGNORE INTO attachments (id, application_id, filename, file_type, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)
`);
const insertAudit = db.prepare(`
  INSERT OR IGNORE INTO audit_logs (id, application_id, user_id, user_role, action, details, failure_reason, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertApp.run('APP001', 'BATCH202501001', '北京燃气公司第一分公司', '北京市朝阳区建国路88号', 'OLD-001', 'NEW-A001', '到期更换', 'pending_supervisor', 1, null, null, 0, null, null, 0, '2025-01-11', '2025-01-10 09:00:00');
insertAttachment.run('ATT001', 'APP001', '旧表照片.jpg', 'image/jpeg', 1, '2025-01-10 09:05:00');
insertProcess.run('PROC001', 'APP001', 'create', 'meter_operator', 1, '发起换表申请', null, null, '2025-01-10 09:00:00');

insertApp.run('APP002', 'BATCH202501001', '北京燃气公司第二分公司', '北京市海淀区中关村大街1号', 'OLD-002', 'NEW-A002', '故障更换', 'pending_archivist', 1, 2, null, 0, null, null, 0, '2025-01-14', '2025-01-11 10:00:00');
insertProcess.run('PROC002', 'APP002', 'create', 'meter_operator', 1, '发起换表申请', null, null, '2025-01-11 10:00:00');
insertProcess.run('PROC003', 'APP002', 'approve', 'meter_supervisor', 2, '审核通过', null, null, '2025-01-12 14:00:00');

insertApp.run('APP003', 'BATCH202501002', '北京燃气公司第三分公司', '北京市西城区金融街15号', 'OLD-003', 'NEW-A003', '到期更换', 'pending_operator', 1, 2, null, 0, null, '退回原因：缺少旧表照片，请补正后重新提交', 0, '2025-01-13', '2025-01-11 11:00:00');
insertProcess.run('PROC004', 'APP003', 'create', 'meter_operator', 1, '发起换表申请', null, null, '2025-01-11 11:00:00');
insertProcess.run('PROC005', 'APP003', 'reject', 'meter_supervisor', 2, '审核退回', '缺少旧表照片', null, '2025-01-12 09:30:00');
insertAudit.run('AUD001', 'APP003', 2, 'meter_supervisor', 'reject', '审核退回：缺少旧表照片', '缺少旧表照片', '登记员需补传旧表照片后重新提交', '2025-01-12 09:30:00');

insertApp.run('APP004', 'BATCH202501004', '北京燃气公司第四分公司', '北京市东城区王府井大街100号', 'OLD-004', 'NEW-A004', '故障更换', 'pending_supervisor', 1, null, null, 0, null, '缺材料：未上传新表安装记录和现场照片，待审核主管退回', 0, '2025-01-15', '2025-01-12 14:00:00');
insertProcess.run('PROC006', 'APP004', 'create', 'meter_operator', 1, '发起换表申请（缺材料）', null, null, '2025-01-12 14:00:00');
insertAudit.run('AUD002', 'APP004', 1, 'meter_operator', 'create', '创建换表申请，但未上传新表安装记录等材料', null, '缺材料单，待审核主管核验退回', '2025-01-12 14:00:00');

insertApp.run('APP005', 'BATCH202501003', '北京燃气公司第五分公司', '北京市丰台区南三环西路16号', 'OLD-005', 'NEW-A005', '到期更换', 'archived', 1, 2, 3, 1, null, '正常归档完成', 0, '2025-01-13', '2025-01-11 15:00:00');
insertAttachment.run('ATT002', 'APP005', '旧表照片.jpg', 'image/jpeg', 1, '2025-01-11 15:05:00');
insertAttachment.run('ATT003', 'APP005', '新表安装记录.pdf', 'application/pdf', 1, '2025-01-11 15:06:00');
insertProcess.run('PROC007', 'APP005', 'create', 'meter_operator', 1, '发起换表申请', null, null, '2025-01-11 15:00:00');
insertProcess.run('PROC008', 'APP005', 'approve', 'meter_supervisor', 2, '审核通过', null, null, '2025-01-12 16:00:00');
insertProcess.run('PROC009', 'APP005', 'archive', 'gas_archivist', 3, '复核归档完成', null, '台账匹配成功，已归档', '2025-01-13 10:00:00');
insertAudit.run('AUD003', 'APP005', 3, 'gas_archivist', 'archive', '复核归档完成，台账匹配成功', null, '正常单完整流程归档', '2025-01-13 10:00:00');

insertApp.run('APP006', 'BATCH202501006', '北京燃气公司第六分公司', '北京市石景山区八角西街66号', 'OLD-006', 'NEW-A006', '到期更换', 'pending_archivist', 1, 2, null, 0, null, '超时：待归档已超过 SLA（应于2025-01-14完成）', 1, '2025-01-14', '2025-01-09 08:00:00');
insertProcess.run('PROC010', 'APP006', 'create', 'meter_operator', 1, '发起换表申请', null, null, '2025-01-09 08:00:00');
insertProcess.run('PROC011', 'APP006', 'approve', 'meter_supervisor', 2, '审核通过', null, null, '2025-01-10 09:00:00');
insertAudit.run('AUD004', 'APP006', 2, 'meter_supervisor', 'approve', '审核通过', null, '该单随后超时，待复核负责人归档', '2025-01-10 09:00:00');

insertApp.run('APP007', 'BATCH202501007', '北京燃气公司第七分公司', '北京市通州区新华西街58号', 'OLD-007', 'NEW-A007', '故障更换', 'pending_archivist', 1, 2, null, 0, null, '离线台账无此记录，归档将校验失败', 0, '2025-01-16', '2025-01-13 09:00:00');
insertProcess.run('PROC012', 'APP007', 'create', 'meter_operator', 1, '发起换表申请', null, null, '2025-01-13 09:00:00');
insertProcess.run('PROC013', 'APP007', 'approve', 'meter_supervisor', 2, '审核通过', null, null, '2025-01-14 10:00:00');

insertApp.run('APP008', 'BATCH202501008', '北京燃气公司第八分公司', '北京市昌平区回龙观西大街118号', 'OLD-008', 'NEW-A008', '到期更换', 'pending_archivist', 1, 2, null, 0, null, '状态不一致：线下台账已作废，归档将校验失败', 0, '2025-01-16', '2025-01-13 10:00:00');
insertProcess.run('PROC014', 'APP008', 'create', 'meter_operator', 1, '发起换表申请', null, null, '2025-01-13 10:00:00');
insertProcess.run('PROC015', 'APP008', 'approve', 'meter_supervisor', 2, '审核通过', null, null, '2025-01-14 11:00:00');

insertApp.run('APP009', 'BATCH202501009', '北京燃气公司第九分公司', '北京市顺义区府前东街11号', 'OLD-009', 'NEW-A009', '到期更换', 'archived', 1, 2, 3, 1, null, '正常归档（批次已占用）', 0, '2025-01-20', '2025-01-14 09:00:00');
insertProcess.run('PROC016', 'APP009', 'create', 'meter_operator', 1, '发起换表申请', null, null, '2025-01-14 09:00:00');
insertProcess.run('PROC017', 'APP009', 'approve', 'meter_supervisor', 2, '审核通过', null, null, '2025-01-15 09:00:00');
insertProcess.run('PROC018', 'APP009', 'archive', 'gas_archivist', 3, '复核归档完成', null, '台账匹配成功，已归档', '2025-01-16 09:00:00');
insertAudit.run('AUD005', 'APP009', 3, 'gas_archivist', 'archive', '复核归档完成，台账匹配成功', null, '该批次已占用 OLD-009', '2025-01-16 09:00:00');

insertApp.run('APP010', 'BATCH202501009', '北京燃气公司第十分公司', '北京市大兴区兴政街20号', 'OLD-010', 'NEW-A010', '故障更换', 'pending_archivist', 1, 2, null, 0, null, '重复批次：与 APP009 同批次但表号不同，归档将校验失败', 0, '2025-01-20', '2025-01-15 09:00:00');
insertProcess.run('PROC019', 'APP010', 'create', 'meter_operator', 1, '发起换表申请', null, null, '2025-01-15 09:00:00');
insertProcess.run('PROC020', 'APP010', 'approve', 'meter_supervisor', 2, '审核通过', null, null, '2025-01-16 09:00:00');

console.log('数据库初始化完成');
console.log('数据文件位置:', dbPath);
db.close();
