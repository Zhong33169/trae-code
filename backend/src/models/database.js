import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/care.db');

let db;

export function getDB() {
  if (!db) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDB() {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('doctor', 'nurse', 'reviewer', 'admin')),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS care_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_name TEXT NOT NULL,
      species TEXT,
      breed TEXT,
      owner_name TEXT NOT NULL,
      owner_phone TEXT,
      admission_date TEXT NOT NULL,
      diagnosis TEXT,
      treatment_plan TEXT,
      status TEXT NOT NULL DEFAULT 'initiated' CHECK(status IN ('initiated', 'processing', 'reviewing', 'archived', 'returned', 'overdue')),
      priority TEXT DEFAULT 'normal' CHECK(priority IN ('normal', 'urgent', 'critical')),
      ward TEXT,
      bed_number TEXT,
      doctor_id INTEGER REFERENCES users(id),
      nurse_id INTEGER REFERENCES users(id),
      reviewer_id INTEGER REFERENCES users(id),
      deadline TEXT,
      return_reason TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS medication_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      care_record_id INTEGER NOT NULL REFERENCES care_records(id) ON DELETE CASCADE,
      medicine_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      route TEXT,
      frequency TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      administered_by INTEGER REFERENCES users(id),
      notes TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'discontinued')),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS discharge_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      care_record_id INTEGER NOT NULL REFERENCES care_records(id) ON DELETE CASCADE,
      discharge_date TEXT NOT NULL,
      discharge_summary TEXT NOT NULL,
      follow_up TEXT,
      condition_at_discharge TEXT,
      discharged_by INTEGER REFERENCES users(id),
      confirmed_by INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'rejected')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      care_record_id INTEGER NOT NULL REFERENCES care_records(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER DEFAULT 0,
      category TEXT NOT NULL CHECK(category IN ('admission_form', 'lab_result', 'imaging', 'consent_form', 'treatment_record', 'other')),
      is_required INTEGER DEFAULT 0,
      upload_type TEXT DEFAULT 'initial' CHECK(upload_type IN ('initial', 'supplement', 'resubmit')),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      uploaded_by INTEGER REFERENCES users(id),
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TEXT,
      reject_reason TEXT,
      supplement_reason TEXT,
      replaced_attachment_id INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      care_record_id INTEGER REFERENCES care_records(id),
      action TEXT NOT NULL,
      actor_id INTEGER REFERENCES users(id),
      actor_name TEXT,
      actor_role TEXT,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      detail TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_care_records_status ON care_records(status);
    CREATE INDEX IF NOT EXISTS idx_care_records_doctor ON care_records(doctor_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_care_record ON attachments(care_record_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_care_record ON audit_logs(care_record_id);
    CREATE INDEX IF NOT EXISTS idx_medication_care_record ON medication_records(care_record_id);
  `);

  return db;
}
