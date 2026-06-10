export const API_BASE = '/api';

export const ROLES = {
  TEACHING_ASSISTANT: 'teaching_assistant',
  LAB_ADMIN: 'lab_admin',
  COLLEGE_HEAD: 'college_head',
};

export const ROLE_LABELS = {
  [ROLES.TEACHING_ASSISTANT]: '实验助教',
  [ROLES.LAB_ADMIN]: '实验室管理员',
  [ROLES.COLLEGE_HEAD]: '学院负责人',
};

export const RESERVATION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  LAB_REVIEWED: 'lab_reviewed',
  LAB_REJECTED: 'lab_rejected',
  CONFIRMED: 'confirmed',
  COLLEGE_REJECTED: 'college_rejected',
};

export const STATUS_LABELS = {
  [RESERVATION_STATUS.DRAFT]: '草稿',
  [RESERVATION_STATUS.SUBMITTED]: '待实验室审核',
  [RESERVATION_STATUS.LAB_REVIEWED]: '待学院确认',
  [RESERVATION_STATUS.LAB_REJECTED]: '实验室退回',
  [RESERVATION_STATUS.CONFIRMED]: '已确认',
  [RESERVATION_STATUS.COLLEGE_REJECTED]: '学院退回',
};

export const STATUS_COLORS = {
  [RESERVATION_STATUS.DRAFT]: 'gray',
  [RESERVATION_STATUS.SUBMITTED]: 'blue',
  [RESERVATION_STATUS.LAB_REVIEWED]: 'purple',
  [RESERVATION_STATUS.LAB_REJECTED]: 'orange',
  [RESERVATION_STATUS.CONFIRMED]: 'green',
  [RESERVATION_STATUS.COLLEGE_REJECTED]: 'red',
};

export const EVIDENCE_TYPES = {
  EXPERIMENT_PLAN: 'experiment_plan',
  MATERIAL_APPLICATION: 'material_application',
  SAFETY_CONFIRMATION: 'safety_confirmation',
};

export const EVIDENCE_LABELS = {
  [EVIDENCE_TYPES.EXPERIMENT_PLAN]: '实验预约方案',
  [EVIDENCE_TYPES.MATERIAL_APPLICATION]: '耗材申领单',
  [EVIDENCE_TYPES.SAFETY_CONFIRMATION]: '安全确认书',
};

export const DEMO_USERS = [
  { id: 1, username: 'ta_wang', role: ROLES.TEACHING_ASSISTANT, name: '王助教', dept: '计算机学院' },
  { id: 2, username: 'ta_li', role: ROLES.TEACHING_ASSISTANT, name: '李助教', dept: '物理学院' },
  { id: 3, username: 'labadmin_zhang', role: ROLES.LAB_ADMIN, name: '张管理员', dept: '实验中心' },
  { id: 4, username: 'labadmin_liu', role: ROLES.LAB_ADMIN, name: '刘管理员', dept: '实验中心' },
  { id: 5, username: 'college_chen', role: ROLES.COLLEGE_HEAD, name: '陈主任', dept: '计算机学院' },
  { id: 6, username: 'college_zhao', role: ROLES.COLLEGE_HEAD, name: '赵院长', dept: '物理学院' },
];
