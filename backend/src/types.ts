export type UserRole = 'receptionist' | 'room_supervisor' | 'duty_manager';

export type OrderStatus = 'pending_supplement' | 'pending_verification' | 'pending_review' | 'archived';

export type EvidenceStage = 'registration' | 'verification' | 'archive';

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

export interface ValidationError {
  error: string;
  reason: string;
}
