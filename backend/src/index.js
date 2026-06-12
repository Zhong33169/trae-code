import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { initDatabase, seedDemoData, queryOne, queryAll, run } from './db.js';

await initDatabase();
await seedDemoData();

const app = new Hono();

app.use('*', cors({
  origin: ['http://localhost:30010'],
  allowHeaders: ['Content-Type', 'X-User-Id', 'X-User-Role'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  credentials: true,
  maxAge: 86400,
}));

const STAGE_TRANSITIONS = {
  INITIATE: { next: 'HANDLE', requiredRole: 'INITIATOR' },
  HANDLE: { next: 'REVIEW_ARCHIVE', requiredRole: 'HANDLER' },
  REVIEW_ARCHIVE: { next: null, requiredRole: 'REVIEWER' }
};

const ROLE_NAMES = {
  INITIATOR: '招商专员(发起)',
  HANDLER: '招商经理(办理)',
  REVIEWER: '复核专员(复核归档)'
};

const STATUS_NAMES = {
  INITIATED: '已发起',
  HANDLED: '已办理',
  REVIEWED: '已复核',
  ARCHIVED: '已归档',
  REJECTED: '已驳回'
};

function getCurrentUser(c) {
  const userId = c.req.header('X-User-Id');
  const userRole = c.req.header('X-User-Role');
  if (!userId || !userRole) return null;
  const user = queryOne('SELECT * FROM users WHERE id = ? AND role = ?', [userId, userRole]);
  return user || null;
}

function requireAuth(c) {
  const user = getCurrentUser(c);
  if (!user) {
    return c.json({
      success: false,
      error: 'AUTH_REQUIRED',
      message: '用户未登录或角色无效，请先选择角色登录',
      details: null
    }, 401);
  }
  return user;
}

function requireRole(user, allowedRoles) {
  if (!allowedRoles.includes(user.role)) {
    return {
      success: false,
      error: 'ROLE_PERMISSION_DENIED',
      message: `当前角色【${ROLE_NAMES[user.role]}】无此操作权限`,
      details: {
        currentRole: user.role,
        currentRoleName: ROLE_NAMES[user.role],
        allowedRoles: allowedRoles.map(r => ({ role: r, name: ROLE_NAMES[r] }))
      }
    };
  }
  return null;
}

function addLog(orderNo, user, action, detail) {
  run(
    'INSERT INTO operation_logs (order_no, operator_id, operator_name, operator_role, action, detail) VALUES (?, ?, ?, ?, ?, ?)',
    [orderNo, user.id, user.name, user.role, action, detail]
  );
}

function checkEvidence(clueNo) {
  const lead = queryOne('SELECT * FROM enterprise_leads WHERE clue_no = ?', [clueNo]);
  const followups = queryOne('SELECT COUNT(*) as cnt FROM follow_up_records WHERE clue_no = ?', [clueNo]).cnt || 0;
  const signings = queryOne('SELECT COUNT(*) as cnt FROM signing_confirmations WHERE clue_no = ?', [clueNo]).cnt || 0;
  return {
    hasEnterpriseEvidence: !!(lead && lead.enterprise_name && lead.contact_person && lead.contact_phone),
    hasFollowupEvidence: followups > 0,
    hasSigningEvidence: signings > 0,
    lead: lead || null,
    followupCount: followups,
    signingCount: signings
  };
}

function validateEvidenceForStage(currentStage, evidence) {
  const missing = [];
  if (currentStage === 'HANDLE' || currentStage === 'REVIEW_ARCHIVE') {
    if (!evidence.hasEnterpriseEvidence) {
      missing.push({ field: 'enterprise_evidence', name: '企业线索关键信息', detail: '缺少企业名称、联系人或联系电话' });
    }
  }
  if (currentStage === 'REVIEW_ARCHIVE') {
    if (!evidence.hasFollowupEvidence) {
      missing.push({ field: 'followup_evidence', name: '跟进拜访记录', detail: '至少需要1条跟进拜访记录' });
    }
    if (!evidence.hasSigningEvidence) {
      missing.push({ field: 'signing_evidence', name: '签约确认材料', detail: '缺少签约确认信息（合同金额、签约日期）' });
    }
  }
  return missing;
}

app.get('/api/health', (c) => {
  return c.json({ success: true, message: '园区招商中心服务运行中', timestamp: new Date().toISOString() });
});

app.get('/api/users', (c) => {
  const users = queryAll('SELECT id, username, name, role FROM users ORDER BY id');
  return c.json({ success: true, data: users.map(u => ({ ...u, roleName: ROLE_NAMES[u.role] })) });
});

app.get('/api/users/current', (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, data: null });
  return c.json({ success: true, data: { ...user, roleName: ROLE_NAMES[user.role] } });
});

app.get('/api/clue-orders', (c) => {
  const user = requireAuth(c);
  if (user && user.success === false) return user;

  const status = c.req.query('status');
  const currentStage = c.req.query('currentStage');
  const keyword = c.req.query('keyword');
  const mine = c.req.query('mine');

  let sql = `
    SELECT co.*, el.enterprise_name, el.industry, el.intention
    FROM clue_orders co LEFT JOIN enterprise_leads el ON co.clue_no = el.clue_no
    WHERE 1=1
  `;
  const params = [];

  if (status) { sql += ' AND co.status = ?'; params.push(status); }
  if (currentStage) { sql += ' AND co.current_stage = ?'; params.push(currentStage); }
  if (keyword) {
    sql += ' AND (co.order_no LIKE ? OR co.title LIKE ? OR el.enterprise_name LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }
  if (mine === 'true') {
    if (user.role === 'INITIATOR') { sql += ' AND co.initiator_id = ?'; params.push(user.id); }
    else if (user.role === 'HANDLER') { sql += ' AND co.handler_id = ?'; params.push(user.id); }
    else if (user.role === 'REVIEWER') { sql += ' AND co.reviewer_id = ?'; params.push(user.id); }
  }

  sql += ' ORDER BY co.created_at DESC';
  const orders = queryAll(sql, params);

  const data = orders.map(o => ({
    ...o,
    statusName: STATUS_NAMES[o.status],
    stageName: o.current_stage === 'INITIATE' ? '发起' : o.current_stage === 'HANDLE' ? '办理' : '复核归档'
  }));

  return c.json({ success: true, data });
});

app.get('/api/clue-orders/:orderNo', (c) => {
  const user = requireAuth(c);
  if (user && user.success === false) return user;

  const { orderNo } = c.req.param();
  const order = queryOne(`
    SELECT co.*, el.enterprise_name, el.contact_person, el.contact_phone, el.industry, el.scale, el.registered_capital, el.intention, el.source
    FROM clue_orders co LEFT JOIN enterprise_leads el ON co.clue_no = el.clue_no
    WHERE co.order_no = ?
  `, [orderNo]);

  if (!order) {
    return c.json({ success: false, error: 'ORDER_NOT_FOUND', message: `线索单【${orderNo}】不存在`, details: { orderNo } }, 404);
  }

  const followups = queryAll('SELECT * FROM follow_up_records WHERE clue_no = ? ORDER BY visit_date DESC', [order.clue_no]);
  const signings = queryAll('SELECT * FROM signing_confirmations WHERE clue_no = ? ORDER BY signing_date DESC', [order.clue_no]);
  const logs = queryAll('SELECT * FROM operation_logs WHERE order_no = ? ORDER BY created_at DESC', [orderNo]);
  const evidence = checkEvidence(order.clue_no);

  const enterpriseFields = ['enterprise_name', 'contact_person', 'contact_phone', 'industry', 'scale', 'registered_capital', 'intention', 'source'];
  const enterprise = {};
  enterpriseFields.forEach(f => { enterprise[f] = order[f]; delete order[f]; });

  order.statusName = STATUS_NAMES[order.status];
  order.stageName = order.current_stage === 'INITIATE' ? '发起' : order.current_stage === 'HANDLE' ? '办理' : '复核归档';

  return c.json({
    success: true,
    data: {
      order,
      enterprise,
      followups,
      signings,
      logs,
      evidence,
      enterpriseEvidenceOk: evidence.hasEnterpriseEvidence
    }
  });
});

app.post('/api/clue-orders', async (c) => {
  const user = requireAuth(c);
  if (user && user.success === false) return user;

  const roleError = requireRole(user, ['INITIATOR']);
  if (roleError) return c.json(roleError, 403);

  const body = await c.req.json();
  const { clue_no, title } = body;

  if (!clue_no || !title) {
    return c.json({
      success: false, error: 'MISSING_REQUIRED_FIELDS', message: '缺少必填字段',
      details: { required: ['clue_no', 'title'], provided: Object.keys(body) }
    }, 400);
  }

  const existing = queryOne('SELECT * FROM enterprise_leads WHERE clue_no = ?', [clue_no]);
  if (!existing) {
    return c.json({
      success: false, error: 'CLUE_NOT_FOUND', message: `企业线索【${clue_no}】不存在，请先录入企业线索`,
      details: { clue_no }
    }, 400);
  }

  const duplicate = queryOne(`
    SELECT co.* FROM clue_orders co
    WHERE co.clue_no = ? AND co.status IN ('INITIATED', 'HANDLED', 'REVIEWED')
  `, [clue_no]);

  if (duplicate) {
    return c.json({
      success: false, error: 'DUPLICATE_ORDER',
      message: `企业线索【${clue_no}】已存在进行中的线索单【${duplicate.order_no}】，不得重复发起`,
      details: {
        clue_no, existingOrderNo: duplicate.order_no,
        existingStatus: duplicate.status, existingStatusName: STATUS_NAMES[duplicate.status]
      }
    }, 409);
  }

  const evidence = checkEvidence(clue_no);
  const evidenceIssues = validateEvidenceForStage('HANDLE', evidence);

  const orderNo = 'XS' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') +
    String(Math.floor(Math.random() * 9000) + 1000);

  run(`
    INSERT INTO clue_orders (order_no, clue_no, status, title, current_stage, initiator_id, initiator_name, initiate_time, has_enterprise_evidence, has_followup_evidence, has_signing_evidence, evidence_check_note)
    VALUES (?, ?, 'INITIATED', ?, 'HANDLE', ?, ?, ?, ?, ?, ?, ?)
  `, [
    orderNo, clue_no, title, user.id, user.name, new Date().toISOString(),
    evidence.hasEnterpriseEvidence ? 1 : 0,
    evidence.hasFollowupEvidence ? 1 : 0,
    evidence.hasSigningEvidence ? 1 : 0,
    evidenceIssues.length > 0 ? '发起时证据待补：' + evidenceIssues.map(e => e.name).join('、') : '发起时证据初检通过'
  ]);

  addLog(orderNo, user, '发起线索单',
    `创建线索单${orderNo}，关联企业${clue_no}(${existing.enterprise_name})。证据检查：${evidenceIssues.length > 0 ? evidenceIssues.map(e => e.name + '缺失').join('、') : '齐全'}`
  );

  const created = queryOne(`
    SELECT co.*, el.enterprise_name FROM clue_orders co
    LEFT JOIN enterprise_leads el ON co.clue_no = el.clue_no
    WHERE co.order_no = ?
  `, [orderNo]);

  return c.json({
    success: true,
    message: evidenceIssues.length > 0
      ? `线索单发起成功，以下证据待后续补充：${evidenceIssues.map(e => e.name).join('、')}`
      : '线索单发起成功',
    data: created,
    warnings: evidenceIssues
  }, 201);
});

app.post('/api/clue-orders/:orderNo/handle', async (c) => {
  const user = requireAuth(c);
  if (user && user.success === false) return user;

  const roleError = requireRole(user, ['HANDLER']);
  if (roleError) return c.json(roleError, 403);

  const { orderNo } = c.req.param();
  const body = await c.req.json();
  const { clientVersion, followup, signing } = body;

  const order = queryOne('SELECT * FROM clue_orders WHERE order_no = ?', [orderNo]);
  if (!order) {
    addLog(orderNo, user, '办理-拦截', '失败原因：线索单不存在');
    return c.json({ success: false, error: 'ORDER_NOT_FOUND', message: `线索单【${orderNo}】不存在`, details: { orderNo } }, 404);
  }

  if (order.status === 'REJECTED') {
    addLog(orderNo, user, '办理-拦截', '失败原因：线索单已被驳回');
    return c.json({
      success: false, error: 'ORDER_REJECTED', message: `线索单【${orderNo}】已被驳回，需重新发起`,
      details: { orderNo, rejectReason: order.reject_reason }
    }, 409);
  }

  if (order.current_stage !== 'HANDLE') {
    const stageName = order.current_stage === 'INITIATE' ? '发起' : '复核归档';
    const requiredRole = order.current_stage === 'INITIATE' ? ROLE_NAMES['INITIATOR'] : ROLE_NAMES['REVIEWER'];
    addLog(orderNo, user, '办理-拦截',
      `失败原因：阶段不符(当前${order.current_stage})，HANDLER角色只能处理HANDLE阶段`);
    return c.json({
      success: false, error: 'WRONG_STAGE',
      message: `线索单【${orderNo}】当前处于【${stageName}】阶段，应由【${requiredRole}】处理，您作为【${ROLE_NAMES[user.role]}】无法办理`,
      details: {
        orderNo, currentStage: order.current_stage, currentStageName: stageName,
        yourRole: user.role, yourRoleName: ROLE_NAMES[user.role]
      }
    }, 409);
  }

  if (order.status !== 'INITIATED') {
    addLog(orderNo, user, '办理-拦截',
      `失败原因：状态不符(当前${order.status})，仅INITIATED可办理`);
    return c.json({
      success: false, error: 'WRONG_STATUS',
      message: `线索单【${orderNo}】当前状态为【${STATUS_NAMES[order.status]}】，仅【已发起】状态可办理`,
      details: { orderNo, currentStatus: order.status, currentStatusName: STATUS_NAMES[order.status], expectedStatus: 'INITIATED' }
    }, 409);
  }

  if (clientVersion !== undefined && clientVersion !== order.version) {
    addLog(orderNo, user, '办理-拦截',
      `失败原因：版本冲突(客户端${clientVersion}/服务端${order.version})`);
    return c.json({
      success: false, error: 'VERSION_CONFLICT',
      message: `线索单【${orderNo}】已被更新，请刷新后再操作`,
      details: { orderNo, clientVersion, serverVersion: order.version }
    }, 409);
  }

  if (order.handler_id && order.handler_id !== user.id) {
    const handlerName = order.handler_name || queryOne('SELECT name FROM users WHERE id = ?', [order.handler_id])?.name;
    addLog(orderNo, user, '办理-拦截',
      `失败原因：非当前办理人，实际办理人${handlerName}`);
    return c.json({
      success: false, error: 'ORDER_ALREADY_ASSIGNED',
      message: `线索单【${orderNo}】已由【${handlerName}】办理，您无法覆盖他人办理结果`,
      details: {
        orderNo, assignedHandlerId: order.handler_id, assignedHandlerName: handlerName,
        yourId: user.id, yourName: user.name
      }
    }, 409);
  }

  if (!followup && !signing) {
    addLog(orderNo, user, '办理-拦截', '失败原因：未提供任何证据(followup/signing)');
    return c.json({
      success: false, error: 'NO_EVIDENCE_PROVIDED',
      message: '办理时至少需要提供跟进拜访记录或签约确认信息',
      details: { required: ['followup', 'signing'], hint: '请填写跟进拜访记录或签约确认信息' }
    }, 400);
  }

  const evidence = checkEvidence(order.clue_no);
  const newFollowupCount = evidence.followupCount + (followup ? 1 : 0);

  if (newFollowupCount === 0) {
    addLog(orderNo, user, '办理-拦截', '失败原因：缺少至少1条跟进拜访记录');
    return c.json({
      success: false, error: 'FOLLOWUP_REQUIRED',
      message: '办理阶段至少需要1条跟进拜访记录，请补充',
      details: { currentCount: evidence.followupCount, required: 1 }
    }, 400);
  }

  try {
    if (followup) {
      run(`
        INSERT INTO follow_up_records (clue_no, visit_date, location, participants, content, attachment, handler_id, handler_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [order.clue_no, followup.visit_date, followup.location || '', followup.participants || '', followup.content, followup.attachment || '', user.id, user.name]);
    }

    if (signing) {
      if (!signing.contract_amount || !signing.signing_date) {
        throw new Error('签约确认缺少合同金额或签约日期');
      }
      run(`
        INSERT INTO signing_confirmations (clue_no, contract_amount, signing_date, contract_terms, attachment, handler_id, handler_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [order.clue_no, signing.contract_amount, signing.signing_date, signing.contract_terms || '', signing.attachment || '', user.id, user.name]);
    }

    const updatedEvidence = checkEvidence(order.clue_no);
    const missing = [];
    if (!updatedEvidence.hasEnterpriseEvidence) missing.push('企业线索信息');
    if (!updatedEvidence.hasFollowupEvidence) missing.push('跟进拜访记录');
    if (!updatedEvidence.hasSigningEvidence) missing.push('签约确认');

    run(`
      UPDATE clue_orders SET
        status = 'HANDLED', current_stage = 'REVIEW_ARCHIVE',
        handler_id = ?, handler_name = ?, handle_time = ?,
        has_enterprise_evidence = ?, has_followup_evidence = ?, has_signing_evidence = ?,
        evidence_check_note = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE order_no = ? AND version = ?
    `, [
      user.id, user.name, new Date().toISOString(),
      updatedEvidence.hasEnterpriseEvidence ? 1 : 0,
      updatedEvidence.hasFollowupEvidence ? 1 : 0,
      updatedEvidence.hasSigningEvidence ? 1 : 0,
      missing.length > 0 ? `办理后仍待补：${missing.join('、')}` : '办理完成，证据已齐全',
      orderNo, order.version
    ]);

    addLog(orderNo, user, '办理线索单',
      `完成办理，提交至复核归档。补充证据：${followup ? '跟进拜访' : ''}${followup && signing ? '、' : ''}${signing ? '签约确认' : ''}。${missing.length > 0 ? '仍缺失：' + missing.join('、') : '证据齐全'}`
    );

    const updated = queryOne(`
      SELECT co.*, el.enterprise_name FROM clue_orders co
      LEFT JOIN enterprise_leads el ON co.clue_no = el.clue_no
      WHERE co.order_no = ?
    `, [orderNo]);

    return c.json({ success: true, message: '线索单办理成功，已提交至复核归档', data: updated });
  } catch (e) {
    return c.json({ success: false, error: 'HANDLE_FAILED', message: '办理失败：' + e.message, details: { error: e.message } }, 500);
  }
});

app.post('/api/clue-orders/:orderNo/review', async (c) => {
  const user = requireAuth(c);
  if (user && user.success === false) return user;

  const roleError = requireRole(user, ['REVIEWER']);
  if (roleError) return c.json(roleError, 403);

  const { orderNo } = c.req.param();
  const body = await c.req.json();
  const { clientVersion, action, rejectReason } = body;

  const order = queryOne('SELECT * FROM clue_orders WHERE order_no = ?', [orderNo]);
  if (!order) {
    addLog(orderNo, user, '复核-拦截', '失败原因：线索单不存在');
    return c.json({ success: false, error: 'ORDER_NOT_FOUND', message: `线索单【${orderNo}】不存在`, details: { orderNo } }, 404);
  }

  if (order.current_stage !== 'REVIEW_ARCHIVE') {
    const stageName = order.current_stage === 'INITIATE' ? '发起' : '办理';
    const requiredRole = order.current_stage === 'INITIATE' ? ROLE_NAMES['INITIATOR'] : ROLE_NAMES['HANDLER'];
    addLog(orderNo, user, '复核-拦截',
      `失败原因：阶段不符(当前${order.current_stage})，REVIEWER角色只能处理REVIEW_ARCHIVE阶段`);
    return c.json({
      success: false, error: 'WRONG_STAGE',
      message: `线索单【${orderNo}】当前处于【${stageName}】阶段，应由【${requiredRole}】处理，您作为【${ROLE_NAMES[user.role]}】无法复核`,
      details: { orderNo, currentStage: order.current_stage, currentStageName: stageName, yourRole: user.role, yourRoleName: ROLE_NAMES[user.role] }
    }, 409);
  }

  if (order.status !== 'HANDLED' && order.status !== 'REVIEWED') {
    addLog(orderNo, user, '复核-拦截',
      `失败原因：状态不符(当前${order.status})，仅HANDLED/REVIEWED可复核`);
    return c.json({
      success: false, error: 'WRONG_STATUS',
      message: `线索单【${orderNo}】当前状态为【${STATUS_NAMES[order.status]}】，仅【已办理/已复核】状态可复核归档`,
      details: { orderNo, currentStatus: order.status, currentStatusName: STATUS_NAMES[order.status], expectedStatuses: ['HANDLED', 'REVIEWED'] }
    }, 409);
  }

  if (clientVersion !== undefined && clientVersion !== order.version) {
    addLog(orderNo, user, '复核-拦截',
      `失败原因：版本冲突(客户端${clientVersion}/服务端${order.version})`);
    return c.json({
      success: false, error: 'VERSION_CONFLICT',
      message: `线索单【${orderNo}】已被更新，请刷新后再操作`,
      details: { orderNo, clientVersion, serverVersion: order.version }
    }, 409);
  }

  const evidence = checkEvidence(order.clue_no);
  const missing = validateEvidenceForStage('REVIEW_ARCHIVE', evidence);

  if (action === 'reject') {
    if (!rejectReason) {
      addLog(orderNo, user, '复核-拦截', '失败原因：驳回操作未填驳回原因');
      return c.json({ success: false, error: 'REJECT_REASON_REQUIRED', message: '驳回必须填写驳回原因', details: { orderNo } }, 400);
    }
    run(`
      UPDATE clue_orders SET
        status = 'REJECTED', reviewer_id = ?, reviewer_name = ?, review_time = ?, reject_reason = ?,
        version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE order_no = ? AND version = ?
    `, [user.id, user.name, new Date().toISOString(), rejectReason, orderNo, order.version]);

    addLog(orderNo, user, '驳回复核', `驳回原因：${rejectReason}`);
    const updated = queryOne('SELECT * FROM clue_orders WHERE order_no = ?', [orderNo]);
    return c.json({ success: true, message: `线索单已驳回：${rejectReason}`, data: updated });
  }

  if (missing.length > 0) {
    addLog(orderNo, user, '复核-拦截',
      `失败原因：证据不齐全，缺少${missing.map(e => e.name).join('、')}`);
    return c.json({
      success: false, error: 'INSUFFICIENT_EVIDENCE',
      message: `复核归档前证据不齐全，缺少：${missing.map(e => e.name).join('、')}`,
      details: { orderNo, missing: missing, evidenceStatus: evidence }
    }, 400);
  }

  run(`
    UPDATE clue_orders SET
      status = 'ARCHIVED', current_stage = 'REVIEW_ARCHIVE',
      reviewer_id = ?, reviewer_name = ?, review_time = ?,
      version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE order_no = ? AND version = ?
  `, [user.id, user.name, new Date().toISOString(), orderNo, order.version]);

  addLog(orderNo, user, '复核归档', '证据齐全，完成归档');

  const updated = queryOne(`
    SELECT co.*, el.enterprise_name FROM clue_orders co
    LEFT JOIN enterprise_leads el ON co.clue_no = el.clue_no
    WHERE co.order_no = ?
  `, [orderNo]);

  return c.json({ success: true, message: '线索单复核通过，已归档', data: updated });
});

app.post('/api/clue-orders/batch-review', async (c) => {
  const user = requireAuth(c);
  if (user && user.success === false) return user;

  const roleError = requireRole(user, ['REVIEWER']);
  if (roleError) return c.json(roleError, 403);

  const body = await c.req.json();
  const { order_nos } = body;

  if (!Array.isArray(order_nos) || order_nos.length === 0) {
    return c.json({ success: false, error: 'EMPTY_BATCH', message: '请选择要批量复核的线索单', details: {} }, 400);
  }

  const results = [];
  for (const orderNo of order_nos) {
    const order = queryOne('SELECT * FROM clue_orders WHERE order_no = ?', [orderNo]);
    if (!order) {
      addLog(orderNo, user, '批量复核-拦截', '失败原因：线索单不存在');
      results.push({ orderNo, success: false, error: 'ORDER_NOT_FOUND', message: '线索单不存在' });
      continue;
    }
    if (order.current_stage !== 'REVIEW_ARCHIVE' || !['HANDLED', 'REVIEWED'].includes(order.status)) {
      addLog(orderNo, user, '批量复核-拦截',
        `失败原因：阶段/状态不符(阶段${order.current_stage} 状态${order.status})，仅REVIEW_ARCHIVE阶段/HANDLED-REVIEWED状态可归档`);
      results.push({ orderNo, success: false, error: 'NOT_REVIEWABLE', message: `当前阶段${order.current_stage}状态${order.status}不可复核` });
      continue;
    }
    const evidence = checkEvidence(order.clue_no);
    const missing = validateEvidenceForStage('REVIEW_ARCHIVE', evidence);
    if (missing.length > 0) {
      addLog(orderNo, user, '批量复核-拦截', `失败原因：证据不齐全，缺少${missing.map(e => e.name).join('、')}`);
      results.push({ orderNo, success: false, error: 'INSUFFICIENT_EVIDENCE', message: `缺少：${missing.map(e => e.name).join('、')}`, missing });
      continue;
    }
    try {
      run(`
        UPDATE clue_orders SET
          status = 'ARCHIVED', reviewer_id = ?, reviewer_name = ?, review_time = ?,
          version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE order_no = ?
      `, [user.id, user.name, new Date().toISOString(), orderNo]);
      addLog(orderNo, user, '批量复核归档', '单条批量复核通过，证据齐全');
      results.push({ orderNo, success: true, message: '已归档' });
    } catch (e) {
      addLog(orderNo, user, '批量复核-拦截', `失败原因：DB异常 - ${e.message}`);
      results.push({ orderNo, success: false, error: 'DB_ERROR', message: e.message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failedNos = results.filter(r => !r.success).map(r => r.orderNo).join(',');
  addLog(order_nos[0] || 'BATCH', user, '【批量复核汇总】',
    `共${results.length}条，成功${successCount}条，失败${results.length - successCount}条。失败单号：${failedNos || '无'}`);

  return c.json({
    success: true,
    message: `批量复核完成：成功${successCount}条，失败${results.length - successCount}条`,
    data: { total: results.length, success: successCount, failed: results.length - successCount, details: results }
  });
});

function validateBindOrderForSupplement(user, body, supplementType) {
  const { order_no, clientVersion } = body;
  const typeName = supplementType;
  if (!order_no) {
    return { blocked: true, httpStatus: 400, error: {
      success: false, error: 'ORDER_NO_REQUIRED',
      message: '补录' + typeName + '必须通过线索单办理页面发起（需order_no）',
      details: { required: ['order_no'], provided: Object.keys(body) }
    } };
  }
  const order = queryOne('SELECT * FROM clue_orders WHERE order_no = ?', [order_no]);
  if (!order) {
    addLog(order_no, user, '补录' + typeName + '-拦截', '失败原因：线索单不存在');
    return { blocked: true, httpStatus: 404, error: { success: false, error: 'ORDER_NOT_FOUND', message: '线索单【' + order_no + '】不存在', details: { order_no } } };
  }
  if (order.status === 'ARCHIVED') {
    addLog(order_no, user, '补录' + typeName + '-拦截', '失败原因：线索单已归档，禁止补录');
    return { blocked: true, httpStatus: 409, error: { success: false, error: 'ORDER_ARCHIVED', message: '线索单【' + order_no + '】已归档，禁止补录' + typeName, details: { order_no } } };
  }
  if (order.status === 'REJECTED') {
    addLog(order_no, user, '补录' + typeName + '-拦截', '失败原因：线索单已被驳回，禁止补录');
    return { blocked: true, httpStatus: 409, error: { success: false, error: 'ORDER_REJECTED', message: '线索单【' + order_no + '】已被驳回，无法补录' + typeName + '，请重新发起', details: { order_no, reject_reason: order.reject_reason } } };
  }
  if (order.current_stage !== 'HANDLE') {
    addLog(order_no, user, '补录' + typeName + '-拦截',
      '失败原因：阶段不符(当前' + order.current_stage + ')，仅HANDLE阶段可补录');
    const stageText = { INITIATE: '发起', HANDLE: '办理', REVIEW_ARCHIVE: '复核归档' }[order.current_stage];
    return { blocked: true, httpStatus: 409, error: {
      success: false, error: 'WRONG_STAGE',
      message: '线索单【' + order_no + '】当前处于【' + stageText + '阶段】，仅【办理】阶段可补录' + typeName,
      details: { order_no, current_stage: order.current_stage, required_stage: 'HANDLE' } } };
  }
  if (order.status !== 'INITIATED') {
    addLog(order_no, user, '补录' + typeName + '-拦截',
      '失败原因：状态不符(当前' + order.status + ')，仅INITIATED状态可补录');
    return { blocked: true, httpStatus: 409, error: {
      success: false, error: 'WRONG_STATUS',
      message: '线索单【' + order_no + '】当前状态为【' + (STATUS_NAMES[order.status] || order.status) + '】，仅【已发起】状态可补录' + typeName,
      details: { order_no, current_status: order.status, required_status: 'INITIATED' } } };
  }
  if (clientVersion !== undefined && clientVersion !== order.version) {
    addLog(order_no, user, '补录' + typeName + '-拦截',
      '失败原因：版本冲突(客户端' + clientVersion + '/服务端' + order.version + ')');
    return { blocked: true, httpStatus: 409, error: {
      success: false, error: 'VERSION_CONFLICT',
      message: '线索单【' + order_no + '】已被他人更新，请刷新后再补录' + typeName,
      details: { order_no, clientVersion, serverVersion: order.version } } };
  }
  if (order.handler_id && order.handler_id !== user.id) {
    const handlerName = order.handler_name || '';
    addLog(order_no, user, '补录' + typeName + '-拦截', '失败原因：非当前办理人，实际办理人' + handlerName);
    return { blocked: true, httpStatus: 409, error: {
      success: false, error: 'NOT_CURRENT_HANDLER',
      message: '线索单【' + order_no + '】已由【' + handlerName + '】接手，您不是当前办理人，无法补录' + typeName,
      details: { order_no, assigned_handler_id: order.handler_id, assigned_handler_name: handlerName, your_id: user.id, your_name: user.name } } };
  }
  return { blocked: false, order };
}

function syncEvidenceAfterSupplement(order_no, order, user, supplementType) {
  const evidence = checkEvidence(order.clue_no);
  const missing = [];
  if (!evidence.hasEnterpriseEvidence) missing.push('企业关键信息');
  if (!evidence.hasFollowupEvidence) missing.push('跟进拜访');
  if (!evidence.hasSigningEvidence) missing.push('签约确认');
  run(`
    UPDATE clue_orders SET
      handler_id = CASE WHEN handler_id IS NULL THEN ? ELSE handler_id END,
      handler_name = CASE WHEN handler_name IS NULL THEN ? ELSE handler_name END,
      has_enterprise_evidence = ?,
      has_followup_evidence = ?,
      has_signing_evidence = ?,
      evidence_check_note = ?,
      version = version + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE order_no = ?
  `, [
    user.id, user.name,
    evidence.hasEnterpriseEvidence ? 1 : 0,
    evidence.hasFollowupEvidence ? 1 : 0,
    evidence.hasSigningEvidence ? 1 : 0,
    `补录${supplementType}后：${missing.length ? '仍待补 - ' + missing.join('、') : '证据已齐全'}`,
    order_no
  ]);
}

app.get('/api/enterprise-leads', (c) => {
  const keyword = c.req.query('keyword');
  let sql = `
    SELECT el.*, (SELECT COUNT(*) FROM clue_orders co WHERE co.clue_no = el.clue_no AND co.status IN ('INITIATED','HANDLED','REVIEWED')) as active_order_count
    FROM enterprise_leads el WHERE 1=1
  `;
  const params = [];
  if (keyword) {
    sql += ' AND (el.clue_no LIKE ? OR el.enterprise_name LIKE ? OR el.contact_person LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }
  sql += ' ORDER BY el.created_at DESC';
  const data = queryAll(sql, params);
  return c.json({ success: true, data });
});

app.get('/api/enterprise-leads/:clueNo', (c) => {
  const { clueNo } = c.req.param();
  const lead = queryOne('SELECT * FROM enterprise_leads WHERE clue_no = ?', [clueNo]);
  if (!lead) return c.json({ success: false, error: 'NOT_FOUND', message: '企业线索不存在' }, 404);
  const followups = queryAll('SELECT * FROM follow_up_records WHERE clue_no = ? ORDER BY visit_date DESC', [clueNo]);
  const signings = queryAll('SELECT * FROM signing_confirmations WHERE clue_no = ? ORDER BY signing_date DESC', [clueNo]);
  const orders = queryAll('SELECT * FROM clue_orders WHERE clue_no = ? ORDER BY created_at DESC', [clueNo]);
  return c.json({ success: true, data: { ...lead, followups, signings, orders } });
});

app.post('/api/enterprise-leads', async (c) => {
  const user = requireAuth(c);
  if (user && user.success === false) return user;

  const roleError = requireRole(user, ['INITIATOR', 'HANDLER']);
  if (roleError) return c.json(roleError, 403);

  const body = await c.req.json();
  const { enterprise_name, contact_person, contact_phone, industry, scale, registered_capital, intention, source } = body;

  if (!enterprise_name || !contact_person || !contact_phone) {
    return c.json({
      success: false, error: 'MISSING_REQUIRED_FIELDS', message: '企业线索缺少必填字段：企业名称、联系人、联系电话',
      details: { required: ['enterprise_name', 'contact_person', 'contact_phone'], provided: Object.keys(body) }
    }, 400);
  }

  const clueNo = 'QY' + new Date().getFullYear() + String(Math.floor(Math.random() * 90000) + 10000);

  run(`
    INSERT INTO enterprise_leads (clue_no, enterprise_name, contact_person, contact_phone, industry, scale, registered_capital, intention, source, initiator_id, initiator_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [clueNo, enterprise_name, contact_person, contact_phone, industry || '', scale || '', registered_capital || 0, intention || '中', source || '', user.id, user.name]);

  const data = queryOne('SELECT * FROM enterprise_leads WHERE clue_no = ?', [clueNo]);
  return c.json({ success: true, message: '企业线索录入成功', data }, 201);
});

app.post('/api/follow-up-records', async (c) => {
  const user = requireAuth(c);
  if (user && user.success === false) return user;

  const roleError = requireRole(user, ['HANDLER']);
  if (roleError) return c.json(roleError, 403);

  const body = await c.req.json();
  const { visit_date, content, location, participants, attachment } = body;

  const validated = validateBindOrderForSupplement(user, body, '跟进拜访');
  if (validated.blocked) return c.json(validated.error, validated.httpStatus);
  const { order } = validated;

  if (!visit_date || !content) {
    addLog(order.order_no, user, '补录跟进拜访-拦截', '失败原因：必填字段缺失');
    return c.json({
      success: false, error: 'MISSING_REQUIRED_FIELDS', message: '跟进拜访缺少必填字段',
      details: { required: ['order_no', 'visit_date', 'content'], provided: Object.keys(body) }
    }, 400);
  }

  const lead = queryOne('SELECT * FROM enterprise_leads WHERE clue_no = ?', [order.clue_no]);
  if (!lead) {
    addLog(order.order_no, user, '补录跟进拜访-拦截', '失败原因：关联企业线索不存在');
    return c.json({ success: false, error: 'CLUE_NOT_FOUND', message: `企业线索【${order.clue_no}】不存在`, details: { clue_no: order.clue_no } }, 404);
  }

  try {
    run(`
      INSERT INTO follow_up_records (clue_no, visit_date, location, participants, content, attachment, handler_id, handler_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [order.clue_no, visit_date, location || '', participants || '', content, attachment || '', user.id, user.name]);

    syncEvidenceAfterSupplement(order.order_no, order, user, '跟进拜访');

    addLog(order.order_no, user, '补录跟进拜访',
      `补录成功。拜访日期：${visit_date}${location ? `，地点：${location}` : ''}${participants ? `，参与人：${participants}` : ''}`);

    const updatedOrder = queryOne(`
      SELECT co.*, el.enterprise_name FROM clue_orders co
      LEFT JOIN enterprise_leads el ON co.clue_no = el.clue_no WHERE co.order_no = ?
    `, [order.order_no]);

    return c.json({ success: true, message: '跟进拜访补录成功，线索单证据与版本已同步更新', data: { order: updatedOrder } }, 201);
  } catch (e) {
    addLog(order.order_no, user, '补录跟进拜访-拦截', `失败原因：DB异常 - ${e.message}`);
    return c.json({ success: false, error: 'SUPPLEMENT_FAILED', message: '补录跟进拜访失败：' + e.message, details: { error: e.message } }, 500);
  }
});

app.post('/api/signing-confirmations', async (c) => {
  const user = requireAuth(c);
  if (user && user.success === false) return user;

  const roleError = requireRole(user, ['HANDLER']);
  if (roleError) return c.json(roleError, 403);

  const body = await c.req.json();
  const { contract_amount, signing_date, contract_terms, attachment } = body;

  const validated = validateBindOrderForSupplement(user, body, '签约确认');
  if (validated.blocked) return c.json(validated.error, validated.httpStatus);
  const { order } = validated;

  if (!contract_amount || !signing_date) {
    addLog(order.order_no, user, '补录签约确认-拦截', '失败原因：必填字段缺失');
    return c.json({
      success: false, error: 'MISSING_REQUIRED_FIELDS', message: '签约确认缺少必填字段',
      details: { required: ['order_no', 'contract_amount', 'signing_date'], provided: Object.keys(body) }
    }, 400);
  }

  const lead = queryOne('SELECT * FROM enterprise_leads WHERE clue_no = ?', [order.clue_no]);
  if (!lead) {
    addLog(order.order_no, user, '补录签约确认-拦截', '失败原因：关联企业线索不存在');
    return c.json({ success: false, error: 'CLUE_NOT_FOUND', message: `企业线索【${order.clue_no}】不存在`, details: { clue_no: order.clue_no } }, 404);
  }

  try {
    run(`
      INSERT INTO signing_confirmations (clue_no, contract_amount, signing_date, contract_terms, attachment, handler_id, handler_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [order.clue_no, contract_amount, signing_date, contract_terms || '', attachment || '', user.id, user.name]);

    syncEvidenceAfterSupplement(order.order_no, order, user, '签约确认');

    addLog(order.order_no, user, '补录签约确认',
      `补录成功。签约日期：${signing_date}，合同金额：${contract_amount}万`);

    const updatedOrder = queryOne(`
      SELECT co.*, el.enterprise_name FROM clue_orders co
      LEFT JOIN enterprise_leads el ON co.clue_no = el.clue_no WHERE co.order_no = ?
    `, [order.order_no]);

    return c.json({ success: true, message: '签约确认补录成功，线索单证据与版本已同步更新', data: { order: updatedOrder } }, 201);
  } catch (e) {
    addLog(order.order_no, user, '补录签约确认-拦截', `失败原因：DB异常 - ${e.message}`);
    return c.json({ success: false, error: 'SUPPLEMENT_FAILED', message: '补录签约确认失败：' + e.message, details: { error: e.message } }, 500);
  }
});

app.get('/api/stats', (c) => {
  const totalOrders = queryOne('SELECT COUNT(*) as cnt FROM clue_orders').cnt || 0;
  const byStatusArr = queryAll('SELECT status, COUNT(*) as cnt FROM clue_orders GROUP BY status');
  const byStageArr = queryAll('SELECT current_stage, COUNT(*) as cnt FROM clue_orders GROUP BY current_stage');
  return c.json({
    success: true,
    data: {
      totalOrders,
      byStatus: Object.fromEntries(byStatusArr.map(s => [s.status, s.cnt])),
      byStage: Object.fromEntries(byStageArr.map(s => [s.current_stage, s.cnt]))
    }
  });
});

app.onError((err, c) => {
  console.error('[API Error]', err);
  return c.json({ success: false, error: 'SERVER_ERROR', message: err.message || '服务器内部错误', details: null }, 500);
});

const port = 8010;
console.log(`\n🏢 园区招商中心后端服务启动中...`);
console.log(`📍 监听端口: ${port}`);
console.log(`🔗 API 基础地址: http://localhost:${port}/api`);
console.log(`👥 演示账号已初始化，请查看 README\n`);

serve({
  fetch: app.fetch,
  port
});
