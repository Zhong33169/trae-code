export interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  role_cn: string;
  department: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const STATUS_MAP: Record<string, string> = {
  PENDING_SUBMIT: '待提交',
  SUBMITTED: '已提交',
  REJECTED: '已退回',
  RESUBMITTED: '重新提交',
  QUALITY_CHECKED: '质控已审核',
  NOTICE_SENT: '整改通知已发送',
  REVIEWED: '复核通过',
  ARCHIVED: '已归档',
  CONFIRMED: '医务部确认',
};

export const NODE_MAP: Record<string, string> = {
  DEPARTMENT_SUBMIT: '科室提交',
  QUALITY_REVIEW: '质控审核',
  NOTICE_SEND: '发送整改通知',
  RECTIFICATION: '整改处理',
  REVIEW_ARCHIVE: '复核归档',
  DIRECTOR_CONFIRM: '医务部确认',
};

export const ROLE_MAP: Record<string, string> = {
  DEPARTMENT_SECRETARY: '科室秘书',
  QUALITY_DOCTOR: '质控医生',
  MEDICAL_DIRECTOR: '医务部主任',
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING_SUBMIT: 'default',
  SUBMITTED: 'processing',
  REJECTED: 'error',
  RESUBMITTED: 'processing',
  QUALITY_CHECKED: 'processing',
  NOTICE_SENT: 'warning',
  REVIEWED: 'processing',
  ARCHIVED: 'processing',
  CONFIRMED: 'success',
};

export interface NodeRecord {
  id: number;
  node_name: string;
  node_name_cn: string;
  started_at: string;
  deadline: string;
  completed_at: string | null;
  is_overdue: boolean;
  overdue_reason: string | null;
  follow_up_action: string | null;
  status: string;
  handler_name: string | null;
}

export interface OperationLog {
  id: number;
  operation: string;
  operation_cn: string;
  old_status: string | null;
  new_status: string | null;
  old_status_cn: string | null;
  new_status_cn: string | null;
  operator_name: string;
  remark: string | null;
  extra_data: Record<string, any> | null;
  created_at: string;
}

export interface AllowedAction {
  action: string;
  action_cn: string;
  new_status: string;
  new_status_cn: string;
}

export interface RectificationOrder {
  id: number;
  order_no: string;
  patient_name: string;
  medical_record_no: string;
  department: string;
  diagnosis: string | null;
  status: string;
  status_cn: string;
  current_node: string;
  current_node_cn: string;
  content: string | null;
  rectification_requirements: string | null;
  quality_opinion: string | null;
  notice_content: string | null;
  review_opinion: string | null;
  director_opinion: string | null;
  department_secretary_name: string | null;
  quality_doctor_name: string | null;
  medical_director_name: string | null;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
  nodes?: NodeRecord[];
  logs?: OperationLog[];
  allowed_actions?: AllowedAction[];
}

export interface OrderListResponse {
  items: RectificationOrder[];
  total: number;
  page: number;
  page_size: number;
  overdue_count: number;
  statistics: Statistics;
}

export interface Statistics {
  total: number;
  by_status: Record<string, number>;
  by_department: Record<string, number>;
  overdue_count: number;
  pending_my_action: number;
}

export interface StatusUpdateRequest {
  action: string;
  remark?: string;
  overdue_reason?: string;
  follow_up_action?: string;
  extra_data?: Record<string, any>;
}

export interface StatusUpdateResponse {
  success: boolean;
  message: string;
  order_id: number;
  old_status: string;
  old_status_cn: string;
  new_status: string;
  new_status_cn: string;
  order: RectificationOrder;
}

export interface BatchOperationRequest {
  order_ids: number[];
  action: string;
  remark?: string;
  data?: Record<string, any>;
}

export interface BatchOperationResult {
  success_count: number;
  failed_count: number;
  total_count: number;
  results: Array<{
    order_id: number;
    order_no?: string;
    success: boolean;
    message?: string;
  }>;
}

export interface OverdueCheckResponse {
  order_id: number;
  is_overdue: boolean;
  remaining_hours: number;
  current_node: string;
  current_node_cn: string;
  deadline: string;
  allowed_actions: AllowedAction[];
}
