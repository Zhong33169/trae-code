const { ORDER_STATUS, ROLES, EVIDENCE_TYPES } = require('../config');

const STATUS_FLOW = {
  [ORDER_STATUS.DRAFT]: {
    [ROLES.REGISTRAR]: [ORDER_STATUS.PENDING_AUDIT]
  },
  [ORDER_STATUS.PENDING_AUDIT]: {
    [ROLES.AUDITOR]: [ORDER_STATUS.PENDING_REVIEW, ORDER_STATUS.AUDIT_REJECTED]
  },
  [ORDER_STATUS.AUDIT_REJECTED]: {
    [ROLES.REGISTRAR]: [ORDER_STATUS.PENDING_AUDIT]
  },
  [ORDER_STATUS.PENDING_REVIEW]: {
    [ROLES.REVIEWER]: [ORDER_STATUS.ARCHIVED, ORDER_STATUS.REVIEW_REJECTED]
  },
  [ORDER_STATUS.REVIEW_REJECTED]: {
    [ROLES.REGISTRAR]: [ORDER_STATUS.PENDING_AUDIT]
  },
  [ORDER_STATUS.ARCHIVED]: {}
};

function canTransition(fromStatus, role, toStatus) {
  const allowed = STATUS_FLOW[fromStatus]?.[role] || [];
  return allowed.includes(toStatus);
}

function roleName(role) {
  return {
    [ROLES.REGISTRAR]: '器材借用登记员',
    [ROLES.AUDITOR]: '器材借用审核主管',
    [ROLES.REVIEWER]: '体育场馆复核负责人'
  }[role] || role;
}

function statusName(status) {
  return {
    [ORDER_STATUS.DRAFT]: '草稿',
    [ORDER_STATUS.PENDING_AUDIT]: '待审核',
    [ORDER_STATUS.AUDIT_REJECTED]: '审核驳回（待补正）',
    [ORDER_STATUS.PENDING_REVIEW]: '待复核归档',
    [ORDER_STATUS.REVIEW_REJECTED]: '复核驳回（待补正）',
    [ORDER_STATUS.ARCHIVED]: '已归档'
  }[status] || status;
}

function validateEvidenceForReview(order, evidences) {
  const errors = [];
  const has = (t) => evidences.some((e) => e.type === t);
  if (!has(EVIDENCE_TYPES.BORROW)) errors.push('缺少"设备借用"证据');
  if (!has(EVIDENCE_TYPES.RETURN)) errors.push('缺少"归还验收"证据');
  if (order.loss_remark && !has(EVIDENCE_TYPES.LOSS)) errors.push('注明了损耗但缺少"损耗确认"证据');
  if (has(EVIDENCE_TYPES.LOSS) && !order.loss_remark) errors.push('上传了损耗证据但未填写损耗说明');
  return errors;
}

function validateEvidenceForAudit(order, evidences) {
  const errors = [];
  if (!order.borrow_reason || order.borrow_reason.trim().length < 5) {
    errors.push('借用理由描述过于简略，至少5个字');
  }
  if (!order.applicant || !order.department) {
    errors.push('借用人和所属部门必填');
  }
  return errors;
}

module.exports = {
  STATUS_FLOW,
  canTransition,
  roleName,
  statusName,
  validateEvidenceForReview,
  validateEvidenceForAudit
};
