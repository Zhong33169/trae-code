export enum UserRole {
  RECEPTIONIST = 'receptionist',
  DENTIST = 'dentist',
  DIRECTOR = 'director',
}

export enum TreatmentPlanStatus {
  DRAFT = 'draft',
  PENDING_VERIFICATION = 'pending_verification',
  VERIFICATION_REJECTED = 'verification_rejected',
  PENDING_REVIEW = 'pending_review',
  REVIEW_REJECTED = 'review_rejected',
  ARCHIVED = 'archived',
}

export enum UrgencyLevel {
  NORMAL = 'normal',
  WARNING = 'warning',
  OVERDUE = 'overdue',
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  store: string;
}

export interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  checked: boolean;
  verified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface TreatmentPlan {
  id: string;
  planNo: string;
  patientName: string;
  patientPhone: string;
  store: string;
  status: TreatmentPlanStatus;
  urgencyLevel: UrgencyLevel;
  createdAt: string;
  deadline: string;
  receptionistId: string;
  dentistId?: string;
  directorId?: string;
  materials: MaterialItem[];
  attachments: Attachment[];
  remarks: string;
  verificationOpinion?: string;
  verificationResult?: 'pass' | 'reject';
  verifiedAt?: string;
  reviewOpinion?: string;
  reviewResult?: 'pass' | 'reject';
  reviewedAt?: string;
  rejectReason?: string;
  version: number;
}

export interface AuditLog {
  id: string;
  planId: string;
  userId: string;
  userName: string;
  userRole?: string;
  action: string;
  fromStatus?: TreatmentPlanStatus;
  toStatus?: TreatmentPlanStatus;
  details: string;
  timestamp: string;
  materialChanges?: Array<{
    id: string;
    name: string;
    before?: { checked?: boolean; verified?: boolean };
    after?: { checked?: boolean; verified?: boolean };
    checked?: boolean;
    verified?: boolean;
  }>;
  attachmentChanges?: Array<{
    id?: string;
    name: string;
    type: string;
    changeType: 'add' | 'remove';
  }>;
  opinion?: string;
  rejectReason?: string;
  batchInfo?: {
    totalCount: number;
    successCount: number;
    failCount: number;
    successPlans: Array<{ id: string; planNo: string }>;
    failedPlans: Array<{ id: string; planNo?: string; reason?: string }>;
    opinion?: string;
    rejectReason?: string;
  };
}

export interface PlanListResponse {
  list: TreatmentPlan[];
  total: number;
  stats: PlanStats;
}

export interface PlanStats {
  total: number;
  draft: number;
  pendingVerification: number;
  verificationRejected: number;
  pendingReview: number;
  reviewRejected: number;
  archived: number;
  normal: number;
  warning: number;
  overdue: number;
}

export interface PlanDetailResponse {
  plan: TreatmentPlan;
  auditLogs: AuditLog[];
  canEdit: boolean;
  availableActions: string[];
}

export const statusLabels: Record<TreatmentPlanStatus, string> = {
  [TreatmentPlanStatus.DRAFT]: '草稿',
  [TreatmentPlanStatus.PENDING_VERIFICATION]: '待核验',
  [TreatmentPlanStatus.VERIFICATION_REJECTED]: '核验退回',
  [TreatmentPlanStatus.PENDING_REVIEW]: '待复核',
  [TreatmentPlanStatus.REVIEW_REJECTED]: '复核退回',
  [TreatmentPlanStatus.ARCHIVED]: '已归档',
};

export const urgencyLabels: Record<UrgencyLevel, string> = {
  [UrgencyLevel.NORMAL]: '正常',
  [UrgencyLevel.WARNING]: '临期',
  [UrgencyLevel.OVERDUE]: '逾期',
};

export const roleLabels: Record<UserRole, string> = {
  [UserRole.RECEPTIONIST]: '前台顾问',
  [UserRole.DENTIST]: '口腔医生',
  [UserRole.DIRECTOR]: '门店院长',
};
