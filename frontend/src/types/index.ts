export type UserRole = "registrar" | "supervisor" | "reviewer";

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  password_hash?: string;
  created_at?: string;
}

export type TaskStatus =
  | "draft"
  | "pending_review"
  | "review_passed"
  | "review_rejected"
  | "review_approved"
  | "review_returned";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  draft: "草稿",
  pending_review: "待审核",
  review_passed: "审核通过待复核",
  review_rejected: "审核驳回",
  review_approved: "已归档",
  review_returned: "复核退回",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  registrar: "采样登记员",
  supervisor: "采样审核主管",
  reviewer: "复核负责人",
};

export type EvidenceType = "registration" | "process" | "review";

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  registration: "登记证据",
  process: "过程核验证据",
  review: "复核归档证据",
};

export interface Evidence {
  id: number;
  task_id: number;
  type: EvidenceType;
  title: string;
  description: string;
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface TaskLog {
  id: number;
  task_id: number;
  action: string;
  operator_id: number;
  operator_name: string;
  operator_role: UserRole;
  remark: string;
  created_at: string;
}

export interface SamplingTask {
  id: number;
  task_no: string;
  project_name: string;
  sample_location: string;
  sample_type: string;
  status: TaskStatus;
  version: number;
  created_at: string;
  updated_at: string;
  registrar_id: number;
  registrar_name: string;
  supervisor_id?: number | null;
  supervisor_name?: string;
  reviewer_id?: number | null;
  reviewer_name?: string;
  reject_reason?: string;
  return_reason?: string;
  evidences?: Evidence[];
  logs?: TaskLog[];
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  size: number;
}

export interface BatchResultItem {
  task_id: number;
  task_no: string;
  status: string;
  success: boolean;
  message: string;
  need_retry: boolean;
}

export interface BatchResult {
  success_count: number;
  fail_count: number;
  results: BatchResultItem[];
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface BatchReviewItem {
  id: number;
  version: number;
  pass: boolean;
  reason?: string;
}

export interface BatchSubmitItem {
  id: number;
  version: number;
}
