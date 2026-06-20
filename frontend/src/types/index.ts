export type UserRole = "inspector" | "handler" | "reviewer";

export type InspectionStatus =
  | "DRAFT"
  | "PENDING_HANDLING"
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "RETURNED"
  | "ARCHIVED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type InspectionResult =
  | "NORMAL"
  | "ABNORMAL"
  | "MISSING_EVIDENCE"
  | "OVERDUE"
  | "STATUS_CONFLICT";

export type OperationType =
  | "INITIATE"
  | "HANDLE"
  | "REVIEW"
  | "RETURN"
  | "RISK_CHANGE"
  | "FAULT_REPORT"
  | "RECOVERY_CONFIRM"
  | "VALIDATION_FAILED";

export interface User {
  id: number;
  username: string;
  real_name: string;
  role: UserRole;
}

export interface Equipment {
  id: number;
  code: string;
  name: string;
  model: string;
  location: string;
  last_inspection_date: string | null;
}

export interface InspectionEvidence {
  id: number;
  type: string;
  description: string;
  file_url: string | null;
  uploaded_at: string;
}

export interface OperationRecord {
  id: number;
  operator_name: string;
  operator_role: UserRole;
  operation_type: OperationType;
  from_status: InspectionStatus | null;
  to_status: InspectionStatus | null;
  opinion: string | null;
  created_at: string;
  details: string | null;
}

export interface RiskLevelChange {
  id: number;
  from_level: RiskLevel;
  to_level: RiskLevel;
  reason: string;
  changed_by_name: string;
  created_at: string;
}

export interface FaultReport {
  id: number;
  description: string;
  reported_by_name: string;
  created_at: string;
}

export interface RecoveryConfirm {
  id: number;
  description: string;
  confirmed_by_name: string;
  created_at: string;
}

export interface InspectionOrderListItem {
  id: number;
  order_no: string;
  equipment_code: string;
  equipment_name: string;
  equipment_location: string;
  initiator_name: string;
  current_handler_name: string | null;
  status: InspectionStatus;
  risk_level: RiskLevel;
  inspection_result: InspectionResult | null;
  created_at: string;
  due_date: string;
  is_overdue: boolean;
  has_fault: boolean;
}

export interface InspectionOrderDetail {
  id: number;
  order_no: string;
  equipment: Equipment;
  initiator_name: string;
  current_handler_name: string | null;
  status: InspectionStatus;
  risk_level: RiskLevel;
  inspection_result: InspectionResult | null;
  check_basic_safety: boolean | null;
  check_running_condition: boolean | null;
  check_emergency_stop: boolean | null;
  check_maintenance_record: boolean | null;
  check_environment: boolean | null;
  check_result: string | null;
  handler_opinion: string | null;
  reviewer_opinion: string | null;
  created_at: string;
  submitted_at: string | null;
  due_date: string;
  version: number;
  is_overdue: boolean;
  evidences: InspectionEvidence[];
  operation_records: OperationRecord[];
  risk_level_changes: RiskLevelChange[];
  fault_reports: FaultReport[];
  recovery_confirms: RecoveryConfirm[];
  last_opinion: string | null;
  last_result: InspectionResult | null;
}

export interface StatisticsResponse {
  total: number;
  draft: number;
  pending_handling: number;
  in_progress: number;
  pending_review: number;
  returned: number;
  archived: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  normal: number;
  abnormal: number;
  missing_evidence: number;
  overdue: number;
  status_conflict: number;
  by_location: Record<string, number>;
}

export interface QueueItem {
  id: number;
  order_no: string;
  equipment_name: string;
  equipment_location: string;
  status: InspectionStatus;
  risk_level: RiskLevel;
  created_at: string;
  updated_at: string;
  action_required: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface InspectionOrderHandleRequest {
  handler_id: number;
  handler_role: UserRole;
  version: number;
  check_basic_safety: boolean;
  check_running_condition: boolean;
  check_emergency_stop: boolean;
  check_maintenance_record: boolean;
  check_environment: boolean;
  inspection_result: InspectionResult;
  handler_opinion: string;
  evidences: Array<{ type: string; description: string }>;
}

export interface InspectionOrderReviewRequest {
  reviewer_id: number;
  reviewer_role: UserRole;
  version: number;
  inspection_result: InspectionResult;
  reviewer_opinion: string;
}

export interface InspectionOrderReturnRequest {
  reviewer_id: number;
  reviewer_role: UserRole;
  version: number;
  return_reason: string;
}

export interface RiskLevelChangeRequest {
  operator_id: number;
  operator_role: UserRole;
  version: number;
  new_risk_level: RiskLevel;
  reason: string;
}

export interface FaultReportRequest {
  inspection_order_id: number;
  reporter_id: number;
  reporter_role: UserRole;
  description: string;
  is_high_risk: boolean;
}

export interface RecoveryConfirmRequest {
  inspection_order_id: number;
  confirmer_id: number;
  confirmer_role: UserRole;
  description: string;
}
