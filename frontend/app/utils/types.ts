export type Status = "pending_review" | "pending_recheck" | "returned" | "rejected" | "archived";

export type AnomalyType = "normal" | "missing_evidence" | "overdue" | "returned" | "status_conflict";

export type Role = "registrar" | "reviewer" | "rechecker";

export type Action = "submit" | "approve" | "reject" | "return" | "resubmit" | "archive" | "validation_failed";

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Appeal {
  id: string;
  appeal_no: string;
  visitor_name: string;
  visitor_phone: string;
  appointment_date: string;
  anomaly_type: AnomalyType;
  description: string;
  evidence_urls: string[];
  status: Status;
  current_handler_id: string;
  current_handler_name: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OperationRecord {
  id: string;
  appeal_id: string;
  operator_id: string;
  operator_name: string;
  operator_role: Role;
  action: Action;
  opinion: string;
  from_status: Status | "";
  to_status: Status | "";
  created_at: string;
}

export interface Stats {
  total: number;
  pending_review: number;
  pending_recheck: number;
  returned: number;
  rejected: number;
  archived: number;
}

export interface AppealCreate {
  visitor_name: string;
  visitor_phone: string;
  appointment_date: string;
  anomaly_type: AnomalyType;
  description: string;
  evidence_urls: string[];
  operator_id: string;
}

export interface ProcessRequest {
  action: "approve" | "reject" | "return";
  opinion: string;
  operator_id: string;
  version: number;
}

export interface ResubmitRequest {
  opinion: string;
  evidence_urls: string[];
  operator_id: string;
  version: number;
}

export const STATUS_LABELS: Record<Status | "", string> = {
  pending_review: "待审核",
  pending_recheck: "待复核",
  returned: "退回补正",
  rejected: "已驳回",
  archived: "已归档",
  "": "-",
};

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  normal: "正常通过",
  missing_evidence: "缺证据",
  overdue: "逾期",
  returned: "退回补正",
  status_conflict: "状态冲突",
};

export const ACTION_LABELS: Record<Action, string> = {
  submit: "提交",
  approve: "通过",
  reject: "驳回",
  return: "退回补正",
  resubmit: "再次提交",
  archive: "归档",
  validation_failed: "校验失败",
};

export const ROLE_LABELS: Record<Role, string> = {
  registrar: "登记员",
  reviewer: "审核主管",
  rechecker: "复核负责人",
};

export const STATUS_COLORS: Record<Status, string> = {
  pending_review: "bg-blue-100 text-blue-800",
  pending_recheck: "bg-purple-100 text-purple-800",
  returned: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  archived: "bg-gray-100 text-gray-800",
};

export const STATUS_BAR_COLORS: Record<Status, string> = {
  pending_review: "bg-blue-500",
  pending_recheck: "bg-purple-500",
  returned: "bg-amber-500",
  rejected: "bg-red-500",
  archived: "bg-gray-500",
};
