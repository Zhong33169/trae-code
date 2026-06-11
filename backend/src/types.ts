export type UserRole = 'receptionist' | 'room_supervisor' | 'duty_manager';

export type OrderStatus = 'pending_supplement' | 'pending_verification' | 'pending_review' | 'archived';

export type EvidenceStage = 'registration' | 'verification' | 'archive';

export type BlockCode =
  | 'wrong_role'
  | 'wrong_status'
  | 'missing_evidence'
  | 'version_conflict'
  | 'duplicate_supplement'
  | 'archived'
  | 'not_found'
  | 'unknown';

export type ActionTarget =
  | 'goto_detail'
  | 'switch_role'
  | 'refresh_version'
  | 'add_evidence'
  | 'continue_verify'
  | 'continue_review'
  | 'continue_supplement'
  | 'no_action';

export type ResolveStatus = 'pending' | 'resolved' | 'ignored';

export interface ActionPayload {
  targetRole?: UserRole;
  orderId?: string;
  scrollTo?: 'evidence' | 'action';
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
}

export interface Order {
  id: string;
  order_no: string;
  guest_name: string;
  guest_phone: string | null;
  room_number: string | null;
  supplement_reason: string | null;
  status: OrderStatus;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  evidenceItems?: EvidenceItem[];
  auditLogs?: AuditLog[];
  blockAttempts?: BlockAttempt[];
}

export interface EvidenceItem {
  id: string;
  order_id: string;
  stage: EvidenceStage;
  type: string;
  description: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  order_id: string;
  action: string;
  operator_id: string;
  operator_role: UserRole;
  detail: string;
  created_at: string;
}

export interface JwtPayload {
  id: string;
  username: string;
  role: UserRole;
}

export interface BlockAttempt {
  id: string;
  order_id: string;
  operator_id: string;
  operator_role: UserRole;
  action_attempted: 'supplement' | 'verify' | 'review';
  code: BlockCode;
  reason: string;
  action_hint: string;
  action_target: ActionTarget;
  action_payload: string | null;
  submitted_version: number | null;
  current_version: number;
  resolve_status: ResolveStatus;
  resolve_remark: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ValidationError {
  error: string;
  reason: string;
  code: BlockCode;
  actionHint: string;
  actionTarget: ActionTarget;
  actionPayload: ActionPayload;
  currentVersion: number;
}

export interface BatchSuccessItem {
  id: string;
  order_no: string;
}

export interface BatchFailureItem {
  id: string;
  order_no?: string;
  reason: string;
  code: string;
  actionHint: string;
  actionTarget: ActionTarget;
  actionPayload: ActionPayload;
  submittedVersion: number | null;
  currentVersion: number;
}

export interface BatchActionResult {
  successes: BatchSuccessItem[];
  failures: BatchFailureItem[];
}
