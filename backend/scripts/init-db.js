const { initializeDatabase, getDb } = require('../src/db');

async function init() {
  await initializeDatabase();
  const db = getDb();

  console.log('开始初始化数据库...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      department TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS supervision_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_no TEXT UNIQUE NOT NULL,
      project_name TEXT NOT NULL,
      construction_unit TEXT,
      supervision_unit TEXT,
      location TEXT,
      record_date DATE NOT NULL,
      weather TEXT,
      temperature TEXT,
      content TEXT NOT NULL,
      issues TEXT,
      requirement TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      version INTEGER NOT NULL DEFAULT 1,
      current_handler_id INTEGER,
      created_by INTEGER NOT NULL,
      deadline DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (current_handler_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS evidences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      file_url TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES supervision_records(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS review_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      handler_id INTEGER NOT NULL,
      operation_type TEXT NOT NULL,
      opinion TEXT NOT NULL,
      result TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      reject_reason TEXT,
      version INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES supervision_records(id) ON DELETE CASCADE,
      FOREIGN KEY (handler_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER,
      user_id INTEGER NOT NULL,
      operation_type TEXT NOT NULL,
      description TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES supervision_records(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_records_status ON supervision_records(status);
    CREATE INDEX IF NOT EXISTS idx_records_handler ON supervision_records(current_handler_id);
    CREATE INDEX IF NOT EXISTS idx_records_creator ON supervision_records(created_by);
    CREATE INDEX IF NOT EXISTS idx_review_record_id ON review_records(record_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_record_id ON evidences(record_id);
    CREATE INDEX IF NOT EXISTS idx_logs_record_id ON operation_logs(record_id);
    CREATE INDEX IF NOT EXISTS idx_logs_user_id ON operation_logs(user_id);
  `);

  console.log('数据库初始化完成！');
  
  process.exit(0);
}

init().catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
