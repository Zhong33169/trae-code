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
  archive_validation: '归档校验',
  update_attachment: '上传/更新附件',
  update_result: '更新结果',
  update_audit_remark: '更新审计备注',
  batch_archive: '批量复核归档'
};

export const ISSUE_TYPE_NAMES = {
  offline_missing: '离线台账缺失',
  batch_conflict: '重复批次冲突',
  status_inconsistency: '状态不一致'
};

export const SAMPLE_CASE_NAMES = {
  normal: '正常样例',
  missing_materials: '缺材料',
  timeout: '超时',
  rejected: '退回',
  offline_missing: '离线台账缺失',
  status_inconsistency: '状态不一致',
  batch_conflict: '重复批次'
};

export const SAMPLE_CASE_COLORS = {
  normal: '#16a34a',
  missing_materials: '#f59e0b',
  timeout: '#ef4444',
  rejected: '#dc2626',
  offline_missing: '#7c3aed',
  status_inconsistency: '#ec4899',
  batch_conflict: '#ea580c'
};
