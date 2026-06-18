export type Role = "registrar" | "supervisor" | "reviewer";
export type Stage = "need" | "quotation" | "contract";
export type Status =
  | "draft"
  | "submitted"
  | "under_review"
  | "returned"
  | "approved"
  | "rejected"
  | "appeal_submitted"
  | "appeal_under_review"
  | "appeal_approved"
  | "appeal_rejected"
  | "overdue"
  | "archived";
export type EvidenceType = "need_document" | "quotation_sheet" | "contract" | "other";
export type ActionType =
  | "create"
  | "submit"
  | "review_approve"
  | "review_reject"
  | "return_for_correction"
  | "correct"
  | "appeal_submit"
  | "appeal_review"
  | "appeal_approve"
  | "appeal_reject"
  | "archive"
  | "mark_overdue"
  | "state_conflict";
export type AppealResult = "pending" | "approved" | "rejected";

export interface User {
  id: number;
  name: string;
  role: Role;
  department?: string;
}

export interface Evidence {
  id: number;
  project_id: number;
  name: string;
  evidence_type: EvidenceType;
  file_path?: string;
  description?: string;
  uploaded_by_id: number;
  uploaded_at: string;
}

export interface AppealRecord {
  id: number;
  project_id: number;
  version: number;
  submitter_id: number;
  submitter_name: string;
  appeal_reason: string;
  submitter_opinion?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  reviewer_opinion?: string;
  result: AppealResult;
  created_at: string;
  reviewed_at?: string;
}

export interface OperationLog {
  id: number;
  project_id: number;
  user_id: number;
  user_role: Role;
  user_name: string;
  action: ActionType;
  from_status?: Status;
  to_status?: Status;
  stage?: Stage;
  version?: number;
  comment?: string;
  opinion?: string;
  reject_reason?: string;
  created_at: string;
}

export interface TrainingProject {
  id: number;
  project_no: string;
  project_name: string;
  client_company: string;
  stage: Stage;
  status: Status;
  version: number;
  created_by_id: number;
  current_handler_id?: number;
  description?: string;
  budget?: number;
  deadline?: string;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
  created_by?: User;
  current_handler?: User;
  evidences: Evidence[];
  operation_logs: OperationLog[];
  appeals: AppealRecord[];
}

export interface TrainingProjectListItem {
  id: number;
  project_no: string;
  project_name: string;
  client_company: string;
  stage: Stage;
  status: Status;
  version: number;
  current_handler_name?: string;
  current_handler_role?: Role;
  created_at: string;
  updated_at: string;
  is_overdue: boolean;
}

export interface Statistics {
  total: number;
  draft: number;
  submitted: number;
  under_review: number;
  returned: number;
  approved: number;
  rejected: number;
  appeal_submitted: number;
  appeal_under_review: number;
  appeal_approved: number;
  appeal_rejected: number;
  overdue: number;
  archived: number;
  by_stage_need: number;
  by_stage_quotation: number;
  by_stage_contract: number;
}

export interface LabelMap {
  roles: Record<string, string>;
  stages: Record<string, string>;
  statuses: Record<string, string>;
  evidence_types: Record<string, string>;
}

export interface SubmitData {
  current_user_id: number;
  comment?: string;
}

export interface ReviewData {
  current_user_id: number;
  opinion?: string;
  reject_reason?: string;
  next_stage?: Stage;
}

export interface ReturnForCorrectionData {
  current_user_id: number;
  reject_reason: string;
  opinion?: string;
}

export interface CorrectData {
  current_user_id: number;
  comment?: string;
}

export interface AppealSubmitData {
  current_user_id: number;
  appeal_reason: string;
  submitter_opinion?: string;
}

export interface AppealReviewData {
  current_user_id: number;
  reviewer_opinion: string;
  result: AppealResult;
}

export interface ProjectCreate {
  project_name: string;
  client_company: string;
  stage?: Stage;
  description?: string;
  budget?: number;
  deadline?: string;
  created_by_id: number;
}

export interface EvidenceCreate {
  name: string;
  evidence_type: EvidenceType;
  file_path?: string;
  description?: string;
  uploaded_by_id: number;
}
