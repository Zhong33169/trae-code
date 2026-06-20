export const ROLES = {
  REGISTRAR: 'REGISTRAR',
  REVIEWER: 'REVIEWER',
  APPROVER: 'APPROVER'
} as const

export type RoleType = typeof ROLES[keyof typeof ROLES]

export const STATUS = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  PENDING_CORRECTION: 'PENDING_CORRECTION',
  REVIEWED: 'REVIEWED',
  APPROVED: 'APPROVED',
  ARCHIVED: 'ARCHIVED',
  REJECTED: 'REJECTED'
} as const

export type StatusType = typeof STATUS[keyof typeof STATUS]

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING_REVIEW: '待审核',
  PENDING_CORRECTION: '待补正',
  REVIEWED: '审核通过',
  APPROVED: '复核通过',
  ARCHIVED: '已归档',
  REJECTED: '已退回'
}

export const ROLE_LABELS: Record<string, string> = {
  REGISTRAR: '政策兑现登记员',
  REVIEWER: '政策兑现审核主管',
  APPROVER: '园区招商中心复核负责人'
}

export const ABNORMAL_TYPES = {
  MISSING_ATTACHMENT: 'MISSING_ATTACHMENT',
  TIMEOUT: 'TIMEOUT',
  REJECTED: 'REJECTED'
} as const

export const ABNORMAL_LABELS: Record<string, string> = {
  MISSING_ATTACHMENT: '缺材料',
  TIMEOUT: '超时',
  REJECTED: '已退回'
}

export const ATTACHMENT_STATUS = {
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED'
} as const

export const ATTACHMENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: '有效',
  REJECTED: '已驳回',
  SUPERSEDED: '已作废（已替换）'
}
