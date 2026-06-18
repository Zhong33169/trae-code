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
