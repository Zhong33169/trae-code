export type RiskLevel = 'low' | 'medium' | 'high';
export type ApplicationStatus = '待签收' | '异常回传' | '签收完成';
export type ApplicationStage = '开户预约' | '资料审核' | '账户启用';
export type UserRole = '客户经理' | '运营主管' | '支行行长';

export interface UserInfo {
  id: number;
  username: string;
  name: string;
  role: UserRole;
}

export interface EvidenceItem {
  id: number;
  application_id: number;
  evidence_type: string;
  evidence_name: string;
  is_provided: number;
  is_required: number;
  verified_at?: string;
  verified_by?: number;
  created_at: string;
}

export interface AccountApplication {
  id: number;
  application_no: string;
  applicant_name: string;
  applicant_id_card: string;
  applicant_phone?: string;
  account_type: string;
  risk_level: RiskLevel;
  risk_reason?: string;
  stage: ApplicationStage;
  status: ApplicationStatus;
  current_handler_id?: number;
  current_handler_name?: string;
  current_handler_role?: UserRole;
  version: number;
  deadline?: string;
  is_overdue: number;
  is_evidence_missing: number;
  is_returned: number;
  returned_reason?: string;
  created_at: string;
  updated_at: string;
  evidences?: EvidenceItem[];
}

export interface OperationRecord {
  id: number;
  application_id: number;
  operator_id: number;
  operator_role: UserRole;
  operator_name?: string;
  operation_type: string;
  is_success: number;
  from_stage?: ApplicationStage;
  to_stage?: ApplicationStage;
  from_status?: ApplicationStatus;
  to_status?: ApplicationStatus;
  from_risk_level?: RiskLevel;
  to_risk_level?: RiskLevel;
  remark?: string;
  evidence_checked?: string;
  version_before?: number;
  version_after?: number;
  created_at: string;
}

export interface RiskLevelLog {
  id: number;
  application_id: number;
  operator_id: number;
  operator_role: UserRole;
  operator_name?: string;
  from_level: RiskLevel;
  to_level: RiskLevel;
  change_reason: string;
  created_at: string;
}

export interface Statistics {
  total_count: number;
  pending_count: number;
  abnormal_count: number;
  done_count: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  overdue_count: number;
  stage_booking_count: number;
  stage_review_count: number;
  stage_enable_count: number;
}

export interface OperationSubmitRequest {
  operator_id: number;
  operator_role: UserRole;
  application_id: number;
  current_version: number;
  action: 'advance_stage' | 'sign_complete' | 'sign_receive' | 'return_back' | 'mark_abnormal';
  remark?: string;
  new_risk_level?: RiskLevel;
  risk_change_reason?: string;
  evidence_ids_verified?: number[];
  returned_reason?: string;
}

export interface ApiResponse<T = any> {
  code: number;
  message?: string;
  data?: T;
}
