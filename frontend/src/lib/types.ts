export interface User {
  id: number;
  username: string;
  name: string;
  role: 'admission' | 'academic' | 'admin';
}

export type EnrollmentStatus = 
  | 'draft' 
  | 'pending_verify' 
  | 'pending_correction' 
  | 'pending_review' 
  | 'archived' 
  | 'rejected';

export type AttachmentStatus = 'pending' | 'approved' | 'rejected';

export interface Attachment {
  id: number;
  enrollment_id: number;
  name: string;
  type: string;
  file_key: string;
  status: AttachmentStatus;
  reject_reason: string;
  uploaded_by: number;
  uploaded_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  enrollment_id: number;
  user_id: number;
  user_name: string;
  user_role: string;
  action: string;
  reason: string;
  from_status: string;
  to_status: string;
  created_at: string;
}

export interface Enrollment {
  id: number;
  student_name: string;
  id_card: string;
  phone: string;
  major: string;
  status: EnrollmentStatus;
  created_by: number;
  created_by_name: string;
  deadline: string | null;
  is_overdue: boolean;
  reject_reason: string;
  admin_remark: string;
  audit_remark: string;
  attachments?: Attachment[];
  audit_logs?: AuditLog[];
  created_at: string;
  updated_at: string;
}

export interface Stats {
  total: number;
  pending_verify: number;
  pending_correction: number;
  pending_review: number;
  archived: number;
  rejected: number;
}

export interface BatchResult {
  id: number;
  success: boolean;
  message: string;
}

export const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  draft: '草稿',
  pending_verify: '待核验',
  pending_correction: '待补正',
  pending_review: '待复核',
  archived: '已归档',
  rejected: '已退回',
};

export const STATUS_COLORS: Record<EnrollmentStatus, string> = {
  draft: '#9ca3af',
  pending_verify: '#f59e0b',
  pending_correction: '#ef4444',
  pending_review: '#3b82f6',
  archived: '#10b981',
  rejected: '#6b7280',
};

export const ROLE_LABELS: Record<string, string> = {
  admission: '招生顾问',
  academic: '教务主管',
  admin: '校务负责人',
};
