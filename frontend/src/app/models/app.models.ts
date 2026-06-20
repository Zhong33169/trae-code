export interface User {
  id: number;
  username: string;
  real_name: string;
  role: 'registrar' | 'auditor' | 'reviewer';
}

export interface OrderSummary {
  id: number;
  order_no: string;
  applicant: string;
  department: string;
  equipment_name: string;
  equipment_model: string | null;
  quantity: number;
  borrow_reason: string;
  expected_return_date: string;
  actual_return_date: string | null;
  status: string;
  version: number;
  created_by: number;
  created_by_name: string;
  auditor_id: number | null;
  auditor_name: string | null;
  reviewer_id: number | null;
  reviewer_name: string | null;
  audit_comment: string | null;
  review_comment: string | null;
  last_failure_reason: string | null;
  loss_remark: string | null;
  created_at: string;
  updated_at: string;
  borrow_evidence_count: number;
  return_evidence_count: number;
  loss_evidence_count: number;
  selected?: boolean;
}

export interface Evidence {
  id: number;
  order_id: number;
  type: 'borrow' | 'return' | 'loss';
  description: string;
  file_name: string | null;
  uploaded_by: number;
  uploader_name: string;
  created_at: string;
}

export interface OperationLog {
  id: number;
  order_id: number;
  user_id: number;
  user_name: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  comment: string | null;
  created_at: string;
}

export interface OrderDetail {
  order: OrderSummary;
  evidences: Evidence[];
  logs: OperationLog[];
}

export interface QueueStats {
  pending_audit: number;
  pending_review: number;
  audit_rejected: number;
  review_rejected: number;
  archived: number;
  draft: number;
}

export interface BatchResultItem {
  orderId: number;
  status: 'success' | 'failed' | 'retry';
  message: string;
  failureReason: string | null;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  failureReason?: string;
}
