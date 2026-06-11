import { db } from '../db/schema.js';
import { ROLES, STATUS } from '../db/seed.js';

export const TRANSITION_RULES = {
  [STATUS.DRAFT]: {
    submit: { to: STATUS.PENDING_REVIEW, roles: [ROLES.CSM] }
  },
  [STATUS.PENDING_REVIEW]: {
    verify_pass: { to: STATUS.PENDING_CONFIRM, roles: [ROLES.DELIVERY] },
    reject: { to: STATUS.REJECTED, roles: [ROLES.DELIVERY] }
  },
  [STATUS.PENDING_CONFIRM]: {
    confirm_pass: { to: STATUS.COMPLETED, roles: [ROLES.DIRECTOR] },
    reject: { to: STATUS.REJECTED, roles: [ROLES.DIRECTOR] }
  },
  [STATUS.REJECTED]: {
    resubmit: { to: STATUS.PENDING_REVIEW, roles: [ROLES.CSM] }
  },
  [STATUS.COMPLETED]: {}
};

export const ERROR_CODES = {
  WRONG_ROLE: 'WRONG_ROLE',
  OLD_VERSION: 'OLD_VERSION',
  MISSING_EVIDENCE: 'MISSING_EVIDENCE',
  WRONG_STATUS: 'WRONG_STATUS',
  INVALID_ACTION: 'INVALID_ACTION',
  NOT_FOUND: 'NOT_FOUND'
};

export function audit(userId, action, targetType, targetId, detail = null, ip = null) {
  const d = db();
  const user = d.prepare('SELECT name, role FROM users WHERE id=?').get(userId);
  if (!user) return;
  d.prepare(`
    INSERT INTO audit_logs (user_id, user_name, user_role, action, target_type, target_id, detail, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, user.name, user.role, action, targetType, String(targetId),
    detail ? JSON.stringify(detail) : null, ip);
}

export function checkTransition(plan, action, userRole) {
  const rules = TRANSITION_RULES[plan.status];
  if (!rules || !rules[action]) {
    return {
      ok: false,
      code: ERROR_CODES.WRONG_STATUS,
      message: `状态${plan.status}不允许执行操作「${action}」`
    };
  }
  const rule = rules[action];
  if (!rule.roles.includes(userRole)) {
    return {
      ok: false,
      code: ERROR_CODES.WRONG_ROLE,
      message: `当前角色「${userRole}」不允许执行「${action}」操作，仅允许: ${rule.roles.join(',')}`
    };
  }
  return { ok: true, nextStatus: rule.to };
}

export function requiredEvidences(_plan, action) {
  const req = [];
  if (action === 'submit' || action === 'resubmit') req.push('REGISTRATION');
  if (action === 'verify_pass') req.push('VERIFICATION');
  if (action === 'confirm_pass') req.push('ARCHIVAL');
  return req;
}

export function checkEvidences(planId, requiredTypes) {
  const d = db();
  const missing = [];
  for (const t of requiredTypes) {
    const exists = d.prepare(`
      SELECT COUNT(*) AS c FROM plan_evidences
      WHERE plan_id=? AND evidence_type=?
    `).get(planId, t).c;
    if (exists === 0) {
      const nameMap = { REGISTRATION: '登记证据', VERIFICATION: '过程核验证据', ARCHIVAL: '复核归档证据' };
      missing.push(nameMap[t]);
    }
  }
  if (missing.length > 0) {
    return {
      ok: false,
      code: ERROR_CODES.MISSING_EVIDENCE,
      message: `缺少必要证据：${missing.join('、')}。请先上传对应证据后再执行操作。`
    };
  }
  return { ok: true };
}

export function getPlanWithDetail(planId) {
  const d = db();
  const plan = d.prepare(`
    SELECT p.*, u.name AS creator_name, u.role AS creator_role
    FROM launch_plans p LEFT JOIN users u ON p.created_by = u.id
    WHERE p.id = ?
  `).get(planId);
  if (!plan) return null;

  plan.evidences = d.prepare(`
    SELECT e.*, u.name AS uploader_name FROM plan_evidences e
    LEFT JOIN users u ON e.uploaded_by = u.id
    WHERE e.plan_id = ? ORDER BY e.uploaded_at
  `).all(planId);

  plan.transitions = d.prepare(`
    SELECT t.*, u.name AS operator_name, u.role AS operator_role
    FROM plan_transitions t LEFT JOIN users u ON t.operated_by = u.id
    WHERE t.plan_id = ? ORDER BY t.operated_at
  `).all(planId);

  return plan;
}
