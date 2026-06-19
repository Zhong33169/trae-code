import { db } from './db';

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sample_records (
      id TEXT PRIMARY KEY,
      record_no TEXT UNIQUE NOT NULL,
      batch_no TEXT NOT NULL,
      product_name TEXT NOT NULL,
      production_line TEXT NOT NULL,
      sample_time TEXT NOT NULL,
      sample_temperature REAL NOT NULL,
      storage_location TEXT NOT NULL,
      operator TEXT NOT NULL,
      evidence_count INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      current_handler TEXT NOT NULL,
      current_role TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      deadline TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sample_evidences (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (sample_id) REFERENCES sample_records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sample_appeals (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      submitter TEXT NOT NULL,
      submitter_role TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      review_opinion TEXT,
      reject_reason TEXT,
      previous_status TEXT,
      submitted_at TEXT NOT NULL,
      reviewed_at TEXT,
      FOREIGN KEY (sample_id) REFERENCES sample_records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sample_operation_logs (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL,
      operator TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      remark TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (sample_id) REFERENCES sample_records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS temperature_records (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL,
      measure_time TEXT NOT NULL,
      temperature REAL NOT NULL,
      location TEXT NOT NULL,
      recorder TEXT NOT NULL,
      is_abnormal INTEGER NOT NULL DEFAULT 0,
      remark TEXT,
      FOREIGN KEY (sample_id) REFERENCES sample_records(id) ON DELETE CASCADE
    );
  `);
}
