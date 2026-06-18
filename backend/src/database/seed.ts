import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  UserRole, RiskLevel, ReviewStatus, ReviewAction, RISK_PRIORITY,
} from '../review/review.types';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'deviation.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('FINANCIAL_ADVISOR','COMPLIANCE_OFFICER','BRANCH_MANAGER')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trade_reviews (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    trade_type TEXT NOT NULL,
    trade_amount REAL NOT NULL,
    trade_date TEXT NOT NULL,
    account_no TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK(risk_level IN ('HIGH','MEDIUM','LOW')),
    status TEXT NOT NULL CHECK(status IN ('REGISTERED','PENDING_CORRECTION','REVIEWING','COMPLETED')),
    priority INTEGER NOT NULL DEFAULT 0,
    current_handler_id TEXT,
    current_role TEXT CHECK(current_role IN ('FINANCIAL_ADVISOR','COMPLIANCE_OFFICER','BRANCH_MANAGER')),
    version INTEGER NOT NULL DEFAULT 1,
    evidence_json TEXT,
    deadline TEXT,
    is_overdue INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS review_records (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('REGISTER','SUBMIT_REVIEW','REQUEST_CORRECTION','CORRECT','CONFIRM_COMPLETE','REJECT','APPROVE')),
    from_status TEXT,
    to_status TEXT,
    opinion TEXT,
    result TEXT,
    evidence_json TEXT,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_review_status ON trade_reviews(status);
  CREATE INDEX IF NOT EXISTS idx_review_priority ON trade_reviews(priority DESC);
  CREATE INDEX IF NOT EXISTS idx_review_risk ON trade_reviews(risk_level);
  CREATE INDEX IF NOT EXISTS idx_review_handler ON trade_reviews(current_handler_id);
  CREATE INDEX IF NOT EXISTS idx_records_review ON review_records(review_id, created_at DESC);
`);

const advisorId = uuidv4();
const officerId = uuidv4();
const managerId = uuidv4();
const advisor2Id = uuidv4();

const users = [
  { id: advisorId, name: '张伟', role: UserRole.FINANCIAL_ADVISOR },
  { id: advisor2Id, name: '李娜', role: UserRole.FINANCIAL_ADVISOR },
  { id: officerId, name: '王强', role: UserRole.COMPLIANCE_OFFICER },
  { id: managerId, name: '赵敏', role: UserRole.BRANCH_MANAGER },
];

const insertUser = db.prepare('INSERT INTO users (id, name, role) VALUES (?, ?, ?)');
const insertReview = db.prepare(`
  INSERT INTO trade_reviews (
    id, code, customer_name, trade_type, trade_amount, trade_date, account_no,
    risk_level, status, priority, current_handler_id, current_role, version,
    evidence_json, deadline, is_overdue, created_by, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertRecord = db.prepare(`
  INSERT INTO review_records (
    id, review_id, operator_id, operator_name, operator_role, action,
    from_status, to_status, opinion, result, evidence_json, version, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const tx = db.transaction(() => {
  for (const u of users) insertUser.run(u.id, u.name, u.role);

  const baseEvidence = JSON.stringify(['客户身份证明', '交易授权书', '风险揭示书']);
  const highEvidence = JSON.stringify(['客户身份证明', '交易授权书', '风险揭示书', '资金来源证明']);
  const partialEvidence = JSON.stringify(['客户身份证明']);

  const now = new Date();
  const daysAgo = (d: number) => {
    const t = new Date(now);
    t.setDate(t.getDate() - d);
    return t.toISOString().slice(0, 19).replace('T', ' ');
  };
  const daysLater = (d: number) => {
    const t = new Date(now);
    t.setDate(t.getDate() + d);
    return t.toISOString().slice(0, 19).replace('T', ' ');
  };

  function createReview(opts: {
    code: string; customer: string; type: string; amount: number;
    tradeDate: string; account: string; risk: RiskLevel; status: ReviewStatus;
    handlerId: string | null; handlerRole: UserRole | null; version: number;
    evidence: string; deadline: string | null; overdue: number;
    createdAt: string; updatedAt: string;
  }) {
    const id = uuidv4();
    insertReview.run(
      id, opts.code, opts.customer, opts.type, opts.amount, opts.tradeDate,
      opts.account, opts.risk, opts.status, RISK_PRIORITY[opts.risk],
      opts.handlerId, opts.handlerRole, opts.version, opts.evidence,
      opts.deadline, opts.overdue, advisorId, opts.createdAt, opts.updatedAt,
    );
    return id;
  }

  function addRecord(opts: {
    reviewId: string; operatorId: string; operatorName: string;
    operatorRole: UserRole; action: ReviewAction; fromStatus: ReviewStatus | null;
    toStatus: ReviewStatus | null; opinion: string; result: string;
    evidence: string | null; version: number; createdAt: string;
  }) {
    insertRecord.run(
      uuidv4(), opts.reviewId, opts.operatorId, opts.operatorName,
      opts.operatorRole, opts.action, opts.fromStatus, opts.toStatus,
      opts.opinion, opts.result, opts.evidence, opts.version, opts.createdAt,
    );
  }

  const review1Id = createReview({
    code: 'TR-20250615-1001', customer: '陈建国', type: '股票买入', amount: 580000,
    tradeDate: '2025-06-15', account: '881200003421', risk: RiskLevel.HIGH,
    status: ReviewStatus.COMPLETED, handlerId: null, handlerRole: null,
    version: 4, evidence: highEvidence, deadline: daysLater(3), overdue: 0,
    createdAt: daysAgo(5), updatedAt: daysAgo(2),
  });
  addRecord({
    reviewId: review1Id, operatorId: advisorId, operatorName: '张伟',
    operatorRole: UserRole.FINANCIAL_ADVISOR, action: ReviewAction.REGISTER,
    fromStatus: null, toStatus: ReviewStatus.REGISTERED,
    opinion: '客户大额买入高风险股票，已按要求收集全部证据',
    result: '登记成功', evidence: highEvidence, version: 1, createdAt: daysAgo(5),
  });
  addRecord({
    reviewId: review1Id, operatorId: officerId, operatorName: '王强',
    operatorRole: UserRole.COMPLIANCE_OFFICER, action: ReviewAction.SUBMIT_REVIEW,
    fromStatus: ReviewStatus.REGISTERED, toStatus: ReviewStatus.REVIEWING,
    opinion: '核验通过：资金来源清晰，客户风险承受能力匹配',
    result: '提交复核成功', evidence: highEvidence, version: 2, createdAt: daysAgo(4),
  });
  addRecord({
    reviewId: review1Id, operatorId: managerId, operatorName: '赵敏',
    operatorRole: UserRole.BRANCH_MANAGER, action: ReviewAction.CONFIRM_COMPLETE,
    fromStatus: ReviewStatus.REVIEWING, toStatus: ReviewStatus.COMPLETED,
    opinion: '复核通过，交易合规，材料齐全',
    result: '已办结归档', evidence: highEvidence, version: 4, createdAt: daysAgo(2),
  });

  const review2Id = createReview({
    code: 'TR-20250616-1002', customer: '刘美丽', type: '基金申购', amount: 120000,
    tradeDate: '2025-06-16', account: '881200004567', risk: RiskLevel.MEDIUM,
    status: ReviewStatus.REVIEWING, handlerId: managerId, handlerRole: UserRole.BRANCH_MANAGER,
    version: 3, evidence: baseEvidence, deadline: daysLater(1), overdue: 0,
    createdAt: daysAgo(3), updatedAt: daysAgo(1),
  });
  addRecord({
    reviewId: review2Id, operatorId: advisorId, operatorName: '张伟',
    operatorRole: UserRole.FINANCIAL_ADVISOR, action: ReviewAction.REGISTER,
    fromStatus: null, toStatus: ReviewStatus.REGISTERED,
    opinion: '客户申购混合型基金',
    result: '登记成功', evidence: baseEvidence, version: 1, createdAt: daysAgo(3),
  });
  addRecord({
    reviewId: review2Id, operatorId: officerId, operatorName: '王强',
    operatorRole: UserRole.COMPLIANCE_OFFICER, action: ReviewAction.REQUEST_CORRECTION,
    fromStatus: ReviewStatus.REGISTERED, toStatus: ReviewStatus.PENDING_CORRECTION,
    opinion: '缺少客户风险测评报告，请补充',
    result: '退回补正', evidence: null, version: 2, createdAt: daysAgo(2),
  });
  addRecord({
    reviewId: review2Id, operatorId: advisorId, operatorName: '张伟',
    operatorRole: UserRole.FINANCIAL_ADVISOR, action: ReviewAction.CORRECT,
    fromStatus: ReviewStatus.PENDING_CORRECTION, toStatus: ReviewStatus.REGISTERED,
    opinion: '已补充风险测评报告（2025年6月最新），风险等级C4匹配',
    result: '补正完成', evidence: baseEvidence, version: 3, createdAt: daysAgo(1),
  });
  addRecord({
    reviewId: review2Id, operatorId: officerId, operatorName: '王强',
    operatorRole: UserRole.COMPLIANCE_OFFICER, action: ReviewAction.SUBMIT_REVIEW,
    fromStatus: ReviewStatus.REGISTERED, toStatus: ReviewStatus.REVIEWING,
    opinion: '补正材料核验通过，提交经理复核',
    result: '提交复核成功', evidence: baseEvidence, version: 3, createdAt: daysAgo(1),
  });

  const review3Id = createReview({
    code: 'TR-20250617-1003', customer: '周大海', type: '融资融券', amount: 890000,
    tradeDate: '2025-06-17', account: '881200007890', risk: RiskLevel.HIGH,
    status: ReviewStatus.PENDING_CORRECTION, handlerId: advisorId, handlerRole: UserRole.FINANCIAL_ADVISOR,
    version: 2, evidence: partialEvidence, deadline: daysAgo(1), overdue: 1,
    createdAt: daysAgo(2), updatedAt: daysAgo(1),
  });
  addRecord({
    reviewId: review3Id, operatorId: advisor2Id, operatorName: '李娜',
    operatorRole: UserRole.FINANCIAL_ADVISOR, action: ReviewAction.REGISTER,
    fromStatus: null, toStatus: ReviewStatus.REGISTERED,
    opinion: '融资融券开户交易，客户为高净值客户',
    result: '登记成功', evidence: partialEvidence, version: 1, createdAt: daysAgo(2),
  });
  addRecord({
    reviewId: review3Id, operatorId: officerId, operatorName: '王强',
    operatorRole: UserRole.COMPLIANCE_OFFICER, action: ReviewAction.REQUEST_CORRECTION,
    fromStatus: ReviewStatus.REGISTERED, toStatus: ReviewStatus.PENDING_CORRECTION,
    opinion: '高风险业务缺少：资金来源证明、融资融券风险揭示书、担保品清单。请于1个工作日内补正',
    result: '退回补正（逾期中）', evidence: null, version: 2, createdAt: daysAgo(1),
  });

  const review4Id = createReview({
    code: 'TR-20250618-1004', customer: '吴小芳', type: '理财产品购买', amount: 50000,
    tradeDate: '2025-06-18', account: '881200009012', risk: RiskLevel.LOW,
    status: ReviewStatus.REGISTERED, handlerId: officerId, handlerRole: UserRole.COMPLIANCE_OFFICER,
    version: 1, evidence: JSON.stringify(['客户身份证明']), deadline: daysLater(7), overdue: 0,
    createdAt: daysAgo(0), updatedAt: daysAgo(0),
  });
  addRecord({
    reviewId: review4Id, operatorId: advisor2Id, operatorName: '李娜',
    operatorRole: UserRole.FINANCIAL_ADVISOR, action: ReviewAction.REGISTER,
    fromStatus: null, toStatus: ReviewStatus.REGISTERED,
    opinion: '低风险理财产品，仅上传身份证明，交易授权书待补充（系统提示缺证据）',
    result: '登记成功（待核验）', evidence: JSON.stringify(['客户身份证明']), version: 1, createdAt: daysAgo(0),
  });

  const review5Id = createReview({
    code: 'TR-20250614-1005', customer: '孙国华', type: '股票卖出+再买入', amount: 320000,
    tradeDate: '2025-06-14', account: '881200001122', risk: RiskLevel.MEDIUM,
    status: ReviewStatus.REGISTERED, handlerId: officerId, handlerRole: UserRole.COMPLIANCE_OFFICER,
    version: 3, evidence: baseEvidence, deadline: daysAgo(2), overdue: 1,
    createdAt: daysAgo(6), updatedAt: daysAgo(3),
  });
  addRecord({
    reviewId: review5Id, operatorId: advisorId, operatorName: '张伟',
    operatorRole: UserRole.FINANCIAL_ADVISOR, action: ReviewAction.REGISTER,
    fromStatus: null, toStatus: ReviewStatus.REGISTERED,
    opinion: '客户频繁交易，疑似异常，已留存材料',
    result: '登记成功', evidence: baseEvidence, version: 1, createdAt: daysAgo(6),
  });
  addRecord({
    reviewId: review5Id, operatorId: officerId, operatorName: '王强',
    operatorRole: UserRole.COMPLIANCE_OFFICER, action: ReviewAction.REQUEST_CORRECTION,
    fromStatus: ReviewStatus.REGISTERED, toStatus: ReviewStatus.PENDING_CORRECTION,
    opinion: '状态冲突：客户交易记录与柜台系统不一致，请核实交易时间戳并补充说明',
    result: '退回补正（状态冲突）', evidence: null, version: 2, createdAt: daysAgo(5),
  });
  addRecord({
    reviewId: review5Id, operatorId: advisorId, operatorName: '张伟',
    operatorRole: UserRole.FINANCIAL_ADVISOR, action: ReviewAction.CORRECT,
    fromStatus: ReviewStatus.PENDING_CORRECTION, toStatus: ReviewStatus.REGISTERED,
    opinion: '已核实：系统时间差导致，补充了柜台流水截图及客户签字确认说明',
    result: '补正完成，待重新核验', evidence: baseEvidence, version: 3, createdAt: daysAgo(3),
  });

  const review6Id = createReview({
    code: 'TR-20250618-1006', customer: '钱志强', type: '期权交易', amount: 1500000,
    tradeDate: '2025-06-18', account: '881200003344', risk: RiskLevel.HIGH,
    status: ReviewStatus.REGISTERED, handlerId: officerId, handlerRole: UserRole.COMPLIANCE_OFFICER,
    version: 1, evidence: highEvidence, deadline: daysLater(2), overdue: 0,
    createdAt: daysAgo(0), updatedAt: daysAgo(0),
  });
  addRecord({
    reviewId: review6Id, operatorId: advisorId, operatorName: '张伟',
    operatorRole: UserRole.FINANCIAL_ADVISOR, action: ReviewAction.REGISTER,
    fromStatus: null, toStatus: ReviewStatus.REGISTERED,
    opinion: '首次期权交易，已完成适当性评估，材料齐全',
    result: '登记成功', evidence: highEvidence, version: 1, createdAt: daysAgo(0),
  });
});

tx();
console.log('种子数据已生成，共 4 名用户、6 笔交易核查单、14 条操作记录');
console.log(`用户列表：张伟(理财顾问)、李娜(理财顾问)、王强(合规专员)、赵敏(营业部经理)`);
console.log(`样例覆盖：正常办结(1001)、复核中(1002)、待补正-逾期(1003)、已登记-缺证据(1004)、已登记-状态冲突-逾期(1005)、高风险正常登记(1006)`);
db.close();
