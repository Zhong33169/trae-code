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

  run('DELETE FROM operation_logs');
  run('DELETE FROM signing_confirmations');
  run('DELETE FROM follow_up_records');
  run('DELETE FROM clue_orders');
  run('DELETE FROM enterprise_leads');
  run('DELETE FROM users');

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
    ['QY20250003', '北京智联软件有限公司', '', '', '软件服务', '50-100人', 1000, '高', '主动拜访'],
    ['QY20250004', '杭州蓝鲸生物科技有限公司', '吴博士', '13600136004', '生物医药', '100-500人', 8000, '低', '推荐'],
    ['QY20250005', '苏州锐驰精密制造有限公司', '孙总', '13500135005', '高端制造', '500人以上', 15000, '高', '政府推荐'],
    ['QY20250006', '宁波海晟半导体有限公司', '黄总', '', '集成电路', '100-500人', 30000, '高', '展会']
  ];
  for (const l of leads) {
    run(
      'INSERT INTO enterprise_leads (clue_no, enterprise_name, contact_person, contact_phone, industry, scale, registered_capital, intention, source, initiator_id, initiator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [...l, userMap['zs001'].id, userMap['zs001'].name]
    );
  }

  const now = new Date().toISOString();

  const orders = [
    ['XS202506001', 'QY20250001', 'INITIATED', '星瀚科技AI研发中心入驻', 'HANDLE', userMap['zs001'].id, userMap['zs001'].name, now, null, null, null, null, null, null, 1, 0, 0, '发起阶段：有企业信息，缺跟进、签约'],
    ['XS202506002', 'QY20250002', 'INITIATED', '云帆新能源华中区域总部', 'HANDLE', userMap['zs001'].id, userMap['zs001'].name, now, userMap['bl001'].id, userMap['bl001'].name, null, null, null, null, 1, 0, 0, '指定王办理(bl001)接手，缺跟进、签约 — 用于测试非办理人拦截'],
    ['XS202506003', 'QY20250003', 'INITIATED', '智联软件行业SaaS研发中心', 'HANDLE', userMap['zs002'].id, userMap['zs002'].name, now, null, null, null, null, null, null, 0, 0, 0, '企业线索联系人/电话均为空 — 真实缺企业信息场景'],
    ['XS202506004', 'QY20250006', 'INITIATED', '海晟半导体设备项目', 'HANDLE', userMap['zs001'].id, userMap['zs001'].name, now, userMap['bl002'].id, userMap['bl002'].name, null, null, null, null, 1, 1, 0, '指定赵办理(bl002)接手，已有跟进，缺签约 — 办齐后可推到复核'],
    ['XS202506005', 'QY20250004', 'HANDLED', '蓝鲸生物中试基地项目', 'REVIEW_ARCHIVE', userMap['zs001'].id, userMap['zs001'].name, now, userMap['bl002'].id, userMap['bl002'].name, now, null, null, null, 1, 1, 0, '已办理推进到复核阶段，仅有跟进缺签约 — 测试"缺签约不可归档"'],
    ['XS202506006', 'QY20250005', 'HANDLED', '锐驰精密智能制造基地', 'REVIEW_ARCHIVE', userMap['zs002'].id, userMap['zs002'].name, now, userMap['bl001'].id, userMap['bl001'].name, now, null, null, null, 1, 1, 1, '证据齐全已办理完成 — 测试"正常可归档"']
  ];
  for (const o of orders) {
    run(
      'INSERT INTO clue_orders (order_no, clue_no, status, title, current_stage, initiator_id, initiator_name, initiate_time, handler_id, handler_name, handle_time, reviewer_id, reviewer_name, review_time, has_enterprise_evidence, has_followup_evidence, has_signing_evidence, evidence_check_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      o
    );
  }

  const followups = [
    ['QY20250006', '2025-06-02', '园区规划展示厅', '赵办理(bl002)、海晟半导体黄总', '海晟半导体对园区集成电路配套及补贴政策高度关注，已提供企业营业执照和投资计划书扫描件', 'haisheng_investment_plan.pdf', userMap['bl002'].id, userMap['bl002'].name],
    ['QY20250004', '2025-06-05', '杭州蓝鲸生物会议室', '赵办理(bl002)、蓝鲸吴博士', '考察了蓝鲸生物现有实验室，讨论了中试基地2000平米的布局需求和环评要求', 'bluewhale_site_visit.zip', userMap['bl002'].id, userMap['bl002'].name],
    ['QY20250005', '2025-06-01', '苏州锐驰精密工厂', '王办理(bl001)、锐驰孙总', '实地考察锐驰现有生产车间，确认了50亩工业用地需求及智能制造投资规模', 'ruichi_factory_report.pdf', userMap['bl001'].id, userMap['bl001'].name],
    ['QY20250005', '2025-06-08', '园区招商中心会议室B', '王办理(bl001)、李招商(zs002)、锐驰孙总', '第三次商务谈判，就土地出让金、建设周期、人才公寓配套达成一致', 'meeting_minutes_0608.pdf', userMap['bl001'].id, userMap['bl001'].name]
  ];
  for (const f of followups) {
    run(
      'INSERT INTO follow_up_records (clue_no, visit_date, location, participants, content, attachment, handler_id, handler_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      f
    );
  }

  const signings = [
    ['QY20250005', 25000, '2025-06-10', '签订《工业项目投资协议》：出让工业用地50亩，总投资2.5亿元人民币，享受园区重大项目招商引资一揽子政策', 'ruichi_investment_agreement_v3.pdf', userMap['bl001'].id, userMap['bl001'].name]
  ];
  for (const s of signings) {
    run(
      'INSERT INTO signing_confirmations (clue_no, contract_amount, signing_date, contract_terms, attachment, handler_id, handler_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
      s
    );
  }

  const logs = [
    ['XS202506001', userMap['zs001'].id, userMap['zs001'].name, 'INITIATOR', '发起线索单', '创建线索单，关联QY20250001上海星瀚科技，当前缺跟进、签约证据'],
    ['XS202506002', userMap['zs001'].id, userMap['zs001'].name, 'INITIATOR', '发起线索单', '创建线索单，关联QY20250002深圳云帆新能源，指定王办理(bl001)接手'],
    ['XS202506003', userMap['zs002'].id, userMap['zs002'].name, 'INITIATOR', '发起线索单', '创建线索单，关联QY20250003北京智联软件，企业线索联系人/电话均缺失 — 真实缺企业信息'],
    ['XS202506004', userMap['zs001'].id, userMap['zs001'].name, 'INITIATOR', '发起线索单', '创建线索单，关联QY20250006宁波海晟半导体，指定赵办理(bl002)接手，已有跟进记录'],
    ['XS202506004', userMap['bl002'].id, userMap['bl002'].name, 'HANDLER', '补录跟进拜访', '补录6月2日海晟半导体展厅参观记录，缺签约待补录'],
    ['XS202506005', userMap['zs001'].id, userMap['zs001'].name, 'INITIATOR', '发起线索单', '创建线索单，关联QY20250004杭州蓝鲸生物'],
    ['XS202506005', userMap['bl002'].id, userMap['bl002'].name, 'HANDLER', '办理线索单', '办理完成，推进到复核归档阶段；但仅补了跟进记录，未提交签约确认 — 用于测试缺证据归档拦截'],
    ['XS202506006', userMap['zs002'].id, userMap['zs002'].name, 'INITIATOR', '发起线索单', '创建线索单，关联QY20250005苏州锐驰精密'],
    ['XS202506006', userMap['bl001'].id, userMap['bl001'].name, 'HANDLER', '补录跟进拜访', '补录6月1日现场考察记录'],
    ['XS202506006', userMap['bl001'].id, userMap['bl001'].name, 'HANDLER', '补录签约确认', '补录6月10日2.5亿元投资协议'],
    ['XS202506006', userMap['bl001'].id, userMap['bl001'].name, 'HANDLER', '办理线索单', '证据齐全（企业+跟进×2+签约），办理完成推进到复核归档阶段，待复核员归档']
  ];
  for (const l of logs) {
    run(
      'INSERT INTO operation_logs (order_no, operator_id, operator_name, operator_role, action, detail) VALUES (?, ?, ?, ?, ?, ?)',
      l
    );
  }

  console.log('✅ 演示数据已重置并重新生成完毕');
}

export default { getDb, initDatabase, seedDemoData, run, exec, queryOne, queryAll, saveDb };
