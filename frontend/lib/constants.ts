export const API_BASE_URL = Deno.env.get("API_BASE_URL") || "http://localhost:8005/api";

export const ROLES = {
  REGISTER: "REGISTER",
  AUDITOR: "AUDITOR",
  REVIEWER: "REVIEWER",
};

export const ROLE_NAMES = {
  [ROLES.REGISTER]: "签约服务登记员",
  [ROLES.AUDITOR]: "签约服务审核主管",
  [ROLES.REVIEWER]: "社区卫生服务中心复核负责人",
};

export const STAGES = {
  SIGN: "SIGN",
  PLAN: "PLAN",
  PERFORM: "PERFORM",
};

export const STAGE_NAMES = {
  [STAGES.SIGN]: "家庭医生签约",
  [STAGES.PLAN]: "服务计划",
  [STAGES.PERFORM]: "履约确认",
};

export const STAGE_ORDER = [STAGES.SIGN, STAGES.PLAN, STAGES.PERFORM];

export const STATUSES = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  NEEDS_CORRECTION: "NEEDS_CORRECTION",
  OVERDUE: "OVERDUE",
  ARCHIVED: "ARCHIVED",
  STATUS_CONFLICT: "STATUS_CONFLICT",
};

export const STATUS_NAMES = {
  [STATUSES.DRAFT]: "草稿",
  [STATUSES.PENDING]: "待办理",
  [STATUSES.APPROVED]: "审核通过",
  [STATUSES.REJECTED]: "不予通过",
  [STATUSES.NEEDS_CORRECTION]: "退回补正",
  [STATUSES.OVERDUE]: "逾期",
  [STATUSES.ARCHIVED]: "已归档",
  [STATUSES.STATUS_CONFLICT]: "状态冲突",
};

export const STATUS_COLORS = {
  [STATUSES.DRAFT]: "#6b7280",
  [STATUSES.PENDING]: "#f59e0b",
  [STATUSES.APPROVED]: "#16a34a",
  [STATUSES.REJECTED]: "#dc2626",
  [STATUSES.NEEDS_CORRECTION]: "#f97316",
  [STATUSES.OVERDUE]: "#dc2626",
  [STATUSES.ARCHIVED]: "#6b7280",
  [STATUSES.STATUS_CONFLICT]: "#7c3aed",
};

export const RISK_LEVELS = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

export const RISK_NAMES = {
  [RISK_LEVELS.HIGH]: "高风险",
  [RISK_LEVELS.MEDIUM]: "中风险",
  [RISK_LEVELS.LOW]: "低风险",
};

export const RISK_COLORS = {
  [RISK_LEVELS.HIGH]: "#dc2626",
  [RISK_LEVELS.MEDIUM]: "#f59e0b",
  [RISK_LEVELS.LOW]: "#16a34a",
};

export const ACTION_NAMES = {
  CREATE: "创建",
  SUBMIT: "提交",
  APPROVE: "审核通过",
  REJECT: "不予通过",
  RETURN_CORRECTION: "退回补正",
  CORRECT: "补正提交",
  ARCHIVE: "归档",
  ADD_EVIDENCE: "添加证据",
  REMOVE_EVIDENCE: "移除证据",
  MARK_OVERDUE: "标记逾期",
};

export const USERS = [
  { id: 1, username: "zhangsan", name: "张三", role: ROLES.REGISTER },
  { id: 2, username: "lisi", name: "李四", role: ROLES.AUDITOR },
  { id: 3, username: "wangwu", name: "王五", role: ROLES.REVIEWER },
];

export const REQUIRED_EVIDENCES_BY_STAGE = {
  [STAGES.SIGN]: ["签约协议书", "身份证复印件"],
  [STAGES.PLAN]: ["服务计划书", "健康评估报告"],
  [STAGES.PERFORM]: ["履约记录表", "服务确认单"],
};

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function getDaysRemaining(deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  const now = new Date().getTime();
  const dl = new Date(deadline).getTime();
  return Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
}
