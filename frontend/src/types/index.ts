// ============================================================
// Equipment Inspection Frontend Type Definitions
// Fully aligned with backend: backend/app/schemas.py & models.py
// ============================================================

// Enum definitions matching backend Python Enums (value = snake_case strings)
export type UserRole = "inspector" | "handler" | "reviewer";

export type InspectionStatus =
  | "draft"
  | "pending_handling"
  | "in_progress"
  | "pending_review"
  | "returned"
  | "archived";

export type RiskLevel = "low" | "medium" | "high";

export type InspectionResult =
  | "normal"
  | "abnormal"
  | "missing_evidence"
  | "overdue"
  | "returned"
  | "status_conflict";

export type OperationType =
  | "initiate"
  | "assign"
  | "handle"
  | "submit"
  | "review"
  | "return"
  | "archive"
  | "risk_upgrade"
  | "risk_downgrade"
  | "report_fault"
  | "confirm_recovery";

// ========= User =========
export interface User {
  id: number;
  username: string;
  name: string;
  real_name: string; // alias for convenience (same as name)
  role: UserRole;
  created_at: string;
}

// ========= Equipment =========
export interface Equipment {
  id: number;
  code: string;
  name: string;
  location: string;
  model: string; // alias of specification
  specification: string;
  last_inspection_date: string | null;
}

// ========= Operation Record =========
export interface OperationRecord {
  id: number;
  inspection_order_id: number;
  operator_id: number;
  operator_name: string | null;
  operation_type: OperationType;
  from_status: InspectionStatus | null;
  to_status: InspectionStatus | null;
  from_risk_level: RiskLevel | null;
  to_risk_level: RiskLevel | null;
  opinion: string | null;
  result: string | null;
  remark: string | null;
  version: number | null;
  operated_at: string;
}

// ========= Risk Level Change =========
export interface RiskLevelChange {
  id: number;
  inspection_order_id: number;
  operator_id: number;
  operator_name: string | null;
  from_level: RiskLevel;
  to_level: RiskLevel;
  reason: string;
  changed_at: string;
}

// ========= Fault Report =========
export interface FaultReport {
  id: number;
  inspection_order_id: number;
  fault_description: string;
  fault_level: RiskLevel;
  reported_by: number;
  reported_by_name: string | null;
  reported_at: string;
  is_resolved: boolean;
  resolved_by: number | null;
  resolved_at: string | null;
  resolution: string | null;
}

// ========= Recovery Confirm =========
export interface RecoveryConfirm {
  id: number;
  fault_report_id: number;
  inspection_order_id: number | null;
  confirmation_remark: string;
  is_successful: boolean;
  evidence_path: string | null;
  confirmed_by: number;
  confirmed_by_name: string | null;
  confirmed_at: string;
}

// ========= Inspection Order List Item =========
export interface InspectionOrderListItem {
  id: number;
  order_no: string;
  equipment_id: number;
  equipment_name: string;
  equipment_code: string;
  equipment_location: string;
  initiator_id: number;
  initiator_name: string;
  current_handler_id: number | null;
  current_handler_name: string | null;
  status: InspectionStatus;
  risk_level: RiskLevel;
  inspection_result: InspectionResult | null;
  inspection_date: string;
  due_date: string | null;
  last_handler_opinion: string | null;
  last_handler_result: string | null;
  handler_opinion: string | null;
  handler_result: string | null;
  reviewer_opinion: string | null;
  reviewer_result: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  is_overdue: boolean;
  has_fault: boolean;
}

// ========= Inspection Order Detail =========
export interface InspectionOrderDetail extends InspectionOrderListItem {
  // Per-check-item fields (4 check items)
  appearance_check: boolean | null;
  appearance_evidence: string | null;
  appearance_remark: string | null;

  function_check: boolean | null;
  function_evidence: string | null;
  function_remark: string | null;

  safety_check: boolean | null;
  safety_evidence: string | null;
  safety_remark: string | null;

  maintenance_check: boolean | null;
  maintenance_evidence: string | null;
  maintenance_remark: string | null;

  // Collections
  operation_records: OperationRecord[];
  risk_changes: RiskLevelChange[];
  fault_reports: FaultReport[];
  recovery_confirms: RecoveryConfirm[];
}

// ========= Statistics =========
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

// ========= Queue Item =========
export interface QueueItem {
  id: number;
  order_no: string;
  equipment_name: string;
  equipment_location: string;
  status: InspectionStatus;
  risk_level: RiskLevel;
  current_handler_name: string | null;
  updated_at: string;
  action_required: string;
}

// ========= Generic API Response =========
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

// ========= Request Bodies =========

// Handle (办理)
export interface InspectionOrderHandleRequest {
  version: number;
  handler_opinion: string;
  handler_result: string;
  new_risk_level?: RiskLevel | null;
  risk_change_reason?: string | null;

  appearance_check?: boolean | null;
  appearance_evidence?: string | null;
  appearance_remark?: string | null;

  function_check?: boolean | null;
  function_evidence?: string | null;
  function_remark?: string | null;

  safety_check?: boolean | null;
  safety_evidence?: string | null;
  safety_remark?: string | null;

  maintenance_check?: boolean | null;
  maintenance_evidence?: string | null;
  maintenance_remark?: string | null;
}

// Review (复核)
export interface InspectionOrderReviewRequest {
  version: number;
  reviewer_opinion: string;
  reviewer_result: string;
  is_approved: boolean;
}

// Return (退回补正)
export interface InspectionOrderReturnRequest {
  version: number;
  opinion: string;
}

// Change Risk Level
export interface RiskLevelChangeRequest {
  version: number;
  new_risk_level: RiskLevel;
  reason: string;
}

// Submit Validation
export interface InspectionOrderSubmitValidateRequest {
  current_user_id: number;
  expected_role: UserRole;
  expected_status: InspectionStatus;
  version: number;
  required_evidences?: string[] | null;
}

// Create Fault Report
export interface FaultReportCreateRequest {
  inspection_order_id: number;
  fault_description: string;
  fault_level: RiskLevel;
}

// Recovery Confirm
export interface RecoveryConfirmCreateRequest {
  fault_report_id: number;
  inspection_order_id?: number | null;
  confirmation_remark: string;
  is_successful?: boolean;
  evidence_path?: string | null;
}

// Initiate new inspection order
export interface InspectionOrderInitiateRequest {
  equipment_id: number;
  inspection_date: string;
  due_date?: string | null;
  risk_level?: RiskLevel;
  appearance_check: boolean | null;
  appearance_evidence?: string | null;
  appearance_remark?: string | null;
  function_check: boolean | null;
  function_evidence?: string | null;
  function_remark?: string | null;
  safety_check: boolean | null;
  safety_evidence?: string | null;
  safety_remark?: string | null;
  maintenance_check: boolean | null;
  maintenance_evidence?: string | null;
  maintenance_remark?: string | null;
}
