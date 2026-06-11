import initSqlJs from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'launch_plan.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let _wrapper = null;

function persist(db) {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function createWrapper(dbInstance) {
  return {
    exec(sql) {
      dbInstance.exec(sql);
      persist(dbInstance);
    },
    prepare(sql) {
      return {
        run(...params) {
          const stmt = dbInstance.prepare(sql);
          try {
            stmt.bind(params);
            stmt.step();
            const results = dbInstance.exec('SELECT last_insert_rowid() AS id, changes() AS ch');
            const row = results[0]?.values?.[0] || [0, 0];
            persist(dbInstance);
            return { lastInsertRowid: row[0], changes: row[1] };
          } finally {
            try { stmt.free(); } catch (_) {}
          }
        },
        get(...params) {
          const stmt = dbInstance.prepare(sql);
          try {
            stmt.bind(params);
            let row = undefined;
            if (stmt.step()) row = stmt.getAsObject();
            return row;
          } finally {
            try { stmt.free(); } catch (_) {}
          }
        },
        all(...params) {
          const stmt = dbInstance.prepare(sql);
          try {
            stmt.bind(params);
            const rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            return rows;
          } finally {
            try { stmt.free(); } catch (_) {}
          }
        }
      };
    },
    pragma() {},
    _raw: dbInstance
  };
}

export async function initSchema() {
  if (_wrapper) return _wrapper;
  const SQL = await initSqlJs();
  let db;
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(new Uint8Array(buf));
  } else {
    db = new SQL.Database();
  }

  const w = createWrapper(db);
  w.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('CSM','DELIVERY','DIRECTOR')),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS launch_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_no TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      change_type TEXT NOT NULL,
      plan_date TEXT NOT NULL,
      risk_level TEXT NOT NULL CHECK(risk_level IN ('LOW','MEDIUM','HIGH')),
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('DRAFT','PENDING_REVIEW','PENDING_CONFIRM','COMPLETED','REJECTED')) DEFAULT 'DRAFT',
      version INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      reject_reason TEXT
    );
    CREATE TABLE IF NOT EXISTS plan_evidences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      evidence_type TEXT NOT NULL CHECK(evidence_type IN ('REGISTRATION','VERIFICATION','ARCHIVAL')),
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL,
      batch_item_id INTEGER,
      source TEXT CHECK(source IN ('queue','batch_detail','plan_detail')),
      note TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (batch_item_id) REFERENCES batch_items(id)
    );
    PRAGMA table_info(plan_evidences);
  `);

  try {
    w.exec(`ALTER TABLE plan_evidences ADD COLUMN batch_item_id INTEGER`);
  } catch (_) {}
  try {
    w.exec(`ALTER TABLE plan_evidences ADD COLUMN source TEXT CHECK(source IN ('queue','batch_detail','plan_detail'))`);
  } catch (_) {}
  try {
    w.exec(`ALTER TABLE plan_evidences ADD COLUMN note TEXT`);
  } catch (_) {}

  w.exec(`
    CREATE TABLE IF NOT EXISTS plan_transitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      operated_by INTEGER NOT NULL,
      operated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      comment TEXT
    );
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      action TEXT NOT NULL,
      target_status TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      total_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS batch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING','SUCCESS','FAILED')),
      error_code TEXT,
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      detail TEXT,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
  _wrapper = w;
  return w;
}

export function db() {
  if (!_wrapper) throw new Error('DB not initialized, call initSchema first');
  return _wrapper;
}

export function getDb() {
  return db();
}
