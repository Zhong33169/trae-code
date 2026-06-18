export type Role = 'customer_manager' | 'underwriting_specialist' | 'business_owner';
export type TaskStatus = 'draft' | 'submitted' | 'reviewed' | 'confirmed' | 'rejected' | 'archived';
export type ActionType = 'submit' | 'review' | 'confirm' | 'archive' | 'reject';

export interface Evidence {
  content: string;
  operator: string;
  operatorId: number;
  ts: string;
}

export interface Task {
  id: number;
  taskNo: string;
  policyNo: string;
  customerName: string;
  product: string;
  renewalType: string;
  originalPremium: number;
  newPremium: number;
  status: TaskStatus;
  version: number;
  submitterName: string;
  currentHandlerRole: string;
  regEvidence: Evidence | null;
  verifyEvidence: Evidence | null;
  archiveEvidence: Evidence | null;
  lastBatchNo: string;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: number;
  batchNo: string;
  action: ActionType;
  operatorName: string;
  operatorRole: string;
  total: number;
  successCount: number;
  failCount: number;
  status: string;
  createdAt: string;
}

export interface BatchItem {
  id: number;
  batchId: number;
  taskId: number;
  taskNo: string;
  status: 'success' | 'failed';
  errorReason: string;
  retryCount: number;
  processedAt: string;
}

export interface AuditLog {
  id: number;
  batchId?: number;
  taskId: number;
  taskNo: string;
  action: string;
  operatorName: string;
  operatorRole: string;
  fromStatus: string;
  toStatus: string;
  detail: string;
  createdAt: string;
}

export interface AppUser {
  id: number;
  username: string;
  role: Role;
  displayName: string;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  customer_manager: '客户经理',
  underwriting_specialist: '核保专员',
  business_owner: '业务负责人',
};

export const ROLE_AVATARS: Record<Role, string> = {
  customer_manager: '客',
  underwriting_specialist: '核',
  business_owner: '负',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  draft: '草稿',
  submitted: '已提交待复核',
  reviewed: '已复核待确认',
  confirmed: '已确认',
  rejected: '已驳回',
  archived: '已归档',
};

export const STATUS_FILTERS: { value: TaskStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'submitted', label: '待复核' },
  { value: 'reviewed', label: '待确认' },
  { value: 'confirmed', label: '已确认' },
  { value: 'rejected', label: '已驳回' },
  { value: 'archived', label: '已归档' },
];

export const ACTION_LABELS: Record<ActionType, string> = {
  submit: '提交',
  review: '复核',
  confirm: '确认',
  archive: '归档',
  reject: '驳回',
};

export interface DemoAccount {
  role: Role;
  username: string;
  password: string;
  displayName: string;
}

export const DEMO_ACCOUNTS: Record<Role, DemoAccount> = {
  customer_manager: { role: 'customer_manager', username: 'cm_demo', password: 'cm123', displayName: '陈经理' },
  underwriting_specialist: { role: 'underwriting_specialist', username: 'us_demo', password: 'us123', displayName: '林专员' },
  business_owner: { role: 'business_owner', username: 'bo_demo', password: 'bo123', displayName: '周负责人' },
};

export const ROLE_LIST: Role[] = ['customer_manager', 'underwriting_specialist', 'business_owner'];

export function actionRequiredRole(action: ActionType): Role {
  switch (action) {
    case 'submit': return 'customer_manager';
    case 'review': return 'underwriting_specialist';
    case 'confirm':
    case 'archive': return 'business_owner';
    case 'reject': return 'customer_manager';
  }
}

export function evidenceKeyForAction(action: ActionType): keyof Task | null {
  switch (action) {
    case 'submit': return 'regEvidence';
    case 'review': return 'verifyEvidence';
    case 'confirm': return 'archiveEvidence';
    default: return null;
  }
}
