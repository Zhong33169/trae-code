export interface User {
  id: number;
  username: string;
  role: 'initiator' | 'handler' | 'reviewer' | 'admin';
  real_name: string;
}

export interface CheckinRecord {
  id: number;
  batch_no: string;
  flight_no: string;
  flight_date: string;
  passenger_name: string;
  id_card_no: string;
  seat_no: string;
  boarding_gate: string;
  checkin_time: string | null;
  source: 'offline' | 'online';
  status: 'pending' | 'processing' | 'verified' | 'archived' | 'returned' | 'rejected';
  material_complete: number;
  is_overtime: number;
  is_abnormal: number;
  abnormal_reason: string;
  result: string;
  return_reason: string;
  audit_remark: string;
  initiator_id: number | null;
  handler_id: number | null;
  reviewer_id: number | null;
  initiator_name: string;
  handler_name: string;
  reviewer_name: string;
  initiated_at: string | null;
  handled_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  attachments?: Attachment[];
  audit_logs?: AuditLog[];
}

export interface Attachment {
  id: number;
  checkin_record_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: number;
  uploader_name: string;
  uploaded_at: string;
}

export interface AuditLog {
  id: number;
  checkin_record_id: number;
  user_id: number;
  user_name: string;
  action: string;
  old_status: string;
  new_status: string;
  detail: string;
  failure_reason: string;
  created_at: string;
}

export interface ConsistencyIssue {
  type: string;
  message: string;
}

export interface BatchResultItem {
  id: number;
  success: boolean;
  message: string;
}

export interface BatchHandleResponse {
  results: BatchResultItem[];
  total: number;
  success: number;
  failed: number;
}

export const STATUS_LABELS: Record<string, string> = {
  pending: '待发起',
  processing: '办理中',
  verified: '已核验',
  archived: '已归档',
  returned: '已退回',
  rejected: '已驳回',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: '#909399',
  processing: '#409eff',
  verified: '#e6a23c',
  archived: '#67c23a',
  returned: '#f56c6c',
  rejected: '#f56c6c',
};

export const ROLE_LABELS: Record<string, string> = {
  initiator: '发起岗',
  handler: '办理岗',
  reviewer: '复核岗',
  admin: '管理员',
};

export const SOURCE_LABELS: Record<string, string> = {
  offline: '线下',
  online: '线上',
};
