export interface User {
  id: number;
  username: string;
  role: string;
  name: string;
  created_at?: string;
}

export interface BorrowRecord {
  id: number;
  record_no: string;
  borrower_name: string;
  borrower_id?: string;
  book_title: string;
  book_isbn?: string;
  borrow_date: string;
  due_date: string;
  return_date?: string;
  status: string;
  exception_type?: string;
  version: number;
  current_handler_id?: number;
  current_handler_role?: string;
  current_handler_name?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProcessRecord {
  id: number;
  borrow_record_id: number;
  handler_id: number;
  handler_name: string;
  handler_role: string;
  action: string;
  from_status: string;
  to_status: string;
  opinion?: string;
  reject_reason?: string;
  version_before: number;
  version_after: number;
  created_at?: string;
}

export interface EvidenceItem {
  id: number;
  borrow_record_id: number;
  name: string;
  description?: string;
  evidence_type: string;
  is_required: boolean;
  file_path?: string;
  uploaded_by?: number;
  uploaded_at?: string;
}

export interface StatsResponse {
  total: number;
  draft: number;
  pending_audit: number;
  pending_review: number;
  returned_correction: number;
  archived: number;
  missing_evidence: number;
  overdue: number;
  conflict: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export const STATUS_MAP: Record<string, string> = {
  draft: '草稿',
  pending_audit: '待审核',
  pending_review: '待复核',
  returned_correction: '退回补正',
  archived: '已归档',
};

export const EXCEPTION_MAP: Record<string, string> = {
  missing_evidence: '缺证据',
  overdue: '逾期',
  conflict: '状态冲突',
};

export const ROLE_MAP: Record<string, string> = {
  registrar: '借阅登记员',
  supervisor: '借阅审核主管',
  director: '图书馆复核负责人',
};

export const ACTION_MAP: Record<string, string> = {
  submit: '提交审核',
  audit_pass: '审核通过',
  audit_reject: '审核驳回',
  review_pass: '复核通过',
  review_reject: '复核驳回',
  correct: '补正',
  validation_failed: '校验失败',
};

export const ACTION_COLORS: Record<string, string> = {
  submit: 'bg-blue-100 text-blue-700',
  audit_pass: 'bg-green-100 text-green-700',
  audit_reject: 'bg-red-100 text-red-700',
  review_pass: 'bg-green-100 text-green-700',
  review_reject: 'bg-red-100 text-red-700',
  correct: 'bg-amber-100 text-amber-700',
  validation_failed: 'bg-red-100 text-red-700',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_audit: 'bg-yellow-100 text-yellow-800',
  pending_review: 'bg-blue-100 text-blue-800',
  returned_correction: 'bg-red-100 text-red-800',
  archived: 'bg-green-100 text-green-800',
};

export const EXCEPTION_COLORS: Record<string, string> = {
  missing_evidence: 'bg-orange-100 text-orange-800',
  overdue: 'bg-red-100 text-red-800',
  conflict: 'bg-purple-100 text-purple-800',
};
