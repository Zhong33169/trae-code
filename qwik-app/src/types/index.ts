export type Role = 'registrar' | 'audit_supervisor' | 'review_leader';

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'correction_requested'
  | 'corrected'
  | 'audit_passed'
  | 'rejected'
  | 'review_passed'
  | 'archived';

export type MaterialType =
  | 'business_license'
  | 'tax_certificate'
  | 'product_catalog'
  | 'booth_design'
  | 'other';

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  is_active: boolean;
}

export interface Material {
  id: number;
  material_type: MaterialType;
  material_name: string;
  file_path?: string;
  is_approved?: boolean | null;
  review_comment?: string;
  uploaded_at: string;
}

export interface AuditLog {
  id: number;
  application_id: number;
  operator_id: number;
  operator_name: string;
  action: string;
  action_name: string;
  from_status?: ApplicationStatus;
  to_status?: ApplicationStatus;
  remark?: string;
  created_at: string;
}

export interface Application {
  id: number;
  application_no: string;
  company_name: string;
  contact_person: string;
  contact_phone: string;
  contact_email?: string;
  booth_type?: string;
  booth_size?: string;
  expected_area?: number;
  industry?: string;
  product_description?: string;
  status: ApplicationStatus;
  is_overdue: boolean;
  overdue_reason?: string;
  status_changed_at: string;
  deadline_at?: string;
  audit_opinion?: string;
  review_opinion?: string;
  correction_request?: string;
  created_at: string;
  updated_at: string;
  version: number;
  materials: Material[];
  audit_logs?: AuditLog[];
}

export interface ApplicationListResponse {
  items: Application[];
  total: number;
  page: number;
  page_size: number;
}

export interface Statistics {
  total: number;
  draft: number;
  submitted: number;
  corrected: number;
  audit_passed: number;
  review_passed: number;
  pending_audit: number;
  under_review: number;
  pending_correction: number;
  pending_review: number;
  passed: number;
  rejected: number;
  archived: number;
  overdue: number;
  correction_overdue: number;
  review_overdue: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface BatchActionResult {
  success: number[];
  failed: Array<{ id: number; code?: string; reason: string; data?: any }>;
}
