export type UserRole = 'registrar' | 'supervisor' | 'reviewer';

export interface User {
  id: number;
  username: string;
  real_name: string;
  role: UserRole;
}

export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'returned_to_registrar'
  | 'resubmitted'
  | 'supervisor_approved'
  | 'supervisor_rejected'
  | 'high_risk_escalated'
  | 'reviewer_approved'
  | 'reviewer_rejected'
  | 'archived'
  | 'overdue';

export type RiskLevel = 'low' | 'medium' | 'high';

export type OrderStage = 'appointment' | 'dispatch' | 'delivery';

export interface OrderOperation {
  id: number;
  order_id: number;
  operator_id: number;
  operator_name: string;
  operator_role: UserRole;
  action: string;
  from_status: OrderStatus | '';
  to_status: OrderStatus | '';
  opinion: string;
  result: string;
  risk_change: string;
  evidence_check: string;
  version_checked: number;
  ip_address: string;
  created_at: string;
}

export interface RepairOrder {
  id: number;
  order_no: string;
  customer_name: string;
  phone: string;
  vehicle_plate: string;
  vehicle_model: string;
  mileage: number;
  appointment_type: string;
  problem_description: string;
  status: OrderStatus;
  risk_level: RiskLevel;
  risk_reason: string;
  stage: OrderStage;
  assigned_technician: string;
  repair_items: string;
  estimated_cost: number;
  final_cost: number;
  evidence_submitted: boolean;
  evidence_list: string;
  deadline: string;
  current_handler: string;
  version: number;
  created_at: string;
  updated_at: string;
  created_by_id: number;
  created_by?: User;
  last_opinion: string;
  last_result: string;
  operations?: OrderOperation[];
}

export interface OverviewStats {
  todo_by_role: { registrar: number; supervisor: number; reviewer: number };
  by_status: {
    draft: number;
    submitted: number;
    returned_to_registrar: number;
    resubmitted: number;
    supervisor_approved: number;
    supervisor_rejected: number;
    high_risk_escalated: number;
    reviewer_approved: number;
    reviewer_rejected: number;
    archived: number;
    overdue: number;
  };
  by_risk: { low: number; medium: number; high: number };
  by_stage: { appointment: number; dispatch: number; delivery: number };
  my_todo: number;
  total_orders: number;
}

export const ROLE_NAMES: Record<UserRole, string> = {
  registrar: '登记员',
  supervisor: '主管',
  reviewer: '复核员',
};

export const STATUS_NAMES: Record<OrderStatus, string> = {
  draft: '草稿',
  submitted: '已提交',
  returned_to_registrar: '退回登记员',
  resubmitted: '重新提交',
  supervisor_approved: '主管通过',
  supervisor_rejected: '主管拒绝',
  high_risk_escalated: '高风险升级',
  reviewer_approved: '复核通过',
  reviewer_rejected: '复核拒绝',
  archived: '已归档',
  overdue: '已逾期',
};

export const STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  draft: 'badge-default',
  submitted: 'badge-warning',
  returned_to_registrar: 'badge-danger',
  resubmitted: 'badge-primary',
  supervisor_approved: 'badge-primary',
  supervisor_rejected: 'badge-error',
  high_risk_escalated: 'badge-danger',
  reviewer_approved: 'badge-success',
  reviewer_rejected: 'badge-error',
  archived: 'badge-success',
  overdue: 'badge-danger',
};

export const RISK_NAMES: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

export const RISK_BADGE_CLASSES: Record<RiskLevel, string> = {
  low: 'badge-low-risk',
  medium: 'badge-medium-risk',
  high: 'badge-high-risk',
};

export const STAGE_NAMES: Record<OrderStage, string> = {
  appointment: '预约阶段',
  dispatch: '派单阶段',
  delivery: '交付阶段',
};

export const APPOINTMENT_TYPES: string[] = [
  '常规保养',
  '故障维修',
  '事故维修',
  '年检代办',
  '轮胎更换',
  '空调维修',
  '电路检修',
  '其他',
];

export const EVIDENCE_OPTIONS: string[] = [
  '车辆外观照片',
  '行驶证照片',
  '故障现象视频',
  '维修前照片',
  '维修中照片',
  '维修后照片',
  '配件合格证',
  '客户签字确认单',
  '估价单',
  '结算单',
];
