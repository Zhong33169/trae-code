import db from './connection.js';

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('REGISTER', 'AUDITOR', 'REVIEWER')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contract_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_no TEXT UNIQUE NOT NULL,
      resident_name TEXT NOT NULL,
      id_card TEXT,
      phone TEXT,
      address TEXT,
      doctor_name TEXT,
      team_name TEXT,
      risk_level TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
      stage TEXT NOT NULL DEFAULT 'SIGN' CHECK(stage IN ('SIGN', 'PLAN', 'PERFORM')),
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN (
        'DRAFT', 'PENDING', 'APPROVED', 'REJECTED',
        'NEEDS_CORRECTION', 'OVERDUE', 'ARCHIVED', 'STATUS_CONFLICT'
      )),
      current_handler_id INTEGER,
      current_role TEXT CHECK(current_role IN ('REGISTER', 'AUDITOR', 'REVIEWER')),
      version INTEGER NOT NULL DEFAULT 1,
      deadline DATETIME,
      sign_content TEXT,
      plan_content TEXT,
      perform_content TEXT,
      evidence_required INTEGER NOT NULL DEFAULT 0,
      evidence_submitted INTEGER NOT NULL DEFAULT 0,
      last_opinion TEXT,
      last_result TEXT,
      last_handler_name TEXT,
      priority_score INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (current_handler_id) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS evidences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_form_id INTEGER NOT NULL,
      stage TEXT NOT NULL CHECK(stage IN ('SIGN', 'PLAN', 'PERFORM')),
      name TEXT NOT NULL,
      description TEXT,
      file_path TEXT,
      is_required INTEGER NOT NULL DEFAULT 0,
      uploaded_by INTEGER,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_form_id) REFERENCES contract_forms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_form_id INTEGER NOT NULL,
      operator_id INTEGER,
      operator_name TEXT,
      operator_role TEXT,
      action TEXT NOT NULL,
      from_stage TEXT,
      to_stage TEXT,
      from_status TEXT,
      to_status TEXT,
      opinion TEXT,
      result TEXT,
      version_before INTEGER,
      version_after INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_form_id) REFERENCES contract_forms(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_forms_stage_status ON contract_forms(stage, status);
    CREATE INDEX IF NOT EXISTS idx_forms_risk ON contract_forms(risk_level);
    CREATE INDEX IF NOT EXISTS idx_forms_handler ON contract_forms(current_handler_id, current_role);
    CREATE INDEX IF NOT EXISTS idx_logs_form ON operation_logs(contract_form_id);
    CREATE INDEX IF NOT EXISTS idx_evidences_form ON evidences(contract_form_id);
  `);

  console.log('Database schema initialized successfully.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initSchema();
}

export default initSchema;
