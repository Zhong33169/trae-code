const db = require('../db');
const bcrypt = require('bcryptjs');

async function initDB() {
  await db.initDB();

  db.execScript(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      real_name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS bus_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_no TEXT UNIQUE NOT NULL,
      route_name TEXT NOT NULL,
      bus_no TEXT,
      driver_name TEXT,
      departure_time TEXT NOT NULL,
      start_station TEXT NOT NULL,
      end_station TEXT NOT NULL,
      shift_type TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      remark TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS handover_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      shift_no TEXT,
      handover_person TEXT,
      receiver_person TEXT,
      confirm_time TEXT,
      handover_remark TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (schedule_id) REFERENCES bus_schedules(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      action_desc TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (schedule_id) REFERENCES bus_schedules(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      auditor_id INTEGER NOT NULL,
      auditor_name TEXT NOT NULL,
      audit_type TEXT NOT NULL,
      result TEXT NOT NULL,
      opinion TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (schedule_id) REFERENCES bus_schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (auditor_id) REFERENCES users(id)
    );
  `);

  const userCount = db.get('SELECT COUNT(*) as count FROM users').count;
  if (userCount === 0) {
    const users = [
      { username: 'registrar1', password: '123456', real_name: '张登记', role: 'registrar' },
      { username: 'registrar2', password: '123456', real_name: '李登记', role: 'registrar' },
      { username: 'auditor1', password: '123456', real_name: '王审核', role: 'auditor' },
      { username: 'reviewer1', password: '123456', real_name: '赵复核', role: 'reviewer' }
    ];

    for (const u of users) {
      const hashed = bcrypt.hashSync(u.password, 10);
      db.run(
        'INSERT INTO users (username, password, real_name, role) VALUES (?, ?, ?, ?)',
        [u.username, hashed, u.real_name, u.role]
      );
    }

    console.log('初始用户创建成功');
  }

  console.log('数据库初始化完成');
}

if (require.main === module) {
  initDB().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = initDB;
