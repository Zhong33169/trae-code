import { Hono } from 'hono';
import db from '../db/index.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  generateId, ROLES, STATUS, STATUS_NAMES,
  ACTIONS, ACTION_NAMES, ROLE_NAMES, ISSUE_TYPE_NAMES
} from '../utils/constants.js';

const app = new Hono();

app.use('*', authMiddleware);

function buildApplicationDetail(appData) {
  const processRecords = db.prepare(`
    SELECT pr.*, u.name as actor_name
    FROM process_records pr
    LEFT JOIN users u ON pr.actor_id = u.id
    WHERE pr.application_id = ?
    ORDER BY pr.created_at ASC
  `).all(appData.id).map(r => ({
    ...r,
    actor_role_name: ROLE_NAMES[r.actor_role] || r.actor_role,
    action_name: ACTION_NAMES[r.action] || r.action
  }));

  const attachments = db.prepare(`
    SELECT a.*, u.name as uploader_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    WHERE a.application_id = ?
    ORDER BY a.uploaded_at DESC
  `).all(appData.id);

  const auditLogs = db.prepare(`
    SELECT al.*, u.name as user_name
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE al.application_id = ?
    ORDER BY al.created_at DESC
  `).all(appData.id).map(l => ({
    ...l,
    user_role_name: ROLE_NAMES[l.user_role] || l.user_role,
    action_name: ACTION_NAMES[l.action] || l.action
  }));

  const operator = appData.operator_id ?
    db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(appData.operator_id) : null;
  const reviewer = appData.reviewer_id ?
    db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(appData.reviewer_id) : null;
  const archivist = appData.archivist_id ?
    db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(appData.archivist_id) : null;

  const offlineRecord = db.prepare(`
    SELECT * FROM offline_ledger WHERE batch_no = ? AND meter_no = ?
  `).get(appData.batch_no, appData.old_meter_no);

  return {
    ...appData,
    status_name: STATUS_NAMES[appData.status] || appData.status,
    operator: operator ? { ...operator, role_name: ROLE_NAMES[operator.role] } : null,
    reviewer: reviewer ? { ...reviewer, role_name: ROLE_NAMES[reviewer.role] } : null,
    archivist: archivist ? { ...archivist, role_name: ROLE_NAMES[archivist.role] } : null,
    offline_ledger_record: offlineRecord || null,
    process_records: processRecords,
    attachments: attachments,
    audit_logs: auditLogs
  };
}

function addAuditLog(applicationId, userId, userRole, action, details, failureReason = null, remark = null) {
  const id = generateId('AUDIT_');
  db.prepare(`
    INSERT INTO audit_logs (id, application_id, user_id, user_role, action, details, failure_reason, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, applicationId, userId, userRole, action, details, failureReason, remark);
}

function validateApplicationArchive(appData) {
  const issues = [];

  const offlineRecord = db.prepare(`
    SELECT * FROM offline_ledger WHERE batch_no = ? AND meter_no = ?
  `).get(appData.batch_no, appData.old_meter_no);

  if (!offlineRecord) {
    issues.push({
      type: 'offline_missing',
      type_name: ISSUE_TYPE_NAMES.offline_missing,
      location: 'offline',
      online: { label: '线上申请', value: `批次号=${appData.batch_no}，旧表号=${appData.old_meter_no}（状态：${STATUS_NAMES[appData.status]}）` },
      offline: { label: '离线台账', value: '无对应记录' },
      message: `线上已提交换表申请（批次${appData.batch_no}、旧表号${appData.old_meter_no}），但离线台账中未找到该记录，线上线下数据不一致。`
    });
  } else if (offlineRecord.status === 'rejected') {
    issues.push({
      type: 'status_inconsistency',
      type_name: ISSUE_TYPE_NAMES.status_inconsistency,
      location: 'cross',
      online: { label: '线上状态', value: `${STATUS_NAMES[appData.status]}（准备归档）` },
      offline: { label: '离线台账状态', value: `已作废（${offlineRecord.remark || 'rejected'}）` },
      message: `线下台账已将表号${appData.old_meter_no}标记为作废，但线上仍处于待归档状态，线上线下状态不一致，不能归档。`
    });
  }

  const conflictApp = db.prepare(`
    SELECT id, old_meter_no, customer_name FROM applications
    WHERE batch_no = ? AND status = ? AND old_meter_no != ? AND id != ? LIMIT 1
  `).get(appData.batch_no, STATUS.ARCHIVED, appData.old_meter_no, appData.id);
  if (conflictApp) {
    issues.push({
      type: 'batch_conflict',
      type_name: ISSUE_TYPE_NAMES.batch_conflict,
      location: 'online',
      online: { label: '当前申请表号', value: appData.old_meter_no },
      offline: { label: '已归档申请表号', value: `${conflictApp.old_meter_no}（申请${conflictApp.id}，${conflictApp.customer_name}）` },
      message: `批次号${appData.batch_no}已被另一条已归档申请（${conflictApp.id}，表号${conflictApp.old_meter_no}）占用，与当前申请表号${appData.old_meter_no}不一致。`
    });
  }

  return { valid: issues.length === 0, issues, offlineRecord };
}

function summarizeIssues(issues) {
  return issues.map(i => `[${i.type_name}] ${i.message}`).join('；');
}

app.get('/', (c) => {
  const { status, abnormal, batch_no, keyword, timeout } = c.req.query();
  const user = c.get('user');

  let query = `
    SELECT DISTINCT a.*,
      op.name as operator_name,
      rv.name as reviewer_name,
      ar.name as archivist_name
    FROM applications a
    LEFT JOIN users op ON a.operator_id = op.id
    LEFT JOIN users rv ON a.reviewer_id = rv.id
    LEFT JOIN users ar ON a.archivist_id = ar.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND a.status = ?';
    params.push(status);
  }

  if (timeout === 'true') {
    query += ' AND a.is_timeout = 1';
  }

  if (abnormal === 'true') {
    query += ` AND (
      a.is_timeout = 1
      OR a.status = ?
      OR a.offline_ledger_failure_reason IS NOT NULL
      OR (a.status = ? AND a.offline_ledger_backfilled = 0)
    )`;
    params.push(STATUS.REJECTED, STATUS.ARCHIVED);
  }

  if (batch_no) {
    query += ' AND a.batch_no LIKE ?';
    params.push(`%${batch_no}%`);
  }

  if (keyword) {
    query += ' AND (a.customer_name LIKE ? OR a.old_meter_no LIKE ? OR a.new_meter_no LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  query += ' ORDER BY a.created_at DESC';

  const applications = db.prepare(query).all(...params).map(a => ({
    ...a,
    status_name: STATUS_NAMES[a.status] || a.status,
    is_abnormal: a.is_timeout === 1 || a.status === STATUS.REJECTED ||
      !!a.offline_ledger_failure_reason ||
      (a.status === STATUS.ARCHIVED && a.offline_ledger_backfilled === 0)
  }));

  return c.json({
    list: applications,
    current_user: {
      ...user,
      role_name: ROLE_NAMES[user.role]
    }
  });
});

app.get('/validate/ledger', (c) => {
  const { batch_no, old_meter_no, application_id } = c.req.query();

  if (!batch_no || !old_meter_no) {
    return c.json({ valid: false, error: '缺少参数 batch_no 或 old_meter_no' }, 400);
  }

  const appData = {
    id: application_id || 'PREVIEW',
    batch_no,
    old_meter_no,
    status: STATUS.PENDING_ARCHIVIST
  };
  const { valid, issues, offlineRecord } = validateApplicationArchive(appData);

  return c.json({
    valid,
    issues,
    offline_record: offlineRecord || null
  });
});

app.get('/:id', (c) => {
  const appData = db.prepare('SELECT * FROM applications WHERE id = ?').get(c.req.param('id'));
  if (!appData) {
    return c.json({ error: '申请不存在' }, 404);
  }
  return c.json(buildApplicationDetail(appData));
});

app.post('/', requireRole(ROLES.METER_OPERATOR), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const id = body.id || generateId('APP_');

  const existing = db.prepare('SELECT id FROM applications WHERE id = ?').get(id);
  if (existing) {
    return c.json({ error: '申请ID已存在' }, 400);
  }

  try {
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO applications (
          id, batch_no, customer_name, customer_address, old_meter_no, new_meter_no,
          reason, status, operator_id, is_timeout, sla_due_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        id, body.batch_no, body.customer_name, body.customer_address,
        body.old_meter_no, body.new_meter_no, body.reason,
        STATUS.PENDING_SUPERVISOR, user.id,
        body.sla_due_at || null
      );

      const procId = generateId('PROC_');
      db.prepare(`
        INSERT INTO process_records (id, application_id, action, actor_role, actor_id, review_comment)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(procId, id, ACTIONS.CREATE, user.role, user.id, '发起换表申请');

      addAuditLog(id, user.id, user.role, ACTIONS.CREATE,
        `创建换表申请，批次号：${body.batch_no}，旧表号：${body.old_meter_no}，新表号：${body.new_meter_no}`,
        null, body.audit_remark || null);
    });
    tx();
  } catch (e) {
    return c.json({ error: '创建失败：' + e.message }, 500);
  }

  const appData = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
  return c.json(buildApplicationDetail(appData), 201);
});

app.post('/:id/submit', requireRole(ROLES.METER_OPERATOR), async (c) => {
  const user = c.get('user');
  const appId = c.req.param('id');
  const body = await c.req.json();

  const appData = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!appData) {
    return c.json({ error: '申请不存在' }, 404);
  }
  if (appData.status !== STATUS.PENDING_OPERATOR && appData.status !== STATUS.REJECTED) {
    return c.json({ error: '当前状态不能提交审核' }, 400);
  }

  const isCorrect = appData.status === STATUS.REJECTED;
  try {
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(STATUS.PENDING_SUPERVISOR, appId);

      const procId = generateId('PROC_');
      db.prepare(`
        INSERT INTO process_records (id, application_id, action, actor_role, actor_id, review_comment)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(procId, appId,
        isCorrect ? ACTIONS.CORRECT : ACTIONS.SUBMIT,
        user.role, user.id,
        body.review_comment || (isCorrect ? '补正后重新提交' : '提交审核')
      );

      addAuditLog(appId, user.id, user.role,
        isCorrect ? ACTIONS.CORRECT : ACTIONS.SUBMIT,
        body.review_comment || (isCorrect ? '补正后重新提交' : '提交审核'),
        null, body.review_comment || null);
    });
    tx();
  } catch (e) {
    return c.json({ error: '提交失败：' + e.message }, 500);
  }

  const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  return c.json(buildApplicationDetail(updated));
});

app.post('/:id/approve', requireRole(ROLES.METER_SUPERVISOR), async (c) => {
  const user = c.get('user');
  const appId = c.req.param('id');
  const body = await c.req.json();

  const appData = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!appData) {
    return c.json({ error: '申请不存在' }, 404);
  }
  if (appData.status !== STATUS.PENDING_SUPERVISOR) {
    return c.json({ error: '当前状态不能审核通过' }, 400);
  }

  try {
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE applications SET status = ?, reviewer_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(STATUS.PENDING_ARCHIVIST, user.id, appId);

      const procId = generateId('PROC_');
      db.prepare(`
        INSERT INTO process_records (id, application_id, action, actor_role, actor_id, review_comment)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(procId, appId, ACTIONS.APPROVE, user.role, user.id, body.review_comment || '审核通过');

      addAuditLog(appId, user.id, user.role, ACTIONS.APPROVE,
        body.review_comment || '审核通过', null, body.review_comment || null);
    });
    tx();
  } catch (e) {
    return c.json({ error: '审核失败：' + e.message }, 500);
  }

  const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  return c.json(buildApplicationDetail(updated));
});

app.post('/:id/reject', requireRole(ROLES.METER_SUPERVISOR), async (c) => {
  const user = c.get('user');
  const appId = c.req.param('id');
  const body = await c.req.json();

  if (!body.reject_reason) {
    return c.json({ error: '退回原因不能为空' }, 400);
  }

  const appData = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!appData) {
    return c.json({ error: '申请不存在' }, 404);
  }
  if (appData.status !== STATUS.PENDING_SUPERVISOR) {
    return c.json({ error: '当前状态不能退回' }, 400);
  }

  try {
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE applications SET status = ?, reviewer_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(STATUS.PENDING_OPERATOR, user.id, appId);

      const procId = generateId('PROC_');
      db.prepare(`
        INSERT INTO process_records (id, application_id, action, actor_role, actor_id, review_comment, reject_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(procId, appId, ACTIONS.REJECT, user.role, user.id, body.review_comment || '审核退回', body.reject_reason);

      addAuditLog(appId, user.id, user.role, ACTIONS.REJECT,
        `退回原因：${body.reject_reason}${body.review_comment ? '；备注：' + body.review_comment : ''}`,
        body.reject_reason, body.review_comment || null);
    });
    tx();
  } catch (e) {
    return c.json({ error: '退回失败：' + e.message }, 500);
  }

  const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  return c.json(buildApplicationDetail(updated));
});

function executeArchive(appId, appData, user, reviewComment, auditRemark, actionLabel) {
  const { valid, issues, offlineRecord } = validateApplicationArchive(appData);

  if (!valid) {
    const summary = summarizeIssues(issues);
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE applications SET offline_ledger_failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(summary, appId);

      const procId = generateId('PROC_');
      db.prepare(`
        INSERT INTO process_records (id, application_id, action, actor_role, actor_id, review_comment, result)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(procId, appId, ACTIONS.ARCHIVE, user.role, user.id,
        reviewComment || `${actionLabel}校验`,
        '校验未通过，保持待处理状态');

      addAuditLog(appId, user.id, user.role, ACTIONS.ARCHIVE_VALIDATION,
        `${actionLabel}校验未通过，申请保持待处理状态`,
        summary, auditRemark || reviewComment || null);
    });
    tx();

    return {
      archived: false,
      valid: false,
      issues,
      summary,
      detail: '校验未通过，保持待处理状态'
    };
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE applications SET
        status = ?, archivist_id = ?,
        offline_ledger_backfilled = 1, offline_ledger_failure_reason = NULL,
        audit_remark = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(STATUS.ARCHIVED, user.id, auditRemark || appData.audit_remark || null, appId);

    const procId = generateId('PROC_');
    db.prepare(`
      INSERT INTO process_records (id, application_id, action, actor_role, actor_id, review_comment, result)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(procId, appId, ACTIONS.ARCHIVE, user.role, user.id,
      reviewComment || `${actionLabel}归档`,
      '台账匹配成功，已归档');

    addAuditLog(appId, user.id, user.role, ACTIONS.ARCHIVE,
      `${actionLabel}归档完成，台账匹配成功`,
      null, auditRemark || reviewComment || null);
  });
  tx();

  return {
    archived: true,
    valid: true,
    issues: [],
    summary: null,
    detail: '台账匹配成功，已归档'
  };
}

app.post('/:id/archive', requireRole(ROLES.GAS_ARCHIVIST), async (c) => {
  const user = c.get('user');
  const appId = c.req.param('id');
  const body = await c.req.json();

  const appData = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!appData) {
    return c.json({ error: '申请不存在' }, 404);
  }
  if (appData.status !== STATUS.PENDING_ARCHIVIST) {
    return c.json({ error: '当前状态不能归档' }, 400);
  }

  let result;
  try {
    result = executeArchive(appId, appData, user, body.review_comment, body.audit_remark, '复核归档');
  } catch (e) {
    return c.json({ error: '归档失败：' + e.message }, 500);
  }

  const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  const detail = buildApplicationDetail(updated);

  if (!result.valid) {
    return c.json({
      error: '归档校验未通过，申请保持待处理状态',
      issues: result.issues,
      summary: result.summary,
      application: detail
    }, 422);
  }

  return c.json(detail);
});

app.post('/batch-archive', requireRole(ROLES.GAS_ARCHIVIST), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { ids, audit_remark } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return c.json({ error: '请选择要归档的申请' }, 400);
  }

  const results = [];

  for (const appId of ids) {
    const appData = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
    if (!appData) {
      results.push({ id: appId, success: false, archived: false, error: '申请不存在', issues: [] });
      continue;
    }
    if (appData.status !== STATUS.PENDING_ARCHIVIST) {
      const statusIssue = {
        type: 'status_inconsistency',
        type_name: ISSUE_TYPE_NAMES.status_inconsistency,
        location: 'online',
        online: { label: '当前状态', value: STATUS_NAMES[appData.status] },
        offline: { label: '归档要求', value: '待复核负责人归档（pending_archivist）' },
        message: `申请${appId}当前状态为「${STATUS_NAMES[appData.status]}」，不满足归档前置条件，已跳过并保持原状态。`
      };
      results.push({
        id: appId, success: false, archived: false,
        error: `状态不允许归档：${STATUS_NAMES[appData.status]}`,
        issues: [statusIssue]
      });
      continue;
    }

    let result;
    try {
      result = executeArchive(appId, appData, user, null, audit_remark, '批量复核归档');
    } catch (e) {
      results.push({ id: appId, success: false, archived: false, error: '处理失败：' + e.message, issues: [] });
      continue;
    }

    results.push({
      id: appId,
      success: result.archived,
      archived: result.archived,
      ledger_matched: result.archived,
      detail: result.detail,
      issues: result.issues,
      summary: result.summary
    });
  }

  const archivedCount = results.filter(r => r.archived).length;
  const blockedCount = results.filter(r => !r.archived && r.issues.length > 0).length;

  addAuditLog(null, user.id, user.role, ACTIONS.BATCH_ARCHIVE,
    `批量归档${ids.length}条：成功归档${archivedCount}条，校验拦截${blockedCount}条（保持待处理），其他失败${ids.length - archivedCount - blockedCount}条`,
    blockedCount > 0 ? results.filter(r => !r.archived && r.issues.length > 0).map(r => `${r.id}: ${r.summary || r.error}`).join('；') : null,
    audit_remark || null);

  return c.json({
    total: ids.length,
    success: archivedCount,
    blocked: blockedCount,
    failed: ids.length - archivedCount - blockedCount,
    results: results
  });
});

app.post('/:id/attachments', requireRole(ROLES.METER_OPERATOR, ROLES.METER_SUPERVISOR, ROLES.GAS_ARCHIVIST), async (c) => {
  const user = c.get('user');
  const appId = c.req.param('id');
  const body = await c.req.json();

  const appData = db.prepare('SELECT id FROM applications WHERE id = ?').get(appId);
  if (!appData) {
    return c.json({ error: '申请不存在' }, 404);
  }

  const attachId = generateId('ATT_');
  db.prepare(`
    INSERT INTO attachments (id, application_id, filename, file_type, uploaded_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(attachId, appId, body.filename, body.file_type || 'application/octet-stream', user.id);

  addAuditLog(appId, user.id, user.role, ACTIONS.UPDATE_ATTACHMENT,
    `上传附件：${body.filename}`, null, body.remark || null);

  const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  return c.json(buildApplicationDetail(updated));
});

app.delete('/:id/attachments/:attachId', requireRole(ROLES.METER_OPERATOR, ROLES.METER_SUPERVISOR, ROLES.GAS_ARCHIVIST), (c) => {
  const user = c.get('user');
  const appId = c.req.param('id');
  const attachId = c.req.param('attachId');

  const attach = db.prepare('SELECT * FROM attachments WHERE id = ? AND application_id = ?').get(attachId, appId);
  if (!attach) {
    return c.json({ error: '附件不存在' }, 404);
  }

  db.prepare('DELETE FROM attachments WHERE id = ?').run(attachId);
  addAuditLog(appId, user.id, user.role, ACTIONS.UPDATE_ATTACHMENT,
    `删除附件：${attach.filename}`, null, null);

  const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  return c.json(buildApplicationDetail(updated));
});

app.post('/:id/audit-remark', requireRole(ROLES.METER_OPERATOR, ROLES.METER_SUPERVISOR, ROLES.GAS_ARCHIVIST), async (c) => {
  const user = c.get('user');
  const appId = c.req.param('id');
  const body = await c.req.json();

  const appData = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!appData) {
    return c.json({ error: '申请不存在' }, 404);
  }

  db.prepare(`
    UPDATE applications SET audit_remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(body.audit_remark || null, appId);

  addAuditLog(appId, user.id, user.role, ACTIONS.UPDATE_AUDIT_REMARK,
    `更新审计备注：${body.audit_remark || '(清空)'}`,
    null, body.audit_remark || null);

  const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  return c.json(buildApplicationDetail(updated));
});

export default app;
