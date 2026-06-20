export type Role = 'warehouse_keeper' | 'warehouse_supervisor' | 'operation_manager';

export type OrderStatus = 
  | 'pending_submit'
  | 'returned'
  | 'resubmitted'
  | 'pending_verify'
  | 'verify_passed'
  | 'pending_review'
  | 'review_passed'
  | 'archived';

export type EvidenceType = 'register' | 'verify' | 'review' | 'supplement';

export type SupplementType = 'exception' | 'correct' | 'review';

export interface User {
  id: number;
  username: string;
  real_name: string;
  role: Role;
  create_at: string;
  update_at: string;
}

export interface InventoryAdjustOrder {
  id: number;
  order_no: string;
  title: string;
  adjust_type: string;
  warehouse: string;
  sku: string;
  product_name: string;
  batch_no: string;
  system_stock: number;
  actual_stock: number;
  adjust_quantity: number;
  adjust_reason: string;
  status: OrderStatus;
  version: number;
  created_by: number;
  created_by_name: string;
  verified_by?: number;
  verified_by_name?: string;
  verified_at?: string;
  verify_opinion?: string;
  reviewed_by?: number;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_opinion?: string;
  archived_by?: number;
  archived_by_name?: string;
  archived_at?: string;
  return_reason?: string;
  returned_by?: number;
  returned_by_name?: string;
  returned_at?: string;
  create_at: string;
  update_at: string;
}

export interface OrderEvidence {
  id: number;
  order_id: number;
  type: EvidenceType;
  file_name: string;
  file_type: string;
  file_size: number;
  remark: string;
  uploaded_by: number;
  upload_by_name: string;
  create_at: string;
}

export interface SupplementRecord {
  id: number;
  order_id: number;
  type: SupplementType;
  content: string;
  field_name: string;
  old_value: string;
  new_value: string;
  reason: string;
  supplemented_by: number;
  supplemented_by_name: string;
  create_at: string;
}

export interface OperationLog {
  id: number;
  order_id: number;
  operation: string;
  old_status: OrderStatus;
  new_status: OrderStatus;
  operator_id: number;
  operator_name: string;
  operator_role: Role;
  remark: string;
  create_at: string;
}

export interface OrderDetailResponse {
  order: InventoryAdjustOrder;
  evidences: OrderEvidence[];
  supplements: SupplementRecord[];
  logs: OperationLog[];
}

export interface OrderListResult {
  total: number;
  list: InventoryAdjustOrder[];
  page: number;
  page_size: number;
  groups: Record<string, number>;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  details?: string;
}

export interface RoleInfo {
  user_id: number;
  username: string;
  real_name: string;
  role: Role;
  role_text: string;
}

export const statusText: Record<OrderStatus, string> = {
  pending_submit: '待提交',
  returned: '已退回',
  resubmitted: '重新提交',
  pending_verify: '待核验',
  verify_passed: '核验通过',
  pending_review: '待复核',
  review_passed: '复核通过',
  archived: '已归档',
};

export const statusColor: Record<OrderStatus, string> = {
  pending_submit: '#faad14',
  returned: '#ff4d4f',
  resubmitted: '#1890ff',
  pending_verify: '#fa8c16',
  verify_passed: '#52c41a',
  pending_review: '#722ed1',
  review_passed: '#13c2c2',
  archived: '#8c8c8c',
};

export const supplementTypeText: Record<SupplementType, string> = {
  exception: '异常',
  correct: '补正',
  review: '复核',
};

export const evidenceTypeText: Record<EvidenceType, string> = {
  register: '登记',
  verify: '核验',
  review: '复核',
  supplement: '补录',
};

export const roleText: Record<Role, string> = {
  warehouse_keeper: '库管员',
  warehouse_supervisor: '仓储主管',
  operation_manager: '运营经理',
};
