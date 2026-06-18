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
  [ACTIONS.UPDATE_ATTACHMENT]: '上传/更新附件',
  [ACTIONS.UPDATE_RESULT]: '更新处理结果',
  [ACTIONS.UPDATE_AUDIT_REMARK]: '更新审计备注'
};
