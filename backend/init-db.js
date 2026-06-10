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
      abnormal_by INTEGER,
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
    { id: 1, username: 'registrar1', password: '123456', name: '李登记', role: 'registrar' },
    { id: 2, username: 'registrar2', password: '123456', name: '陈登记', role: 'registrar' },
    { id: 3, username: 'auditor1', password: '123456', name: '王审核', role: 'auditor' },
    { id: 4, username: 'reviewer1', password: '123456', name: '张复核', role: 'reviewer' },
  ];

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password, name, role)
    VALUES (?, ?, ?, ?, ?)
  `);

  users.forEach(u => {
    insertUser.run(u.id, u.username, bcrypt.hashSync(u.password, salt), u.name, u.role);
  });

  const children = [
    { id: 1, name: '小明', gender: '男', birth_date: '2020-03-15', class_name: '大一班', guardian_name: '明爸爸', guardian_phone: '13800138001', health_status: '正常' },
    { id: 2, name: '小红', gender: '女', birth_date: '2020-05-20', class_name: '大一班', guardian_name: '红妈妈', guardian_phone: '13800138002', health_status: '正常' },
    { id: 3, name: '小刚', gender: '男', birth_date: '2021-01-10', class_name: '中二班', guardian_name: '刚爸爸', guardian_phone: '13800138003', health_status: '过敏体质' },
    { id: 4, name: '小美', gender: '女', birth_date: '2021-07-08', class_name: '中二班', guardian_name: '美妈妈', guardian_phone: '13800138004', health_status: '正常' },
    { id: 5, name: '大壮', gender: '男', birth_date: '2019-11-22', class_name: '大二班', guardian_name: '壮爸爸', guardian_phone: '13800138005', health_status: '正常' },
    { id: 6, name: '朵朵', gender: '女', birth_date: '2020-09-30', class_name: '大一班', guardian_name: '朵妈妈', guardian_phone: '13800138006', health_status: '正常' },
    { id: 7, name: '阳阳', gender: '男', birth_date: '2020-02-14', class_name: '大一班', guardian_name: '阳爸爸', guardian_phone: '13800138007', health_status: '正常' },
    { id: 8, name: '月月', gender: '女', birth_date: '2020-08-05', class_name: '大二班', guardian_name: '月妈妈', guardian_phone: '13800138008', health_status: '哮喘' },
    { id: 9, name: '浩浩', gender: '男', birth_date: '2021-04-18', class_name: '中二班', guardian_name: '浩爸爸', guardian_phone: '13800138009', health_status: '正常' },
    { id: 10, name: '涵涵', gender: '女', birth_date: '2019-12-03', class_name: '大二班', guardian_name: '涵妈妈', guardian_phone: '13800138010', health_status: '正常' },
  ];

  const insertChild = db.prepare(`
    INSERT OR IGNORE INTO children (id, name, gender, birth_date, class_name, guardian_name, guardian_phone, health_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  children.forEach(c => {
    insertChild.run(c.id, c.name, c.gender, c.birth_date, c.class_name, c.guardian_name, c.guardian_phone, c.health_status);
  });

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const sampleRecords = [
    { id: 1, child_id: 1, check_date: today, status: 'pending_registration', current_node: 'registration', temperature: null, mental_status: null, registered_by: 1, registered_at: new Date(Date.now() - 10 * 60000).toISOString() },
    { id: 2, child_id: 2, check_date: today, status: 'pending_registration', current_node: 'registration', temperature: null, registered_by: 1, registered_at: new Date(Date.now() - 25 * 60000).toISOString() },
    { id: 3, child_id: 3, check_date: today, status: 'pending_correction', current_node: 'registration', temperature: 37.2, mental_status: '一般', abnormal_reason: '体温偏高，需重新测量确认', abnormal_by: 3, registered_by: 1, registered_at: new Date(Date.now() - 60 * 60000).toISOString(), audit_submitted_at: new Date(Date.now() - 45 * 60000).toISOString(), audit_completed_at: new Date(Date.now() - 35 * 60000).toISOString() },
    { id: 4, child_id: 4, check_date: today, status: 'pending_audit', current_node: 'audit', temperature: 36.5, mental_status: '良好', skin_condition: '正常', throat_condition: '正常', hand_foot_condition: '正常', registration_note: '晨检一切正常', registered_by: 1, registered_at: new Date(Date.now() - 90 * 60000).toISOString(), audit_submitted_at: new Date(Date.now() - 50 * 60000).toISOString() },
    { id: 5, child_id: 5, check_date: today, status: 'pending_audit', current_node: 'audit', temperature: 36.8, mental_status: '良好', skin_condition: '正常', throat_condition: '正常', hand_foot_condition: '正常', registration_note: '精神好', registered_by: 1, registered_at: new Date(Date.now() - 120 * 60000).toISOString(), audit_submitted_at: new Date(Date.now() - 70 * 60000).toISOString() },
    { id: 6, child_id: 6, check_date: today, status: 'pending_audit', current_node: 'audit', temperature: 37.0, mental_status: '一般', skin_condition: '皮疹', registration_note: '手臂有少量皮疹', registered_by: 2, registered_at: new Date(Date.now() - 100 * 60000).toISOString(), audit_submitted_at: new Date(Date.now() - 80 * 60000).toISOString() },
    { id: 7, child_id: 7, check_date: today, status: 'pending_review', current_node: 'review', temperature: 36.6, mental_status: '良好', skin_condition: '正常', throat_condition: '正常', hand_foot_condition: '正常', registration_note: '正常', audit_note: '审核通过', registered_by: 2, registered_at: new Date(Date.now() - 180 * 60000).toISOString(), audit_submitted_at: new Date(Date.now() - 150 * 60000).toISOString(), audited_by: 3, audit_completed_at: new Date(Date.now() - 90 * 60000).toISOString(), review_submitted_at: new Date(Date.now() - 90 * 60000).toISOString() },
    { id: 8, child_id: 8, check_date: today, status: 'pending_review', current_node: 'review', temperature: 36.7, mental_status: '良好', skin_condition: '正常', throat_condition: '正常', hand_foot_condition: '正常', other_symptoms: '轻微咳嗽', registration_note: '有轻微咳嗽，家长称已服药', audit_note: '数据完整，可通过', registered_by: 1, registered_at: new Date(Date.now() - 200 * 60000).toISOString(), audit_submitted_at: new Date(Date.now() - 170 * 60000).toISOString(), audited_by: 3, audit_completed_at: new Date(Date.now() - 140 * 60000).toISOString(), review_submitted_at: new Date(Date.now() - 140 * 60000).toISOString() },
    { id: 9, child_id: 9, check_date: today, status: 'archived', current_node: 'completed', temperature: 36.5, mental_status: '良好', skin_condition: '正常', throat_condition: '正常', hand_foot_condition: '正常', registration_note: '一切正常', audit_note: '通过', review_note: '已复核归档', registered_by: 1, registered_at: new Date(Date.now() - 300 * 60000).toISOString(), audit_submitted_at: new Date(Date.now() - 280 * 60000).toISOString(), audited_by: 3, audit_completed_at: new Date(Date.now() - 250 * 60000).toISOString(), review_submitted_at: new Date(Date.now() - 250 * 60000).toISOString(), reviewed_by: 4, review_completed_at: new Date(Date.now() - 200 * 60000).toISOString() },
    { id: 10, child_id: 10, check_date: today, status: 'archived', current_node: 'completed', temperature: 36.9, mental_status: '良好', skin_condition: '正常', throat_condition: '正常', hand_foot_condition: '正常', registration_note: '正常入园', audit_note: '审核通过', review_note: '归档', registered_by: 2, registered_at: new Date(Date.now() - 320 * 60000).toISOString(), audit_submitted_at: new Date(Date.now() - 300 * 60000).toISOString(), audited_by: 3, audit_completed_at: new Date(Date.now() - 270 * 60000).toISOString(), review_submitted_at: new Date(Date.now() - 270 * 60000).toISOString(), reviewed_by: 4, review_completed_at: new Date(Date.now() - 220 * 60000).toISOString() },
    { id: 11, child_id: 1, check_date: yesterday, status: 'archived', current_node: 'completed', temperature: 36.6, mental_status: '良好', skin_condition: '正常', throat_condition: '正常', hand_foot_condition: '正常', registration_note: '正常', audit_note: '通过', review_note: '已归档', registered_by: 1, audited_by: 3, reviewed_by: 4 },
  ];

  const insertRecord = db.prepare(`
    INSERT OR IGNORE INTO morning_check_records (
      id, child_id, check_date, status, current_node, temperature, mental_status,
      skin_condition, throat_condition, hand_foot_condition, other_symptoms,
      registration_note, audit_note, review_note, abnormal_reason, abnormal_by,
      registered_by, audited_by, reviewed_by,
      registered_at, audit_submitted_at, audit_completed_at, review_submitted_at, review_completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  sampleRecords.forEach(r => {
    insertRecord.run(
      r.id, r.child_id, r.check_date, r.status, r.current_node, r.temperature, r.mental_status,
      r.skin_condition || null, r.throat_condition || null, r.hand_foot_condition || null, r.other_symptoms || null,
      r.registration_note || null, r.audit_note || null, r.review_note || null, r.abnormal_reason || null, r.abnormal_by || null,
      r.registered_by || null, r.audited_by || null, r.reviewed_by || null,
      r.registered_at || null, r.audit_submitted_at || null, r.audit_completed_at || null, r.review_submitted_at || null, r.review_completed_at || null
    );
  });

  const sampleLogs = [
    { record_id: 1, user_id: 1, user_name: '李登记', user_role: 'registrar', action: '创建晨检记录', from_status: null, to_status: 'pending_registration', note: '' },
    { record_id: 2, user_id: 1, user_name: '李登记', user_role: 'registrar', action: '创建晨检记录', from_status: null, to_status: 'pending_registration', note: '' },
    { record_id: 3, user_id: 1, user_name: '李登记', user_role: 'registrar', action: '创建并提交审核', from_status: null, to_status: 'pending_audit', note: '初测体温偏高' },
    { record_id: 3, user_id: 3, user_name: '王审核', user_role: 'auditor', action: '退回补正', from_status: 'pending_audit', to_status: 'pending_correction', note: '异常原因：体温偏高，需重新测量确认' },
    { record_id: 4, user_id: 1, user_name: '李登记', user_role: 'registrar', action: '提交审核', from_status: 'pending_registration', to_status: 'pending_audit', note: '' },
    { record_id: 5, user_id: 1, user_name: '李登记', user_role: 'registrar', action: '提交审核', from_status: 'pending_registration', to_status: 'pending_audit', note: '' },
    { record_id: 6, user_id: 2, user_name: '陈登记', user_role: 'registrar', action: '提交审核', from_status: 'pending_registration', to_status: 'pending_audit', note: '发现皮疹已登记' },
    { record_id: 7, user_id: 2, user_name: '陈登记', user_role: 'registrar', action: '提交审核', from_status: 'pending_registration', to_status: 'pending_audit', note: '' },
    { record_id: 7, user_id: 3, user_name: '王审核', user_role: 'auditor', action: '审核通过', from_status: 'pending_audit', to_status: 'pending_review', note: '审核通过' },
    { record_id: 8, user_id: 1, user_name: '李登记', user_role: 'registrar', action: '提交审核', from_status: 'pending_registration', to_status: 'pending_audit', note: '轻微咳嗽已备注' },
    { record_id: 8, user_id: 3, user_name: '王审核', user_role: 'auditor', action: '审核通过', from_status: 'pending_audit', to_status: 'pending_review', note: '数据完整，可通过' },
    { record_id: 9, user_id: 1, user_name: '李登记', user_role: 'registrar', action: '提交审核', from_status: 'pending_registration', to_status: 'pending_audit', note: '' },
    { record_id: 9, user_id: 3, user_name: '王审核', user_role: 'auditor', action: '审核通过', from_status: 'pending_audit', to_status: 'pending_review', note: '通过' },
    { record_id: 9, user_id: 4, user_name: '张复核', user_role: 'reviewer', action: '复核归档', from_status: 'pending_review', to_status: 'archived', note: '已复核归档' },
    { record_id: 10, user_id: 2, user_name: '陈登记', user_role: 'registrar', action: '提交审核', from_status: 'pending_registration', to_status: 'pending_audit', note: '' },
    { record_id: 10, user_id: 3, user_name: '王审核', user_role: 'auditor', action: '审核通过', from_status: 'pending_audit', to_status: 'pending_review', note: '审核通过' },
    { record_id: 10, user_id: 4, user_name: '张复核', user_role: 'reviewer', action: '复核归档', from_status: 'pending_review', to_status: 'archived', note: '归档' },
  ];

  const insertLog = db.prepare(`
    INSERT OR IGNORE INTO operation_logs (record_id, user_id, user_name, user_role, action, from_status, to_status, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  sampleLogs.forEach(log => {
    insertLog.run(log.record_id, log.user_id, log.user_name, log.user_role, log.action, log.from_status, log.to_status, log.note);
  });

  console.log('数据库初始化完成！');
  console.log('测试账号：');
  console.log('  晨检登记员: registrar1 / 123456 (李登记)');
  console.log('  晨检登记员: registrar2 / 123456 (陈登记)');
  console.log('  晨检审核主管: auditor1 / 123456 (王审核)');
  console.log('  幼儿园复核负责人: reviewer1 / 123456 (张复核)');
  console.log('  样例幼儿档案: 10 条');
  console.log('  样例晨检记录: 11 条（涵盖所有状态）');
  console.log('  样例操作日志: 17 条');

  db.close();
});
