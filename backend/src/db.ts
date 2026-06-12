import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'merchant-onboarding.db');

let db: Database | null = null;
let SQL: any = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    const wasmPath = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const wasmBuffer = fs.readFileSync(wasmPath);
    SQL = await initSqlJs({
      locateFile: () => wasmPath,
      wasmBinary: wasmBuffer.buffer.slice(wasmBuffer.byteOffset, wasmBuffer.byteOffset + wasmBuffer.byteLength),
    });

    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    db!.run(`PRAGMA journal_mode = WAL`);
    db!.run(`PRAGMA foreign_keys = ON`);
  }
  return db!;
}

export function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export async function initDatabase() {
  const database = await getDb();

  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('CLERK', 'SUPERVISOR', 'REVIEWER')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS merchant_onboarding_forms (
      id TEXT PRIMARY KEY,
      batch_no TEXT NOT NULL,
      merchant_name TEXT NOT NULL,
      contact TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      business_license TEXT,
      tax_certificate TEXT,
      org_code TEXT,
      legal_person TEXT,
      registered_capital TEXT,
      business_scope TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MATERIALS_MISSING',
        'QUALIFIED', 'REJECTED', 'STORE_OPENED', 'ARCHIVED'
      )),
      current_role TEXT NOT NULL DEFAULT 'CLERK' CHECK (current_role IN ('CLERK', 'SUPERVISOR', 'REVIEWER')),
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      submitted_by TEXT,
      submitted_at TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      archived_by TEXT,
      archived_at TEXT,
      reject_reason TEXT,
      materials_missing_note TEXT,
      audit_remark TEXT,
      is_overdue INTEGER DEFAULT 0,
      has_exception INTEGER DEFAULT 0,
      exception_message TEXT,
      offline_status TEXT,
      deadline TEXT
    );
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_forms_batch_no ON merchant_onboarding_forms(batch_no)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_forms_status ON merchant_onboarding_forms(status)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_forms_current_role ON merchant_onboarding_forms(current_role)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_forms_has_exception ON merchant_onboarding_forms(has_exception)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_forms_is_overdue ON merchant_onboarding_forms(is_overdue)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      form_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      remark TEXT
    );
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_attachments_form_id ON attachments(form_id)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      form_id TEXT NOT NULL,
      operator TEXT NOT NULL,
      operator_role TEXT NOT NULL CHECK (operator_role IN ('CLERK', 'SUPERVISOR', 'REVIEWER')),
      operator_name TEXT NOT NULL,
      action TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      reason TEXT,
      remark TEXT,
      created_at TEXT NOT NULL
    );
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_form_id ON audit_logs(form_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON audit_logs(operator)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`);

  saveDb();
  console.log('Database initialized successfully at:', dbPath);
}

export function prepare(sql: string) {
  return {
    run: async (...params: any[]) => {
      const database = await getDb();
      database.run(sql, params);
      saveDb();
    },
    get: async (...params: any[]) => {
      const database = await getDb();
      const stmt = database.prepare(sql);
      stmt.bind(params);
      const result = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();
      return result;
    },
    all: async (...params: any[]) => {
      const database = await getDb();
      const results: any[] = [];
      const stmt = database.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    },
    exec: async () => {
      const database = await getDb();
      database.run(sql);
      saveDb();
    }
  };
}

export function exec(sql: string) {
  return getDb().then(database => {
    database.run(sql);
    saveDb();
  });
}

export default { getDb, initDatabase, prepare, exec, saveDb };
