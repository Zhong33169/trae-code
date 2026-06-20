const db = require('../db');
const { ORDER_STATUS, EVIDENCE_TYPES, ROLES } = require('../config');
const {
  canTransition, statusName, roleName,
  validateEvidenceForReview, validateEvidenceForAudit
} = require('../business/rules');

function buildOrderQuery(filters = {}) {
  const clauses = [];
  const params = {};
  if (filters.status) {
    clauses.push('eo.status = @status');
    params.status = filters.status;
  }
  if (filters.statusIn && filters.statusIn.length) {
    const placeholders = filters.statusIn.map((_, i) => `@s${i}`).join(',');
    filters.statusIn.forEach((s, i) => params[`s${i}`] = s);
    clauses.push(`eo.status IN (${placeholders})`);
  }
  if (filters.keyword) {
    clauses.push('(eo.order_no LIKE @kw OR eo.applicant LIKE @kw OR eo.equipment_name LIKE @kw)');
    params.kw = `%${filters.keyword}%`;
  }
  if (filters.myCreated) {
    clauses.push('eo.created_by = @uid');
    params.uid = filters.myCreated;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

function listOrders(filters = {}, page = 1, pageSize = 20) {
  const { where, params } = buildOrderQuery(filters);
  const sql = `
    SELECT eo.*,
      u1.real_name AS created_by_name,
      u2.real_name AS auditor_name,
      u3.real_name AS reviewer_name,
      (SELECT COUNT(*) FROM evidences e WHERE e.order_id = eo.id AND e.type = '${EVIDENCE_TYPES.BORROW}') AS borrow_evidence_count,
      (SELECT COUNT(*) FROM evidences e WHERE e.order_id = eo.id AND e.type = '${EVIDENCE_TYPES.RETURN}') AS return_evidence_count,
      (SELECT COUNT(*) FROM evidences e WHERE e.order_id = eo.id AND e.type = '${EVIDENCE_TYPES.LOSS}') AS loss_evidence_count
    FROM equipment_orders eo
    LEFT JOIN users u1 ON u1.id = eo.created_by
    LEFT JOIN users u2 ON u2.id = eo.auditor_id
    LEFT JOIN users u3 ON u3.id = eo.reviewer_id
    ${where}
    ORDER BY eo.id DESC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `;
  const countSql = `SELECT COUNT(*) AS total FROM equipment_orders eo ${where}`;
  const rows = db.prepare(sql).all(params);
  const { total } = db.prepare(countSql).get(params);
  return { rows, total, page, pageSize };
}

function getOrderDetail(orderId) {
  const order = db.prepare(`
    SELECT eo.*,
      u1.real_name AS created_by_name,
      u2.real_name AS auditor_name,
      u3.real_name AS reviewer_name
    FROM equipment_orders eo
    LEFT JOIN users u1 ON u1.id = eo.created_by
    LEFT JOIN users u2 ON u2.id = eo.auditor_id
    LEFT JOIN users u3 ON u3.id = eo.reviewer_id
    WHERE eo.id = ?
  `).get(orderId);
  if (!order) return null;
  const evidences = db.prepare(`
    SELECT e.*, u.real_name AS uploader_name
    FROM evidences e LEFT JOIN users u ON u.id = e.uploaded_by
    WHERE e.order_id = ? ORDER BY e.id
  `).all(orderId);
  const logs = db.prepare(`
    SELECT l.*, u.real_name AS user_name
    FROM operation_logs l LEFT JOIN users u ON u.id = l.user_id
    WHERE l.order_id = ? ORDER BY l.id
  `).all(orderId);
  return { order, evidences, logs };
}

function createOrder(user, data) {
  const orderNo = `EB-${new Date().getFullYear()}-${String(Date.now() % 10000).padStart(4, '0')}`;
  const info = db.prepare(`
    INSERT INTO equipment_orders (
      order_no, applicant, department, equipment_name, equipment_model,
      quantity, borrow_reason, expected_return_date, status, version, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?)
  `).run(
    orderNo, data.applicant, data.department, data.equipment_name,
    data.equipment_model || null, data.quantity || 1, data.borrow_reason,
    data.expected_return_date, user.id
  );
  const orderId = info.lastInsertRowid;
  db.prepare(`INSERT INTO operation_logs (order_id, user_id, action, from_status, to_status, comment)
    VALUES (?, ?, '创建', NULL, 'draft', ?)`).run(orderId, user.id, `登记员${user.real_name}创建`);
  return getOrderDetail(orderId);
}

function submitForAudit(user, orderId, data = {}) {
  const order = db.prepare('SELECT * FROM equipment_orders WHERE id = ?').get(orderId);
  if (!order) return { ok: false, message: '借用单不存在' };
  if (order.created_by !== user.id) {
    return { ok: false, message: `仅创建人（登记员）可以提交审核，当前操作人不是该单创建人` };
  }
  if (![ORDER_STATUS.DRAFT, ORDER_STATUS.AUDIT_REJECTED, ORDER_STATUS.REVIEW_REJECTED].includes(order.status)) {
    return { ok: false, message: `当前状态为【${statusName(order.status)}】，无法提交审核` };
  }
  if (data.version !== undefined && data.version !== order.version) {
    return { ok: false, message: `版本冲突：当前版本v${order.version}，提交版本v${data.version}，请刷新后重试` };
  }
  const stmt = db.prepare(`
    UPDATE equipment_orders SET
      applicant = ?, department = ?, equipment_name = ?, equipment_model = ?,
      quantity = ?, borrow_reason = ?, expected_return_date = ?,
      status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP,
      last_failure_reason = NULL
    WHERE id = ? AND version = ?
  `);
  const result = stmt.run(
    data.applicant || order.applicant,
    data.department || order.department,
    data.equipment_name || order.equipment_name,
    data.equipment_model ?? order.equipment_model,
    data.quantity ?? order.quantity,
    data.borrow_reason || order.borrow_reason,
    data.expected_return_date || order.expected_return_date,
    ORDER_STATUS.PENDING_AUDIT,
    order.id, order.version
  );
  if (result.changes === 0) {
    return { ok: false, message: '更新失败，版本可能已被他人修改，请刷新' };
  }
  db.prepare(`INSERT INTO operation_logs (order_id, user_id, action, from_status, to_status, comment)
    VALUES (?, ?, '提交审核', ?, ?, ?)`).run(
    orderId, user.id, order.status, ORDER_STATUS.PENDING_AUDIT, data.comment || '补正后重新提交'
  );
  return { ok: true, data: getOrderDetail(orderId) };
}

function auditOrder(user, orderId, decision, data = {}) {
  const order = db.prepare('SELECT * FROM equipment_orders WHERE id = ?').get(orderId);
  if (!order) return { ok: false, message: '借用单不存在' };
  if (order.status !== ORDER_STATUS.PENDING_AUDIT) {
    return { ok: false, message: `当前状态为【${statusName(order.status)}】，审核仅可在【待审核】状态进行` };
  }
  const toStatus = decision === 'approve' ? ORDER_STATUS.PENDING_REVIEW : ORDER_STATUS.AUDIT_REJECTED;
  if (data.version !== undefined && data.version !== order.version) {
    return { ok: false, message: `版本冲突：当前v${order.version}，请刷新` };
  }
  const auditErrors = validateEvidenceForAudit(order, []);
  if (decision === 'approve' && auditErrors.length) {
    return { ok: false, message: `审核前校验失败：${auditErrors.join('；')}` };
  }
  const result = db.prepare(`
    UPDATE equipment_orders SET
      status = ?, auditor_id = ?, audit_comment = ?, version = version + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `).run(toStatus, user.id, data.comment || null, order.id, order.version);
  if (result.changes === 0) return { ok: false, message: '审核失败，版本冲突' };
  db.prepare(`INSERT INTO operation_logs (order_id, user_id, action, from_status, to_status, comment)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    orderId, user.id,
    decision === 'approve' ? '审核通过' : '审核驳回',
    ORDER_STATUS.PENDING_AUDIT, toStatus,
    data.comment || (decision === 'approve' ? '审核通过' : '驳回')
  );
  return { ok: true, data: getOrderDetail(orderId) };
}

function reviewOrder(user, orderId, decision, data = {}) {
  const order = db.prepare('SELECT * FROM equipment_orders WHERE id = ?').get(orderId);
  if (!order) return { ok: false, message: '借用单不存在' };
  if (order.status !== ORDER_STATUS.PENDING_REVIEW && order.status !== ORDER_STATUS.REVIEW_REJECTED) {
    return { ok: false, message: `当前状态为【${statusName(order.status)}】，复核仅可在待复核/复核驳回状态进行` };
  }
  const toStatus = decision === 'approve' ? ORDER_STATUS.ARCHIVED : ORDER_STATUS.REVIEW_REJECTED;
  if (data.version !== undefined && data.version !== order.version) {
    return { ok: false, message: `版本冲突：当前v${order.version}，请刷新` };
  }
  const evidences = db.prepare('SELECT * FROM evidences WHERE order_id = ?').all(orderId);
  const reviewErrors = validateEvidenceForReview(order, evidences);
  if (decision === 'approve' && reviewErrors.length) {
    const reason = reviewErrors.join('；');
    db.prepare(`UPDATE equipment_orders SET last_failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(reason, order.id);
    return { ok: false, message: `复核校验失败：${reason}`, failureReason: reason };
  }
  const result = db.prepare(`
    UPDATE equipment_orders SET
      status = ?, reviewer_id = ?, review_comment = ?,
      actual_return_date = COALESCE(?, actual_return_date),
      loss_remark = COALESCE(?, loss_remark),
      last_failure_reason = CASE WHEN ? THEN NULL ELSE last_failure_reason END,
      version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `).run(
    toStatus, user.id, data.comment || null,
    data.actual_return_date || null,
    data.loss_remark || null,
    decision === 'approve' ? 1 : 0,
    order.id, order.version
  );
  if (result.changes === 0) return { ok: false, message: '复核失败，版本冲突' };
  db.prepare(`INSERT INTO operation_logs (order_id, user_id, action, from_status, to_status, comment)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    orderId, user.id,
    decision === 'approve' ? '复核通过并归档' : '复核驳回',
    order.status, toStatus,
    data.comment || (decision === 'approve' ? '复核通过，归档' : '驳回待补正')
  );
  return { ok: true, data: getOrderDetail(orderId) };
}

function batchReviewOrders(user, orderIds, data = {}) {
  const results = [];
  for (const oid of orderIds) {
    try {
      const res = reviewOrder(user, oid, 'approve', data);
      results.push({
        orderId: oid,
        status: res.ok ? 'success' : (res.message?.includes('版本') ? 'retry' : 'failed'),
        message: res.message,
        failureReason: res.failureReason || null
      });
    } catch (e) {
      results.push({ orderId: oid, status: 'retry', message: `系统异常: ${e.message}` });
    }
  }
  return results;
}

function addEvidence(user, orderId, evidenceData) {
  const order = db.prepare('SELECT * FROM equipment_orders WHERE id = ?').get(orderId);
  if (!order) return { ok: false, message: '借用单不存在' };
  if (order.status === ORDER_STATUS.ARCHIVED) return { ok: false, message: '已归档单据不可新增证据' };
  if (order.created_by !== user.id && user.role !== ROLES.REGISTRAR) {
    return { ok: false, message: '仅登记员（创建人）可上传证据' };
  }
  if (!Object.values(EVIDENCE_TYPES).includes(evidenceData.type)) {
    return { ok: false, message: '证据类型非法' };
  }
  const info = db.prepare(`
    INSERT INTO evidences (order_id, type, description, file_name, uploaded_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    orderId, evidenceData.type, evidenceData.description,
    evidenceData.file_name || null, user.id
  );
  db.prepare(`INSERT INTO operation_logs (order_id, user_id, action, from_status, to_status, comment)
    VALUES (?, ?, '新增证据', ?, ?, ?)`).run(
    orderId, user.id, order.status, order.status,
    `上传【${evidenceData.type === 'borrow' ? '借用' : evidenceData.type === 'return' ? '归还验收' : '损耗确认'}】证据`
  );
  db.prepare('UPDATE equipment_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(orderId);
  return { ok: true, evidenceId: info.lastInsertRowid };
}

function deleteEvidence(user, evidenceId) {
  const ev = db.prepare('SELECT * FROM evidences WHERE id = ?').get(evidenceId);
  if (!ev) return { ok: false, message: '证据不存在' };
  const order = db.prepare('SELECT * FROM equipment_orders WHERE id = ?').get(ev.order_id);
  if (!order) return { ok: false, message: '所属借用单不存在' };
  if (order.status === ORDER_STATUS.ARCHIVED) return { ok: false, message: '已归档单据证据不可删除' };
  if (ev.uploaded_by !== user.id) {
    return { ok: false, message: '仅上传者可删除证据' };
  }
  db.prepare('DELETE FROM evidences WHERE id = ?').run(evidenceId);
  db.prepare('UPDATE equipment_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ev.order_id);
  return { ok: true };
}

function getQueueStats() {
  const rows = db.prepare(`
    SELECT status, COUNT(*) AS cnt FROM equipment_orders GROUP BY status
  `).all();
  const map = Object.fromEntries(rows.map(r => [r.status, r.cnt]));
  return {
    pending_audit: map[ORDER_STATUS.PENDING_AUDIT] || 0,
    pending_review: map[ORDER_STATUS.PENDING_REVIEW] || 0,
    audit_rejected: map[ORDER_STATUS.AUDIT_REJECTED] || 0,
    review_rejected: map[ORDER_STATUS.REVIEW_REJECTED] || 0,
    archived: map[ORDER_STATUS.ARCHIVED] || 0,
    draft: map[ORDER_STATUS.DRAFT] || 0
  };
}

module.exports = {
  listOrders, getOrderDetail, createOrder,
  submitForAudit, auditOrder, reviewOrder, batchReviewOrders,
  addEvidence, deleteEvidence, getQueueStats
};
