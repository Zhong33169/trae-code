import type {
  InspectionStatus,
  RiskLevel,
  InspectionResult,
  OperationType,
  UserRole,
} from "~/types";

export const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
};

export const statusLabels: Record<InspectionStatus, string> = {
  DRAFT: "草稿",
  PENDING_HANDLING: "待办理",
  IN_PROGRESS: "办理中",
  PENDING_REVIEW: "待复核",
  RETURNED: "已退回",
  ARCHIVED: "已归档",
};

export const statusColors: Record<InspectionStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING_HANDLING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  PENDING_REVIEW: "bg-purple-100 text-purple-800",
  RETURNED: "bg-orange-100 text-orange-800",
  ARCHIVED: "bg-green-100 text-green-800",
};

export const riskLabels: Record<RiskLevel, string> = {
  LOW: "低风险",
  MEDIUM: "中风险",
  HIGH: "高风险",
};

export const riskColors: Record<RiskLevel, string> = {
  LOW: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-red-100 text-red-800",
};

export const resultLabels: Record<InspectionResult, string> = {
  NORMAL: "正常",
  ABNORMAL: "异常",
  MISSING_EVIDENCE: "缺证据",
  OVERDUE: "逾期",
  STATUS_CONFLICT: "状态冲突",
};

export const operationLabels: Record<OperationType, string> = {
  INITIATE: "发起巡检",
  HANDLE: "办理",
  REVIEW: "复核归档",
  RETURN: "退回补正",
  RISK_CHANGE: "风险等级变更",
  FAULT_REPORT: "故障报修",
  RECOVERY_CONFIRM: "恢复确认",
  VALIDATION_FAILED: "验证失败",
};

export const roleLabels: Record<UserRole, string> = {
  inspector: "巡检员",
  handler: "办理员",
  reviewer: "复核员",
};

export const checkItemLabels: Record<string, string> = {
  check_basic_safety: "基础安全检查",
  check_running_condition: "运行状态检查",
  check_emergency_stop: "急停装置检查",
  check_maintenance_record: "维护记录检查",
  check_environment: "环境检查",
};
