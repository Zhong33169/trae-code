const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "data.db");

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

function initSchema() {
  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('registrar','supervisor','reviewer')),
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS adjustment_forms (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      department TEXT NOT NULL,
      adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('increase','decrease','transfer')),
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft','pending_review','pending_archive','archived','rejected','returned')),
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS form_evidence (
      id TEXT PRIMARY KEY,
      form_id TEXT NOT NULL,
      evidence_type TEXT NOT NULL CHECK(evidence_type IN ('budget_adjustment','department_confirm','approval_effective')),
      description TEXT NOT NULL,
      file_name TEXT,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (form_id) REFERENCES adjustment_forms(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS form_supplements (
      id TEXT PRIMARY KEY,
      form_id TEXT NOT NULL,
      supplement_type TEXT NOT NULL CHECK(supplement_type IN ('correction','evidence_add','note')),
      content TEXT NOT NULL,
      reason TEXT NOT NULL,
      supplemented_by TEXT NOT NULL,
      supplemented_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (form_id) REFERENCES adjustment_forms(id),
      FOREIGN KEY (supplemented_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS form_actions (
      id TEXT PRIMARY KEY,
      form_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('submit','review_approve','review_reject','review_return','archive','supplement','correct')),
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      comment TEXT,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      version INTEGER NOT NULL,
      acted_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (form_id) REFERENCES adjustment_forms(id),
      FOREIGN KEY (actor_id) REFERENCES users(id)
    );
  `);
}

function seedData() {
  const d = getDb();

  const userCount = d.prepare("SELECT COUNT(*) as c FROM users").get().c;
  if (userCount > 0) return;

  const insertUser = d.prepare(
    "INSERT INTO users (id, name, role, password) VALUES (?, ?, ?, ?)"
  );

  insertUser.run("registrar1", "张登记", "registrar", "123456");
  insertUser.run("registrar2", "李登记", "registrar", "123456");
  insertUser.run("supervisor1", "王审核", "supervisor", "123456");
  insertUser.run("supervisor2", "赵审核", "supervisor", "123456");
  insertUser.run("reviewer1", "孙复核", "reviewer", "123456");
  insertUser.run("reviewer2", "周复核", "reviewer", "123456");

  const insertForm = d.prepare(`
    INSERT INTO adjustment_forms (id, title, department, adjustment_type, amount, reason, status, version, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvidence = d.prepare(`
    INSERT INTO form_evidence (id, form_id, evidence_type, description, file_name, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertAction = d.prepare(`
    INSERT INTO form_actions (id, form_id, action, actor_id, actor_role, comment, from_status, to_status, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSupplement = d.prepare(`
    INSERT INTO form_supplements (id, form_id, supplement_type, content, reason, supplemented_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  insertForm.run("ADJ-2026-001", "市场部Q3预算追加", "市场部", "increase", 500000, "Q3推广活动增加，需追加预算", "pending_review", 1, "registrar1");
  insertEvidence.run("EV-001-1", "ADJ-2026-001", "budget_adjustment", "预算调整申请表", "adjustment_apply.pdf", "registrar1");
  insertEvidence.run("EV-001-2", "ADJ-2026-001", "department_confirm", "市场部确认函", "dept_confirm.pdf", "registrar1");
  insertEvidence.run("EV-001-3", "ADJ-2026-001", "approval_effective", "审批生效通知书", "approval_notice.pdf", "registrar1");
  insertAction.run("ACT-001-1", "ADJ-2026-001", "submit", "registrar1", "registrar", "提交市场部Q3预算追加申请", "draft", "pending_review", 1);

  insertForm.run("ADJ-2026-002", "研发部设备采购预算调减", "研发部", "decrease", 200000, "部分设备采购推迟至下季度", "draft", 1, "registrar1");
  insertEvidence.run("EV-002-1", "ADJ-2026-002", "budget_adjustment", "预算调整申请表", "adjustment_apply.pdf", "registrar1");

  insertForm.run("ADJ-2026-003", "行政部办公预算划转", "行政部", "transfer", 150000, "办公费用划转至IT部门", "pending_archive", 1, "registrar1");
  insertEvidence.run("EV-003-1", "ADJ-2026-003", "budget_adjustment", "预算调整申请表", "adjustment_apply.pdf", "registrar1");
  insertEvidence.run("EV-003-2", "ADJ-2026-003", "department_confirm", "行政部确认函", "dept_confirm.pdf", "registrar1");
  insertEvidence.run("EV-003-3", "ADJ-2026-003", "approval_effective", "审批生效通知书", "approval_notice.pdf", "registrar1");
  insertAction.run("ACT-003-1", "ADJ-2026-003", "submit", "registrar1", "registrar", "提交行政部办公预算划转申请", "draft", "pending_review", 1);
  insertAction.run("ACT-003-2", "ADJ-2026-003", "review_approve", "supervisor1", "supervisor", "同意，材料齐全", "pending_review", "pending_archive", 1);

  insertForm.run("ADJ-2026-004", "销售部差旅费追加（缺证据）", "销售部", "increase", 300000, "差旅费用超支需追加", "pending_review", 1, "registrar2");
  insertEvidence.run("EV-004-1", "ADJ-2026-004", "budget_adjustment", "预算调整申请表", "adjustment_apply.pdf", "registrar2");

  insertForm.run("ADJ-2026-005", "人力资源部培训预算追加（被退回）", "人力资源部", "increase", 100000, "年度培训计划变更", "draft", 2, "registrar1");
  insertEvidence.run("EV-005-1", "ADJ-2026-005", "budget_adjustment", "预算调整申请表", "adjustment_apply_v2.pdf", "registrar1");
  insertAction.run("ACT-005-1", "ADJ-2026-005", "submit", "registrar1", "registrar", "提交培训预算追加申请", "draft", "pending_review", 1);
  insertAction.run("ACT-005-2", "ADJ-2026-005", "review_return", "supervisor1", "supervisor", "部门确认函缺失，请补充", "pending_review", "returned", 1);
  insertAction.run("ACT-005-3", "ADJ-2026-005", "correct", "registrar1", "registrar", "补充部门确认函后重新提交", "returned", "draft", 2);

  insertForm.run("ADJ-2026-006", "财务部审计费调减（已归档）", "财务部", "decrease", 80000, "审计服务费用减少", "archived", 1, "registrar2");
  insertEvidence.run("EV-006-1", "ADJ-2026-001", "budget_adjustment", "预算调整申请表", "adjustment_apply.pdf", "registrar2");
  insertEvidence.run("EV-006-2", "ADJ-2026-006", "department_confirm", "财务部确认函", "dept_confirm.pdf", "registrar2");
  insertEvidence.run("EV-006-3", "ADJ-2026-006", "approval_effective", "审批生效通知书", "approval_notice.pdf", "registrar2");
  insertAction.run("ACT-006-1", "ADJ-2026-006", "submit", "registrar2", "registrar", "提交审计费调减申请", "draft", "pending_review", 1);
  insertAction.run("ACT-006-2", "ADJ-2026-006", "review_approve", "supervisor2", "supervisor", "同意调减", "pending_review", "pending_archive", 1);
  insertAction.run("ACT-006-3", "ADJ-2026-006", "archive", "reviewer1", "reviewer", "归档完成", "pending_archive", "archived", 1);

  insertForm.run("ADJ-2026-007", "IT部云服务预算追加（重复提交测试）", "IT部", "increase", 250000, "云服务扩容需要追加预算", "pending_review", 1, "registrar1");
  insertEvidence.run("EV-007-1", "ADJ-2026-007", "budget_adjustment", "预算调整申请表", "adjustment_apply.pdf", "registrar1");
  insertEvidence.run("EV-007-2", "ADJ-2026-007", "department_confirm", "IT部确认函", "dept_confirm.pdf", "registrar1");
  insertAction.run("ACT-007-1", "ADJ-2026-007", "submit", "registrar1", "registrar", "提交云服务预算追加", "draft", "pending_review", 1);

  insertForm.run("ADJ-2026-008", "法务部咨询费预算划转（补录测试）", "法务部", "transfer", 60000, "咨询费划转至外聘律师费", "pending_review", 1, "registrar2");
  insertEvidence.run("EV-008-1", "ADJ-2026-008", "budget_adjustment", "预算调整申请表", "adjustment_apply.pdf", "registrar2");
  insertEvidence.run("EV-008-2", "ADJ-2026-008", "department_confirm", "法务部确认函", "dept_confirm.pdf", "registrar2");
  insertAction.run("ACT-008-1", "ADJ-2026-008", "submit", "registrar2", "registrar", "提交咨询费划转申请", "draft", "pending_review", 1);

  insertSupplement.run("SUP-005-1", "ADJ-2026-005", "correction", "补充部门确认函，修正申请金额", "被退回后补正", "registrar1");
  insertSupplement.run("SUP-005-2", "ADJ-2026-005", "evidence_add", "增加部门确认函附件", "审核主管要求补充", "registrar1");
}

module.exports = { getDb, initSchema, seedData };
