export interface NursingPlan {
  id: string
  plan_no: string
  elder_name: string
  elder_gender: string
  elder_age: number
  room_no: string
  bed_no: string
  admission_date: string | null
  
  assessment_status: string
  assessment_content: string | null
  assessment_by: string | null
  assessment_at: string | null
  
  plan_content: string | null
  plan_level: string | null
  
  family_confirm_status: string
  family_confirm_by: string | null
  family_confirm_at: string | null
  family_confirm_remark: string | null
  
  status: string
  current_step: string
  return_reason: string | null
  
  created_by: string
  created_at: string
  updated_at: string
}

export interface CreatePlanRequest {
  elder_name: string
  elder_gender: string
  elder_age: number
  room_no: string
  bed_no: string
  admission_date?: string | null
  plan_content?: string | null
  plan_level?: string | null
}

export interface UpdatePlanRequest {
  elder_name?: string
  elder_gender?: string
  elder_age?: number
  room_no?: string
  bed_no?: string
  admission_date?: string | null
  plan_content?: string | null
  plan_level?: string | null
}

export interface HandoverInfo {
  shift: string
  handover_by: string
  takeover_by: string
  confirm_time: string
  handover_content?: string | null
}

export interface StatusTransitionRequest {
  action: string
  reason?: string | null
  handover?: HandoverInfo | null
}

export interface OperationLog {
  id: string
  plan_id: string
  operator_id: string
  operator_name: string
  action: string
  from_status: string | null
  to_status: string | null
  reason: string | null
  created_at: string
}

export interface HandoverRecord {
  id: string
  plan_id: string
  shift: string
  handover_by: string
  takeover_by: string
  confirm_time: string
  handover_content: string | null
  created_at: string
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface PlanListResponse {
  total: number
  items: NursingPlan[]
}

export interface StatisticsResponse {
  total_plans: number
  draft: number
  pending_audit: number
  audited: number
  pending_review: number
  archived: number
  returned: number
  by_shift: { shift: string; count: number }[]
  by_level: { level: string; count: number }[]
}

export const STATUS_MAP: Record<string, string> = {
  draft: '草稿',
  pending_audit: '待审核',
  pending_review: '待复核',
  archived: '已归档',
  returned: '已退回'
}

export const ASSESSMENT_STATUS_MAP: Record<string, string> = {
  pending: '待评估',
  completed: '已完成',
  cancelled: '已取消'
}

export const FAMILY_CONFIRM_STATUS_MAP: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已拒绝'
}

export const ROLE_MAP: Record<string, string> = {
  registrar: '护理计划登记员',
  auditor: '护理计划审核主管',
  reviewer: '养老护理院复核负责人'
}

export const SHIFT_OPTIONS = ['早班', '中班', '晚班', '夜班']

export interface BatchOperation {
  id: string
  batch_no: string
  action: string
  operator_id: string
  operator_name: string
  total_count: number
  success_count: number
  fail_count: number
  reason: string | null
  created_at: string
}

export interface BatchItem {
  id: string
  batch_id: string
  plan_id: string
  plan_no: string
  elder_name: string
  success: boolean
  error_message: string | null
  from_status: string | null
  to_status: string | null
  created_at: string
}

export interface BatchTransitionRequest {
  plan_ids: string[]
  action: string
  reason?: string | null
  handover?: HandoverInfo | null
}

export interface BatchTransitionResponse {
  batch: BatchOperation
  items: BatchItem[]
}

export const BATCH_ACTION_MAP: Record<string, string> = {
  submit: '批量提交',
  resubmit: '批量重新提交',
  approve: '批量审核通过',
  reject: '批量退回',
  archive: '批量复核归档'
}
