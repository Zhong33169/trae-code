export interface User {
  id: number;
  name: string;
  role: 'clerk' | 'supervisor' | 'rechecker';
  created_at: string;
}

export interface RepairOrder {
  id: number;
  order_no: string;
  title: string;
  description: string;
  enterprise_name: string;
  contact_person: string;
  contact_phone: string;
  repair_type: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  location: string;
  evidence_descriptions: string[];
  status: 'draft' | 'submitted' | 'under_review' | 'returned' | 'review_approved' | 'under_recheck' | 'archived' | 'rejected';
  current_handler_id: number | null;
  current_handler_role: string | null;
  current_handler_name?: string;
  version: number;
  created_at: string;
  updated_at: string;
  operation_records?: OperationRecord[];
}

export interface OperationRecord {
  id: number;
  order_id: number;
  action: string;
  operator_id: number;
  operator_name: string;
  operator_role: string;
  opinion: string | null;
  result: string | null;
  reason: string | null;
  from_status: string | null;
  to_status: string;
  created_at: string;
}

export interface Stats {
  total: number;
  draft: number;
  submitted: number;
  under_review: number;
  returned: number;
  review_approved: number;
  under_recheck: number;
  archived: number;
  rejected: number;
}
