const db = require('./db');

const ROLE_TRANSITIONS = {
  registrar: ['draft', 'reject_correction', 'reject_revision'],
  auditor: ['pending_audit', 'overdue', 'conflict'],
  reviewer: ['pending_review', 'appeal_reviewing', 'conflict']
};

const ACTION_ALLOWED_STATUSES = {
  register_submit: ['draft', 'reject_correction'],
  correction_resubmit: ['reject_correction'],
  audit_pass: ['pending_audit', 'overdue'],
  audit_correction: ['pending_audit', 'overdue'],
  audit_reject: ['pending_audit', 'overdue'],
  review_pass: ['pending_review'],
  review_reject: ['pending_review', 'appeal_reviewing', 'conflict'],
  review_archive: ['pending_review', 'review_pass', 'conflict', 'appeal_reviewing'],
  appeal_submit: ['reject_revision', 'review_reject'],
};

function checkHandler(app, user) {
  if (!app.current_handler_id) return { ok: true };
  if (app.current_handler_id !== user.id) {
    return { ok: false, msg: '当前处理人不一致，操作被拒绝' };
  }
  return { ok: true };
}

function checkRole(app, user, action) {
  const allowedRoles = ACTION_ALLOWED_STATUSES[action] ? null : null;
  const roleCheck = {
    register_submit: 'registrar',
    correction_resubmit: 'registrar',
    appeal_submit: 'registrar',
    audit_pass: 'auditor',
    audit_correction: 'auditor',
    audit_reject: 'auditor',
    review_pass: 'reviewer',
    review_reject: 'reviewer',
    review_archive: 'reviewer',
  }[action];

  if (roleCheck && user.role !== roleCheck) {
    return { ok: false, msg: '角色权限不符，操作被拒绝' };
  }
  return { ok: true };
}

function checkStatus(app, action) {
  const allowed = ACTION_ALLOWED_STATUSES[action];
  if (!allowed) return { ok: true };
  if (!allowed.includes(app.status)) {
    return { ok: false, msg: `当前状态 ${app.status} 不允许执行 ${action}` };
  }
  return { ok: true };
}

function checkVersion(app, clientVersion) {
  if (clientVersion !== undefined && clientVersion !== null) {
    const cv = parseInt(clientVersion);
    if (!isNaN(cv) && cv !== app.version) {
      return { ok: false, msg: `版本冲突：客户端版本 ${cv}，当前版本 ${app.version}` };
    }
  }
  return { ok: true };
}

function checkEvidence(appId, requireComplete = false) {
  const items = db.prepare('SELECT * FROM evidence_items WHERE app_id = ? AND is_required = 1').all(appId);
  const missing = items.filter(i => !i.is_submitted);
  if (requireComplete && missing.length > 0) {
    const names = missing.map(m => m.evidence_name).join('、');
    return { ok: false, msg: '必填证据不完整：' + names, missing: missing.length, status: 'incomplete' };
  }
  const allItems = db.prepare('SELECT * FROM evidence_items WHERE app_id = ?').all(appId);
  const submittedCount = allItems.filter(i => i.is_submitted).length;
  let status = 'incomplete';
  if (submittedCount === allItems.length) status = 'complete';
  else if (submittedCount > 0) status = 'partial';
  return { ok: true, status, missing: missing.length };
}

function validateAll(app, user, action, clientVersion, requireEvidence = true) {
  const checks = [
    checkHandler(app, user),
    checkRole(app, user, action),
    checkStatus(app, action),
    checkVersion(app, clientVersion),
  ];
  for (const c of checks) if (!c.ok) return c;
  if (requireEvidence) {
    const ev = checkEvidence(app.id, requireEvidence);
    if (!ev.ok) return ev;
  }
  return { ok: true };
}

module.exports = {
  ROLE_TRANSITIONS,
  ACTION_ALLOWED_STATUSES,
  checkHandler,
  checkRole,
  checkStatus,
  checkVersion,
  checkEvidence,
  validateAll,
};
