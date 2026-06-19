import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'requirement_tracker.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE requirement_tickets (
    id TEXT PRIMARY KEY,
    ticket_no TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    stage TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    customer_name TEXT,
    customer_contact TEXT,
    product_version TEXT,
    deadline TEXT,
    result TEXT,
    reject_reason TEXT,
    audit_remark TEXT,
    is_abnormal INTEGER DEFAULT 0,
    abnormal_type TEXT,
    source TEXT DEFAULT 'online',
    import_batch_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    auditor_id TEXT,
    audit_time TEXT,
    reviewer_id TEXT,
    review_time TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (auditor_id) REFERENCES users(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
  );

  CREATE TABLE ticket_attachments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by TEXT,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES requirement_tickets(id) ON DELETE CASCADE
  );

  CREATE TABLE ticket_audit_logs (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    action TEXT NOT NULL,
    action_type TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL,
    is_failure INTEGER DEFAULT 0,
    failure_reason TEXT,
    FOREIGN KEY (ticket_id) REFERENCES requirement_tickets(id) ON DELETE CASCADE
  );

  CREATE TABLE import_batches (
    id TEXT PRIMARY KEY,
    batch_no TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    conflict_count INTEGER DEFAULT 0,
    imported_by TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    FOREIGN KEY (imported_by) REFERENCES users(id)
  );

  CREATE TABLE import_records (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    ticket_id TEXT,
    source_ticket_no TEXT NOT NULL,
    status TEXT NOT NULL,
    result TEXT,
    diff_detail TEXT,
    FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE CASCADE
  );

  CREATE INDEX idx_tickets_stage ON requirement_tickets(stage);
  CREATE INDEX idx_tickets_status ON requirement_tickets(status);
  CREATE INDEX idx_tickets_is_abnormal ON requirement_tickets(is_abnormal);
  CREATE INDEX idx_audit_logs_ticket ON ticket_audit_logs(ticket_id);
  CREATE INDEX idx_import_records_batch ON import_records(batch_id);
`);

const users = [
  { id: 'u1', username: 'registrar1', name: '张登记', role: 'registrar' },
  { id: 'u2', username: 'auditor1', name: '李审核', role: 'auditor' },
  { id: 'u3', username: 'reviewer1', name: '王复核', role: 'reviewer' },
];

const insertUser = db.prepare(`
  INSERT INTO users (id, username, name, role, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

users.forEach(u => {
  insertUser.run(u.id, u.username, u.name, u.role, dayjs().format('YYYY-MM-DD HH:mm:ss'));
});

const now = dayjs();

const tickets = [
  {
    id: 't1',
    ticket_no: 'REQ-2024-001',
    title: '正常推进的正常需求单',
    description: '客户反馈需要增加数据导出功能，支持 Excel 格式',
    stage: 'feedback',
    status: 'pending_audit',
    priority: 'high',
    customer_name: 'ABC公司',
    customer_contact: '13800138001',
    product_version: 'v2.3.0',
    deadline: now.add(7, 'day').format('YYYY-MM-DD'),
    is_abnormal: 0,
    source: 'online',
    created_by: 'u1',
    created_at: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updated_at: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
  },
  {
    id: 't2',
    ticket_no: 'REQ-2024-002',
    title: '缺材料的需求单',
    description: '客户反馈报表展示异常，但缺少相关材料',
    stage: 'feedback',
    status: 'material_missing',
    priority: 'medium',
    customer_name: 'XYZ公司',
    customer_contact: '13900139002',
    product_version: 'v2.3.0',
    deadline: now.add(3, 'day').format('YYYY-MM-DD'),
    is_abnormal: 1,
    abnormal_type: 'material_missing',
    source: 'online',
    reject_reason: '缺少需求规格说明书和客户签字确认件',
    created_by: 'u1',
    created_at: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updated_at: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    auditor_id: 'u2',
    audit_time: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
  },
  {
    id: 't3',
    ticket_no: 'REQ-2024-003',
    title: '超时未处理的需求单',
    description: '客户反馈系统登录速度慢的问题',
    stage: 'product_review',
    status: 'overdue',
    priority: 'high',
    customer_name: '123公司',
    customer_contact: '13700137003',
    product_version: 'v2.2.0',
    deadline: now.subtract(1, 'day').format('YYYY-MM-DD'),
    is_abnormal: 1,
    abnormal_type: 'overdue',
    source: 'online',
    created_by: 'u1',
    created_at: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updated_at: now.subtract(8, 'day').format('YYYY-MM-DD HH:mm:ss'),
    auditor_id: 'u2',
    audit_time: now.subtract(8, 'day').format('YYYY-MM-DD HH:mm:ss'),
  },
  {
    id: 't4',
    ticket_no: 'REQ-2024-004',
    title: '被退回补正的需求单',
    description: '客户反馈需要增加权限管理模块',
    stage: 'feedback',
    status: 'returned',
    priority: 'medium',
    customer_name: '456公司',
    customer_contact: '13600136004',
    product_version: 'v2.4.0',
    deadline: now.add(5, 'day').format('YYYY-MM-DD'),
    is_abnormal: 1,
    abnormal_type: 'returned',
    source: 'online',
    reject_reason: '需求描述不清晰，需要补充详细的权限分级说明和业务场景描述',
    created_by: 'u1',
    created_at: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updated_at: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    auditor_id: 'u2',
    audit_time: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
  },
  {
    id: 't5',
    ticket_no: 'REQ-2024-005',
    title: '产品评审通过的需求单',
    description: '客户反馈需要增加移动端适配',
    stage: 'product_review',
    status: 'review_passed',
    priority: 'high',
    customer_name: '789公司',
    customer_contact: '13500135005',
    product_version: 'v3.0.0',
    deadline: now.add(15, 'day').format('YYYY-MM-DD'),
    result: '已纳入v3.0版本规划，预计下季度发布',
    is_abnormal: 0,
    source: 'online',
    created_by: 'u1',
    created_at: now.subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updated_at: now.subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'),
    auditor_id: 'u2',
    audit_time: now.subtract(6, 'day').format('YYYY-MM-DD HH:mm:ss'),
  },
  {
    id: 't6',
    ticket_no: 'REQ-2024-006',
    title: '发布回访中的需求单',
    description: '客户反馈报表优化需求已发布',
    stage: 'release_visit',
    status: 'pending_review',
    priority: 'medium',
    customer_name: 'AAA公司',
    customer_contact: '13400134006',
    product_version: 'v2.5.0',
    deadline: now.add(2, 'day').format('YYYY-MM-DD'),
    result: '报表功能已在v2.5.0版本发布，客户反馈良好',
    is_abnormal: 0,
    source: 'online',
    created_by: 'u1',
    created_at: now.subtract(15, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updated_at: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
    auditor_id: 'u2',
    audit_time: now.subtract(12, 'day').format('YYYY-MM-DD HH:mm:ss'),
  },
  {
    id: 't7',
    ticket_no: 'REQ-2024-007',
    title: '已归档的需求单',
    description: '客户反馈的UI优化需求',
    stage: 'release_visit',
    status: 'archived',
    priority: 'low',
    customer_name: 'BBB公司',
    customer_contact: '13300133007',
    product_version: 'v2.4.0',
    deadline: now.subtract(5, 'day').format('YYYY-MM-DD'),
    result: 'UI优化已完成，客户验收通过',
    audit_remark: '客户满意度高，需求落地效果好',
    is_abnormal: 0,
    source: 'online',
    created_by: 'u1',
    created_at: now.subtract(20, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updated_at: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
    auditor_id: 'u2',
    audit_time: now.subtract(18, 'day').format('YYYY-MM-DD HH:mm:ss'),
    reviewer_id: 'u3',
    review_time: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
  },
  {
    id: 't8',
    ticket_no: 'REQ-2024-008',
    title: '离线台账导入的需求单',
    description: '线下收集的客户需求',
    stage: 'feedback',
    status: 'draft',
    priority: 'medium',
    customer_name: 'CCC公司',
    customer_contact: '13200132008',
    product_version: 'v2.6.0',
    deadline: now.add(10, 'day').format('YYYY-MM-DD'),
    is_abnormal: 0,
    source: 'offline_import',
    import_batch_id: 'b1',
    created_by: 'u1',
    created_at: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updated_at: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
  },
];

const insertTicket = db.prepare(`
  INSERT INTO requirement_tickets (
    id, ticket_no, title, description, stage, status, priority,
    customer_name, customer_contact, product_version, deadline,
    result, reject_reason, audit_remark,
    is_abnormal, abnormal_type, source, import_batch_id,
    created_by, created_at, updated_at,
    auditor_id, audit_time, reviewer_id, review_time
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

tickets.forEach(t => {
  insertTicket.run(
    t.id, t.ticket_no, t.title, t.description, t.stage, t.status, t.priority,
    t.customer_name, t.customer_contact, t.product_version, t.deadline,
    t.result, t.reject_reason, t.audit_remark,
    t.is_abnormal, t.abnormal_type, t.source, t.import_batch_id,
    t.created_by, t.created_at, t.updated_at,
    t.auditor_id, t.audit_time, t.reviewer_id, t.review_time
  );
});

const attachments = [
  { id: 'a1', ticket_id: 't1', file_name: '需求说明书.docx', file_size: 102400, uploaded_by: 'u1', uploaded_at: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss') },
  { id: 'a2', ticket_id: 't2', file_name: '客户反馈截图.png', file_size: 204800, uploaded_by: 'u1', uploaded_at: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss') },
  { id: 'a3', ticket_id: 't5', file_name: '产品评审报告.pdf', file_size: 512000, uploaded_by: 'u2', uploaded_at: now.subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss') },
  { id: 'a4', ticket_id: 't6', file_name: '发布说明文档.pdf', file_size: 256000, uploaded_by: 'u2', uploaded_at: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss') },
];

const insertAttachment = db.prepare(`
  INSERT INTO ticket_attachments (id, ticket_id, file_name, file_size, uploaded_by, uploaded_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

attachments.forEach(a => {
  insertAttachment.run(a.id, a.ticket_id, a.file_name, a.file_size, a.uploaded_by, a.uploaded_at);
});

const auditLogs = [
  { id: 'l1', ticket_id: 't1', action: '创建需求单', action_type: 'create', operator_id: 'u1', operator_name: '张登记', operator_role: 'registrar', detail: '创建需求跟踪单 REQ-2024-001', created_at: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'), is_failure: 0 },
  { id: 'l2', ticket_id: 't1', action: '提交审核', action_type: 'submit', operator_id: 'u1', operator_name: '张登记', operator_role: 'registrar', detail: '提交需求单进入审核阶段', created_at: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'), is_failure: 0 },
  { id: 'l3', ticket_id: 't2', action: '创建需求单', action_type: 'create', operator_id: 'u1', operator_name: '张登记', operator_role: 'registrar', detail: '创建需求跟踪单 REQ-2024-002', created_at: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'), is_failure: 0 },
  { id: 'l4', ticket_id: 't2', action: '提交审核', action_type: 'submit', operator_id: 'u1', operator_name: '张登记', operator_role: 'registrar', detail: '提交需求单进入审核阶段', created_at: now.subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'), is_failure: 0 },
  { id: 'l5', ticket_id: 't2', action: '退回补正', action_type: 'reject', operator_id: 'u2', operator_name: '李审核', operator_role: 'auditor', detail: '退回原因：缺少需求规格说明书和客户签字确认件', created_at: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'), is_failure: 1, failure_reason: '材料不齐全，缺少必要的需求规格说明书和客户签字确认件' },
  { id: 'l6', ticket_id: 't4', action: '创建需求单', action_type: 'create', operator_id: 'u1', operator_name: '张登记', operator_role: 'registrar', detail: '创建需求跟踪单 REQ-2024-004', created_at: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'), is_failure: 0 },
  { id: 'l7', ticket_id: 't4', action: '提交审核', action_type: 'submit', operator_id: 'u1', operator_name: '张登记', operator_role: 'registrar', detail: '提交需求单进入审核阶段', created_at: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'), is_failure: 0 },
  { id: 'l8', ticket_id: 't4', action: '退回补正', action_type: 'reject', operator_id: 'u2', operator_name: '李审核', operator_role: 'auditor', detail: '退回原因：需求描述不清晰', created_at: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'), is_failure: 1, failure_reason: '需求描述不清晰，需要补充详细的权限分级说明和业务场景描述' },
  { id: 'l9', ticket_id: 't5', action: '创建需求单', action_type: 'create', operator_id: 'u1', operator_name: '张登记', operator_role: 'registrar', detail: '创建需求跟踪单 REQ-2024-005', created_at: now.subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss'), is_failure: 0 },
  { id: 'l10', ticket_id: 't5', action: '审核通过', action_type: 'audit_pass', operator_id: 'u2', operator_name: '李审核', operator_role: 'auditor', detail: '审核通过，进入产品评审阶段', created_at: now.subtract(6, 'day').format('YYYY-MM-DD HH:mm:ss'), is_failure: 0 },
  { id: 'l11', ticket_id: 't5', action: '评审通过', action_type: 'review_pass', operator_id: 'u2', operator_name: '李审核', operator_role: 'auditor', detail: '产品评审通过，纳入版本规划', created_at: now.subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'), is_failure: 0 },
  { id: 'l12', ticket_id: 't7', action: '复核归档', action_type: 'archive', operator_id: 'u3', operator_name: '王复核', operator_role: 'reviewer', detail: 'SaaS客户成功团队复核通过，归档', created_at: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'), is_failure: 0 },
];

const insertAuditLog = db.prepare(`
  INSERT INTO ticket_audit_logs (
    id, ticket_id, action, action_type, operator_id, operator_name,
    operator_role, detail, created_at, is_failure, failure_reason
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

auditLogs.forEach(l => {
  insertAuditLog.run(
    l.id, l.ticket_id, l.action, l.action_type, l.operator_id,
    l.operator_name, l.operator_role, l.detail, l.created_at,
    l.is_failure, l.failure_reason
  );
});

const importBatches = [
  {
    id: 'b1',
    batch_no: 'BATCH-2024-001',
    source: 'offline_excel',
    total_count: 3,
    success_count: 1,
    failure_count: 1,
    conflict_count: 1,
    imported_by: 'u1',
    imported_at: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
  },
];

const insertBatch = db.prepare(`
  INSERT INTO import_batches (
    id, batch_no, source, total_count, success_count, failure_count,
    conflict_count, imported_by, imported_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

importBatches.forEach(b => {
  insertBatch.run(
    b.id, b.batch_no, b.source, b.total_count, b.success_count,
    b.failure_count, b.conflict_count, b.imported_by, b.imported_at
  );
});

const importRecords = [
  { id: 'ir1', batch_id: 'b1', ticket_id: 't8', source_ticket_no: 'REQ-2024-008', status: 'success', result: '导入成功', diff_detail: null },
  { id: 'ir2', batch_id: 'b1', ticket_id: null, source_ticket_no: 'REQ-2024-009', status: 'failure', result: '导入失败', diff_detail: '客户名称为空' },
  { id: 'ir3', batch_id: 'b1', ticket_id: 't1', source_ticket_no: 'REQ-2024-001', status: 'conflict', result: '状态冲突', diff_detail: '线上状态：待审核，线下状态：草稿' },
];

const insertImportRecord = db.prepare(`
  INSERT INTO import_records (id, batch_id, ticket_id, source_ticket_no, status, result, diff_detail)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

importRecords.forEach(r => {
  insertImportRecord.run(r.id, r.batch_id, r.ticket_id, r.source_ticket_no, r.status, r.result, r.diff_detail);
});

console.log('数据库初始化完成！');
console.log('演示数据已创建：');
console.log('  - 用户：3个（登记员、审核主管、复核负责人）');
console.log('  - 需求跟踪单：8张');
console.log('  - 附件：4个');
console.log('  - 审计日志：12条');
console.log('  - 导入批次：1个');
console.log('  - 导入记录：3条');
console.log('');
console.log('正常单示例：REQ-2024-001（待审核）');
console.log('缺材料单示例：REQ-2024-002（材料缺失）');
console.log('超时单示例：REQ-2024-003（超时未处理）');
console.log('退回单示例：REQ-2024-004（退回补正）');

db.close();
