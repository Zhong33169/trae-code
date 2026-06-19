export type UserRole = "registrar" | "reviewer" | "archiver";

export type OrderStatus =
  | "draft"
  | "submitted"
  | "returned_to_registrar"
  | "reviewed"
  | "returned_to_reviewer"
  | "archived";

export type EvidenceType = "registration" | "verification" | "archive";

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  display_name: string;
}

export interface Order {
  id: string;
  order_no: string;
  dish_name: string;
  dish_category: string;
  price: number;
  description: string;
  status: OrderStatus;
  version: number;
  created_by: string;
  current_handler: string;
  created_at: string;
  updated_at: string;
}

export interface Evidence {
  id: string;
  order_id: string;
  type: EvidenceType;
  file_name: string;
  description: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface OrderActionLog {
  id: string;
  order_id: string;
  action: string;
  operator: string;
  operator_role: UserRole;
  operator_name?: string;
  comment: string;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export type ActionName =
  | "create"
  | "submit"
  | "review"
  | "review_return"
  | "archive"
  | "archive_return"
  | "amend";

export const ACTION_ROLE_MAP: Record<ActionName, UserRole> = {
  create: "registrar",
  submit: "registrar",
  amend: "registrar",
  review: "reviewer",
  review_return: "reviewer",
  archive: "archiver",
  archive_return: "archiver",
};

export const ACTION_STATUS_MAP: Record<ActionName, OrderStatus[]> = {
  create: [],
  submit: ["draft", "returned_to_registrar"],
  amend: ["returned_to_registrar"],
  review: ["submitted"],
  review_return: ["submitted"],
  archive: ["reviewed"],
  archive_return: ["reviewed"],
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "草稿",
  submitted: "已提交",
  returned_to_registrar: "退回补正",
  reviewed: "审核通过",
  returned_to_reviewer: "退回审核",
  archived: "已归档",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  registrar: "登记员",
  reviewer: "审核主管",
  archiver: "复核负责人",
};

export const ERROR_CODES = {
  WRONG_ROLE: { code: "WRONG_ROLE", status: 403, message: "当前角色无权执行此操作" },
  WRONG_STATUS: { code: "WRONG_STATUS", status: 409, message: "单据状态不允许此操作" },
  VERSION_CONFLICT: { code: "VERSION_CONFLICT", status: 409, message: "版本号冲突，数据已被他人修改" },
  MISSING_EVIDENCE: { code: "MISSING_EVIDENCE", status: 422, message: "缺少必要证据" },
  DUPLICATE_SUBMISSION: { code: "DUPLICATE_SUBMISSION", status: 409, message: "重复提交" },
  ALREADY_PROCESSED: { code: "ALREADY_PROCESSED", status: 409, message: "单据已被处理" },
  NOT_FOUND: { code: "NOT_FOUND", status: 404, message: "单据不存在" },
  UNAUTHORIZED: { code: "UNAUTHORIZED", status: 401, message: "未登录" },
  FORBIDDEN: { code: "FORBIDDEN", status: 403, message: "无权限" },
};
