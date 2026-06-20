export interface User {
  id: number;
  username: string;
  real_name: string;
  role: string;
  shift: string;
  phone?: string;
}

export interface RepairQuote {
  id: number;
  quote_no: string;
  customer_name: string;
  customer_phone: string;
  device_type: string;
  device_model: string;
  fault_description: string;
  status: string;
  status_display: string;
  current_handler_id: number;
  current_handler: string;
  shift: string;
  shift_display: string;
  estimate_amount: number;
  actual_amount: number;
  payment_status: string;
  payment_status_display?: string;
  payment_method: string;
  quote_detail: string;
  confirmed_at?: string | null;
  paid_at?: string | null;
  completed_at?: string | null;
  assigned_technician_id: number;
  assigned_technician: string;
  creator_id: number;
  creator_name: string;
  handover_count: number;
  created_at: string;
  updated_at: string;
  pending_handover_id?: number;
}

export interface OperationLog {
  id: number;
  operation: string;
  old_status: string;
  new_status: string;
  operator_id: number;
  operator_name: string;
  operator_role: string;
  operator_shift?: string;
  batch_id?: string;
  remark: string;
  created_at: string;
}

export interface ShiftHandover {
  id: number;
  quote_id: number;
  from_user_id: number;
  from_user_name: string;
  from_user_role: string;
  from_shift: string;
  to_user_id: number;
  to_user_name: string;
  to_user_role: string;
  to_shift: string;
  handover_remark: string;
  confirmed_at?: string | null;
  status: string;
  status_display: string;
  created_at: string;
}

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-300',
  pending_quote: 'bg-yellow-50 text-yellow-800 border-yellow-300',
  quoted: 'bg-blue-50 text-blue-800 border-blue-300',
  confirmed: 'bg-indigo-50 text-indigo-800 border-indigo-300',
  customer_paid: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  repairing: 'bg-purple-50 text-purple-800 border-purple-300',
  returned: 'bg-red-50 text-red-800 border-red-300',
  completed: 'bg-green-50 text-green-800 border-green-400',
  cancelled: 'bg-gray-200 text-gray-600 border-gray-400',
};

export const ROLE_COLORS: Record<string, string> = {
  service_manager: 'bg-red-100 text-red-700',
  dispatcher: 'bg-blue-100 text-blue-700',
  customer_service: 'bg-green-100 text-green-700',
  technician: 'bg-orange-100 text-orange-700',
};
