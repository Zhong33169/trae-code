let API_BASE_URL = "http://localhost:8008";

export function setApiBaseUrl(url: string) {
  API_BASE_URL = url;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
  success?: boolean;
  message?: string;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      data.error || `HTTP ${response.status}`,
      data.code || "UNKNOWN_ERROR",
      response.status
    );
  }

  return data as T;
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "ApiError";
  }
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: "registrar" | "supervisor" | "reviewer";
}

export interface CreativeDemand {
  id: string;
  code: string;
  title: string;
  client_name: string;
  status: DemandStatus;
  current_handler_role: string;
  current_handler_id: string | null;
  brief_materials: string | null;
  brief_deadline: string | null;
  brief_opinion: string | null;
  schedule_materials: string | null;
  schedule_deadline: string | null;
  schedule_opinion: string | null;
  confirmation_materials: string | null;
  confirmation_deadline: string | null;
  confirmation_opinion: string | null;
  attachments: string | null;
  remarks: string | null;
  processing_result: string | null;
  return_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export type DemandStatus = 
  | "pending_registrar" 
  | "pending_supervisor" 
  | "pending_reviewer" 
  | "completed" 
  | "rejected";

export interface AuditLog {
  id: string;
  creative_demand_id: string | null;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface ScanResponse {
  success: boolean;
  creative_demand: CreativeDemand | null;
  error_code: string | null;
  error_message: string | null;
  is_current_handler: boolean;
  current_handler_role: string | null;
}

export interface Statistics {
  total: number;
  pending_registrar: number;
  pending_supervisor: number;
  pending_reviewer: number;
  completed: number;
  rejected: number;
  my_tasks: number;
}

export const statusLabels: Record<DemandStatus, string> = {
  pending_registrar: "待登记员处理",
  pending_supervisor: "待主管审核",
  pending_reviewer: "待复核归档",
  completed: "已完成",
  rejected: "已退回",
};

export const statusColors: Record<DemandStatus, string> = {
  pending_registrar: "bg-yellow-100 text-yellow-800",
  pending_supervisor: "bg-blue-100 text-blue-800",
  pending_reviewer: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export const roleLabels: Record<string, string> = {
  registrar: "创意需求登记员",
  supervisor: "创意需求审核主管",
  reviewer: "广告代理公司复核负责人",
};

export const getNextStatus = (
  current: DemandStatus,
  action: "approve" | "reject" | "return"
): DemandStatus | null => {
  const transitions: Record<DemandStatus, Record<string, DemandStatus>> = {
    pending_registrar: { approve: "pending_supervisor" },
    pending_supervisor: { 
      approve: "pending_reviewer", 
      reject: "rejected",
      return: "pending_registrar" 
    },
    pending_reviewer: { 
      approve: "completed", 
      reject: "rejected",
      return: "pending_supervisor" 
    },
    completed: {},
    rejected: {},
  };

  return transitions[current]?.[action] || null;
};

export const getAvailableActions = (
  status: DemandStatus,
  userRole: string
): Array<{ key: string; label: string; target: DemandStatus; variant: string }> => {
  const actions: Array<{ key: string; label: string; target: DemandStatus; variant: string }> = [];

  if (status === "pending_registrar" && userRole === "registrar") {
    actions.push({ key: "submit", label: "提交审核", target: "pending_supervisor", variant: "primary" });
  }
  if (status === "pending_supervisor" && userRole === "supervisor") {
    actions.push({ key: "approve", label: "审核通过", target: "pending_reviewer", variant: "primary" });
    actions.push({ key: "return", label: "退回补正", target: "pending_registrar", variant: "warning" });
    actions.push({ key: "reject", label: "拒绝", target: "rejected", variant: "danger" });
  }
  if (status === "pending_reviewer" && userRole === "reviewer") {
    actions.push({ key: "approve", label: "复核通过", target: "completed", variant: "primary" });
    actions.push({ key: "return", label: "退回补正", target: "pending_supervisor", variant: "warning" });
    actions.push({ key: "reject", label: "拒绝归档", target: "rejected", variant: "danger" });
  }

  return actions;
};
