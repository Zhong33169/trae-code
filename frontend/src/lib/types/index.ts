export enum Role {
  REGISTRAR = 'registrar',
  SUPERVISOR = 'supervisor',
  SUPERVISOR_ENGINEER = 'supervisor_engineer',
}

export const RoleLabel: Record<Role, string> = {
  [Role.REGISTRAR]: '进度登记员',
  [Role.SUPERVISOR]: '进度审核主管',
  [Role.SUPERVISOR_ENGINEER]: '工程监理公司复核负责人',
};

export enum ProgressStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  UNDER_REVIEW = 'under_review',
  REVIEW_REJECTED = 'review_rejected',
  PENDING_VERIFICATION = 'pending_verification',
  UNDER_VERIFICATION = 'under_verification',
  VERIFICATION_REJECTED = 'verification_rejected',
  ARCHIVED = 'archived',
}

export const ProgressStatusLabel: Record<ProgressStatus, string> = {
  [ProgressStatus.DRAFT]: '草稿',
  [ProgressStatus.PENDING_REVIEW]: '待审核',
  [ProgressStatus.UNDER_REVIEW]: '审核中',
  [ProgressStatus.REVIEW_REJECTED]: '审核驳回',
  [ProgressStatus.PENDING_VERIFICATION]: '待复核',
  [ProgressStatus.UNDER_VERIFICATION]: '复核中',
  [ProgressStatus.VERIFICATION_REJECTED]: '复核驳回',
  [ProgressStatus.ARCHIVED]: '已归档',
};

export const ProgressStatusColor: Record<ProgressStatus, string> = {
  [ProgressStatus.DRAFT]: '#9ca3af',
  [ProgressStatus.PENDING_REVIEW]: '#f59e0b',
  [ProgressStatus.UNDER_REVIEW]: '#3b82f6',
  [ProgressStatus.REVIEW_REJECTED]: '#ef4444',
  [ProgressStatus.PENDING_VERIFICATION]: '#8b5cf6',
  [ProgressStatus.UNDER_VERIFICATION]: '#06b6d4',
  [ProgressStatus.VERIFICATION_REJECTED]: '#dc2626',
  [ProgressStatus.ARCHIVED]: '#10b981',
};

export enum TimeoutStatus {
  NORMAL = 'normal',
  WARNING = 'warning',
  OVERDUE = 'overdue',
}

export const TimeoutStatusLabel: Record<TimeoutStatus, string> = {
  [TimeoutStatus.NORMAL]: '正常',
  [TimeoutStatus.WARNING]: '预警',
  [TimeoutStatus.OVERDUE]: '超时',
};

export const TimeoutStatusColor: Record<TimeoutStatus, string> = {
  [TimeoutStatus.NORMAL]: '#10b981',
  [TimeoutStatus.WARNING]: '#f59e0b',
  [TimeoutStatus.OVERDUE]: '#ef4444',
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  SUBMIT = 'submit',
  REVIEW = 'review',
  REVIEW_APPROVE = 'review_approve',
  REVIEW_REJECT = 'review_reject',
  VERIFY = 'verify',
  VERIFY_APPROVE = 'verify_approve',
  VERIFY_REJECT = 'verify_reject',
  ARCHIVE = 'archive',
  CORRECT = 'correct',
  TIMEOUT_HANDLE = 'timeout_handle',
  UPDATE_STATUS = 'update_status',
  DELETE = 'delete',
  WEEKLY_REPORT_CREATE = 'weekly_report_create',
  WEEKLY_REPORT_UPDATE = 'weekly_report_update',
  DEVIATION_CREATE = 'deviation_create',
  DEVIATION_UPDATE = 'deviation_update',
  DEVIATION_APPROVE = 'deviation_approve',
  OWNER_REPORT_CREATE = 'owner_report_create',
  OWNER_REPORT_UPDATE = 'owner_report_update',
  OWNER_REPORT_ACKNOWLEDGE = 'owner_report_acknowledge',
  BATCH_PROCESS = 'batch_process',
}

export const OperationTypeLabel: Record<OperationType, string> = {
  [OperationType.CREATE]: '创建',
  [OperationType.UPDATE]: '更新',
  [OperationType.SUBMIT]: '提交',
  [OperationType.REVIEW]: '审核',
  [OperationType.REVIEW_APPROVE]: '审核通过',
  [OperationType.REVIEW_REJECT]: '审核驳回',
  [OperationType.VERIFY]: '复核',
  [OperationType.VERIFY_APPROVE]: '复核通过',
  [OperationType.VERIFY_REJECT]: '复核驳回',
  [OperationType.ARCHIVE]: '归档',
  [OperationType.CORRECT]: '补正',
  [OperationType.TIMEOUT_HANDLE]: '超时处理',
  [OperationType.UPDATE_STATUS]: '状态更新',
  [OperationType.DELETE]: '删除',
  [OperationType.WEEKLY_REPORT_CREATE]: '新增周报',
  [OperationType.WEEKLY_REPORT_UPDATE]: '更新周报',
  [OperationType.DEVIATION_CREATE]: '新增偏差分析',
  [OperationType.DEVIATION_UPDATE]: '更新偏差分析',
  [OperationType.DEVIATION_APPROVE]: '偏差分析审批',
  [OperationType.OWNER_REPORT_CREATE]: '新增业主汇报',
  [OperationType.OWNER_REPORT_UPDATE]: '更新业主汇报',
  [OperationType.OWNER_REPORT_ACKNOWLEDGE]: '业主汇报确认',
  [OperationType.BATCH_PROCESS]: '批量办理',
};

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  department?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProgressReport {
  id: string;
  title: string;
  content?: string;
  status: ProgressStatus;
  timeoutStatus: TimeoutStatus;
  deadline: string;
  reportDate?: string;
  projectName?: string;
  abnormalReason?: string;
  lastProcessResult?: string;
  reviewCount: number;
  verificationCount: number;
  currentNodeEnteredAt?: string;
  timeoutDays: number;
  timeoutReason?: string;
  timeoutFollowUp?: string;
  timeoutHandledAt?: string;
  batchResult?: string;
  responsiblePersonId?: string;
  responsiblePerson?: User;
  weeklyReports?: WeeklyReport[];
  deviationAnalyses?: DeviationAnalysis[];
  ownerReports?: OwnerReport[];
  operationLogs?: OperationLog[];
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReport {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  weekProgress?: string;
  nextWeekPlan?: string;
  existingProblems?: string;
  completionRate: number;
  progressReportId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviationAnalysis {
  id: string;
  deviationDescription: string;
  causeAnalysis: string;
  impactAssessment: string;
  correctionMeasures: string;
  deviationPercentage: number;
  isApproved: boolean;
  approvalOpinion?: string;
  progressReportId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerReport {
  id: string;
  reportTitle: string;
  reportContent: string;
  reportDate: string;
  ownerFeedback?: string;
  ownerAcknowledged: boolean;
  progressReportId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OperationLog {
  id: string;
  operationType: OperationType;
  operationDetail?: string;
  remarks?: string;
  fromStatus?: ProgressStatus;
  toStatus?: ProgressStatus;
  operatorId: string;
  operator?: User;
  progressReportId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T;
  timestamp: string;
  path?: string;
}

export interface Statistics {
  totalCount: number;
  thisMonthCount: number;
  overdueCount: number;
  statusCounts: Partial<Record<ProgressStatus, number>>;
  timeoutCounts: Partial<Record<TimeoutStatus, number>>;
}

export interface PageResult<T> {
  list: T[];
  total: number;
}

export interface BatchResultItem {
  id: string;
  success: boolean;
  message: string;
}

export interface BatchResult {
  results: BatchResultItem[];
}
