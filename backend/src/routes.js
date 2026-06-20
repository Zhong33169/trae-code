const express = require('express');
const db = require('./db');
const validators = require('./validators');

const router = express.Router();

router.use(express.json());

function parseUser(req) {
  const userId = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];
  if (!userId || !role) return null;
  return db.prepare('SELECT * FROM users WHERE id = ? AND role = ? AND is_active = 1').get(parseInt(userId), role);
}

function logOperation(data) {
  const payload = Object.assign({
    app_id: null, user_id: null, user_name: '', user_role: '',
    action: '', old_status: null, new_status: null, opinion: null,
    reject_reason: null, evidence_check: null,
    version_from: 1, version_to: 1, ip: null, extra: null
  }, data || {});
  db.prepare(`
    INSERT INTO operation_logs (app_id, user_id, user_name, user_role, action, old_status, new_status, opinion, reject_reason, evidence_check, version_from, version_to, ip, extra)
    VALUES (@app_id, @user_id, @user_name, @user_role, @action, @old_status, @new_status, @opinion, @reject_reason, @evidence_check, @version_from, @version_to, @ip, @extra)
  `).run(payload);
}

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ? AND is_active = 1').get(username, password);
  if (!user) return res.status(401).json({ ok: false, msg: '用户名或密码错误' });
  res.json({ ok: true, data: { id: user.id, username: user.username, name: user.name, role: user.role, department: user.department } });
});

router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, username, name, role, department FROM users WHERE is_active = 1').all();
  res.json({ ok: true, data: users });
});

router.get('/applications', (req, res) => {
  const { status, role, handler_id, keyword, evidence_status, is_overdue, has_conflict } = req.query;
  let sql = 'SELECT a.*, u.name as handler_name, u2.name as creator_name FROM credit_applications a LEFT JOIN users u ON a.current_handler_id = u.id LEFT JOIN users u2 ON a.created_by = u2.id WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND a.status = ?'; params.push(status); }
  if (role) { sql += ' AND a.current_handler_role = ?'; params.push(role); }
  if (handler_id) { sql += ' AND a.current_handler_id = ?'; params.push(parseInt(handler_id)); }
  if (evidence_status) { sql += ' AND a.evidence_status = ?'; params.push(evidence_status); }
  if (is_overdue) { sql += ' AND a.is_overdue = 1'; }
  if (has_conflict) { sql += ' AND a.has_conflict = 1'; }
  if (keyword) { sql += ' AND (a.company_name LIKE ? OR a.app_no LIKE ? OR a.applicant LIKE ?)'; const kw = '%' + keyword + '%'; params.push(kw, kw, kw); }
  sql += ' ORDER BY a.updated_at DESC, a.id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ ok: true, data: rows });
});

router.get('/applications/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as n FROM credit_applications').get().n;
  const byStatus = db.prepare('SELECT status, COUNT(*) as n FROM credit_applications GROUP BY status').all();
  const byRole = db.prepare('SELECT current_handler_role, COUNT(*) as n FROM credit_applications WHERE current_handler_role IS NOT NULL GROUP BY current_handler_role').all();
  const overdue = db.prepare('SELECT COUNT(*) as n FROM credit_applications WHERE is_overdue = 1').get().n;
  const conflict = db.prepare('SELECT COUNT(*) as n FROM credit_applications WHERE has_conflict = 1').get().n;
  const archived = db.prepare("SELECT COUNT(*) as n FROM credit_applications WHERE status = 'archived'").get().n;
  const evidenceBad = db.prepare("SELECT COUNT(*) as n FROM credit_applications WHERE evidence_status = 'incomplete'").get().n;
  const inProgress = total - archived - overdue;
  res.json({ ok: true, data: { total, byStatus, byRole, overdue, conflict, archived, evidenceBad, in_progress: inProgress } });
});

router.get('/applications/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const app = db.prepare(`
    SELECT a.*, u.name as handler_name, r.name as prev_handler_name, c.name as creator_name
    FROM credit_applications a
    LEFT JOIN users u ON a.current_handler_id = u.id
    LEFT JOIN users r ON a.prev_handler_id = r.id
    LEFT JOIN users c ON a.created_by = c.id
    WHERE a.id = ?
  `).get(id);
  if (!app) return res.status(404).json({ ok: false, msg: '申请不存在' });
  const evidence = db.prepare('SELECT * FROM evidence_items WHERE app_id = ? ORDER BY is_required DESC, id').all(id);
  const nodes = db.prepare('SELECT * FROM process_nodes WHERE app_id = ? ORDER BY node_order, id').all(id);
  const logs = db.prepare('SELECT * FROM operation_logs WHERE app_id = ? ORDER BY id DESC').all(id);
  res.json({ ok: true, data: { app, evidence, nodes, logs } });
});

function _updateProcessNode(dbTx, appId, nodeType, version, handler, opinion, result) {
  const node = dbTx.prepare(`SELECT * FROM process_nodes WHERE app_id = ? AND node_type = ? AND version = ? AND status IN ('processing','pending') ORDER BY id DESC LIMIT 1`).get(appId, nodeType, version);
  if (node) {
    dbTx.prepare(`UPDATE process_nodes SET handler_id = ?, handler_role = ?, handler_name = ?, opinion = ?, result = ?, status = 'completed', end_time = datetime('now','localtime'), duration_seconds = CAST((julianday('now','localtime') - julianday(start_time)) * 86400 AS INTEGER) WHERE id = ?`).run(
      handler ? handler.id : null, handler ? handler.role : null, handler ? handler.name : null,
      opinion, result, node.id
    );
  }
}

function _addProcessNode(dbTx, appId, nodeType, order, version, handler, status) {
  const last = dbTx.prepare('SELECT MAX(node_order) as max_o FROM process_nodes WHERE app_id = ?').get(appId);
  const o = order || ((last && last.max_o) ? last.max_o + 1 : 1);
  dbTx.prepare(`INSERT INTO process_nodes (app_id, node_type, node_order, handler_id, handler_role, handler_name, status, start_time, version, opinion, result) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), ?, NULL, NULL)`).run(
    appId, nodeType, o,
    handler ? handler.id : null, handler ? handler.role : null, handler ? handler.name : null,
    status || 'processing', version
  );
}

router.post('/applications', (req, res) => {
  const user = parseUser(req);
  if (!user) return res.status(401).json({ ok: false, msg: '未登录' });
  if (user.role !== 'registrar') return res.status(403).json({ ok: false, msg: '仅登记员可创建申请' });
  const { company_name, credit_line, applicant, contact_phone, business_type, currency = 'CNY' } = req.body || {};
  if (!company_name || !credit_line) return res.status(400).json({ ok: false, msg: '企业名称和授信额度必填' });
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

    const result = db.transaction(() => {
      const maxNo = db.prepare(`SELECT MAX(CAST(SUBSTR(app_no, 9) AS INTEGER)) as n FROM credit_applications WHERE app_no LIKE 'CR' || ? || '%'`).get(dateStr).n || 0;
      const app_no = 'CR' + dateStr + String(maxNo + 1).padStart(3, '0');
      const info = db.prepare(`
        INSERT INTO credit_applications (
          app_no, company_name, credit_line, currency, applicant, contact_phone, business_type,
          status, current_handler_role, current_handler_id, version, evidence_status,
          prev_handler_id, prev_handler_role, prev_opinion, prev_result,
          is_overdue, has_conflict, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'registrar', ?, 1, 'incomplete', NULL, NULL, NULL, NULL, 0, 0, ?)
      `).run(
        app_no, company_name, parseFloat(credit_line) || 0, currency,
        applicant, contact_phone, business_type, user.id, user.id
      );
      const appId = info.lastInsertRowid;
      const tpls = [
        ['business_license', '营业执照', 1],
        ['tax_cert', '税务登记证', 1],
        ['id_card', '法人身份证', 1],
        ['financial_report', '近一年财务报表', 1],
        ['bank_statement', '近3个月银行流水', 1],
        ['contract', '主要业务合同', 0],
      ];
      const insEv = db.prepare('INSERT INTO evidence_items (app_id, evidence_type, evidence_name, is_required, is_submitted) VALUES (?, ?, ?, ?, 0)');
      tpls.forEach(t => insEv.run(appId, t[0], t[1], t[2]));
      _addProcessNode(db, appId, 'register', 1, 1, user, 'processing');
      logOperation({
        app_id: appId, user_id: user.id, user_name: user.name, user_role: user.role,
        action: 'create', old_status: null, new_status: 'draft',
        version_from: 1, version_to: 1, ip: req.ip,
        extra: JSON.stringify({ app_no })
      });
      return { id: appId, app_no };
    })();
    res.json({ ok: true, data: result });
  } catch (e) {
    console.error('[CREATE FAILED]', e);
    res.status(500).json({ ok: false, msg: '创建失败：' + (e.message || String(e)) });
  }
});

router.put('/applications/:id/evidence/:eid', (req, res) => {
  const user = parseUser(req);
  if (!user) return res.status(401).json({ ok: false, msg: '未登录' });
  const id = parseInt(req.params.id);
  const eid = parseInt(req.params.eid);
  try {
    const result = db.transaction(() => {
      const app = db.prepare('SELECT * FROM credit_applications WHERE id = ?').get(id);
      if (!app) throw new Error('申请不存在');
      if (user.role !== 'registrar') throw new Error('仅登记员可更新证据');
      const ev = db.prepare('SELECT * FROM evidence_items WHERE id = ? AND app_id = ?').get(eid, id);
      if (!ev) throw new Error('证据不存在');
      const { is_submitted, file_name, remark } = req.body || {};
      const submit = is_submitted ? 1 : 0;
      db.prepare(`UPDATE evidence_items SET is_submitted = ?, file_name = ?, remark = ?, submit_time = datetime('now','localtime') WHERE id = ? AND app_id = ?`).run(
        submit, file_name || null, remark || null, eid, id
      );
      const check = validators.checkEvidence(id, false);
      db.prepare(`UPDATE credit_applications SET evidence_status = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(check.status, id);
      logOperation({
        app_id: id, user_id: user.id, user_name: user.name, user_role: user.role,
        action: 'evidence_update', old_status: app.status, new_status: app.status,
        evidence_check: check.status, version_from: app.version, version_to: app.version,
        ip: req.ip, extra: JSON.stringify({ evidence_id: eid, evidence_name: ev.evidence_name, is_submitted: submit })
      });
      return check;
    })();
    res.json({ ok: true, data: result });
  } catch (e) {
    res.status(400).json({ ok: false, msg: e.message || String(e) });
  }
});

const ACTION_MAP = {
  register_submit: {
    newStatus: 'pending_audit',
    nextRole: 'auditor',
    nextHandler: 3,
    result: 'submit',
    nodeType: 'register',
    needEvidence: true,
    bumpVersion: false,
    clearOverdue: false,
    clearConflict: false,
  },
  correction_resubmit: {
    newStatus: 'pending_audit',
    nextRole: 'auditor',
    nextHandler: 3,
    result: 'submit',
    nodeType: 'correction',
    needEvidence: true,
    bumpVersion: true,
    clearOverdue: false,
    clearConflict: false,
  },
  audit_pass: {
    newStatus: 'pending_review',
    nextRole: 'reviewer',
    nextHandler: 5,
    result: 'pass',
    nodeType: 'audit',
    needEvidence: true,
    bumpVersion: false,
    clearOverdue: true,
    clearConflict: false,
  },
  audit_correction: {
    newStatus: 'reject_correction',
    nextRole: 'registrar',
    nextHandler: 1,
    result: 'correction',
    nodeType: 'audit',
    needEvidence: false,
    bumpVersion: false,
    clearOverdue: false,
    clearConflict: false,
  },
  audit_reject: {
    newStatus: 'reject_revision',
    nextRole: 'registrar',
    nextHandler: 1,
    result: 'reject',
    nodeType: 'audit',
    needEvidence: false,
    bumpVersion: false,
    clearOverdue: false,
    clearConflict: false,
  },
  review_pass: {
    newStatus: 'review_pass',
    nextRole: 'reviewer',
    nextHandler: 5,
    result: 'pass',
    nodeType: 'review',
    needEvidence: true,
    bumpVersion: false,
    clearOverdue: false,
    clearConflict: true,
  },
  review_reject: {
    newStatus: 'reject_revision',
    nextRole: 'registrar',
    nextHandler: 1,
    result: 'reject',
    nodeType: 'review',
    needEvidence: false,
    bumpVersion: false,
    clearOverdue: false,
    clearConflict: false,
  },
  review_archive: {
    newStatus: 'archived',
    nextRole: 'reviewer',
    nextHandler: 5,
    result: 'archive',
    nodeType: 'review',
    needEvidence: true,
    bumpVersion: false,
    clearOverdue: true,
    clearConflict: true,
  },
  appeal_submit: {
    newStatus: 'appeal_reviewing',
    nextRole: 'reviewer',
    nextHandler: 5,
    result: 'appeal',
    nodeType: 'appeal',
    needEvidence: true,
    bumpVersion: true,
    clearOverdue: false,
    clearConflict: false,
  },
};

const NEXT_NODE_MAP = {
  register_submit: 'audit',
  correction_resubmit: 'audit',
  audit_pass: 'review',
  audit_correction: 'correction',
  audit_reject: 'correction',
  review_pass: null,
  review_reject: 'correction',
  review_archive: null,
  appeal_submit: 'review',
};

router.post('/applications/:id/action', (req, res) => {
  const user = parseUser(req);
  if (!user) return res.status(401).json({ ok: false, msg: '未登录' });
  const id = parseInt(req.params.id);
  try {
    const app = db.prepare('SELECT * FROM credit_applications WHERE id = ?').get(id);
    if (!app) return res.status(404).json({ ok: false, msg: '申请不存在' });
    const { action, opinion, reject_reason, client_version } = req.body || {};
    const mapping = ACTION_MAP[action];
    if (!mapping) return res.status(400).json({ ok: false, msg: '未知操作' });

    const validation = validators.validateAll(app, user, action, client_version, mapping.needEvidence);
    if (!validation.ok) {
      try {
        db.prepare('BEGIN').run();
        logOperation({
          app_id: id, user_id: user.id, user_name: user.name, user_role: user.role,
          action: action + '_fail', old_status: app.status, new_status: app.status,
          opinion, reject_reason,
          version_from: app.version, version_to: app.version,
          ip: req.ip, extra: JSON.stringify({ reason: validation.msg })
        });
        db.prepare('COMMIT').run();
      } catch (e) { try { db.prepare('ROLLBACK').run(); } catch {} }
      return res.status(400).json({ ok: false, msg: validation.msg });
    }

    const updated = db.transaction(() => {
      const oldStatus = app.status;
      const oldVersion = app.version;
      const newVersion = mapping.bumpVersion ? app.version + 1 : app.version;
      const isOverdue = mapping.clearOverdue ? 0 : app.is_overdue;
      const hasConflict = mapping.clearConflict ? 0 : app.has_conflict;
      const evCheck = validators.checkEvidence(id, false);
      const nextHandlerUser = db.prepare('SELECT * FROM users WHERE id = ?').get(mapping.nextHandler) || null;

      db.prepare(`
        UPDATE credit_applications SET
          status = ?,
          current_handler_role = ?,
          current_handler_id = ?,
          prev_handler_id = ?,
          prev_handler_role = ?,
          prev_opinion = ?,
          prev_result = ?,
          version = ?,
          is_overdue = ?,
          has_conflict = ?,
          evidence_status = ?,
          reject_reason = ?,
          updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(
        mapping.newStatus, mapping.nextRole, mapping.nextHandler,
        user.id, user.role, opinion || '', mapping.result,
        newVersion, isOverdue, hasConflict,
        evCheck.status, reject_reason || null,
        id
      );

      _updateProcessNode(db, id, mapping.nodeType, oldVersion, user, opinion || '', mapping.result);

      if (mapping.newStatus === 'archived') {
        db.prepare(`UPDATE process_nodes SET status = 'completed', end_time = datetime('now','localtime') WHERE app_id = ? AND status IN ('processing','pending')`).run(id);
      } else {
        const nextNodeType = NEXT_NODE_MAP[action];
        if (nextNodeType && nextHandlerUser) {
          _addProcessNode(db, id, nextNodeType, null, newVersion, nextHandlerUser, 'processing');
        }
      }

      logOperation({
        app_id: id, user_id: user.id, user_name: user.name, user_role: user.role,
        action, old_status: oldStatus, new_status: mapping.newStatus,
        opinion, reject_reason,
        evidence_check: evCheck.status,
        version_from: oldVersion, version_to: newVersion,
        ip: req.ip, extra: JSON.stringify({
          next_handler: nextHandlerUser ? nextHandlerUser.name : null,
          cleared_overdue: mapping.clearOverdue ? !!app.is_overdue : false,
          cleared_conflict: mapping.clearConflict ? !!app.has_conflict : false,
        })
      });
      return db.prepare(`
        SELECT a.*, u.name as handler_name, r.name as prev_handler_name, c.name as creator_name
        FROM credit_applications a
        LEFT JOIN users u ON a.current_handler_id = u.id
        LEFT JOIN users r ON a.prev_handler_id = r.id
        LEFT JOIN users c ON a.created_by = c.id
        WHERE a.id = ?
      `).get(id);
    })();
    res.json({ ok: true, data: updated });
  } catch (e) {
    res.status(400).json({ ok: false, msg: e.message || String(e) });
  }
});

router.get('/applications/:id/logs', (req, res) => {
  const id = parseInt(req.params.id);
  const logs = db.prepare('SELECT * FROM operation_logs WHERE app_id = ? ORDER BY id DESC').all(id);
  res.json({ ok: true, data: logs });
});

router.get('/dict/statuses', (_req, res) => {
  res.json({
    ok: true,
    data: [
      { key: 'draft', label: '草稿', color: 'gray' },
      { key: 'pending_audit', label: '待审核', color: 'blue' },
      { key: 'reject_correction', label: '退回补正', color: 'orange' },
      { key: 'audit_pass', label: '审核通过', color: 'cyan' },
      { key: 'pending_review', label: '待复核', color: 'purple' },
      { key: 'reject_revision', label: '复核驳回', color: 'red' },
      { key: 'review_pass', label: '复核通过', color: 'green' },
      { key: 'appeal_reviewing', label: '申诉复核中', color: 'yellow' },
      { key: 'archived', label: '已归档', color: 'gray' },
      { key: 'overdue', label: '逾期', color: 'red' },
      { key: 'conflict', label: '状态冲突', color: 'red' },
    ]
  });
});

router.get('/dict/roles', (_req, res) => {
  res.json({
    ok: true,
    data: [
      { key: 'registrar', label: '授信登记员' },
      { key: 'auditor', label: '授信审核主管' },
      { key: 'reviewer', label: 'B2B复核负责人' },
    ]
  });
});

router.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

module.exports = router;
