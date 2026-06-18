export type Role = "window_staff" | "meter_supervisor" | "business_manager";
export type Stage = "registration" | "verification" | "archiving";
export type OrderStatus = "pending_review" | "approved" | "synced";
export type StageStatus = "pending" | "submitted" | "approved" | "rejected";
export type WarningLevel = "normal" | "notice" | "near_due" | "overdue";

export interface User {
  id: number;
  name: string;
  role: Role;
}

export interface Material {
  name: string;
  required: boolean;
  provided: boolean;
}

export interface WorkOrder {
  id: number;
  orderNo: string;
  title: string;
  customerName: string;
  customerPhone: string;
  address: string;
  repairType: string;
  priority: string;
  status: OrderStatus;
  currentStage: Stage;
  deadline: string;
  slaHours: number;
  createdBy: number;
  createdByName: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StageRecord {
  id: number;
  orderId: number;
  stage: Stage;
  handlerRole: Role;
  handlerId: number | null;
  handlerName: string;
  materials: Material[];
  processingOpinion: string;
  status: StageStatus;
  startedAt: string;
  timeLimitHours: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewerId: number | null;
  reviewComment: string;
}

export interface AuditLog {
  id: number;
  orderId: number;
  action: string;
  actorId: number | null;
  actorName: string;
  actorRole: Role;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  fromStage: Stage | null;
  toStage: Stage | null;
  detail: string;
  versionBefore: number | null;
  versionAfter: number | null;
  createdAt: string;
}

export interface WarningInfo {
  level: WarningLevel;
  deadline: string;
  remainSeconds: number;
  remainText: string;
}

export interface OrderDetail {
  order: WorkOrder;
  stages: StageRecord[];
  auditLogs: AuditLog[];
  warning: WarningInfo;
  currentStageRecord: StageRecord | null;
}

export interface OrderListItem extends WorkOrder {
  warning: WarningInfo;
  stageStatus: StageStatus;
  canAct: boolean;
  actionLabel: string;
}

export interface Stats {
  pendingReview: number;
  approved: number;
  synced: number;
  nearDue: number;
  overdue: number;
}

export interface BatchResultItem {
  id: number;
  orderNo: string;
  success: boolean;
  reason?: string;
  message?: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  window_staff: "窗口人员",
  meter_supervisor: "抄表主管",
  business_manager: "营业经理",
};

export const STAGE_LABELS: Record<Stage, string> = {
  registration: "抢修工单登记",
  verification: "过程核验",
  archiving: "复核归档",
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_review: "待审核",
  approved: "审核通过",
  synced: "已同步",
};

export const WARNING_LABELS: Record<WarningLevel, string> = {
  normal: "正常",
  notice: "提醒",
  near_due: "临期",
  overdue: "逾期",
};

export const STAGE_ROLE: Record<Stage, Role> = {
  registration: "window_staff",
  verification: "meter_supervisor",
  archiving: "business_manager",
};
