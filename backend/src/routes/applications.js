import { Hono } from 'hono';
import db from '../db/index.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { 
  generateId, ROLES, STATUS, STATUS_NAMES, 
  ACTIONS, ACTION_NAMES, ROLE_NAMES 
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
    user_role_name: ROLE_NAMES[l.user_role] || l.user_role
  }));

  const operator = appData.operator_id ? 
    db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(appData.operator_id) : null;
  const reviewer = appData.reviewer_id ? 
    db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(appData.reviewer_id) : null;
  const archivist = appData.archivist_id ? 
    db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(appData.archivist_id) : null;

  return {
    ...appData,
    status_name: STATUS_NAMES[appData.status] || appData.status,
    operator: operator ? { ...operator, role_name: ROLE_NAMES[operator.role] } : null,
    reviewer: reviewer ? { ...reviewer, role_name: ROLE_NAMES[reviewer.role] } : null,
    archivist: archivist ? { ...archivist, role_name: ROLE_NAMES[archivist.role] } : null,
    process_records: processRecords,
    attachments: attachments,
    audit_logs: auditLogs
  };
}

function addAuditLog(applicationId, userId, userRole, action, details, failureReason = null) {
  const id = generateId('AUDIT_');
  db.prepare(`
    INSERT INTO audit_logs (id, application_id, user_id, user_role, action, details, failure_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, applicationId, userId, userRole, action, details, failureReason);
}

app.get('/', (c) => {
  const { status, abnormal, batch_no, keyword } = c.req.query();
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

  if (abnormal === 'true') {
    query += ` AND (
      a.offline_ledger_backfilled = 0 
      OR EXISTS (
        SELECT 1 FROM process_records pr 
        WHERE pr.application_id = a.id AND pr.action = 'reject'
      )
    )`;
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
    is_abnormal: a.offline_ledger_backfilled === 0 || a.status === STATUS.REJECTED
  }));

  return c.json({
    list: applications,
    current_user: {
      ...user,
      role_name: ROLE_NAMES[user.role]
    }
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
          reason, status, operator_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, body.batch_no, body.customer_name, body.customer_address,
        body.old_meter_no, body.new_meter_no, body.reason,
        STATUS.PENDING_SUPERVISOR, user.id
      );

      const procId = generateId('PROC_');
      db.prepare(`
        INSERT INTO process_records (id, application_id, action, actor_role, actor_id, review_comment)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(procId, id, ACTIONS.CREATE, user.role, user.id, '发起换表申请');

      addAuditLog(id, user.id, user.role, ACTIONS.CREATE, 
        `创建换表申请，批次号：${body.batch_no}，旧表号：${body.old_meter_no}，新表号：${body.new_meter_no}`);
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
        appData.status === STATUS.REJECTED ? ACTIONS.CORRECT : ACTIONS.SUBMIT, 
        user.role, user.id, 
        body.review_comment || (appData.status === STATUS.REJECTED ? '补正后重新提交' : '提交审核')
      );

      addAuditLog(appId, user.id, user.role, 
        appData.status === STATUS.REJECTED ? ACTIONS.CORRECT : ACTIONS.SUBMIT,
        body.review_comment || '提交审核'
      );
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

      addAuditLog(appId, user.id, user.role, ACTIONS.APPROVE, body.review_comment || '审核通过');
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
        `退回原因：${body.reject_reason}${body.review_comment ? '；备注：' + body.review_comment : ''}`
      );
    });
    tx();
  } catch (e) {
    return c.json({ error: '退回失败：' + e.message }, 500);
  }

  const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  return c.json(buildApplicationDetail(updated));
});

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

  const offlineRecord = db.prepare(`
    SELECT * FROM offline_ledger WHERE batch_no = ? AND meter_no = ?
  `).get(appData.batch_no, appData.old_meter_no);

  let backfilled = 0;
  let failureReason = null;

  if (!offlineRecord) {
    failureReason = `离线台账无此记录：批次号=${appData.batch_no}，旧表号=${appData.old_meter_no}。线上已提交但线下台账未录入。`;
  }

  const batchCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM applications WHERE batch_no = ? AND status = ?
  `).get(appData.batch_no, STATUS.ARCHIVED).cnt;

  if (batchCount > 0) {
    const firstApp = db.prepare(`
      SELECT old_meter_no FROM applications WHERE batch_no = ? AND status = ? LIMIT 1
    `).get(appData.batch_no, STATUS.ARCHIVED);
    if (firstApp && firstApp.old_meter_no !== appData.old_meter_no) {
      if (!failureReason) {
        failureReason = '';
      }
      failureReason += `批次号重复冲突：批次${appData.batch_no}已用于表号${firstApp.old_meter_no}，当前申请表号为${appData.old_meter_no}。`;
    }
  }

  if (failureReason && !body.force_archive) {
    addAuditLog(appId, user.id, user.role, ACTIONS.ARCHIVE, 
      '归档校验失败', failureReason);
    return c.json({ 
      error: '归档校验失败',
      validation_errors: failureReason,
      offline_record: offlineRecord,
      can_force: true
    }, 422);
  }

  backfilled = offlineRecord ? 1 : 0;

  try {
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE applications SET 
          status = ?, archivist_id = ?, 
          offline_ledger_backfilled = ?, offline_ledger_failure_reason = ?,
          audit_remark = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        STATUS.ARCHIVED, user.id, 
        backfilled, failureReason,
        body.audit_remark || null,
        appId
      );

      const procId = generateId('PROC_');
      db.prepare(`
        INSERT INTO process_records (id, application_id, action, actor_role, actor_id, review_comment, result)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(procId, appId, ACTIONS.ARCHIVE, user.role, user.id, 
        body.review_comment || '复核归档', 
        backfilled ? '台账匹配成功' : '台账匹配失败：' + (failureReason || '未知原因')
      );

      addAuditLog(appId, user.id, user.role, ACTIONS.ARCHIVE, 
        `复核归档完成。台账匹配：${backfilled ? '成功' : '失败'}。${body.audit_remark ? '审计备注：' + body.audit_remark : ''}`,
        failureReason
      );
    });
    tx();
  } catch (e) {
    return c.json({ error: '归档失败：' + e.message }, 500);
  }

  const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  return c.json(buildApplicationDetail(updated));
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
    `上传附件：${body.filename}`);

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
    `删除附件：${attach.filename}`);

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
    `更新审计备注：${body.audit_remark || '(清空)'}`);

  const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  return c.json(buildApplicationDetail(updated));
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
      results.push({ id: appId, success: false, error: '申请不存在' });
      continue;
    }
    if (appData.status !== STATUS.PENDING_ARCHIVIST) {
      results.push({ id: appId, success: false, error: `状态不允许归档：${STATUS_NAMES[appData.status]}` });
      continue;
    }

    const offlineRecord = db.prepare(`
      SELECT * FROM offline_ledger WHERE batch_no = ? AND meter_no = ?
    `).get(appData.batch_no, appData.old_meter_no);

    let backfilled = 0;
    let failureReason = null;

    if (!offlineRecord) {
      failureReason = `离线台账无此记录：批次号=${appData.batch_no}，旧表号=${appData.old_meter_no}`;
    }

    const batchArchived = db.prepare(`
      SELECT old_meter_no FROM applications 
      WHERE batch_no = ? AND status = ? AND id != ? LIMIT 1
    `).get(appData.batch_no, STATUS.ARCHIVED, appId);

    if (batchArchived && batchArchived.old_meter_no !== appData.old_meter_no) {
      failureReason = (failureReason ? failureReason + '；' : '') + 
        `批次号重复冲突：批次${appData.batch_no}已用于表号${batchArchived.old_meter_no}`;
    }

    backfilled = offlineRecord ? 1 : 0;

    try {
      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE applications SET 
            status = ?, archivist_id = ?, 
            offline_ledger_backfilled = ?, offline_ledger_failure_reason = ?,
            audit_remark = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          STATUS.ARCHIVED, user.id, 
          backfilled, failureReason,
          audit_remark || null,
          appId
        );

        const procId = generateId('PROC_');
        db.prepare(`
          INSERT INTO process_records (id, application_id, action, actor_role, actor_id, review_comment, result)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(procId, appId, ACTIONS.ARCHIVE, user.role, user.id, 
          '批量复核归档', 
          backfilled ? '台账匹配成功' : '台账匹配失败：' + (failureReason || '未知原因')
        );

        addAuditLog(appId, user.id, user.role, ACTIONS.ARCHIVE, 
          `批量复核归档。台账匹配：${backfilled ? '成功' : '失败'}`,
          failureReason
        );
      });
      tx();

      results.push({ 
        id: appId, 
        success: true, 
        ledger_matched: backfilled === 1,
        detail: backfilled ? '台账匹配成功，已归档' : `台账匹配失败但已归档：${failureReason}`
      });
    } catch (e) {
      results.push({ id: appId, success: false, error: '处理失败：' + e.message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  addAuditLog(null, user.id, user.role, 'batch_archive', 
    `批量归档${ids.length}条，成功${successCount}条，失败${ids.length - successCount}条`);

  return c.json({
    total: ids.length,
    success: successCount,
    failed: ids.length - successCount,
    results: results
  });
});

app.get('/validate/ledger', (c) => {
  const { batch_no, old_meter_no } = c.req.query();
  
  if (!batch_no || !old_meter_no) {
    return c.json({ valid: false, error: '缺少参数' }, 400);
  }

  const offlineRecord = db.prepare(`
    SELECT * FROM offline_ledger WHERE batch_no = ? AND meter_no = ?
  `).get(batch_no, old_meter_no);

  const batchConflict = db.prepare(`
    SELECT a.id, a.old_meter_no, a.customer_name
    FROM applications a
    WHERE a.batch_no = ? AND a.old_meter_no != ? AND a.status = ?
  `).get(batch_no, old_meter_no, STATUS.ARCHIVED);

  const issues = [];

  if (!offlineRecord) {
    issues.push({
      type: 'offline_missing',
      message: `离线台账缺失：线下台账未找到批次号=${batch_no}、旧表号=${old_meter_no}的记录`,
      location: 'offline'
    });
  }

  if (batchConflict) {
    issues.push({
      type: 'batch_conflict',
      message: `批次号重复：批次${batch_no}已被申请${batchConflict.id}（${batchConflict.customer_name}，表号${batchConflict.old_meter_no}）使用`,
      location: 'online'
    });
  }

  return c.json({
    valid: issues.length === 0,
    issues: issues,
    offline_record: offlineRecord || null,
    batch_conflict: batchConflict || null
  });
});

export default app;
