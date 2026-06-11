export type RoleEnum = 'initiator' | 'handler' | 'reviewer';

export type OrderStatus =
  | 'draft'
  | 'entrusted'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'reviewed'
  | 'rejected';

export type EvidenceType = 'entrustment' | 'dispatch' | 'receipt';

export type BatchStatus = 'pending' | 'processing' | 'partial_success' | 'all_success' | 'all_failed';
export type BatchItemStatus = 'pending' | 'success' | 'failed' | 'retry_pending';

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: RoleEnum;
}

export interface Evidence {
  id: number;
  evidence_type: EvidenceType;
  file_name: string;
  file_ref: string;
  remark?: string;
  uploaded_by?: number;
  uploaded_at: string;
}

export interface TransportOrder {
  id: number;
  order_no: string;
  customer: string;
  cargo_name: string;
  cargo_weight: number;
  origin: string;
  destination: string;
  status: OrderStatus;
  version: number;
  plate_number?: string;
  driver?: string;
  receiver?: string;
  signed_at?: string;
  rejected_reason?: string;
  initiator_id?: number;
  handler_id?: number;
  reviewer_id?: number;
  created_at: string;
  updated_at: string;
  evidences: Evidence[];
}

export interface BatchItem {
  id: number;
  order_id: number;
  order_no: string;
  status: BatchItemStatus;
  error_message?: string;
  retry_count: number;
  processed_at?: string;
}

export interface BatchChange {
  id: number;
  batch_no: string;
  operator_id: number;
  change_type: string;
  target_status?: OrderStatus;
  status: BatchStatus;
  total_count: number;
  success_count: number;
  failed_count: number;
  created_at: string;
  finished_at?: string;
  items: BatchItem[];
}

export interface AuditLog {
  id: number;
  order_id?: number;
  order_no?: string;
  batch_id?: number;
  batch_no?: string;
  user_id?: number;
  username?: string;
  action: string;
  old_status?: string;
  new_status?: string;
  detail?: string;
  failure_reason?: string;
  created_at: string;
}

export const ROLE_LABELS: Record<RoleEnum, string> = {
  initiator: '发起岗',
  handler: '办理岗',
  reviewer: '复核岗',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: '草稿',
  entrusted: '已委托',
  dispatched: '已调度',
  in_transit: '运输中',
  delivered: '已签收',
  reviewed: '已归档',
  rejected: '已驳回',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: '#9ca3af',
  entrusted: '#3b82f6',
  dispatched: '#8b5cf6',
  in_transit: '#f59e0b',
  delivered: '#10b981',
  reviewed: '#059669',
  rejected: '#ef4444',
};

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  entrustment: '运输委托单',
  dispatch: '车辆调度单',
  receipt: '签收回单',
};

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  pending: '待执行',
  processing: '执行中',
  partial_success: '部分成功',
  all_success: '全部成功',
  all_failed: '全部失败',
};

export const BATCH_ITEM_STATUS_LABELS: Record<BatchItemStatus, string> = {
  pending: '待处理',
  success: '成功',
  failed: '失败',
  retry_pending: '待重试',
};
