const ROLES = {
  REGISTRAR: 'registrar',
  SUPERVISOR: 'supervisor',
  REVIEWER: 'reviewer',
};

const ROLE_NAMES = {
  [ROLES.REGISTRAR]: '旁站记录登记员',
  [ROLES.SUPERVISOR]: '旁站记录审核主管',
  [ROLES.REVIEWER]: '工程监理公司复核负责人',
};

const RECORD_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  IN_REVIEW: 'in_review',
  REVIEW_PASSED: 'review_passed',
  REVIEW_REJECTED: 'review_rejected',
  NEEDS_CORRECTION: 'needs_correction',
  CORRECTED: 'corrected',
  IN_FINAL_REVIEW: 'in_final_review',
  FINAL_PASSED: 'final_passed',
  FINAL_REJECTED: 'final_rejected',
  EVIDENCE_MISSING: 'evidence_missing',
  OVERDUE: 'overdue',
  STATUS_CONFLICT: 'status_conflict',
  ARCHIVED: 'archived',
};

const STATUS_NAMES = {
  [RECORD_STATUSES.DRAFT]: '草稿',
  [RECORD_STATUSES.SUBMITTED]: '已提交待审核',
  [RECORD_STATUSES.IN_REVIEW]: '审核中',
  [RECORD_STATUSES.REVIEW_PASSED]: '审核通过',
  [RECORD_STATUSES.REVIEW_REJECTED]: '审核驳回',
  [RECORD_STATUSES.NEEDS_CORRECTION]: '需补正',
  [RECORD_STATUSES.CORRECTED]: '已补正',
  [RECORD_STATUSES.IN_FINAL_REVIEW]: '复核中',
  [RECORD_STATUSES.FINAL_PASSED]: '复核通过',
  [RECORD_STATUSES.FINAL_REJECTED]: '复核驳回',
  [RECORD_STATUSES.EVIDENCE_MISSING]: '缺证据',
  [RECORD_STATUSES.OVERDUE]: '逾期',
  [RECORD_STATUSES.STATUS_CONFLICT]: '状态冲突',
  [RECORD_STATUSES.ARCHIVED]: '已归档',
};

const STATUS_COLORS = {
  [RECORD_STATUSES.DRAFT]: 'default',
  [RECORD_STATUSES.SUBMITTED]: 'blue',
  [RECORD_STATUSES.IN_REVIEW]: 'processing',
  [RECORD_STATUSES.REVIEW_PASSED]: 'success',
  [RECORD_STATUSES.REVIEW_REJECTED]: 'error',
  [RECORD_STATUSES.NEEDS_CORRECTION]: 'warning',
  [RECORD_STATUSES.CORRECTED]: 'blue',
  [RECORD_STATUSES.IN_FINAL_REVIEW]: 'processing',
  [RECORD_STATUSES.FINAL_PASSED]: 'success',
  [RECORD_STATUSES.FINAL_REJECTED]: 'error',
  [RECORD_STATUSES.EVIDENCE_MISSING]: 'warning',
  [RECORD_STATUSES.OVERDUE]: 'red',
  [RECORD_STATUSES.STATUS_CONFLICT]: 'magenta',
  [RECORD_STATUSES.ARCHIVED]: 'default',
};

const OPERATION_TYPES = {
  CREATE: 'create',
  SUBMIT: 'submit',
  REVIEW: 'review',
  REVIEW_PASS: 'review_pass',
  REVIEW_REJECT: 'review_reject',
  REQUEST_CORRECTION: 'request_correction',
  CORRECT: 'correct',
  RESUBMIT: 'resubmit',
  FINAL_REVIEW: 'final_review',
  FINAL_PASS: 'final_pass',
  FINAL_REJECT: 'final_reject',
  ARCHIVE: 'archive',
  MARK_EVIDENCE_MISSING: 'mark_evidence_missing',
  MARK_OVERDUE: 'mark_overdue',
  MARK_STATUS_CONFLICT: 'mark_status_conflict',
  UPDATE: 'update',
};

const OPERATION_NAMES = {
  [OPERATION_TYPES.CREATE]: '创建记录',
  [OPERATION_TYPES.SUBMIT]: '提交审核',
  [OPERATION_TYPES.REVIEW]: '开始审核',
  [OPERATION_TYPES.REVIEW_PASS]: '审核通过',
  [OPERATION_TYPES.REVIEW_REJECT]: '审核驳回',
  [OPERATION_TYPES.REQUEST_CORRECTION]: '退回补正',
  [OPERATION_TYPES.CORRECT]: '补正材料',
  [OPERATION_TYPES.RESUBMIT]: '再次提交',
  [OPERATION_TYPES.FINAL_REVIEW]: '开始复核',
  [OPERATION_TYPES.FINAL_PASS]: '复核通过',
  [OPERATION_TYPES.FINAL_REJECT]: '复核驳回',
  [OPERATION_TYPES.ARCHIVE]: '归档',
  [OPERATION_TYPES.MARK_EVIDENCE_MISSING]: '标记缺证据',
  [OPERATION_TYPES.MARK_OVERDUE]: '标记逾期',
  [OPERATION_TYPES.MARK_STATUS_CONFLICT]: '标记状态冲突',
  [OPERATION_TYPES.UPDATE]: '更新记录',
};

const EVIDENCE_TYPES = {
  PHOTO: 'photo',
  VIDEO: 'video',
  DOCUMENT: 'document',
  SIGNATURE: 'signature',
  OTHER: 'other',
};

const EVIDENCE_TYPE_NAMES = {
  [EVIDENCE_TYPES.PHOTO]: '照片',
  [EVIDENCE_TYPES.VIDEO]: '视频',
  [EVIDENCE_TYPES.DOCUMENT]: '文档',
  [EVIDENCE_TYPES.SIGNATURE]: '签字',
  [EVIDENCE_TYPES.OTHER]: '其他',
};

module.exports = {
  ROLES,
  ROLE_NAMES,
  RECORD_STATUSES,
  STATUS_NAMES,
  STATUS_COLORS,
  OPERATION_TYPES,
  OPERATION_NAMES,
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_NAMES,
};
