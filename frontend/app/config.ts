export const API_BASE_URL = process.env.VITE_API_BASE_URL || "http://localhost:8005";
export const APP_PORT = process.env.VITE_APP_PORT || "3005";

export const INSPECTION_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  pending_review: "待审核主管办理",
  reviewing: "审核主管办理中",
  review_rejected: "审核退回补正",
  pending_fault_report: "待故障上报",
  fault_reported: "已上报故障",
  pending_repair: "待修复",
  repair_completed: "修复完成待验收",
  pending_acceptance: "待修复验收",
  acceptance_rejected: "验收不合格",
  pending_final_review: "待复核归档",
  final_review_rejected: "复核退回",
  archived: "已归档",
  cancelled: "已取消",
};

export const INSPECTION_TYPE_LABELS: Record<string, string> = {
  routine: "常规巡检",
  special: "专项巡检",
  emergency: "紧急巡检",
};

export const ROLE_LABELS: Record<string, string> = {
  registrar: "设备巡检登记员",
  supervisor: "设备巡检审核主管",
  reviewer: "新能源汽车充电站复核负责人",
};

export const SCAN_RESULT_LABELS: Record<string, string> = {
  success: "核验成功",
  invalid_qr: "无效二维码",
  duplicate_scan: "重复扫码",
  user_mismatch: "扫码人不匹配",
  order_not_found: "巡检单不存在",
  invalid_status: "状态不允许扫码",
  pile_not_match: "充电桩不匹配",
  time_out: "扫码超时",
};

export const STATUS_COLORS: Record<string, string> = {
  draft: "#9ca3af",
  pending_review: "#3b82f6",
  reviewing: "#f59e0b",
  review_rejected: "#ef4444",
  pending_fault_report: "#f97316",
  fault_reported: "#ea580c",
  pending_repair: "#f97316",
  repair_completed: "#8b5cf6",
  pending_acceptance: "#8b5cf6",
  acceptance_rejected: "#dc2626",
  pending_final_review: "#0ea5e9",
  final_review_rejected: "#ef4444",
  archived: "#10b981",
  cancelled: "#6b7280",
};

export interface ActionConfig {
  label: string;
  color: string;
  target_status?: string;
  icon: string;
  need_opinion?: boolean;
  need_signature?: boolean;
  is_form?: boolean;
}

export const ACTION_CONFIGS: Record<string, ActionConfig> = {
  view: {
    label: "查看",
    color: "#6b7280",
    icon: "👁️",
  },
  update: {
    label: "编辑",
    color: "#3b82f6",
    icon: "✏️",
  },
  scan_qr: {
    label: "扫码核验",
    color: "#10b981",
    icon: "📱",
    is_form: true,
  },
  submit: {
    label: "提交审核",
    color: "#3b82f6",
    target_status: "pending_review",
    icon: "📤",
    need_opinion: false,
    need_signature: true,
  },
  approve: {
    label: "审核通过",
    color: "#10b981",
    target_status: "pending_final_review",
    icon: "✅",
    need_opinion: true,
    need_signature: true,
  },
  reject: {
    label: "审核退回",
    color: "#ef4444",
    target_status: "review_rejected",
    icon: "❌",
    need_opinion: true,
    need_signature: true,
  },
  report_fault: {
    label: "故障上报",
    color: "#f97316",
    target_status: "pending_fault_report",
    icon: "⚠️",
    need_opinion: true,
    need_signature: true,
  },
  submit_fault_report: {
    label: "提交故障报告",
    color: "#f97316",
    target_status: "fault_reported",
    icon: "📋",
    is_form: true,
  },
  mark_repair_start: {
    label: "开始修复",
    color: "#8b5cf6",
    target_status: "pending_repair",
    icon: "🔧",
  },
  mark_repair_complete: {
    label: "修复完成",
    color: "#8b5cf6",
    target_status: "repair_completed",
    icon: "🔨",
  },
  submit_acceptance: {
    label: "提交验收",
    color: "#8b5cf6",
    target_status: "pending_acceptance",
    icon: "📝",
  },
  acceptance_pass: {
    label: "验收通过",
    color: "#10b981",
    target_status: "pending_final_review",
    icon: "✅",
    is_form: true,
  },
  acceptance_reject: {
    label: "验收驳回",
    color: "#ef4444",
    target_status: "acceptance_rejected",
    icon: "❌",
    is_form: true,
  },
  archive: {
    label: "复核归档",
    color: "#0ea5e9",
    target_status: "archived",
    icon: "📦",
    need_opinion: true,
    need_signature: true,
  },
  final_reject: {
    label: "复核退回",
    color: "#ef4444",
    target_status: "final_review_rejected",
    icon: "↩️",
    need_opinion: true,
    need_signature: true,
  },
};
