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
  uploader_name?: string;
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

export interface OrderDetail extends Order {
  evidence: Evidence[];
  action_logs: OrderActionLog[];
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

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

export const STATUS_COLOR: Record<OrderStatus, string> = {
  draft: "bg-gray-200 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  returned_to_registrar: "bg-amber-100 text-amber-700",
  reviewed: "bg-green-100 text-green-700",
  returned_to_reviewer: "bg-orange-100 text-orange-700",
  archived: "bg-indigo-100 text-indigo-700",
};

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  registration: "登记证据",
  verification: "核验证据",
  archive: "归档证据",
};

export const EVIDENCE_TYPE_COLOR: Record<EvidenceType, string> = {
  registration: "bg-emerald-50 border-emerald-300",
  verification: "bg-blue-50 border-blue-300",
  archive: "bg-purple-50 border-purple-300",
};
