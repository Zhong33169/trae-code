import Fastify from 'fastify';
import cors from '@fastify/cors';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import db from './db.js';

const fastify = Fastify({
  logger: true,
});

fastify.register(cors, {
  origin: 'http://localhost:3003',
  credentials: true,
});

const STATUS_MAP = {
  draft: { label: '草稿', color: 'gray' },
  pending_audit: { label: '待审核', color: 'blue' },
  audit_passed: { label: '审核通过', color: 'green' },
  returned: { label: '退回补正', color: 'orange' },
  material_missing: { label: '材料缺失', color: 'red' },
  in_review: { label: '评审中', color: 'blue' },
  review_passed: { label: '评审通过', color: 'green' },
  review_rejected: { label: '评审不通过', color: 'red' },
  overdue: { label: '超时', color: 'red' },
  pending_release: { label: '待发布', color: 'blue' },
  released: { label: '已发布', color: 'green' },
  pending_review: { label: '待复核', color: 'blue' },
  archived: { label: '已归档', color: 'gray' },
};

const STAGE_MAP = {
  feedback: { label: '需求反馈', order: 1 },
  product_review: { label: '产品评审', order: 2 },
  release_visit: { label: '发布回访', order: 3 },
};

const ROLE_MAP = {
  registrar: { label: '需求跟踪登记员' },
  auditor: { label: '需求跟踪审核主管' },
  reviewer: { label: 'SaaS客户成功团队复核负责人' },
};

function getUserFromHeader(request) {
  const userId = request.headers['x-user-id'];
  if (!userId) return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return user || null;
}

function addAuditLog(ticketId, action, actionType, operator, detail, isFailure = 0, failureReason = null) {
  const stmt = db.prepare(`
    INSERT INTO ticket_audit_logs (
      id, ticket_id, action, action_type, operator_id, operator_name,
      operator_role, detail, created_at, is_failure, failure_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    uuidv4(),
    ticketId,
    action,
    actionType,
    operator.id,
    operator.name,
    operator.role,
    detail,
    dayjs().format('YYYY-MM-DD HH:mm:ss'),
    isFailure,
    failureReason
  );
}

fastify.get('/api/users', async (request, reply) => {
  const users = db.prepare('SELECT id, username, name, role, created_at FROM users').all();
  return { data: users.map(u => ({ ...u, role_label: ROLE_MAP[u.role]?.label || u.role })) };
});

fastify.get('/api/users/current', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }
  return { data: { ...user, role_label: ROLE_MAP[user.role]?.label || user.role } };
});

fastify.get('/api/tickets', async (request, reply) => {
  const { stage, status, is_abnormal, keyword } = request.query;
  
  let sql = 'SELECT * FROM requirement_tickets WHERE 1=1';
  const params = [];
  
  if (stage) {
    sql += ' AND stage = ?';
    params.push(stage);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (is_abnormal !== undefined) {
    sql += ' AND is_abnormal = ?';
    params.push(is_abnormal === '1' || is_abnormal === true ? 1 : 0);
  }
  if (keyword) {
    sql += ' AND (title LIKE ? OR ticket_no LIKE ? OR customer_name LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  const tickets = db.prepare(sql).all(...params);
  
  return {
    data: tickets.map(t => ({
      ...t,
      status_label: STATUS_MAP[t.status]?.label || t.status,
      status_color: STATUS_MAP[t.status]?.color || 'gray',
      stage_label: STAGE_MAP[t.stage]?.label || t.stage,
    })),
    total: tickets.length,
  };
});

fastify.get('/api/tickets/:id', async (request, reply) => {
  const ticket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(request.params.id);
  if (!ticket) {
    return reply.status(404).send({ error: '需求单不存在' });
  }
  
  const attachments = db.prepare('SELECT * FROM ticket_attachments WHERE ticket_id = ? ORDER BY uploaded_at DESC').all(ticket.id);
  const auditLogs = db.prepare('SELECT * FROM ticket_audit_logs WHERE ticket_id = ? ORDER BY created_at DESC').all(ticket.id);
  
  const creator = db.prepare('SELECT name FROM users WHERE id = ?').get(ticket.created_by);
  const auditor = ticket.auditor_id ? db.prepare('SELECT name FROM users WHERE id = ?').get(ticket.auditor_id) : null;
  const reviewer = ticket.reviewer_id ? db.prepare('SELECT name FROM users WHERE id = ?').get(ticket.reviewer_id) : null;
  
  let importBatchLabel = null;
  if (ticket.import_batch_id) {
    const batch = db.prepare('SELECT batch_no, source FROM import_batches WHERE id = ?').get(ticket.import_batch_id);
    if (batch) {
      const sourceLabels = { offline_excel: '离线Excel台账', offline_manual: '手工录入', third_party: '第三方系统' };
      importBatchLabel = `${batch.batch_no} (${sourceLabels[batch.source] || batch.source})`;
    }
  }

  return {
    data: {
      ...ticket,
      status_label: STATUS_MAP[ticket.status]?.label || ticket.status,
      status_color: STATUS_MAP[ticket.status]?.color || 'gray',
      stage_label: STAGE_MAP[ticket.stage]?.label || ticket.stage,
      creator_name: creator?.name || '未知',
      auditor_name: auditor?.name || null,
      reviewer_name: reviewer?.name || null,
      import_batch_label: importBatchLabel,
      attachments,
      audit_logs: auditLogs.map(l => ({
        ...l,
        operator_role_label: ROLE_MAP[l.operator_role]?.label || l.operator_role,
      })),
    },
  };
});

function checkEditPermission(user, ticket) {
  const editableStatusesByRole = {
    registrar: ['draft', 'returned', 'material_missing'],
    auditor: ['pending_audit', 'in_review', 'review_passed', 'review_rejected', 'pending_release', 'released', 'overdue'],
    reviewer: ['pending_review'],
  };
  const allowed = editableStatusesByRole[user.role] || [];
  return allowed.includes(ticket.status);
}

fastify.post('/api/tickets/:id/attachments', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }

  const ticket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(request.params.id);
  if (!ticket) {
    return reply.status(404).send({ error: '需求单不存在' });
  }

  if (!checkEditPermission(user, ticket)) {
    return reply.status(403).send({ error: `当前角色(${ROLE_MAP[user.role]?.label || user.role})不可在当前状态下操作此需求单的附件` });
  }

  const { file_name, file_size } = request.body;
  if (!file_name) {
    return reply.status(400).send({ error: '文件名不能为空' });
  }

  const id = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  db.prepare(`
    INSERT INTO ticket_attachments (id, ticket_id, file_name, file_size, uploaded_by, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, ticket.id, file_name, file_size || 0, user.id, now);

  addAuditLog(ticket.id, '新增附件', 'attachment_add', user, `新增附件：${file_name}`);

  const attachment = db.prepare('SELECT * FROM ticket_attachments WHERE id = ?').get(id);
  return { data: attachment };
});

fastify.delete('/api/tickets/:id/attachments/:attachmentId', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }

  const ticket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(request.params.id);
  if (!ticket) {
    return reply.status(404).send({ error: '需求单不存在' });
  }

  if (!checkEditPermission(user, ticket)) {
    return reply.status(403).send({ error: `当前角色(${ROLE_MAP[user.role]?.label || user.role})不可在当前状态下操作此需求单的附件` });
  }

  const attachment = db.prepare('SELECT * FROM ticket_attachments WHERE id = ? AND ticket_id = ?').get(request.params.attachmentId, ticket.id);
  if (!attachment) {
    return reply.status(404).send({ error: '附件不存在' });
  }

  db.prepare('DELETE FROM ticket_attachments WHERE id = ?').run(attachment.id);

  addAuditLog(ticket.id, '删除附件', 'attachment_delete', user, `删除附件：${attachment.file_name}`);

  return { data: { success: true } };
});

fastify.post('/api/tickets', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }
  
  const { title, description, priority, customer_name, customer_contact, product_version, deadline } = request.body;
  
  if (!title) {
    return reply.status(400).send({ error: '标题不能为空' });
  }
  
  const ticketNo = `REQ-${dayjs().format('YYYY')}-${String(Date.now()).slice(-6)}`;
  const id = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  const stmt = db.prepare(`
    INSERT INTO requirement_tickets (
      id, ticket_no, title, description, stage, status, priority,
      customer_name, customer_contact, product_version, deadline,
      is_abnormal, source, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id, ticketNo, title, description || '', 'feedback', 'draft',
    priority || 'medium', customer_name || '', customer_contact || '',
    product_version || '', deadline || null,
    0, 'online', user.id, now, now
  );
  
  addAuditLog(id, '创建需求单', 'create', user, `创建需求跟踪单 ${ticketNo}`);
  
  const ticket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(id);
  
  return {
    data: {
      ...ticket,
      status_label: STATUS_MAP[ticket.status]?.label || ticket.status,
      stage_label: STAGE_MAP[ticket.stage]?.label || ticket.stage,
    },
  };
});

fastify.put('/api/tickets/:id', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }
  
  const ticket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(request.params.id);
  if (!ticket) {
    return reply.status(404).send({ error: '需求单不存在' });
  }
  
  if (!checkEditPermission(user, ticket)) {
    return reply.status(403).send({ error: `当前角色(${ROLE_MAP[user.role]?.label})不可编辑此状态的需求单` });
  }
  
  const { title, description, priority, customer_name, customer_contact, product_version, deadline, result, audit_remark, reject_reason } = request.body;
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  const stmt = db.prepare(`
    UPDATE requirement_tickets SET
      title = ?, description = ?, priority = ?,
      customer_name = ?, customer_contact = ?, product_version = ?,
      deadline = ?, result = ?, audit_remark = ?, reject_reason = ?, updated_at = ?
    WHERE id = ?
  `);
  
  const newResult = result !== undefined ? result : ticket.result;
  const newAuditRemark = audit_remark !== undefined ? audit_remark : ticket.audit_remark;
  const newRejectReason = reject_reason !== undefined ? reject_reason : ticket.reject_reason;
  
  stmt.run(
    title || ticket.title, description || ticket.description,
    priority || ticket.priority, customer_name || ticket.customer_name,
    customer_contact || ticket.customer_contact, product_version || ticket.product_version,
    deadline || ticket.deadline, newResult, newAuditRemark, newRejectReason,
    now, ticket.id
  );
  
  const changeParts = [];
  if (result !== undefined && result !== ticket.result) changeParts.push('处理结果');
  if (reject_reason !== undefined && reject_reason !== ticket.reject_reason) changeParts.push('退回原因');
  if (audit_remark !== undefined && audit_remark !== ticket.audit_remark) changeParts.push('审计备注');
  if (title && title !== ticket.title) changeParts.push('标题');
  if (description && description !== ticket.description) changeParts.push('描述');
  
  const detailStr = changeParts.length > 0 ? `编辑了：${changeParts.join('、')}` : '编辑需求单信息';
  addAuditLog(ticket.id, '编辑需求单', 'edit', user, detailStr);
  
  const updatedTicket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(ticket.id);
  
  return {
    data: {
      ...updatedTicket,
      status_label: STATUS_MAP[updatedTicket.status]?.label || updatedTicket.status,
      stage_label: STAGE_MAP[updatedTicket.stage]?.label || updatedTicket.stage,
    },
  };
});

fastify.post('/api/tickets/:id/submit', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }
  
  if (user.role !== 'registrar') {
    return reply.status(403).send({ error: '只有登记员可以提交审核' });
  }
  
  const ticket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(request.params.id);
  if (!ticket) {
    return reply.status(404).send({ error: '需求单不存在' });
  }
  
  if (!['draft', 'returned', 'material_missing'].includes(ticket.status)) {
    return reply.status(400).send({ error: '当前状态不可提交审核' });
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  db.prepare('UPDATE requirement_tickets SET status = ?, stage = ?, updated_at = ?, is_abnormal = ?, abnormal_type = ? WHERE id = ?')
    .run('pending_audit', 'feedback', now, 0, null, ticket.id);
  
  addAuditLog(ticket.id, '提交审核', 'submit', user, '提交需求单进入审核阶段');
  
  const updatedTicket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(ticket.id);
  
  return {
    data: {
      ...updatedTicket,
      status_label: STATUS_MAP[updatedTicket.status]?.label || updatedTicket.status,
      stage_label: STAGE_MAP[updatedTicket.stage]?.label || updatedTicket.stage,
    },
  };
});

fastify.post('/api/tickets/:id/audit-pass', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }
  
  if (user.role !== 'auditor') {
    return reply.status(403).send({ error: '只有审核主管可以审核通过' });
  }
  
  const ticket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(request.params.id);
  if (!ticket) {
    return reply.status(404).send({ error: '需求单不存在' });
  }
  
  if (ticket.status !== 'pending_audit') {
    return reply.status(400).send({ error: '当前状态不可审核' });
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  db.prepare(`UPDATE requirement_tickets SET status = ?, stage = ?, updated_at = ?, auditor_id = ?, audit_time = ? WHERE id = ?`)
    .run('in_review', 'product_review', now, user.id, now, ticket.id);
  
  addAuditLog(ticket.id, '审核通过', 'audit_pass', user, '审核通过，进入产品评审阶段');
  
  const updatedTicket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(ticket.id);
  
  return {
    data: {
      ...updatedTicket,
      status_label: STATUS_MAP[updatedTicket.status]?.label || updatedTicket.status,
      stage_label: STAGE_MAP[updatedTicket.stage]?.label || updatedTicket.stage,
    },
  };
});

fastify.post('/api/tickets/:id/reject', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }
  
  if (user.role !== 'auditor') {
    return reply.status(403).send({ error: '只有审核主管可以退回' });
  }
  
  const ticket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(request.params.id);
  if (!ticket) {
    return reply.status(404).send({ error: '需求单不存在' });
  }
  
  if (ticket.status !== 'pending_audit') {
    return reply.status(400).send({ error: '当前状态不可退回' });
  }
  
  const { reason, type } = request.body;
  
  if (!reason) {
    return reply.status(400).send({ error: '退回原因不能为空' });
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const status = type === 'material_missing' ? 'material_missing' : 'returned';
  const abnormalType = type === 'material_missing' ? 'material_missing' : 'returned';
  
  db.prepare(`
    UPDATE requirement_tickets SET status = ?, reject_reason = ?, updated_at = ?,
      auditor_id = ?, audit_time = ?, is_abnormal = ?, abnormal_type = ?
    WHERE id = ?
  `).run(status, reason, now, user.id, now, 1, abnormalType, ticket.id);
  
  const action = type === 'material_missing' ? '材料缺失退回' : '退回补正';
  addAuditLog(ticket.id, action, 'reject', user, `退回原因：${reason}`, 1, reason);
  
  const updatedTicket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(ticket.id);
  
  return {
    data: {
      ...updatedTicket,
      status_label: STATUS_MAP[updatedTicket.status]?.label || updatedTicket.status,
      stage_label: STAGE_MAP[updatedTicket.stage]?.label || updatedTicket.stage,
    },
  };
});

fastify.post('/api/tickets/:id/review-pass', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }
  
  if (user.role !== 'auditor') {
    return reply.status(403).send({ error: '只有审核主管可以评审' });
  }
  
  const ticket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(request.params.id);
  if (!ticket) {
    return reply.status(404).send({ error: '需求单不存在' });
  }
  
  if (ticket.stage !== 'product_review') {
    return reply.status(400).send({ error: '当前阶段不可评审' });
  }
  
  const { result } = request.body;
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  db.prepare(`UPDATE requirement_tickets SET status = ?, stage = ?, result = ?, updated_at = ? WHERE id = ?`)
    .run('pending_release', 'release_visit', result || ticket.result, now, ticket.id);
  
  addAuditLog(ticket.id, '评审通过', 'review_pass', user, '产品评审通过，进入发布阶段');
  
  const updatedTicket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(ticket.id);
  
  return {
    data: {
      ...updatedTicket,
      status_label: STATUS_MAP[updatedTicket.status]?.label || updatedTicket.status,
      stage_label: STAGE_MAP[updatedTicket.stage]?.label || updatedTicket.stage,
    },
  };
});

fastify.post('/api/tickets/:id/review-reject', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }
  
  if (user.role !== 'auditor') {
    return reply.status(403).send({ error: '只有审核主管可以评审' });
  }
  
  const ticket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(request.params.id);
  if (!ticket) {
    return reply.status(404).send({ error: '需求单不存在' });
  }
  
  if (ticket.stage !== 'product_review') {
    return reply.status(400).send({ error: '当前阶段不可评审' });
  }
  
  const { reason } = request.body;
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  db.prepare(`UPDATE requirement_tickets SET status = ?, stage = ?, reject_reason = ?, updated_at = ?, is_abnormal = ?, abnormal_type = ? WHERE id = ?`)
    .run('review_rejected', 'product_review', reason, now, 1, 'review_rejected', ticket.id);
  
  addAuditLog(ticket.id, '评审不通过', 'review_reject', user, `评审不通过，原因：${reason}`, 1, reason);
  
  const updatedTicket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(ticket.id);
  
  return {
    data: {
      ...updatedTicket,
      status_label: STATUS_MAP[updatedTicket.status]?.label || updatedTicket.status,
      stage_label: STAGE_MAP[updatedTicket.stage]?.label || updatedTicket.stage,
    },
  };
});

fastify.post('/api/tickets/:id/release', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }
  
  if (user.role !== 'auditor') {
    return reply.status(403).send({ error: '只有审核主管可以发布' });
  }
  
  const ticket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(request.params.id);
  if (!ticket) {
    return reply.status(404).send({ error: '需求单不存在' });
  }
  
  if (ticket.status !== 'pending_release') {
    return reply.status(400).send({ error: '当前状态不可发布' });
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  db.prepare(`UPDATE requirement_tickets SET status = ?, updated_at = ? WHERE id = ?`)
    .run('released', now, ticket.id);
  
  addAuditLog(ticket.id, '已发布', 'release', user, '需求已发布，进入回访阶段');
  
  const updatedTicket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(ticket.id);
  
  return {
    data: {
      ...updatedTicket,
      status_label: STATUS_MAP[updatedTicket.status]?.label || updatedTicket.status,
      stage_label: STAGE_MAP[updatedTicket.stage]?.label || updatedTicket.stage,
    },
  };
});

fastify.post('/api/tickets/:id/request-review', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }
  
  if (user.role !== 'auditor') {
    return reply.status(403).send({ error: '只有审核主管可以申请复核' });
  }
  
  const ticket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(request.params.id);
  if (!ticket) {
    return reply.status(404).send({ error: '需求单不存在' });
  }
  
  if (ticket.status !== 'released') {
    return reply.status(400).send({ error: '当前状态不可申请复核' });
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  db.prepare(`UPDATE requirement_tickets SET status = ?, updated_at = ? WHERE id = ?`)
    .run('pending_review', now, ticket.id);
  
  addAuditLog(ticket.id, '申请复核', 'request_review', user, '提交SaaS客户成功团队复核');
  
  const updatedTicket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(ticket.id);
  
  return {
    data: {
      ...updatedTicket,
      status_label: STATUS_MAP[updatedTicket.status]?.label || updatedTicket.status,
      stage_label: STAGE_MAP[updatedTicket.stage]?.label || updatedTicket.stage,
    },
  };
});

fastify.post('/api/tickets/:id/archive', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }
  
  if (user.role !== 'reviewer') {
    return reply.status(403).send({ error: '只有复核负责人可以归档' });
  }
  
  const ticket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(request.params.id);
  if (!ticket) {
    return reply.status(404).send({ error: '需求单不存在' });
  }
  
  if (ticket.status !== 'pending_review') {
    return reply.status(400).send({ error: '当前状态不可归档' });
  }
  
  const { audit_remark } = request.body;
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  db.prepare(`UPDATE requirement_tickets SET status = ?, audit_remark = ?, updated_at = ?, reviewer_id = ?, review_time = ? WHERE id = ?`)
    .run('archived', audit_remark || '', now, user.id, now, ticket.id);
  
  const auditDetail = audit_remark
    ? `SaaS客户成功团队复核通过，归档。审计备注：${audit_remark}`
    : 'SaaS客户成功团队复核通过，归档';
  addAuditLog(ticket.id, '复核归档', 'archive', user, auditDetail);
  
  const updatedTicket = db.prepare('SELECT * FROM requirement_tickets WHERE id = ?').get(ticket.id);
  
  return {
    data: {
      ...updatedTicket,
      status_label: STATUS_MAP[updatedTicket.status]?.label || updatedTicket.status,
      stage_label: STAGE_MAP[updatedTicket.stage]?.label || updatedTicket.stage,
    },
  };
});

fastify.get('/api/audit-logs', async (request, reply) => {
  const { ticket_id, is_failure, keyword } = request.query;
  
  let sql = 'SELECT * FROM ticket_audit_logs WHERE 1=1';
  const params = [];
  
  if (ticket_id) {
    sql += ' AND ticket_id = ?';
    params.push(ticket_id);
  }
  if (is_failure !== undefined) {
    sql += ' AND is_failure = ?';
    params.push(is_failure === '1' ? 1 : 0);
  }
  if (keyword) {
    sql += ' AND (action LIKE ? OR detail LIKE ? OR operator_name LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT 100';
  
  const logs = db.prepare(sql).all(...params);
  
  const ticketMap = {};
  for (const log of logs) {
    if (!ticketMap[log.ticket_id]) {
      const ticket = db.prepare('SELECT ticket_no, title FROM requirement_tickets WHERE id = ?').get(log.ticket_id);
      if (ticket) {
        ticketMap[log.ticket_id] = ticket;
      }
    }
  }
  
  return {
    data: logs.map(l => ({
      ...l,
      operator_role_label: ROLE_MAP[l.operator_role]?.label || l.operator_role,
      ticket_no: ticketMap[l.ticket_id]?.ticket_no || '',
      ticket_title: ticketMap[l.ticket_id]?.title || '',
    })),
  };
});

fastify.get('/api/import-batches', async (request, reply) => {
  const batches = db.prepare('SELECT * FROM import_batches ORDER BY imported_at DESC').all();
  const batchesWithNames = batches.map(b => {
    const importer = db.prepare('SELECT name FROM users WHERE id = ?').get(b.imported_by);
    return { ...b, imported_by_name: importer?.name || '未知' };
  });
  return { data: batchesWithNames };
});

fastify.get('/api/import-batches/:id', async (request, reply) => {
  const batch = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(request.params.id);
  if (!batch) {
    return reply.status(404).send({ error: '批次不存在' });
  }
  
  const importer = db.prepare('SELECT name FROM users WHERE id = ?').get(batch.imported_by);
  const records = db.prepare('SELECT * FROM import_records WHERE batch_id = ?').all(batch.id);
  
  return { data: { ...batch, imported_by_name: importer?.name || '未知', records } };
});

fastify.post('/api/import-batches', async (request, reply) => {
  const user = getUserFromHeader(request);
  if (!user) {
    return reply.status(401).send({ error: '未登录' });
  }
  
  if (user.role !== 'registrar') {
    return reply.status(403).send({ error: '只有登记员可以导入台账' });
  }
  
  const { source, tickets } = request.body;
  
  if (!source || !tickets || !Array.isArray(tickets)) {
    return reply.status(400).send({ error: '参数错误' });
  }
  
  const batchId = uuidv4();
  const batchNo = `BATCH-${dayjs().format('YYYYMMDD')}-${String(Date.now()).slice(-4)}`;
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  let successCount = 0;
  let failureCount = 0;
  let conflictCount = 0;
  
  const insertRecord = db.prepare(`
    INSERT INTO import_records (id, batch_id, ticket_id, source_ticket_no, status, result, diff_detail)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction((ticketsData) => {
    db.prepare(`
      INSERT INTO import_batches (
        id, batch_no, source, total_count, success_count, failure_count,
        conflict_count, imported_by, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      batchId, batchNo, source, tickets.length, 0, 0, 0, user.id, now
    );

    for (const ticketData of ticketsData) {
      const sourceTicketNo = ticketData.ticket_no || ticketData.source_ticket_no;
      
      if (!ticketData.title || !sourceTicketNo) {
        failureCount++;
        insertRecord.run(
          uuidv4(), batchId, null, sourceTicketNo || 'UNKNOWN',
          'failure', '导入失败', '标题或单号为空'
        );
        continue;
      }
      
      const existingTicket = db.prepare('SELECT * FROM requirement_tickets WHERE ticket_no = ?').get(sourceTicketNo);
      
      if (existingTicket) {
        let conflictReason = '';
        let diffDetail = '';
        if (existingTicket.source === source) {
          conflictReason = '同来源重复导入';
          diffDetail = `已有同来源(${existingTicket.source})单据，状态：${STATUS_MAP[existingTicket.status]?.label || existingTicket.status}`;
        } else {
          conflictReason = '线上状态冲突，未覆盖';
          diffDetail = `线上状态：${STATUS_MAP[existingTicket.status]?.label || existingTicket.status}，来源：${existingTicket.source}；线下状态：草稿，来源：${source}`;
        }
        conflictCount++;
        insertRecord.run(
          uuidv4(), batchId, existingTicket.id, sourceTicketNo,
          'conflict', conflictReason, diffDetail
        );
        addAuditLog(
          existingTicket.id, '离线导入冲突', 'import_conflict', user,
          `导入批次 ${batchNo} ${conflictReason}`, 1, diffDetail
        );
        continue;
      }
      
      try {
        const ticketId = uuidv4();
        
        db.prepare(`
          INSERT INTO requirement_tickets (
            id, ticket_no, title, description, stage, status, priority,
            customer_name, customer_contact, product_version, deadline,
            is_abnormal, source, import_batch_id, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          ticketId, sourceTicketNo, ticketData.title, ticketData.description || '',
          'feedback', 'draft', ticketData.priority || 'medium',
          ticketData.customer_name || '', ticketData.customer_contact || '',
          ticketData.product_version || '', ticketData.deadline || null,
          0, 'offline_import', batchId, user.id, now, now
        );
        
        successCount++;
        insertRecord.run(
          uuidv4(), batchId, ticketId, sourceTicketNo,
          'success', '导入成功', null
        );
        
        addAuditLog(ticketId, '离线导入创建', 'import_create', user, `从批次 ${batchNo} 导入创建`);
      } catch (e) {
        failureCount++;
        insertRecord.run(
          uuidv4(), batchId, null, sourceTicketNo,
          'failure', '导入失败', e.message
        );
      }
    }

    db.prepare(`
      UPDATE import_batches SET success_count = ?, failure_count = ?, conflict_count = ? WHERE id = ?
    `).run(successCount, failureCount, conflictCount, batchId);
  });
  
  transaction(tickets);
  
  const batch = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId);
  const records = db.prepare('SELECT * FROM import_records WHERE batch_id = ?').all(batchId);
  
  return {
    data: {
      ...batch,
      records,
    },
  };
});

fastify.get('/api/dashboard/stats', async (request, reply) => {
  const totalTickets = db.prepare('SELECT COUNT(*) as count FROM requirement_tickets').get().count;
  const abnormalTickets = db.prepare('SELECT COUNT(*) as count FROM requirement_tickets WHERE is_abnormal = 1').get().count;
  const pendingAudit = db.prepare('SELECT COUNT(*) as count FROM requirement_tickets WHERE status = ?').get('pending_audit').count;
  const archived = db.prepare('SELECT COUNT(*) as count FROM requirement_tickets WHERE status = ?').get('archived').count;
  
  const stageStats = {};
  for (const stage of Object.keys(STAGE_MAP)) {
    stageStats[stage] = {
      label: STAGE_MAP[stage].label,
      count: db.prepare('SELECT COUNT(*) as count FROM requirement_tickets WHERE stage = ?').get(stage).count,
    };
  }
  
  return {
    data: {
      total: totalTickets,
      abnormal: abnormalTickets,
      pending_audit: pendingAudit,
      archived,
      by_stage: stageStats,
    },
  };
});

fastify.get('/api/status-options', async (request, reply) => {
  return {
    data: {
      statuses: Object.entries(STATUS_MAP).map(([key, val]) => ({ value: key, label: val.label, color: val.color })),
      stages: Object.entries(STAGE_MAP).map(([key, val]) => ({ value: key, label: val.label })),
      roles: Object.entries(ROLE_MAP).map(([key, val]) => ({ value: key, label: val.label })),
    },
  };
});

const start = async () => {
  try {
    await fastify.listen({ port: 8003, host: '0.0.0.0' });
    console.log('后端服务启动成功，端口 8003');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
