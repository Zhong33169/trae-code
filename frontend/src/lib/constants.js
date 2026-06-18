export const ROLES = {
  METER_OPERATOR: 'meter_operator',
  METER_SUPERVISOR: 'meter_supervisor',
  GAS_ARCHIVIST: 'gas_archivist'
};

export const ROLE_NAMES = {
  [ROLES.METER_OPERATOR]: '换表登记员',
  [ROLES.METER_SUPERVISOR]: '换表审核主管',
  [ROLES.GAS_ARCHIVIST]: '燃气服务公司复核负责人'
};

export const STATUS = {
  PENDING_OPERATOR: 'pending_operator',
  PENDING_SUPERVISOR: 'pending_supervisor',
  PENDING_ARCHIVIST: 'pending_archivist',
  REJECTED: 'rejected',
  ARCHIVED: 'archived'
};

export const STATUS_NAMES = {
  [STATUS.PENDING_OPERATOR]: '待登记员补正',
  [STATUS.PENDING_SUPERVISOR]: '待审核主管办理',
  [STATUS.PENDING_ARCHIVIST]: '待复核负责人归档',
  [STATUS.REJECTED]: '已退回',
  [STATUS.ARCHIVED]: '已归档'
};

export const STATUS_COLORS = {
  [STATUS.PENDING_OPERATOR]: '#f59e0b',
  [STATUS.PENDING_SUPERVISOR]: '#3b82f6',
  [STATUS.PENDING_ARCHIVIST]: '#8b5cf6',
  [STATUS.REJECTED]: '#ef4444',
  [STATUS.ARCHIVED]: '#10b981'
};

export const ACTION_NAMES = {
  create: '发起申请',
  submit: '提交审核',
  approve: '审核通过',
  reject: '退回',
  correct: '补正提交',
  archive: '复核归档',
  update_attachment: '更新附件',
  update_result: '更新结果',
  update_audit_remark: '更新审计备注',
  batch_archive: '批量归档'
};
