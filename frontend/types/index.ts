export interface User {
  id: number
  username: string
  name: string
  role: 'registrar' | 'supervisor' | 'reviewer'
  created_at: string
}

export type OrderStatus =
  | 'draft'
  | 'pending_review'
  | 'materials_missing'
  | 'resubmitted'
  | 'approved_review'
  | 'rejected'
  | 'reviewed'
  | 'archived'

export type AttachmentType = 'id_card' | 'photo' | 'health_cert' | 'contract' | 'other'

export interface RequiredAttachment {
  id: number
  order_id: number
  attachment_type: AttachmentType
  attachment_name: string
  is_provided: boolean
  missing_reason: string | null
  reject_reason: string | null
  created_at: string
  updated_at: string
}

export interface Attachment {
  id: number
  order_id: number
  required_attachment_id: number | null
  file_name: string
  file_type: AttachmentType
  file_size: number | null
  uploaded_by: number | null
  uploaded_at: string
}

export interface AuditLog {
  id: number
  order_id: number
  operator_id: number
  action: string
  from_status: OrderStatus | null
  to_status: OrderStatus | null
  remark: string | null
  failure_reason: string | null
  created_at: string
  operator_name: string | null
  operator_role: string | null
}

export interface MembershipOrder {
  id: number
  order_no: string
  member_name: string
  member_phone: string | null
  member_id_no: string | null
  membership_type: string
  membership_duration: number
  amount: number
  contract_confirmed: boolean
  card_activated: boolean
  status: OrderStatus
  is_overdue: boolean
  reject_reason: string | null
  created_by: number | null
  created_at: string
  updated_at: string
  attachments: Attachment[]
  required_attachments: RequiredAttachment[]
  audit_logs: AuditLog[]
}

export interface OrderListResponse {
  total: number
  items: MembershipOrder[]
  skip: number
  limit: number
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: '草稿',
  pending_review: '待审核',
  materials_missing: '附件缺失待补正',
  resubmitted: '补正后重提',
  approved_review: '审核通过待复核',
  rejected: '已驳回',
  reviewed: '复核通过待归档',
  archived: '已归档'
}

export const ROLE_LABELS: Record<string, string> = {
  registrar: '会员入会登记员',
  supervisor: '会员入会审核主管',
  reviewer: '社区健身房复核负责人'
}

export const ATTACHMENT_LABELS: Record<AttachmentType, string> = {
  id_card: '身份证复印件',
  photo: '一寸免冠照片',
  health_cert: '健康证明',
  contract: '入会合同',
  other: '其他材料'
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: '#9ca3af',
  pending_review: '#f59e0b',
  materials_missing: '#ef4444',
  resubmitted: '#8b5cf6',
  approved_review: '#3b82f6',
  rejected: '#dc2626',
  reviewed: '#10b981',
  archived: '#6b7280'
}
