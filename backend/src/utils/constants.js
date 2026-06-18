import { v4 as uuidv4 } from 'uuid';

export function generateId(prefix = '') {
  return prefix + uuidv4().replace(/-/g, '').substring(0, 12);
}

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

export const ACTIONS = {
  CREATE: 'create',
  SUBMIT: 'submit',
  APPROVE: 'approve',
  REJECT: 'reject',
  CORRECT: 'correct',
  ARCHIVE: 'archive',
  BATCH_ARCHIVE: 'batch_archive',
  ARCHIVE_VALIDATION: 'archive_validation',
  UPDATE_ATTACHMENT: 'update_attachment',
  UPDATE_RESULT: 'update_result',
  UPDATE_AUDIT_REMARK: 'update_audit_remark'
};

export const ACTION_NAMES = {
  [ACTIONS.CREATE]: '发起申请',
  [ACTIONS.SUBMIT]: '提交审核',
  [ACTIONS.APPROVE]: '审核通过',
  [ACTIONS.REJECT]: '退回',
  [ACTIONS.CORRECT]: '补正提交',
  [ACTIONS.ARCHIVE]: '复核归档',
  [ACTIONS.BATCH_ARCHIVE]: '批量复核归档',
  [ACTIONS.ARCHIVE_VALIDATION]: '归档校验',
  [ACTIONS.UPDATE_ATTACHMENT]: '上传/更新附件',
  [ACTIONS.UPDATE_RESULT]: '更新处理结果',
  [ACTIONS.UPDATE_AUDIT_REMARK]: '更新审计备注'
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

export function computeNextAction(app, user) {
  const status = app.status;
  const userRole = user?.role;

  if (status === 'pending_operator' || status === 'rejected') {
    return {
      action: 'submit',
      action_name: '补正提交',
      required_role: 'meter_operator',
      required_role_name: '换表登记员',
      next_user: { name: '张三', role: 'meter_operator', role_name: '换表登记员' },
      hint: '登记员补正材料后提交审核'
    };
  } else if (status === 'pending_supervisor') {
    return {
      action: 'approve_or_reject',
      action_name: '审核办理',
      required_role: 'meter_supervisor',
      required_role_name: '换表审核主管',
      next_user: { name: '李四', role: 'meter_supervisor', role_name: '换表审核主管' },
      hint: '主管审核，可通过或退回'
    };
  } else if (status === 'pending_archivist') {
    return {
      action: 'archive',
      action_name: '复核归档',
      required_role: 'gas_archivist',
      required_role_name: '燃气服务公司复核负责人',
      next_user: { name: '王五', role: 'gas_archivist', role_name: '燃气服务公司复核负责人' },
      hint: '复核负责人校验台账后归档'
    };
  } else if (status === 'archived') {
    return {
      action: 'done',
      action_name: '已完成',
      required_role: null,
      required_role_name: null,
      next_user: null,
      hint: '流程已完成，已归档'
    };
  }

  return null;
}
