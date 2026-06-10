export type UserRole = 'registrar' | 'reviewer' | 'final_reviewer';

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: UserRole;
  created_at: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export type ApplicationStatus = 'draft' | 'pending_review' | 'reviewed' | 'needs_correction' | 'archived';

export interface ReplenishmentItem {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface ReplenishmentApplication {
  id: number;
  application_no: string;
  store_id: number;
  store_no: string;
  store_name: string;
  status: ApplicationStatus;
  current_version: number;
  items: ReplenishmentItem[];
  evidence_store_replenishment: string | null;
  evidence_delivery_confirmation: string | null;
  evidence_registration: string | null;
  remarks: string | null;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_by: number | null;
  updated_by_name: string | null;
  updated_at: string;
}

export type ActionType = 'create' | 'submit' | 'review_approve' | 'review_reject' | 'correct' | 'final_approve' | 'final_reject';

export interface ApplicationVersion {
  id: number;
  application_id: number;
  version: number;
  status_from: string | null;
  status_to: string;
  items: ReplenishmentItem[] | null;
  evidence_store_replenishment: string | null;
  evidence_delivery_confirmation: string | null;
  evidence_registration: string | null;
  remarks: string | null;
  action: ActionType;
  performed_by: number;
  performed_by_name: string;
  performed_at: string;
}

export interface Store {
  id: number;
  store_no: string;
  store_name: string;
  address: string;
}

export interface BatchResultItem {
  application_id: number;
  application_no: string;
  success: boolean;
  status: string;
  message: string;
  attempted_version: number;
  new_version: number | null;
  performer_role: string | null;
  performer_name: string | null;
  status_from: string | null;
  status_to: string | null;
  remarks: string | null;
  evidence_store_replenishment: string | null;
  evidence_delivery_confirmation: string | null;
  evidence_registration: string | null;
  items_count: number | null;
}

export interface BatchReviewResponse {
  results: BatchResultItem[];
  success_count: number;
  failed_count: number;
}

export interface ApiError {
  error: string;
  details?: string;
}

export const statusDisplayMap: Record<ApplicationStatus, string> = {
  draft: '草稿',
  pending_review: '待审核',
  reviewed: '审核通过',
  needs_correction: '需补正',
  archived: '已归档',
};

export const roleDisplayMap: Record<UserRole, string> = {
  registrar: '补货登记员',
  reviewer: '补货审核主管',
  final_reviewer: '连锁复核负责人',
};

export const actionDisplayMap: Record<ActionType, string> = {
  create: '创建申请',
  submit: '提交审核',
  review_approve: '审核通过',
  review_reject: '审核驳回',
  correct: '补正提交',
  final_approve: '复核归档',
  final_reject: '复核驳回',
};

export const statusColorMap: Record<ApplicationStatus, string> = {
  draft: '#6b7280',
  pending_review: '#f59e0b',
  reviewed: '#3b82f6',
  needs_correction: '#ef4444',
  archived: '#10b981',
};
