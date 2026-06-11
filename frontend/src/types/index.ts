export type UserRole = 'registrar' | 'auditor' | 'reviewer';

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  role_label: string;
}

export type RiskLevel = 'high' | 'medium' | 'low';
export type Stage = 'confirm' | 'schedule' | 'acceptance';
export type TicketStatus = 'pending' | 'processing' | 'returned' | 'completed' | 'overdue';

export interface Evidence {
  id: number;
  name: string;
  type: string;
  type_label: string;
  url: string;
  uploaded_at: string;
}

export interface TicketLog {
  id: number;
  ticket_id: number;
  action: string;
  action_label: string;
  from_stage: string;
  to_stage: string;
  from_status: string;
  to_status: string;
  operator_id: number | null;
  operator_name: string;
  comment: string;
  created_at: string;
  evidences: Evidence[];
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  risk_level: RiskLevel;
  risk_label: string;
  stage: Stage;
  stage_label: string;
  status: TicketStatus;
  status_label: string;
  priority: number;
  version: number;
  creator_id: number;
  creator_name: string;
  current_handler_id: number | null;
  current_handler_name: string;
  created_at: string;
  updated_at: string;
  deadline: string;
}

export interface TicketDetail extends Ticket {
  logs: TicketLog[];
  evidences: Evidence[];
}

export interface TicketListResponse {
  total: number;
  items: Ticket[];
  page: number;
  page_size: number;
}

export interface DashboardStats {
  total_pending: number;
  stage_counts: Record<string, number>;
  risk_counts: Record<string, number>;
  overdue_count: number;
  my_todo_count: number;
}

export interface EvidenceCreate {
  name: string;
  type: string;
  url: string;
}

export interface TicketCreateData {
  title: string;
  description: string;
  risk_level: RiskLevel;
  deadline?: string;
  evidences: EvidenceCreate[];
}

export interface TicketActionData {
  action: string;
  comment: string;
  version: number;
  evidences: EvidenceCreate[];
}

export interface LogListResponse {
  total: number;
  items: TicketLog[];
  page: number;
  page_size: number;
}
