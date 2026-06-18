export enum UserRole {
  REGISTER = 'REGISTER',
  AUDIT = 'AUDIT',
  REVIEW = 'REVIEW',
}

export const ROLE_NAME: Record<UserRole, string> = {
  [UserRole.REGISTER]: '传播计划登记员',
  [UserRole.AUDIT]: '传播计划审核主管',
  [UserRole.REVIEW]: '公关传播团队复核负责人',
};

export enum PlanStatus {
  DRAFT = 'DRAFT',
  PENDING_AUDIT = 'PENDING_AUDIT',
  NEED_CORRECT = 'NEED_CORRECT',
  AUDIT_PASSED = 'AUDIT_PASSED',
  MATERIAL_PENDING = 'MATERIAL_PENDING',
  MATERIAL_REJECTED = 'MATERIAL_REJECTED',
  MATERIAL_APPROVED = 'MATERIAL_APPROVED',
  DELIVERY_PENDING = 'DELIVERY_PENDING',
  DELIVERY_CONFIRMED = 'DELIVERY_CONFIRMED',
  ARCHIVED = 'ARCHIVED',
}

export const STATUS_NAME: Record<PlanStatus, string> = {
  [PlanStatus.DRAFT]: '草稿',
  [PlanStatus.PENDING_AUDIT]: '待审核',
  [PlanStatus.NEED_CORRECT]: '需补正',
  [PlanStatus.AUDIT_PASSED]: '审核通过',
  [PlanStatus.MATERIAL_PENDING]: '待素材审核',
  [PlanStatus.MATERIAL_REJECTED]: '素材审核不通过',
  [PlanStatus.MATERIAL_APPROVED]: '素材审核通过',
  [PlanStatus.DELIVERY_PENDING]: '待投放确认',
  [PlanStatus.DELIVERY_CONFIRMED]: '投放已确认',
  [PlanStatus.ARCHIVED]: '已归档',
};

export const STATUS_COLOR: Record<PlanStatus, string> = {
  [PlanStatus.DRAFT]: '#909399',
  [PlanStatus.PENDING_AUDIT]: '#e6a23c',
  [PlanStatus.NEED_CORRECT]: '#f56c6c',
  [PlanStatus.AUDIT_PASSED]: '#67c23a',
  [PlanStatus.MATERIAL_PENDING]: '#e6a23c',
  [PlanStatus.MATERIAL_REJECTED]: '#f56c6c',
  [PlanStatus.MATERIAL_APPROVED]: '#67c23a',
  [PlanStatus.DELIVERY_PENDING]: '#e6a23c',
  [PlanStatus.DELIVERY_CONFIRMED]: '#67c23a',
  [PlanStatus.ARCHIVED]: '#409eff',
};

export enum Shift {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  NIGHT = 'NIGHT',
}

export const SHIFT_NAME: Record<Shift, string> = {
  [Shift.MORNING]: '早班',
  [Shift.AFTERNOON]: '中班',
  [Shift.NIGHT]: '夜班',
};
