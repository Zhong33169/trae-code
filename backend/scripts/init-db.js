require('dotenv').config();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/credit.db';
const resolvedPath = path.resolve(dbPath);
const dbDir = path.dirname(resolvedPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const Database = require('better-sqlite3');
const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('registrar','auditor','reviewer')),
    department TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS credit_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_no TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    credit_line REAL NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'CNY',
    applicant TEXT,
    contact_phone TEXT,
    business_type TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN (
      'draft','pending_audit','reject_correction','audit_pass',
      'pending_review','reject_revision','review_pass','review_reject',
      'appeal_pending','appeal_reviewing','closed','archived','overdue','conflict'
    )),
    current_handler_role TEXT CHECK(current_handler_role IN ('registrar','auditor','reviewer')),
    current_handler_id INTEGER,
    prev_handler_id INTEGER,
    prev_handler_role TEXT,
    prev_opinion TEXT,
    prev_result TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    is_overdue INTEGER DEFAULT 0,
    has_conflict INTEGER DEFAULT 0,
    evidence_status TEXT DEFAULT 'incomplete' CHECK(evidence_status IN ('complete','incomplete','partial')),
    reject_reason TEXT,
    remark TEXT,
    deadline TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    created_by INTEGER,
    FOREIGN KEY (current_handler_id) REFERENCES users(id),
    FOREIGN KEY (prev_handler_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS evidence_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,
    evidence_type TEXT NOT NULL,
    evidence_name TEXT NOT NULL,
    is_required INTEGER DEFAULT 1,
    is_submitted INTEGER DEFAULT 0,
    file_name TEXT,
    submit_time TEXT,
    remark TEXT,
    FOREIGN KEY (app_id) REFERENCES credit_applications(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS process_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,
    node_type TEXT NOT NULL CHECK(node_type IN ('register','audit','review','appeal','correction')),
    node_order INTEGER NOT NULL DEFAULT 0,
    handler_id INTEGER,
    handler_role TEXT,
    handler_name TEXT,
    opinion TEXT,
    result TEXT CHECK(result IN ('pass','reject','correction','submit','appeal','archive','withdraw')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','skipped')),
    start_time TEXT,
    end_time TEXT,
    duration_seconds INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (app_id) REFERENCES credit_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (handler_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER,
    user_id INTEGER,
    user_name TEXT,
    user_role TEXT,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    opinion TEXT,
    reject_reason TEXT,
    evidence_check TEXT,
    version_from INTEGER,
    version_to INTEGER,
    ip TEXT,
    extra TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (app_id) REFERENCES credit_applications(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_app_status ON credit_applications(status);
  CREATE INDEX IF NOT EXISTS idx_app_handler ON credit_applications(current_handler_id);
  CREATE INDEX IF NOT EXISTS idx_app_role ON credit_applications(current_handler_role);
  CREATE INDEX IF NOT EXISTS idx_log_app ON operation_logs(app_id);
  CREATE INDEX IF NOT EXISTS idx_log_user ON operation_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_node_app ON process_nodes(app_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_app ON evidence_items(app_id);
`);

console.log('数据库初始化完成:', resolvedPath);
db.close();
