export enum ReleaseStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  REVIEW_APPROVED = 'review_approved',
  REVIEW_REJECTED = 'review_rejected',
  PENDING_RECHECK = 'pending_recheck',
  RECHECK_APPROVED = 'recheck_approved',
  RECHECK_REJECTED = 'recheck_rejected',
  PUBLISHED = 'published',
  ROLLED_BACK = 'rolled_back',
  REVIEWED_POST_LAUNCH = 'reviewed_post_launch',
  ARCHIVED = 'archived'
}

export const StatusLabels: Record<ReleaseStatus, string> = {
  [ReleaseStatus.DRAFT]: '草稿',
  [ReleaseStatus.PENDING_REVIEW]: '待审核',
  [ReleaseStatus.REVIEW_APPROVED]: '审核通过',
  [ReleaseStatus.REVIEW_REJECTED]: '审核驳回',
  [ReleaseStatus.PENDING_RECHECK]: '待复核',
  [ReleaseStatus.RECHECK_APPROVED]: '复核通过',
  [ReleaseStatus.RECHECK_REJECTED]: '复核驳回',
  [ReleaseStatus.PUBLISHED]: '已发布',
  [ReleaseStatus.ROLLED_BACK]: '已回滚',
  [ReleaseStatus.REVIEWED_POST_LAUNCH]: '已复盘',
  [ReleaseStatus.ARCHIVED]: '已归档'
};

export interface ReleaseApplication {
  id: number;
  title: string;
  project_name: string;
  version: string;
  description: string;
  release_content: string;
  impact_scope: string;
  planned_release_time: string;
  status: ReleaseStatus;
  creator_id: number;
  reviewer_id: number | null;
  rechecker_id: number | null;
  review_comment: string;
  recheck_comment: string;
  created_at: string;
  updated_at: string;
  creator?: any;
  reviewer?: any;
  rechecker?: any;
}

export interface ReleaseListResponse {
  total: number;
  items: ReleaseApplication[];
}

export interface RollbackPlan {
  id: number;
  release_application_id: number;
  trigger_condition: string;
  rollback_steps: string;
  rollback_person: string;
  expected_duration: string;
  is_approved: boolean;
  approved_by: number | null;
  approved_at: string;
  created_at: string;
  updated_at: string;
}

export interface PostLaunchReview {
  id: number;
  release_application_id: number;
  review_content: string;
  issues_found: string;
  improvement_measures: string;
  release_result: string;
  reviewer_id: number | null;
  reviewed_at: string;
  created_at: string;
  updated_at: string;
}

export enum Shift {
  DAY = 'day',
  NIGHT = 'night'
}

export const ShiftLabels: Record<Shift, string> = {
  [Shift.DAY]: '白班',
  [Shift.NIGHT]: '夜班'
};

export interface ShiftHandover {
  id: number;
  release_application_id: number;
  from_user_id: number;
  to_user_id: number;
  shift: Shift;
  handover_content: string;
  is_confirmed: boolean;
  confirmed_at: string;
  created_at: string;
  from_user?: any;
  to_user?: any;
}

export interface OperationLog {
  id: number;
  release_application_id: number;
  operator_id: number;
  operation_type: string;
  operation_detail: string;
  old_status: string;
  new_status: string;
  created_at: string;
  operator?: any;
}

export interface Statistics {
  total: number;
  draft: number;
  pending_review: number;
  review_approved: number;
  review_rejected: number;
  pending_recheck: number;
  recheck_approved: number;
  recheck_rejected: number;
  published: number;
  rolled_back: number;
  reviewed_post_launch: number;
  archived: number;
  by_project: Record<string, number>;
  by_creator: Record<string, number>;
}

export interface BatchOperationResult {
  success: number[];
  failed: number[];
  messages: Record<string, string>;
}
