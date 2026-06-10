const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'morning_check.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gender TEXT,
      birth_date TEXT,
      class_name TEXT,
      guardian_name TEXT,
      guardian_phone TEXT,
      health_status TEXT DEFAULT '正常',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS morning_check_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      check_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_registration',
      current_node TEXT NOT NULL DEFAULT 'registration',
      temperature REAL,
      mental_status TEXT,
      skin_condition TEXT,
      throat_condition TEXT,
      hand_foot_condition TEXT,
      other_symptoms TEXT,
      registration_note TEXT,
      audit_note TEXT,
      review_note TEXT,
      abnormal_reason TEXT,
      registered_by INTEGER,
      audited_by INTEGER,
      reviewed_by INTEGER,
      registered_at DATETIME,
      audit_submitted_at DATETIME,
      audit_completed_at DATETIME,
      review_submitted_at DATETIME,
      review_completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES morning_check_records(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_records_status ON morning_check_records(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_records_child ON morning_check_records(child_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_records_date ON morning_check_records(check_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_record ON operation_logs(record_id)`);

  const salt = bcrypt.genSaltSync(10);

  const users = [
    { username: 'registrar1', password: '123456', name: '李登记', role: 'registrar' },
    { username: 'auditor1', password: '123456', name: '王审核', role: 'auditor' },
    { username: 'reviewer1', password: '123456', name: '张复核', role: 'reviewer' },
  ];

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, name, role)
    VALUES (?, ?, ?, ?)
  `);

  users.forEach(u => {
    insertUser.run(u.username, bcrypt.hashSync(u.password, salt), u.name, u.role);
  });

  const children = [
    { id: 1, name: '小明', gender: '男', birth_date: '2020-03-15', class_name: '大一班', guardian_name: '明爸爸', guardian_phone: '13800138001', health_status: '正常' },
    { id: 2, name: '小红', gender: '女', birth_date: '2020-05-20', class_name: '大一班', guardian_name: '红妈妈', guardian_phone: '13800138002', health_status: '正常' },
    { id: 3, name: '小刚', gender: '男', birth_date: '2021-01-10', class_name: '中二班', guardian_name: '刚爸爸', guardian_phone: '13800138003', health_status: '过敏体质' },
    { id: 4, name: '小美', gender: '女', birth_date: '2021-07-08', class_name: '中二班', guardian_name: '美妈妈', guardian_phone: '13800138004', health_status: '正常' },
    { id: 5, name: '大壮', gender: '男', birth_date: '2019-11-22', class_name: '大二班', guardian_name: '壮爸爸', guardian_phone: '13800138005', health_status: '正常' },
    { id: 6, name: '朵朵', gender: '女', birth_date: '2020-09-30', class_name: '大一班', guardian_name: '朵妈妈', guardian_phone: '13800138006', health_status: '正常' },
  ];

  const insertChild = db.prepare(`
    INSERT OR IGNORE INTO children (id, name, gender, birth_date, class_name, guardian_name, guardian_phone, health_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  children.forEach(c => {
    insertChild.run(c.id, c.name, c.gender, c.birth_date, c.class_name, c.guardian_name, c.guardian_phone, c.health_status);
  });

  console.log('数据库初始化完成！');
  console.log('测试账号：');
  console.log('  晨检登记员: registrar1 / 123456');
  console.log('  晨检审核主管: auditor1 / 123456');
  console.log('  幼儿园复核负责人: reviewer1 / 123456');
  console.log('  样例幼儿档案已插入 6 条');

  db.close();
});
