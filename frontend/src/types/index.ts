export enum InvitationStatus {
  Draft = 'draft',
  PendingReview = 'pending_review',
  ReviewRejected = 'review_rejected',
  PendingFinal = 'pending_final',
  FinalRejected = 'final_rejected',
  Archived = 'archived',
}

export enum UrgencyLevel {
  Normal = 'normal',
  Urgent = 'urgent',
  Overdue = 'overdue',
}

export enum Role {
  Registrar = 'registrar',
  Reviewer = 'reviewer',
  FinalReviewer = 'final_reviewer',
}

export interface Material {
  id: string;
  invitationId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  category: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Invitation {
  id: string;
  title: string;
  mediaType: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  deadline: string;
  status: InvitationStatus;
  urgency: UrgencyLevel;
  creatorId: string;
  creatorName: string;
  reviewerId?: string;
  reviewerName?: string;
  finalReviewerId?: string;
  finalReviewerName?: string;
  reviewComment?: string;
  finalComment?: string;
  guestConfirmed: boolean;
  checkinCompleted: boolean;
  materialsComplete: boolean;
  version: number;
  materials?: Material[];
  auditLogs?: AuditLog[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  invitationId: string;
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  action: string;
  detail: string;
  beforeStatus?: string;
  afterStatus?: string;
  createdAt: string;
}

export interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byUrgency: Record<string, number>;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface InvitationListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  urgency?: string;
  keyword?: string;
  role?: string;
  operatorId?: string;
}

export interface AuditListParams {
  page?: number;
  pageSize?: number;
  invitationId?: string;
  operatorName?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}

export const STATUS_LABEL_MAP: Record<string, string> = {
  [InvitationStatus.Draft]: '草稿',
  [InvitationStatus.PendingReview]: '待审核',
  [InvitationStatus.ReviewRejected]: '审核退回',
  [InvitationStatus.PendingFinal]: '待复核',
  [InvitationStatus.FinalRejected]: '复核退回',
  [InvitationStatus.Archived]: '已归档',
};

export const STATUS_COLOR_MAP: Record<string, string> = {
  [InvitationStatus.Draft]: 'default',
  [InvitationStatus.PendingReview]: 'blue',
  [InvitationStatus.ReviewRejected]: 'red',
  [InvitationStatus.PendingFinal]: 'orange',
  [InvitationStatus.FinalRejected]: 'red',
  [InvitationStatus.Archived]: 'green',
};

export const ROLE_LABEL_MAP: Record<Role, string> = {
  [Role.Registrar]: '媒体邀约登记员',
  [Role.Reviewer]: '媒体邀约审核主管',
  [Role.FinalReviewer]: '公关传播团队复核负责人',
};
