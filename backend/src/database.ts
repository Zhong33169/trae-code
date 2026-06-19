import * as Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export const DB_PATH = path.join(__dirname, '..', 'data', 'harvest.db');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initTables(dbInstance);
  }
  return dbInstance;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS harvest_records (
      id TEXT PRIMARY KEY,
      record_no TEXT UNIQUE NOT NULL,
      batch_no TEXT NOT NULL,
      crop_type TEXT NOT NULL,
      crop_name TEXT NOT NULL,
      harvest_date TEXT NOT NULL,
      harvest_area REAL NOT NULL,
      estimated_weight REAL NOT NULL,
      actual_weight REAL,
      field_location TEXT NOT NULL,
      planter TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      current_queue TEXT NOT NULL DEFAULT 'FIELD_ADMIN',
      materials TEXT,
      deadline TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 1,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS scan_records (
      id TEXT PRIMARY KEY,
      harvest_record_id TEXT NOT NULL,
      scan_code TEXT NOT NULL,
      scanned_by TEXT NOT NULL,
      scanned_at TEXT DEFAULT CURRENT_TIMESTAMP,
      result TEXT NOT NULL,
      credential TEXT,
      remark TEXT,
      FOREIGN KEY (harvest_record_id) REFERENCES harvest_records(id),
      FOREIGN KEY (scanned_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      harvest_record_id TEXT,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      action TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (harvest_record_id) REFERENCES harvest_records(id),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      harvest_record_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (harvest_record_id) REFERENCES harvest_records(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS process_comments (
      id TEXT PRIMARY KEY,
      harvest_record_id TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      comment TEXT NOT NULL,
      action_type TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (harvest_record_id) REFERENCES harvest_records(id),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_harvest_status ON harvest_records(status);
    CREATE INDEX IF NOT EXISTS idx_harvest_queue ON harvest_records(current_queue);
    CREATE INDEX IF NOT EXISTS idx_harvest_creator ON harvest_records(created_by);
    CREATE INDEX IF NOT EXISTS idx_scan_record ON scan_records(harvest_record_id);
    CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(harvest_record_id);
  `);
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
