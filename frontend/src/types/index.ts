export type UserRole = 'registrar' | 'auditor' | 'reviewer';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  company: string;
}

export type OrderStatus =
  | 'draft'
  | 'registered'
  | 'verifying'
  | 'verify_passed'
  | 'verify_returned'
  | 'appeal_submitted'
  | 'appeal_accepted'
  | 'appeal_rejected_correction'
  | 'appeal_resubmitted'
  | 'reviewing'
  | 'review_confirmed'
  | 'review_returned'
  | 'archived';

export interface EvidenceItem {
  name: string;
  url: string;
  uploaded_at: string;
}

export interface ProcessRecord {
  id: string;
  order_id: string;
  handler_id: string;
  handler_name: string;
  handler_role: UserRole;
  action: string;
  opinion: string;
  from_status: OrderStatus;
  to_status: OrderStatus;
  created_at: string;
}

export interface SparePartOrder {
  id: string;
  order_no: string;
  title: string;
  part_name: string;
  part_model: string;
  quantity: number;
  reason: string;
  station_name: string;
  status: OrderStatus;
  current_handler_id: string;
  current_handler_name: string;
  current_handler_role: UserRole;
  version: number;
  evidence: EvidenceItem[];
  registrar_id: string;
  registrar_name: string;
  appeal_reason?: string;
  review_opinion?: string;
  reject_reason?: string;
  original_status?: OrderStatus;
  deadline?: string;
  is_overdue: boolean;
  is_evidence_missing: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderListResponse {
  orders: SparePartOrder[];
  total: number;
  stats: {
    total: number;
    registered: number;
    verifying: number;
    reviewing: number;
    appeal: number;
    archived: number;
    overdue: number;
    evidence_missing: number;
  };
}

export interface ActionRequest {
  order_id: string;
  version: number;
  handler_id: string;
  opinion?: string;
  evidence?: EvidenceItem[];
  appeal_reason?: string;
}
