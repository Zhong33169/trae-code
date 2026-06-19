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

export type SampleStatusKey =
  | 'pending'
  | 'processing'
  | 'appeal'
  | 'completed'
  | 'rejected';

export const STATUS_GROUPS: Record<SampleStatusKey, SampleStatus[]> = {
  pending: ['draft', 'pending_review', 'evidence_missing'],
  processing: ['qc_approved', 'resubmitted'],
  appeal: ['appeal_submitted', 'appeal_accepted', 'appeal_rejected'],
  completed: ['manager_approved', 'completed'],
  rejected: ['qc_rejected', 'manager_rejected', 'overdue'],
};
