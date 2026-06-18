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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS offline_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT NOT NULL,
    meter_no TEXT NOT NULL,
    replacement_date TEXT NOT NULL,
    UNIQUE(batch_no, meter_no)
  );
`);

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, name, role) VALUES (?, ?, ?)
`);

const users = [
  ['meter_operator', '张三', 'meter_operator'],
  ['meter_supervisor', '李四', 'meter_supervisor'],
  ['gas_archivist', '王五', 'gas_archivist']
];
users.forEach(u => insertUser.run(...u));

const insertOfflineLedger = db.prepare(`
  INSERT OR IGNORE INTO offline_ledger (batch_no, meter_no, replacement_date) VALUES (?, ?, ?)
`);

const ledgerData = [
  ['BATCH202501001', 'OLD-001', '2025-01-15'],
  ['BATCH202501001', 'OLD-002', '2025-01-15'],
  ['BATCH202501002', 'OLD-003', '2025-01-16'],
  ['BATCH202501003', 'OLD-005', '2025-01-17']
];
ledgerData.forEach(d => insertOfflineLedger.run(...d));

const insertApp = db.prepare(`
  INSERT OR IGNORE INTO applications (
    id, batch_no, customer_name, customer_address, old_meter_no, new_meter_no,
    reason, status, operator_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertProcess = db.prepare(`
  INSERT OR IGNORE INTO process_records (
    id, application_id, action, actor_role, actor_id, review_comment, reject_reason
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

insertApp.run(
  'APP001', 'BATCH202501001', '北京燃气公司第一分公司', '北京市朝阳区建国路88号',
  'OLD-001', 'NEW-A001', '到期更换', 'pending_operator', 1
);
insertProcess.run('PROC001', 'APP001', 'create', 'meter_operator', 1, '发起换表申请', null);

insertApp.run(
  'APP002', 'BATCH202501001', '北京燃气公司第二分公司', '北京市海淀区中关村大街1号',
  'OLD-002', 'NEW-A002', '故障更换', 'pending_archivist', 1
);
const updateReviewed = db.prepare(`
  UPDATE applications SET reviewer_id = 2 WHERE id = 'APP002'
`);
updateReviewed.run();
insertProcess.run('PROC002', 'APP002', 'create', 'meter_operator', 1, '发起换表申请', null);
insertProcess.run('PROC003', 'APP002', 'approve', 'meter_supervisor', 2, '审核通过', null);

insertApp.run(
  'APP003', 'BATCH202501002', '北京燃气公司第三分公司', '北京市西城区金融街15号',
  'OLD-003', 'NEW-A003', '到期更换', 'pending_operator', 1
);
insertProcess.run('PROC004', 'APP003', 'create', 'meter_operator', 1, '发起换表申请', null);
insertProcess.run('PROC005', 'APP003', 'reject', 'meter_supervisor', 2, null, '缺少旧表照片');

insertApp.run(
  'APP004', 'BATCH202501004', '北京燃气公司第四分公司', '北京市东城区王府井大街100号',
  'OLD-004', 'NEW-A004', '故障更换', 'pending_operator', 1
);
insertProcess.run('PROC006', 'APP004', 'create', 'meter_operator', 1, '发起换表申请（离线台账无此记录）', null);

insertApp.run(
  'APP005', 'BATCH202501003', '北京燃气公司第五分公司', '北京市丰台区南三环西路16号',
  'OLD-005', 'NEW-A005', '到期更换', 'archived', 1
);
const updateArchived = db.prepare(`
  UPDATE applications SET 
    reviewer_id = 2, archivist_id = 3, offline_ledger_backfilled = 1
  WHERE id = 'APP005'
`);
updateArchived.run();
insertProcess.run('PROC007', 'APP005', 'create', 'meter_operator', 1, '发起换表申请', null);
insertProcess.run('PROC008', 'APP005', 'approve', 'meter_supervisor', 2, '审核通过', null);
insertProcess.run('PROC009', 'APP005', 'archive', 'gas_archivist', 3, '复核归档完成', null);

console.log('数据库初始化完成');
console.log('数据文件位置:', dbPath);
db.close();
