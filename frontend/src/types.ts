export type UserRole = 'clerk' | 'qc_supervisor' | 'production_manager';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  username: string;
}

export type SampleStatus =
  | 'draft'
  | 'pending_review'
  | 'evidence_missing'
  | 'qc_approved'
  | 'qc_rejected'
  | 'overdue'
  | 'manager_approved'
  | 'manager_rejected'
  | 'resubmitted'
  | 'appeal_submitted'
  | 'appeal_accepted'
  | 'appeal_rejected'
  | 'completed';

export interface SampleRecord {
  id: string;
  record_no: string;
  batch_no: string;
  product_name: string;
  production_line: string;
  sample_time: string;
  sample_temperature: number;
  storage_location: string;
  operator: string;
  evidence_count: number;
  status: SampleStatus;
  current_handler: string;
  current_role: UserRole;
  version: number;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface SampleEvidence {
  id: string;
  sample_id: string;
  type: string;
  name: string;
  url: string;
  uploaded_at: string;
}

export interface SampleAppeal {
  id: string;
  sample_id: string;
  version: number;
  submitter: string;
  submitter_role: UserRole;
  reason: string;
  status: 'submitted' | 'accepted' | 'rejected' | 'resubmitted';
  review_opinion: string | null;
  reject_reason: string | null;
  previous_status: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface OperationLog {
  id: string;
  sample_id: string;
  operator: string;
  operator_role: UserRole;
  action: string;
  from_status: string | null;
  to_status: string;
  remark: string | null;
  created_at: string;
}

export interface TemperatureRecord {
  id: string;
  sample_id: string;
  measure_time: string;
  temperature: number;
  location: string;
  recorder: string;
  is_abnormal: number;
  remark: string | null;
}

export type SampleStatusKey = 'pending' | 'processing' | 'appeal' | 'completed' | 'rejected';

export const STATUS_LABELS: Record<SampleStatus, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'badge-gray' },
  pending_review: { label: '待品控审核', cls: 'badge-blue' },
  evidence_missing: { label: '待补正证据', cls: 'badge-orange' },
  qc_approved: { label: '品控通过待复核', cls: 'badge-cyan' },
  qc_rejected: { label: '品控驳回', cls: 'badge-red' },
  overdue: { label: '已逾期', cls: 'badge-red' },
  manager_approved: { label: '经理复核通过', cls: 'badge-green' },
  manager_rejected: { label: '经理复核驳回', cls: 'badge-red' },
  resubmitted: { label: '已重新提交', cls: 'badge-blue' },
  appeal_submitted: { label: '申诉待受理', cls: 'badge-purple' },
  appeal_accepted: { label: '申诉受理通过', cls: 'badge-green' },
  appeal_rejected: { label: '申诉被驳回', cls: 'badge-orange' },
  completed: { label: '已完成', cls: 'badge-green' },
};

export const STATUS_GROUP_LABELS: Record<SampleStatusKey, string> = {
  pending: '待处理',
  processing: '处理中',
  appeal: '申诉中',
  completed: '已完成',
  rejected: '已驳回',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  clerk: '排产文员',
  qc_supervisor: '品控主管',
  production_manager: '生产经理',
};
