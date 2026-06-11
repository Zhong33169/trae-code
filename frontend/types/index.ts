export type UserRole = 'registrar' | 'auditor' | 'reviewer';

export type TaskNode = 'order_sampling' | 'sample_confirmation' | 'production_scheduling' | 'archived';

export type TaskStatus = 'pending' | 'processing' | 'rejected' | 'completed' | 'archived';

export interface User {
  id: string;
  username: string;
  real_name: string;
  role: string;
  role_name: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface TaskListItem {
  id: string;
  task_no: string;
  order_no?: string;
  style_no: string;
  style_name: string;
  customer_name?: string;
  fabric_type?: string;
  color?: string;
  size_spec?: string;
  quantity?: number;
  current_node: TaskNode;
  status: TaskStatus;
  priority?: string;
  deadline?: string;
  order_sampling_started_at?: string;
  order_sampling_completed_at?: string;
  sample_confirmation_started_at?: string;
  sample_confirmation_completed_at?: string;
  production_scheduling_started_at?: string;
  production_scheduling_completed_at?: string;
  archived_at?: string;
  registrar_id?: string;
  auditor_id?: string;
  reviewer_id?: string;
  created_at: string;
  updated_at: string;
  is_timeout: boolean;
  timeout_hours: number;
  registrar_name?: string;
  auditor_name?: string;
  reviewer_name?: string;
}

export interface TaskListResponse {
  list: TaskListItem[];
  total: number;
  page: number;
  page_size: number;
  timeout_count: number;
}

export interface TaskDetail extends TaskListItem {
  node_records: NodeRecordDetail[];
  operation_logs: OperationLogDetail[];
}

export interface NodeRecordDetail {
  id: string;
  task_id: string;
  node_type: string;
  operator_id: string;
  action: string;
  remark?: string;
  abnormal_reason?: string;
  started_at: string;
  completed_at?: string;
  is_timeout: number;
  timeout_hours: number;
  created_at: string;
  operator_name?: string;
  node_name?: string;
}

export interface OperationLogDetail {
  id: string;
  task_id?: string;
  user_id: string;
  action: string;
  from_status?: string;
  to_status?: string;
  from_node?: string;
  to_node?: string;
  detail?: string;
  ip_address?: string;
  created_at: string;
  user_name?: string;
}

export interface SummaryStatistics {
  total_tasks: number;
  pending_tasks: number;
  processing_tasks: number;
  completed_tasks: number;
  timeout_tasks: number;
  today_new_tasks: number;
  today_completed_tasks: number;
  avg_processing_hours: number;
}

export interface TrendData {
  date: string;
  new_tasks: number;
  completed_tasks: number;
  timeout_tasks: number;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T | null;
}

export interface TaskListQuery {
  page?: number;
  page_size?: number;
  status?: TaskStatus;
  current_node?: TaskNode;
  keyword?: string;
  is_timeout?: string;
  start_date?: string;
  end_date?: string;
}

export interface CreateTaskRequest {
  style_no: string;
  style_name: string;
  customer_name?: string;
  fabric_type?: string;
  color?: string;
  size_spec?: string;
  quantity?: number;
  priority?: string;
  remark?: string;
}

export interface AdvanceTaskRequest {
  action: 'submit' | 'approve' | 'reject';
  remark?: string;
  abnormal_reason?: string;
}

export const NODE_LABELS: Record<TaskNode, string> = {
  order_sampling: '订单打样',
  sample_confirmation: '样衣确认',
  production_scheduling: '大货排产',
  archived: '归档',
};

export const NODE_ORDER: TaskNode[] = ['order_sampling', 'sample_confirmation', 'production_scheduling', 'archived'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  rejected: '已打回',
  completed: '已完成',
  archived: '已归档',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  registrar: '登记员',
  auditor: '审核主管',
  reviewer: '复核负责人',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
};

export function getResponsibleName(task: TaskListItem | TaskDetail): string {
  switch (task.current_node) {
    case 'order_sampling':
      return task.registrar_name || '-';
    case 'sample_confirmation':
      return task.auditor_name || '-';
    case 'production_scheduling':
      return task.auditor_name || '-';
    case 'archived':
      return task.reviewer_name || '-';
    default:
      return '-';
  }
}

export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'completed':
    case 'archived':
      return 'green';
    case 'rejected':
      return 'red';
    case 'processing':
      return 'blue';
    case 'pending':
    default:
      return 'default';
  }
}

export function getNodeColor(node: TaskNode): string {
  switch (node) {
    case 'order_sampling':
      return 'blue';
    case 'sample_confirmation':
      return 'cyan';
    case 'production_scheduling':
      return 'purple';
    case 'archived':
      return 'green';
    default:
      return 'default';
  }
}

export function formatTimeoutDisplay(timeoutHours: number): string {
  if (timeoutHours > 0) {
    return `已超时${timeoutHours}小时`;
  }
  return '';
}
