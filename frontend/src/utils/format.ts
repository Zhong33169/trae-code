// ============================================================
// Formatting utilities - matches backend enum string values
// ============================================================

import type {
  InspectionStatus,
  RiskLevel,
  InspectionResult,
  OperationType,
  UserRole,
} from "~/types";

// ---------- Date ----------
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("zh-CN", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// ---------- Inspection Status ----------
export const statusLabels: Record<InspectionStatus, string> = {
  draft: "草稿",
  pending_handling: "待办理",
  in_progress: "办理中",
  pending_review: "待复核",
  returned: "已退回",
  archived: "已归档",
};

export const statusColors: Record<InspectionStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_handling: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  pending_review: "bg-purple-100 text-purple-800",
  returned: "bg-orange-100 text-orange-800",
  archived: "bg-green-100 text-green-800",
};

export const statusDotColors: Record<InspectionStatus, string> = {
  draft: "bg-gray-400",
  pending_handling: "bg-yellow-500",
  in_progress: "bg-blue-500",
  pending_review: "bg-purple-500",
  returned: "bg-orange-500",
  archived: "bg-green-500",
};

// ---------- Risk Level ----------
export const riskLabels: Record<RiskLevel, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

export const riskColors: Record<RiskLevel, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

export const riskRowBg: Record<RiskLevel, string> = {
  low: "",
  medium: "bg-yellow-50/40",
  high: "bg-red-50/60",
};

export const riskBorderColors: Record<RiskLevel, string> = {
  low: "border-green-400",
  medium: "border-yellow-400",
  high: "border-red-500",
};

// ---------- Inspection Result ----------
export const resultLabels: Record<InspectionResult, string> = {
  normal: "正常",
  abnormal: "异常",
  missing_evidence: "缺证据",
  overdue: "逾期",
  returned: "退回补正",
  status_conflict: "状态冲突",
};

export const resultColors: Record<InspectionResult, string> = {
  normal: "text-green-600",
  abnormal: "text-red-600",
  missing_evidence: "text-orange-600",
  overdue: "text-red-700",
  returned: "text-orange-700",
  status_conflict: "text-pink-600",
};

// ---------- Operation Type ----------
export const operationLabels: Record<OperationType, string> = {
  initiate: "发起巡检",
  assign: "分配办理人",
  handle: "办理",
  submit: "提交",
  review: "复核",
  return: "退回补正",
  archive: "复核归档",
  risk_upgrade: "风险升级",
  risk_downgrade: "风险降级",
  report_fault: "故障报修",
  confirm_recovery: "恢复确认",
};

export const operationColors: Record<OperationType, string> = {
  initiate: "bg-blue-50 text-blue-700",
  assign: "bg-indigo-50 text-indigo-700",
  handle: "bg-cyan-50 text-cyan-700",
  submit: "bg-teal-50 text-teal-700",
  review: "bg-purple-50 text-purple-700",
  return: "bg-orange-50 text-orange-700",
  archive: "bg-green-50 text-green-700",
  risk_upgrade: "bg-red-50 text-red-700",
  risk_downgrade: "bg-emerald-50 text-emerald-700",
  report_fault: "bg-rose-50 text-rose-700",
  confirm_recovery: "bg-emerald-50 text-emerald-700",
};

// ---------- User Role ----------
export const roleLabels: Record<UserRole, string> = {
  inspector: "巡检员",
  handler: "办理员",
  reviewer: "复核员",
};

export const roleColors: Record<UserRole, string> = {
  inspector: "bg-sky-100 text-sky-800",
  handler: "bg-indigo-100 text-indigo-800",
  reviewer: "bg-violet-100 text-violet-800",
};

// ---------- Check Items ----------
export interface CheckItemMeta {
  field: string;
  label: string;
  icon: string;
}

export const checkItems: CheckItemMeta[] = [
  { field: "appearance", label: "外观与完整性检查", icon: "🔍" },
  { field: "function", label: "功能运行检查", icon: "⚙️" },
  { field: "safety", label: "安全装置检查", icon: "🛡️" },
  { field: "maintenance", label: "维护记录检查", icon: "📋" },
];

// ---------- Helpers ----------
export function isActiveStatus(status: InspectionStatus): boolean {
  return status !== "archived";
}

export function canHandle(status: InspectionStatus): boolean {
  return (
    status === "pending_handling" ||
    status === "in_progress" ||
    status === "returned"
  );
}

export function canReview(status: InspectionStatus): boolean {
  return status === "pending_review";
}
