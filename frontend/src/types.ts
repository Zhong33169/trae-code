export type Role = 'registrar' | 'reviewer' | 'archivist'
export type AppointmentStatus = 'pending_review' | 'pending_archive' | 'rejected_for_correction' | 'rejected_for_review' | 'archived'
export type EvidenceType = 'reservation' | 'check_in' | 'data_recovery'
export type ErrorCode = 'ROLE_MISMATCH' | 'VERSION_CONFLICT' | 'MISSING_EVIDENCE' | 'WRONG_STATUS' | 'DUPLICATE' | 'NOT_FOUND'

export interface User {
  username: string
  role: Role
  display_name: string
}

export interface Appointment {
  id: string
  visitor_name: string
  visitor_phone: string
  visitor_id_number: string
  exhibition_name: string
  status: AppointmentStatus
  current_handler_role: Role
  version: number
  created_at: string
  updated_at: string
}

export interface AppointmentDetail extends Appointment {
  evidence: {
    reservation: Evidence[]
    check_in: Evidence[]
    data_recovery: Evidence[]
  }
  version_history: VersionRecord[]
  operation_logs: OperationLog[]
  batch_records: AppointmentBatchItem[]
}

export interface Evidence {
  id: string
  appointment_id: string
  type: EvidenceType
  content: string
  created_at: string
  created_by: string
}

export interface VersionRecord {
  version: number
  action: string
  operator: string
  operator_role: string
  timestamp: string
  changes: string
}

export interface OperationLog {
  id: string
  appointment_id: string
  action: string
  operator: string
  operator_role: string
  detail: string
  batch_id?: string
  timestamp: string
}

export interface AppointmentBatchItem {
  batch_id: string
  action_type: string
  action: string
  success: boolean
  error_code?: string
  error_message?: string
  created_at: string
}

export interface ApiError {
  code: ErrorCode
  message: string
}

export interface BatchResult {
  id: string
  success: boolean
  error?: string
  error_code?: string
}

export interface BatchResultWithId {
  batch_id: string
  results: BatchResult[]
}

export interface BatchSummary {
  id: string
  action_type: 'batch_review' | 'batch_archive'
  action: string
  operator: string
  operator_role: Role
  comment?: string
  total_count: number
  success_count: number
  fail_count: number
  created_at: string
}

export interface BatchDetailItem {
  id: string
  appointment_id: string
  success: boolean
  error_code?: string
  error_message?: string
}

export interface BatchDetail {
  id: string
  action_type: 'batch_review' | 'batch_archive'
  action: string
  operator: string
  operator_role: Role
  comment?: string
  total_count: number
  success_count: number
  fail_count: number
  created_at: string
  items: BatchDetailItem[]
}

export interface FilterState {
  status: AppointmentStatus | ''
  keyword: string
}
