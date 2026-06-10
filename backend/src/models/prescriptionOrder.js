const { getDb } = require('../db');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const RISK_PRIORITY = { high: 3, medium: 2, low: 1 };

const STATUS_LABELS = {
  draft: '草稿',
  pending_audit: '待审核',
  auditing: '审核中',
  returned: '退回补正',
  pending_review: '待复核',
  reviewing: '复核中',
  archived: '已归档',
  rejected: '已驳回',
  overdue: '已逾期'
};

const RISK_LABELS = {
  high: '高风险',
  medium: '中风险',
  low: '低风险'
};

const ROLE_LABELS = {
  registrar: '处方登记员',
  auditor: '处方审核主管',
  reviewer: '连锁药房复核负责人'
};

const EVIDENCE_TYPE_LABELS = {
  prescription: '处方单',
  id_card: '身份证',
  medical_record: '病历/诊断证明',
  insurance_card: '医保卡'
};

const getStatusLabel = (status) => STATUS_LABELS[status] || status;
const getRiskLabel = (risk) => RISK_LABELS[risk] || risk;
const getRoleLabel = (role) => ROLE_LABELS[role] || role;
const getEvidenceTypeLabel = (type) => EVIDENCE_TYPE_LABELS[type] || type;

const formatOrder = (order) => {
  if (!order) return null;
  return {
    ...order,
    statusLabel: getStatusLabel(order.status),
    riskLabel: getRiskLabel(order.risk_level),
    riskPriority: RISK_PRIORITY[order.risk_level] || 0,
    currentHandlerRoleLabel: order.current_handler_role ? getRoleLabel(order.current_handler_role) : null,
    lastHandlerRoleLabel: order.last_handler_role ? getRoleLabel(order.last_handler_role) : null
  };
};

const logAuditFailure = async (orderId, action, userId, userRole, failureType, failureReason, requestData = null) => {
  const db = await getDb();
  const order = orderId ? await getOrderById(orderId) : null;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO audit_failures
    (id, order_id, action, operator_id, operator_role, failure_type, failure_reason,
     request_data, version_at_time, status_at_time)
    VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, orderId, action, userId, userRole, failureType, failureReason,
    requestData ? JSON.stringify(requestData) : null,
    order?.version || null,
    order?.status || null
  );
  db.saveToDisk();
};

const logFieldChange = async (db, orderId, fieldName, oldValue, newValue, userId, userRole, reason = null, versionFrom = null, versionTo = null) => {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO field_changes
    (id, order_id, field_name, old_value, new_value, changed_by, changed_by_role,
     change_reason, version_from, version_to)
    VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, orderId, fieldName,
    oldValue !== undefined && oldValue !== null ? String(oldValue) : null,
    newValue !== undefined && newValue !== null ? String(newValue) : null,
    userId, userRole, reason, versionFrom, versionTo
  );
};

const logEvidenceChange = async (db, orderId, evidenceId, changeType, evidenceType, evidenceName, userId, userRole) => {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO evidence_changes
    (id, order_id, evidence_id, change_type, evidence_type, evidence_name,
     changed_by, changed_by_role)
    VALUES
    (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orderId, evidenceId, changeType, evidenceType, evidenceName, userId, userRole);
};

const getOrdersByRole = async (userId, userRole, options = {}) => {
  const db = await getDb();
  const { status, riskLevel, storeId, keyword } = options;

  let sql = `SELECT po.*, s.name as store_name FROM prescription_orders po
             LEFT JOIN stores s ON po.store_id = s.id
             WHERE 1=1`;
  const params = [];

  if (userRole === 'registrar') {
    sql += ' AND po.registrar_id = ?';
    params.push(userId);
  } else if (userRole === 'auditor') {
    sql += ` AND (
      po.current_handler = ? 
      OR (po.status IN ('pending_audit', 'auditing', 'returned') AND po.store_id = (SELECT store_id FROM users WHERE id = ?))
    )`;
    params.push(userId, userId);
  } else if (userRole === 'reviewer') {
    sql += ` AND (
      po.current_handler = ?
      OR po.status IN ('pending_review', 'reviewing', 'archived', 'rejected')
    )`;
    params.push(userId);
  }

  if (status && status !== 'all') {
    sql += ' AND po.status = ?';
    params.push(status);
  }

  if (riskLevel && riskLevel !== 'all') {
    sql += ' AND po.risk_level = ?';
    params.push(riskLevel);
  }

  if (storeId && storeId !== 'all') {
    sql += ' AND po.store_id = ?';
    params.push(storeId);
  }

  if (keyword) {
    sql += ' AND (po.order_no LIKE ? OR po.patient_name LIKE ? OR po.drug_name LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }

  sql += ` ORDER BY 
    CASE po.risk_level 
      WHEN 'high' THEN 1 
      WHEN 'medium' THEN 2 
      WHEN 'low' THEN 3 
      ELSE 4 
    END,
    CASE po.status
      WHEN 'overdue' THEN 1
      WHEN 'pending_audit' THEN 2
      WHEN 'auditing' THEN 3
      WHEN 'pending_review' THEN 4
      WHEN 'reviewing' THEN 5
      WHEN 'returned' THEN 6
      WHEN 'draft' THEN 7
      WHEN 'archived' THEN 8
      WHEN 'rejected' THEN 9
      ELSE 10
    END,
    po.created_at DESC`;

  const rows = db.prepare(sql).all(...params);
  return rows.map(formatOrder);
};

const getOrderById = async (orderId) => {
  const db = await getDb();
  const order = db.prepare(`
    SELECT po.*, s.name as store_name 
    FROM prescription_orders po
    LEFT JOIN stores s ON po.store_id = s.id
    WHERE po.id = ?
  `).get(orderId);
  return formatOrder(order);
};

const getOrderEvidences = async (orderId) => {
  const db = await getDb();
  const evidences = db.prepare('SELECT * FROM evidences WHERE order_id = ? ORDER BY uploaded_at DESC').all(orderId);
  return evidences.map(e => ({
    ...e,
    typeLabel: getEvidenceTypeLabel(e.type)
  }));
};

const getOrderLogs = async (orderId) => {
  const db = await getDb();
  const logs = db.prepare(`
    SELECT * FROM operation_logs 
    WHERE order_id = ? 
    ORDER BY created_at DESC, id DESC
  `).all(orderId);
  return logs.map(l => ({
    ...l,
    operatorRoleLabel: getRoleLabel(l.operator_role),
    fromStatusLabel: l.from_status ? getStatusLabel(l.from_status) : null,
    toStatusLabel: l.to_status ? getStatusLabel(l.to_status) : null
  }));
};

const getStats = async (userId, userRole) => {
  const orders = await getOrdersByRole(userId, userRole);

  const stats = {
    total: orders.length,
    pendingAudit: 0,
    auditing: 0,
    pendingReview: 0,
    reviewing: 0,
    returned: 0,
    draft: 0,
    archived: 0,
    rejected: 0,
    overdue: 0,
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
    myPending: 0
  };

  orders.forEach(o => {
    if (o.status === 'pending_audit') stats.pendingAudit++;
    if (o.status === 'auditing') stats.auditing++;
    if (o.status === 'pending_review') stats.pendingReview++;
    if (o.status === 'reviewing') stats.reviewing++;
    if (o.status === 'returned') stats.returned++;
    if (o.status === 'draft') stats.draft++;
    if (o.status === 'archived') stats.archived++;
    if (o.status === 'rejected') stats.rejected++;
    if (o.status === 'overdue') stats.overdue++;
    if (o.risk_level === 'high') stats.highRisk++;
    if (o.risk_level === 'medium') stats.mediumRisk++;
    if (o.risk_level === 'low') stats.lowRisk++;
    if (o.current_handler === userId && !['archived', 'rejected', 'draft'].includes(o.status)) {
      stats.myPending++;
    }
  });

  return stats;
};

const REQUIRED_EVIDENCES_BY_RISK = {
  high: ['prescription', 'id_card', 'medical_record'],
  medium: ['prescription', 'id_card'],
  low: ['prescription']
};

const validateRequiredEvidences = async (orderId, riskLevel) => {
  const evidences = await getOrderEvidences(orderId);
  const evidenceTypes = new Set(evidences.map(e => e.type));
  const required = REQUIRED_EVIDENCES_BY_RISK[riskLevel] || [];
  const missing = required.filter(t => !evidenceTypes.has(t));
  return {
    valid: missing.length === 0,
    missing,
    required,
    missingLabels: missing.map(getEvidenceTypeLabel)
  };
};

const checkCanPerformAction = (order, userId, userRole, action) => {
  if (!order) return { can: false, reason: '订单不存在' };

  const roleActions = {
    registrar: ['submit', 'resubmit', 'save_draft'],
    auditor: ['start_audit', 'audit_pass', 'audit_return', 'audit_reject'],
    reviewer: ['start_review', 'review_archive', 'review_reject']
  };

  if (!roleActions[userRole]?.includes(action)) {
    return { can: false, reason: '当前角色无此操作权限' };
  }

  const statusTransitions = {
    submit: { from: ['draft', 'returned'], to: 'pending_audit' },
    resubmit: { from: ['returned'], to: 'pending_audit' },
    start_audit: { from: ['pending_audit'], to: 'auditing' },
    audit_pass: { from: ['auditing', 'pending_audit'], to: 'pending_review' },
    audit_return: { from: ['auditing', 'pending_audit'], to: 'returned' },
    audit_reject: { from: ['auditing', 'pending_audit'], to: 'rejected' },
    start_review: { from: ['pending_review'], to: 'reviewing' },
    review_archive: { from: ['reviewing', 'pending_review'], to: 'archived' },
    review_reject: { from: ['reviewing', 'pending_review'], to: 'rejected' },
    save_draft: { from: ['draft', 'returned'], to: 'draft' }
  };

  const transition = statusTransitions[action];
  if (!transition) return { can: false, reason: '未知操作' };

  if (!transition.from.includes(order.status)) {
    return { can: false, reason: `当前状态【${getStatusLabel(order.status)}】不允许此操作` };
  }

  if (action === 'submit' || action === 'resubmit' || action === 'save_draft') {
    if (order.registrar_id !== userId) {
      return { can: false, reason: '只有登记员本人可以提交或保存' };
    }
  }

  if (action.startsWith('audit_') || action === 'start_audit') {
    if (order.current_handler && order.current_handler !== userId) {
      return { can: false, reason: '当前订单正在由其他审核员处理' };
    }
    if (userRole !== 'auditor') {
      return { can: false, reason: '只有审核员可以执行此操作' };
    }
  }

  if (action.startsWith('review_') || action === 'start_review') {
    if (order.current_handler && order.current_handler !== userId) {
      return { can: false, reason: '当前订单正在由其他复核人处理' };
    }
    if (userRole !== 'reviewer') {
      return { can: false, reason: '只有复核负责人可以执行此操作' };
    }
  }

  return { can: true, transition };
};

const getAvailableActions = (order, userId, userRole) => {
  const actions = [];
  const allActions = [
    { key: 'submit', label: '提交审核', role: 'registrar' },
    { key: 'resubmit', label: '补正后重新提交', role: 'registrar' },
    { key: 'start_audit', label: '开始审核', role: 'auditor' },
    { key: 'audit_pass', label: '审核通过', role: 'auditor' },
    { key: 'audit_return', label: '退回补正', role: 'auditor' },
    { key: 'audit_reject', label: '审核驳回', role: 'auditor' },
    { key: 'start_review', label: '开始复核', role: 'reviewer' },
    { key: 'review_archive', label: '复核归档', role: 'reviewer' },
    { key: 'review_reject', label: '复核驳回', role: 'reviewer' }
  ];

  allActions.forEach(a => {
    const check = checkCanPerformAction(order, userId, userRole, a.key);
    if (check.can) {
      actions.push({ ...a, needOpinion: !['start_audit', 'start_review'].includes(a.key) });
    }
  });

  return actions;
};

const performAction = async (orderId, userId, userRole, action, opinion, version) => {
  const db = await getDb();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return { success: false, message: '用户不存在' };
  if (user.role !== userRole) return { success: false, message: '用户角色不匹配' };

  const order = await getOrderById(orderId);
  if (!order) return { success: false, message: '订单不存在' };

  const check = checkCanPerformAction(order, userId, userRole, action);
  if (!check.can) {
    await logAuditFailure(orderId, action, userId, userRole, 'permission_denied', check.reason, { opinion, version });
    return { success: false, message: check.reason };
  }

  if (version !== undefined && version !== order.version) {
    await logAuditFailure(orderId, action, userId, userRole, 'version_conflict', '版本冲突，数据已被修改', { opinion, version });
    return { success: false, message: '版本冲突，数据已被修改，请刷新后重试' };
  }

  if (action === 'submit' || action === 'resubmit') {
    const evCheck = await validateRequiredEvidences(orderId, order.risk_level);
    if (!evCheck.valid) {
      await logAuditFailure(orderId, action, userId, userRole, 'evidence_missing', `缺少必填证据：${evCheck.missingLabels.join('、')}`, { opinion, version, missing: evCheck.missing });
      return {
        success: false,
        message: `缺少必填证据：${evCheck.missingLabels.join('、')}`,
        missingEvidences: evCheck.missingLabels
      };
    }
  }

  const transition = check.transition;
  const newStatus = transition.to;
  const newVersion = ['audit_return', 'review_reject', 'audit_reject'].includes(action)
    ? order.version + 1
    : order.version;

  let currentHandler = null;
  let currentHandlerRole = null;

  if (newStatus === 'pending_audit') {
    const storeAuditors = db.prepare(`
      SELECT id FROM users WHERE role = 'auditor' AND store_id = ?
    `).all(order.store_id);
    if (storeAuditors.length > 0) {
      const idx = Math.floor(Math.random() * storeAuditors.length);
      currentHandler = storeAuditors[idx].id;
      currentHandlerRole = 'auditor';
    }
  } else if (newStatus === 'auditing' || newStatus === 'reviewing') {
    currentHandler = userId;
    currentHandlerRole = userRole;
  } else if (newStatus === 'pending_review') {
    const reviewers = db.prepare(`SELECT id FROM users WHERE role = 'reviewer'`).all();
    if (reviewers.length > 0) {
      currentHandler = reviewers[0].id;
      currentHandlerRole = 'reviewer';
    }
  } else if (newStatus === 'returned') {
    currentHandler = order.registrar_id;
    currentHandlerRole = 'registrar';
  }

  const resultMap = {
    submit: 'submitted',
    resubmit: 'resubmitted',
    start_audit: 'processing',
    audit_pass: 'passed',
    audit_return: 'returned',
    audit_reject: 'rejected',
    start_review: 'processing',
    review_archive: 'archived',
    review_reject: 'rejected'
  };

  const logId = uuidv4();
  const result = resultMap[action] || action;

  try {
    db.run('BEGIN');

    db.prepare(`
      UPDATE prescription_orders SET
        status = ?,
        current_handler = ?,
        current_handler_role = ?,
        version = ?,
        last_opinion = ?,
        last_result = ?,
        last_handler = ?,
        last_handler_role = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      newStatus,
      currentHandler,
      currentHandlerRole,
      newVersion,
      opinion || null,
      result,
      user.name,
      userRole,
      orderId
    );

    db.prepare(`
      INSERT INTO operation_logs
      (id, order_id, action, operator_id, operator_name, operator_role,
       from_status, to_status, opinion, result, version_from, version_to)
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId, orderId, action, userId, user.name, userRole,
      order.status, newStatus, opinion || null, result,
      order.version, newVersion
    );

    db.run('COMMIT');
    db.saveToDisk();

    const updatedOrder = await getOrderById(orderId);
    const logs = await getOrderLogs(orderId);
    const availableActions = getAvailableActions(updatedOrder, userId, userRole);
    const evidenceCheck = await validateRequiredEvidences(orderId, updatedOrder.risk_level);

    return {
      success: true,
      order: updatedOrder,
      logs,
      availableActions,
      evidenceCheck,
      message: '操作成功'
    };
  } catch (e) {
    try { db.run('ROLLBACK'); } catch (_) {}
    return { success: false, message: e.message };
  }
};

const addEvidence = async (orderId, type, name, userId, version = undefined) => {
  const db = await getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    await logAuditFailure(orderId, 'add_evidence', userId, 'unknown', 'user_not_found', '用户不存在', { type, name });
    return { success: false, message: '用户不存在' };
  }

  const order = await getOrderById(orderId);
  if (!order) {
    await logAuditFailure(orderId, 'add_evidence', userId, user.role, 'order_not_found', '订单不存在', { type, name });
    return { success: false, message: '订单不存在' };
  }

  if (order.registrar_id !== userId && order.current_handler !== userId) {
    await logAuditFailure(orderId, 'add_evidence', userId, user.role, 'permission_denied', '无权限添加证据', { type, name });
    return { success: false, message: '无权限添加证据' };
  }

  if (!['draft', 'returned'].includes(order.status)) {
    await logAuditFailure(orderId, 'add_evidence', userId, user.role, 'status_invalid', `当前状态【${order.statusLabel}】不可添加证据`, { type, name });
    return { success: false, message: `当前状态【${order.statusLabel}】不可添加证据` };
  }

  if (version !== undefined && version !== order.version) {
    await logAuditFailure(orderId, 'add_evidence', userId, user.role, 'version_conflict', '版本冲突，数据已被修改', { type, name });
    return { success: false, message: '版本冲突，数据已被修改，请刷新后重试' };
  }

  if (!type || !EVIDENCE_TYPE_LABELS[type]) {
    await logAuditFailure(orderId, 'add_evidence', userId, user.role, 'validation_failed', '无效的证据类型', { type, name });
    return { success: false, message: '无效的证据类型' };
  }
  if (!name || !name.trim()) {
    await logAuditFailure(orderId, 'add_evidence', userId, user.role, 'validation_failed', '证据名称不能为空', { type, name });
    return { success: false, message: '证据名称不能为空' };
  }

  try {
    db.run('BEGIN');
    const id = uuidv4();
    db.prepare(`
      INSERT INTO evidences (id, order_id, type, name, uploaded_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, orderId, type, name.trim(), userId);

    const newVersion = order.version + 1;
    const isReturned = order.status === 'returned';
    const action = isReturned ? 'add_evidence_amendment' : 'add_evidence_draft';
    const actionLabel = isReturned ? '补正添加证据' : '草稿添加证据';
    const logId = uuidv4();

    await logEvidenceChange(db, orderId, id, 'add', type, name.trim(), userId, user.role);

    db.prepare(`
      UPDATE prescription_orders 
      SET version = ?, updated_at = datetime('now', 'localtime') 
      WHERE id = ?
    `).run(newVersion, orderId);

    db.prepare(`
      INSERT INTO operation_logs
      (id, order_id, action, operator_id, operator_name, operator_role,
       from_status, to_status, opinion, result, version_from, version_to)
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId, orderId, action, userId, user.name, user.role,
      order.status, order.status,
      `添加证据：${getEvidenceTypeLabel(type)} - ${name.trim()}`,
      'updated',
      order.version, newVersion
    );

    db.run('COMMIT');
    db.saveToDisk();

    const evidence = db.prepare('SELECT * FROM evidences WHERE id = ?').get(id);
    const evidences = await getOrderEvidences(orderId);
    const evidenceCheck = await validateRequiredEvidences(orderId, order.risk_level);
    const updatedOrder = await getOrderById(orderId);
    const logs = await getOrderLogs(orderId);
    const evidenceChanges = await getEvidenceChanges(orderId);

    return {
      success: true,
      evidence: { ...evidence, typeLabel: getEvidenceTypeLabel(evidence.type) },
      evidences,
      evidenceCheck,
      order: updatedOrder,
      logs,
      evidenceChanges,
      version: newVersion
    };
  } catch (e) {
    try { db.run('ROLLBACK'); } catch (_) {}
    await logAuditFailure(orderId, 'add_evidence', userId, user.role, 'db_error', e.message, { type, name });
    return { success: false, message: e.message };
  }
};

const deleteEvidence = async (evidenceId, userId, version = undefined) => {
  const db = await getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    await logAuditFailure(null, 'delete_evidence', userId, 'unknown', 'user_not_found', '用户不存在', { evidenceId });
    return { success: false, message: '用户不存在' };
  }

  const evidence = db.prepare('SELECT * FROM evidences WHERE id = ?').get(evidenceId);
  if (!evidence) {
    await logAuditFailure(null, 'delete_evidence', userId, user.role, 'evidence_not_found', '证据不存在', { evidenceId });
    return { success: false, message: '证据不存在' };
  }

  const order = await getOrderById(evidence.order_id);
  if (!order) {
    await logAuditFailure(evidence.order_id, 'delete_evidence', userId, user.role, 'order_not_found', '订单不存在', { evidenceId });
    return { success: false, message: '订单不存在' };
  }

  if (order.registrar_id !== userId && order.current_handler !== userId) {
    await logAuditFailure(evidence.order_id, 'delete_evidence', userId, user.role, 'permission_denied', '无权限删除证据', { evidenceId });
    return { success: false, message: '无权限删除证据' };
  }

  if (!['draft', 'returned'].includes(order.status)) {
    await logAuditFailure(evidence.order_id, 'delete_evidence', userId, user.role, 'status_invalid', `当前状态【${order.statusLabel}】不可删除证据`, { evidenceId });
    return { success: false, message: `当前状态【${order.statusLabel}】不可删除证据` };
  }

  if (version !== undefined && version !== order.version) {
    await logAuditFailure(evidence.order_id, 'delete_evidence', userId, user.role, 'version_conflict', '版本冲突，数据已被修改', { evidenceId });
    return { success: false, message: '版本冲突，数据已被修改，请刷新后重试' };
  }

  try {
    db.run('BEGIN');

    const newVersion = order.version + 1;
    const isReturned = order.status === 'returned';
    const action = isReturned ? 'delete_evidence_amendment' : 'delete_evidence_draft';
    const logId = uuidv4();

    await logEvidenceChange(db, evidence.order_id, evidenceId, 'delete', evidence.type, evidence.name, userId, user.role);

    db.prepare('DELETE FROM evidences WHERE id = ?').run(evidenceId);

    db.prepare(`
      UPDATE prescription_orders 
      SET version = ?, updated_at = datetime('now', 'localtime') 
      WHERE id = ?
    `).run(newVersion, evidence.order_id);

    db.prepare(`
      INSERT INTO operation_logs
      (id, order_id, action, operator_id, operator_name, operator_role,
       from_status, to_status, opinion, result, version_from, version_to)
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId, evidence.order_id, action, userId, user.name, user.role,
      order.status, order.status,
      `删除证据：${getEvidenceTypeLabel(evidence.type)} - ${evidence.name}`,
      'updated',
      order.version, newVersion
    );

    db.run('COMMIT');
    db.saveToDisk();

    const evidences = await getOrderEvidences(evidence.order_id);
    const evidenceCheck = await validateRequiredEvidences(evidence.order_id, order.risk_level);
    const updatedOrder = await getOrderById(evidence.order_id);
    const logs = await getOrderLogs(evidence.order_id);
    const evidenceChanges = await getEvidenceChanges(evidence.order_id);

    return {
      success: true,
      evidences,
      evidenceCheck,
      order: updatedOrder,
      logs,
      evidenceChanges,
      version: newVersion
    };
  } catch (e) {
    try { db.run('ROLLBACK'); } catch (_) {}
    await logAuditFailure(evidence.order_id, 'delete_evidence', userId, user.role, 'db_error', e.message, { evidenceId });
    return { success: false, message: e.message };
  }
};

const createOrder = async (data, userId) => {
  const db = await getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    await logAuditFailure(null, 'create', userId, 'unknown', 'user_not_found', '用户不存在', data);
    return { success: false, message: '用户不存在' };
  }
  if (user.role !== 'registrar') {
    await logAuditFailure(null, 'create', userId, user.role, 'permission_denied', '只有登记员可以创建订单', data);
    return { success: false, message: '只有登记员可以创建订单' };
  }

  if (!data.patient_name || !data.patient_name.trim()) {
    await logAuditFailure(null, 'create', userId, user.role, 'validation_failed', '患者姓名不能为空', data);
    return { success: false, message: '患者姓名不能为空' };
  }
  if (!data.drug_name || !data.drug_name.trim()) {
    await logAuditFailure(null, 'create', userId, user.role, 'validation_failed', '药品名称不能为空', data);
    return { success: false, message: '药品名称不能为空' };
  }
  if (!data.quantity || data.quantity < 1) {
    await logAuditFailure(null, 'create', userId, user.role, 'validation_failed', '数量必须大于0', data);
    return { success: false, message: '数量必须大于0' };
  }
  if (!['low', 'medium', 'high'].includes(data.risk_level)) {
    await logAuditFailure(null, 'create', userId, user.role, 'validation_failed', '无效的风险等级', data);
    return { success: false, message: '无效的风险等级' };
  }

  const id = uuidv4();
  const orderNo = `RX${dayjs().format('YYYYMMDDHHmmss')}`;

  db.prepare(`
    INSERT INTO prescription_orders
    (id, order_no, patient_name, patient_phone, drug_name, drug_spec, quantity,
     risk_level, status, current_handler, current_handler_role, store_id,
     registrar_id, version, last_handler, last_handler_role)
    VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, 'registrar', ?, ?, 1, ?, 'registrar')
  `).run(
    id, orderNo, data.patient_name.trim(), data.patient_phone || null, data.drug_name.trim(),
    data.drug_spec || '', data.quantity, data.risk_level,
    userId, user.store_id, userId, user.name
  );
  db.saveToDisk();

  return { success: true, orderId: id, orderNo };
};

const updateOrderBasic = async (orderId, data, userId, version = undefined) => {
  const db = await getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    await logAuditFailure(orderId, 'update', userId, 'unknown', 'user_not_found', '用户不存在', data);
    return { success: false, message: '用户不存在' };
  }

  const order = await getOrderById(orderId);
  if (!order) {
    await logAuditFailure(orderId, 'update', userId, user.role, 'order_not_found', '订单不存在', data);
    return { success: false, message: '订单不存在' };
  }

  if (order.registrar_id !== userId) {
    await logAuditFailure(orderId, 'update', userId, user.role, 'permission_denied', '只有登记员本人可以编辑', data);
    return { success: false, message: '只有登记员本人可以编辑' };
  }

  if (!['draft', 'returned'].includes(order.status)) {
    await logAuditFailure(orderId, 'update', userId, user.role, 'status_invalid', `当前状态【${order.statusLabel}】不可编辑`, data);
    return { success: false, message: `当前状态【${order.statusLabel}】不可编辑` };
  }

  if (version !== undefined && version !== order.version) {
    await logAuditFailure(orderId, 'update', userId, user.role, 'version_conflict', '版本冲突，数据已被修改', data);
    return { success: false, message: '版本冲突，数据已被修改，请刷新后重试' };
  }

  const fieldMap = {
    patient_name: '患者姓名',
    patient_phone: '联系电话',
    drug_name: '药品名称',
    drug_spec: '药品规格',
    quantity: '数量',
    risk_level: '风险等级'
  };

  const updateFields = [];
  const updateValues = [];
  const changedFields = [];

  Object.keys(fieldMap).forEach(field => {
    if (data[field] !== undefined) {
      const oldVal = order[field];
      const newVal = data[field];
      if (String(oldVal) !== String(newVal)) {
        updateFields.push(`${field} = ?`);
        updateValues.push(newVal);
        changedFields.push({ field, label: fieldMap[field], oldVal, newVal });
      }
    }
  });

  if (updateFields.length === 0) {
    return { success: true, changed: false };
  }

  const newVersion = order.version + 1;
  const isReturned = order.status === 'returned';
  const action = isReturned ? 'amendment' : 'edit_draft';
  const actionLabel = isReturned ? '补正修改' : '草稿编辑';
  const logId = uuidv4();

  try {
    db.run('BEGIN');

    updateFields.push(`version = ?`);
    updateValues.push(newVersion);
    updateFields.push(`updated_at = datetime('now', 'localtime')`);
    const sql = `UPDATE prescription_orders SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(orderId);
    db.prepare(sql).run(...updateValues);

    for (const cf of changedFields) {
      await logFieldChange(db, orderId, cf.label, cf.oldVal, cf.newVal, userId, user.role, actionLabel, order.version, newVersion);
    }

    db.prepare(`
      INSERT INTO operation_logs
      (id, order_id, action, operator_id, operator_name, operator_role,
       from_status, to_status, opinion, result, version_from, version_to)
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId, orderId, action, userId, user.name, user.role,
      order.status, order.status,
      `修改字段：${changedFields.map(cf => cf.label).join('、')}`,
      'updated',
      order.version, newVersion
    );

    db.run('COMMIT');
    db.saveToDisk();

    const updatedOrder = await getOrderById(orderId);
    const logs = await getOrderLogs(orderId);
    const fieldChanges = await getFieldChanges(orderId);
    const evidenceCheck = await validateRequiredEvidences(orderId, updatedOrder.risk_level);

    return {
      success: true,
      changed: true,
      order: updatedOrder,
      logs,
      fieldChanges,
      evidenceCheck,
      version: newVersion
    };
  } catch (e) {
    try { db.run('ROLLBACK'); } catch (_) {}
    await logAuditFailure(orderId, 'update', userId, user.role, 'db_error', e.message, data);
    return { success: false, message: e.message };
  }
};

const getFieldChanges = async (orderId) => {
  const db = await getDb();
  const changes = db.prepare(`
    SELECT fc.*, u.name as changed_by_name
    FROM field_changes fc
    LEFT JOIN users u ON fc.changed_by = u.id
    WHERE fc.order_id = ? 
    ORDER BY fc.created_at DESC, fc.id DESC
  `).all(orderId);
  return changes.map(c => ({
    ...c,
    changedByRoleLabel: c.changed_by_role ? getRoleLabel(c.changed_by_role) : null
  }));
};

const getEvidenceChanges = async (orderId) => {
  const db = await getDb();
  const changes = db.prepare(`
    SELECT ec.*, u.name as changed_by_name
    FROM evidence_changes ec
    LEFT JOIN users u ON ec.changed_by = u.id
    WHERE ec.order_id = ? 
    ORDER BY ec.created_at DESC, ec.id DESC
  `).all(orderId);
  return changes.map(c => ({
    ...c,
    evidenceTypeLabel: c.evidence_type ? getEvidenceTypeLabel(c.evidence_type) : null,
    changeTypeLabel: c.change_type === 'add' ? '添加' : c.change_type === 'delete' ? '删除' : c.change_type,
    changedByRoleLabel: c.changed_by_role ? getRoleLabel(c.changed_by_role) : null
  }));
};

const getAuditFailures = async (orderId = null) => {
  const db = await getDb();
  let sql = `SELECT * FROM audit_failures WHERE 1=1`;
  const params = [];
  if (orderId) {
    sql += ' AND order_id = ?';
    params.push(orderId);
  }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT 50';
  return db.prepare(sql).all(...params);
};

module.exports = {
  getOrdersByRole,
  getOrderById,
  getOrderEvidences,
  getOrderLogs,
  getFieldChanges,
  getEvidenceChanges,
  getAuditFailures,
  getStats,
  getAvailableActions,
  checkCanPerformAction,
  validateRequiredEvidences,
  performAction,
  addEvidence,
  deleteEvidence,
  createOrder,
  updateOrderBasic,
  getStatusLabel,
  getRiskLabel,
  getRoleLabel,
  getEvidenceTypeLabel,
  RISK_PRIORITY,
  STATUS_LABELS,
  RISK_LABELS,
  ROLE_LABELS,
  EVIDENCE_TYPE_LABELS
};
