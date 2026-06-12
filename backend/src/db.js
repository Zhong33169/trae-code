import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'zhaoshang.db');

let db = null;
let SQL = null;

export async function getDb() {
  if (db) return db;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(dbPath, buffer);
}

export function exec(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    return results;
  } finally {
    stmt.free();
  }
}

export function run(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  db.run(sql, params);
  saveDb();
  const info = db.exec('SELECT changes() as changes, last_insert_rowid() as lastInsertRowid');
  return {
    changes: info[0]?.values[0]?.[0] || 0,
    lastInsertRowid: info[0]?.values[0]?.[1] || 0
  };
}

export function queryOne(sql, params = []) {
  const rows = exec(sql, params);
  return rows[0] || null;
}

export function queryAll(sql, params = []) {
  return exec(sql, params);
}

export async function initDatabase() {
  await getDb();

  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('INITIATOR', 'HANDLER', 'REVIEWER')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS enterprise_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clue_no TEXT UNIQUE NOT NULL,
      enterprise_name TEXT NOT NULL,
      contact_person TEXT,
      contact_phone TEXT,
      industry TEXT,
      scale TEXT,
      registered_capital REAL,
      intention TEXT,
      source TEXT,
      initiator_id INTEGER,
      initiator_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS follow_up_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clue_no TEXT NOT NULL,
      visit_date DATE NOT NULL,
      location TEXT,
      participants TEXT,
      content TEXT NOT NULL,
      attachment TEXT,
      handler_id INTEGER,
      handler_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS signing_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clue_no TEXT NOT NULL,
      contract_amount REAL NOT NULL,
      signing_date DATE NOT NULL,
      contract_terms TEXT,
      attachment TEXT,
      handler_id INTEGER,
      handler_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clue_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      clue_no TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('INITIATED', 'HANDLED', 'REVIEWED', 'ARCHIVED', 'REJECTED')),
      title TEXT NOT NULL,
      current_stage TEXT NOT NULL CHECK(current_stage IN ('INITIATE', 'HANDLE', 'REVIEW_ARCHIVE')),
      initiator_id INTEGER,
      initiator_name TEXT,
      initiate_time DATETIME,
      handler_id INTEGER,
      handler_name TEXT,
      handle_time DATETIME,
      reviewer_id INTEGER,
      reviewer_name TEXT,
      review_time DATETIME,
      reject_reason TEXT,
      has_enterprise_evidence INTEGER DEFAULT 0,
      has_followup_evidence INTEGER DEFAULT 0,
      has_signing_evidence INTEGER DEFAULT 0,
      evidence_check_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL,
      operator_id INTEGER,
      operator_name TEXT,
      operator_role TEXT,
      action TEXT NOT NULL,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_clue_orders_status ON clue_orders(status);
    CREATE INDEX IF NOT EXISTS idx_clue_orders_stage ON clue_orders(current_stage);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_order ON operation_logs(order_no);
  `;

  const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    db.run(stmt);
  }
  saveDb();
  console.log('Database initialized successfully');
}

export async function seedDemoData() {
  await getDb();
  const userCount = queryOne('SELECT COUNT(*) as cnt FROM users').cnt || 0;
  if (userCount > 0) {
    console.log('Demo data already seeded, skipping');
    return;
  }

  const users = [
    ['zs001', '张招商', 'INITIATOR'],
    ['zs002', '李招商', 'INITIATOR'],
    ['bl001', '王办理', 'HANDLER'],
    ['bl002', '赵办理', 'HANDLER'],
    ['fh001', '刘复核', 'REVIEWER']
  ];
  for (const u of users) {
    run('INSERT INTO users (username, name, role) VALUES (?, ?, ?)', u);
  }

  const allUsers = queryAll('SELECT * FROM users ORDER BY id');
  const userMap = Object.fromEntries(allUsers.map(u => [u.username, u]));

  const leads = [
    ['QY20250001', '上海星瀚科技有限公司', '陈总', '13800138001', '人工智能', '100-500人', 5000, '高', '推荐'],
    ['QY20250002', '深圳云帆新能源有限公司', '林经理', '13900139002', '新能源', '500人以上', 20000, '中', '展会'],
    ['QY20250003', '北京智联软件有限公司', '周总', '13700137003', '软件服务', '50-100人', 1000, '高', '主动拜访'],
    ['QY20250004', '杭州蓝鲸生物科技有限公司', '吴博士', '13600136004', '生物医药', '100-500人', 8000, '低', '推荐'],
    ['QY20250005', '苏州锐驰精密制造有限公司', '孙总', '13500135005', '高端制造', '500人以上', 15000, '高', '政府推荐']
  ];
  for (const l of leads) {
    run(
      'INSERT INTO enterprise_leads (clue_no, enterprise_name, contact_person, contact_phone, industry, scale, registered_capital, intention, source, initiator_id, initiator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [...l, userMap['zs001'].id, userMap['zs001'].name]
    );
  }

  const now = new Date().toISOString();

  const orders = [
    ['XS202506001', 'QY20250001', 'INITIATED', '星瀚科技入驻意向', 'HANDLE', userMap['zs001'].id, userMap['zs001'].name, now, null, null, null, null, null, 1, 0, 0],
    ['XS202506002', 'QY20250002', 'HANDLED', '云帆新能源投资洽谈', 'REVIEW_ARCHIVE', userMap['zs001'].id, userMap['zs001'].name, now, userMap['bl001'].id, userMap['bl001'].name, now, null, null, 1, 1, 0],
    ['XS202506003', 'QY20250003', 'INITIATED', '智联软件研发中心落地', 'HANDLE', userMap['zs002'].id, userMap['zs002'].name, now, null, null, null, null, null, 0, 0, 0],
    ['XS202506004', 'QY20250004', 'HANDLED', '蓝鲸生物中试基地', 'REVIEW_ARCHIVE', userMap['zs001'].id, userMap['zs001'].name, now, userMap['bl002'].id, userMap['bl002'].name, now, null, null, 1, 1, 1],
    ['XS202506005', 'QY20250005', 'REVIEWED', '锐驰精密智能制造基地', 'REVIEW_ARCHIVE', userMap['zs002'].id, userMap['zs002'].name, now, userMap['bl001'].id, userMap['bl001'].name, now, userMap['fh001'].id, userMap['fh001'].name, 1, 1, 1]
  ];
  for (const o of orders) {
    run(
      'INSERT INTO clue_orders (order_no, clue_no, status, title, current_stage, initiator_id, initiator_name, initiate_time, handler_id, handler_name, handle_time, reviewer_id, reviewer_name, has_enterprise_evidence, has_followup_evidence, has_signing_evidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      o
    );
  }

  const followups = [
    ['QY20250002', '2025-06-05', '园区会议室A', '李招商、王办理、云帆林经理', '讨论了新能源项目落地细节，对方提出需要3000平米厂房和电价优惠', 'meeting_summary_20250605.pdf', userMap['bl001'].id, userMap['bl001'].name],
    ['QY20250004', '2025-06-08', '杭州蓝鲸生物', '王办理、蓝鲸吴博士', '考察了对方实验室，了解中试基地需求，对方提供了环评报告初稿', 'site_visit_photos.zip', userMap['bl002'].id, userMap['bl002'].name],
    ['QY20250005', '2025-06-02', '苏州锐驰精密', '李招商、王办理、锐驰孙总', '实地考察生产车间，确认了智能制造基地的需求和投资规模', 'factory_inspection_report.pdf', userMap['bl001'].id, userMap['bl001'].name]
  ];
  for (const f of followups) {
    run(
      'INSERT INTO follow_up_records (clue_no, visit_date, location, participants, content, attachment, handler_id, handler_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      f
    );
  }

  const signings = [
    ['QY20250004', 3000, '2025-06-10', '租赁中试基地2000平米，租期5年，享受前2年租金减半优惠', 'contract_draft_20250610.pdf', userMap['bl002'].id, userMap['bl002'].name],
    ['QY20250005', 25000, '2025-06-06', '拿地50亩建设智能制造基地，总投资2.5亿，享受园区招商引资政策', 'investment_agreement_v3.pdf', userMap['bl001'].id, userMap['bl001'].name]
  ];
  for (const s of signings) {
    run(
      'INSERT INTO signing_confirmations (clue_no, contract_amount, signing_date, contract_terms, attachment, handler_id, handler_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
      s
    );
  }

  const logs = [
    ['XS202506001', userMap['zs001'].id, userMap['zs001'].name, 'INITIATOR', '发起线索单', '创建线索单，关联企业QY20250001'],
    ['XS202506002', userMap['zs001'].id, userMap['zs001'].name, 'INITIATOR', '发起线索单', '创建线索单，关联企业QY20250002'],
    ['XS202506002', userMap['bl001'].id, userMap['bl001'].name, 'HANDLER', '办理线索单', '添加跟进拜访记录，等待签约确认'],
    ['XS202506003', userMap['zs002'].id, userMap['zs002'].name, 'INITIATOR', '发起线索单', '创建线索单，关联企业QY20250003'],
    ['XS202506004', userMap['zs001'].id, userMap['zs001'].name, 'INITIATOR', '发起线索单', '创建线索单，关联企业QY20250004'],
    ['XS202506004', userMap['bl002'].id, userMap['bl002'].name, 'HANDLER', '办理线索单', '完成跟进拜访和签约确认'],
    ['XS202506005', userMap['zs002'].id, userMap['zs002'].name, 'INITIATOR', '发起线索单', '创建线索单，关联企业QY20250005'],
    ['XS202506005', userMap['bl001'].id, userMap['bl001'].name, 'HANDLER', '办理线索单', '完成跟进拜访和签约确认'],
    ['XS202506005', userMap['fh001'].id, userMap['fh001'].name, 'REVIEWER', '复核通过', '复核通过，证据齐全']
  ];
  for (const l of logs) {
    run(
      'INSERT INTO operation_logs (order_no, operator_id, operator_name, operator_role, action, detail) VALUES (?, ?, ?, ?, ?, ?)',
      l
    );
  }

  console.log('Demo data seeded successfully');
}

export default { getDb, initDatabase, seedDemoData, run, exec, queryOne, queryAll, saveDb };
