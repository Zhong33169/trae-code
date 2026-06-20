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

const MIN_LOSS_REMARK_LENGTH = 10;
const MIN_LOSS_EVIDENCE_DESC_LENGTH = 10;

function validateEvidenceForReview(order, evidences) {
  const errors = [];
  const has = (t) => evidences.some((e) => e.type === t);
  const listOf = (t) => evidences.filter((e) => e.type === t);

  if (!has(EVIDENCE_TYPES.BORROW)) errors.push('缺少"设备借用"证据');

  const borrowEvs = listOf(EVIDENCE_TYPES.BORROW);
  if (has(EVIDENCE_TYPES.BORROW)) {
    const short = borrowEvs.find(e => (e.description?.trim().length || 0) < 5);
    if (short) errors.push(`借用证据描述过短（需>=5字）："${short.description}"`);
  }

  if (!has(EVIDENCE_TYPES.RETURN)) errors.push('缺少"归还验收"证据');

  const returnEvs = listOf(EVIDENCE_TYPES.RETURN);
  if (has(EVIDENCE_TYPES.RETURN)) {
    const short = returnEvs.find(e => (e.description?.trim().length || 0) < 5);
    if (short) errors.push(`归还验收证据描述过短（需>=5字）："${short.description}"`);
    if (order.quantity) {
      const mentionQty = returnEvs.some(e => e.description?.includes(String(order.quantity)));
      if (!mentionQty) errors.push(`归还验收证据未提及数量（共借出${order.quantity}件）`);
    }
  }

  if (order.loss_remark && !has(EVIDENCE_TYPES.LOSS)) {
    errors.push('注明了损耗但缺少"损耗确认"证据');
  }
  if (has(EVIDENCE_TYPES.LOSS) && !order.loss_remark) {
    errors.push('上传了损耗证据但未填写损耗说明');
  }

  if (order.loss_remark && has(EVIDENCE_TYPES.LOSS)) {
    const remark = (order.loss_remark || '').trim();
    if (remark.length < MIN_LOSS_REMARK_LENGTH) {
      errors.push(`损耗说明描述不完整（需>=${MIN_LOSS_REMARK_LENGTH}字，当前${remark.length}字）："${remark}"`);
    }
    if (!/\d/.test(remark)) {
      errors.push('损耗说明未明确损坏数量（需包含数字）');
    }

    const lossEvs = listOf(EVIDENCE_TYPES.LOSS);
    const shortLoss = lossEvs.find(e => (e.description?.trim().length || 0) < MIN_LOSS_EVIDENCE_DESC_LENGTH);
    if (shortLoss) {
      errors.push(`损耗确认证据描述不完整（需>=${MIN_LOSS_EVIDENCE_DESC_LENGTH}字）："${shortLoss.description}"`);
    }
  }

  if (order.quantity && order.quantity < 1) {
    errors.push('数量必须为正整数');
  }

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
