export type UserRole = 'registrar' | 'auditor' | 'reviewer';

export type TaskNode = 'order_sampling' | 'sample_confirmation' | 'mass_production' | 'archived';

export type TaskStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'completed' | 'timeout';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  name: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface TaskNodeRecord {
  id: number;
  taskId: number;
  node: TaskNode;
  status: TaskStatus;
  assigneeId: number;
  assigneeName: string;
  startedAt: string;
  completedAt?: string;
  deadline: string;
  isTimeout: boolean;
  timeoutDuration?: number;
  remark?: string;
  exceptionReason?: string;
}

export interface OperationLog {
  id: number;
  taskId: number;
  operatorId: number;
  operatorName: string;
  action: string;
  node: TaskNode;
  remark?: string;
  createdAt: string;
}

export interface Task {
  id: number;
  taskNo: string;
  styleNo: string;
  styleName: string;
  currentNode: TaskNode;
  status: TaskStatus;
  creatorId: number;
  creatorName: string;
  currentAssigneeId: number;
  currentAssigneeName: string;
  isTimeout: boolean;
  remainingTime?: number;
  timeoutDuration?: number;
  createdAt: string;
  updatedAt: string;
  nodeRecords: TaskNodeRecord[];
  operationLogs: OperationLog[];
}

export interface TaskListResponse {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    total: number;
    pending: number;
    timeout: number;
    completed: number;
  };
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface TaskQueryParams {
  page?: number;
  pageSize?: number;
  node?: TaskNode;
  status?: TaskStatus;
  isTimeout?: boolean;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

export interface TaskActionParams {
  taskId: number;
  action: 'submit' | 'approve' | 'reject' | 'review' | 'archive';
  remark?: string;
  exceptionReason?: string;
}

export interface StatisticsData {
  taskCountByNode: {
    node: string;
    count: number;
  }[];
  taskCountByStatus: {
    status: string;
    count: number;
  }[];
  taskTrend: {
    date: string;
    count: number;
  }[];
  timeoutRate: number;
  avgProcessingTime: number;
}

export const NODE_LABELS: Record<TaskNode, string> = {
  order_sampling: '订单打样',
  sample_confirmation: '样衣确认',
  mass_production: '大货排产',
  archived: '归档',
};

export const NODE_ORDER: TaskNode[] = ['order_sampling', 'sample_confirmation', 'mass_production', 'archived'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  approved: '已通过',
  rejected: '已打回',
  completed: '已完成',
  timeout: '已超时',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  registrar: '登记员',
  auditor: '审核主管',
  reviewer: '复核负责人',
};
