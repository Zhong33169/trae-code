export interface User {
  id: number;
  username: string;
  role: string;
  name: string;
  created_at: string;
}

export interface PrescriptionTransfer {
  id: number;
  transfer_no: string;
  patient_name: string;
  id_card: string;
  department: string;
  doctor_name: string;
  medicine_list: string;
  total_amount: number;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TransferEvidence {
  id: number;
  transfer_id: number;
  evidence_type: string;
  operator_id: number;
  operator_name: string;
  operator_role: string;
  evidence_content: string;
  remark: string;
  created_at: string;
}

export interface BatchOperation {
  id: number;
  batch_no: string;
  operation_type: string;
  operator_id: number;
  operator_name: string;
  total_count: number;
  success_count: number;
  fail_count: number;
  status: string;
  created_at: string;
}

export interface BatchItem {
  id: number;
  batch_id: number;
  transfer_id: number;
  transfer_no: string;
  status: string;
  error_message: string;
  result_data: string;
  created_at: string;
  updated_at: string;
}

export interface BatchDetail {
  batch: BatchOperation;
  items: BatchItem[];
}

export interface AuditLog {
  id: number;
  user_id: number;
  user_name: string;
  role: string;
  action: string;
  target_type: string;
  target_id: number;
  old_value: string;
  new_value: string;
  ip_address: string;
  created_at: string;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_page: number;
}

export interface ListResponse<T> {
  list: T[];
  pagination: Pagination;
}

export const STATUS_MAP: Record<string, string> = {
  draft: "草稿",
  pending_registration: "待登记",
  registered: "已登记",
  pending_verification: "待核验",
  verified: "已核验",
  pending_review: "待复核",
  archived: "已归档",
};

export const ROLE_MAP: Record<string, string> = {
  reception_assistant: "接诊助理",
  attending_physician: "坐诊医师",
  pharmacy_admin: "药房管理员",
};

export const EVIDENCE_TYPE_MAP: Record<string, string> = {
  registration: "登记",
  verification: "核验",
  review: "复核归档",
};

export const BATCH_OP_MAP: Record<string, string> = {
  register: "批量登记",
  verify: "批量核验",
  review: "批量复核",
};

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending_registration: "bg-yellow-100 text-yellow-800",
  registered: "bg-blue-100 text-blue-800",
  pending_verification: "bg-orange-100 text-orange-800",
  verified: "bg-green-100 text-green-800",
  pending_review: "bg-purple-100 text-purple-800",
  archived: "bg-gray-100 text-gray-800",
};
