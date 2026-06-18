import type {
  BatchResultItem,
  OrderDetail,
  OrderListItem,
  OrderStatus,
  Role,
  Stats,
  Stage,
  StageStatus,
  User,
  WarningLevel,
} from "./types";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8004";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok || (body && typeof body === "object" && "code" in body && body.code !== 0)) {
    const msg = body?.error ?? `请求失败 (${res.status})`;
    const reason = body?.reason ?? "error";
    throw new ApiError(msg, reason, res.status);
  }
  return body.data as T;
}

export class ApiError extends Error {
  reason: string;
  status: number;
  constructor(message: string, reason: string, status: number) {
    super(message);
    this.reason = reason;
    this.status = status;
  }
}

export interface ListParams {
  role?: Role;
  status?: OrderStatus;
  stage?: Stage;
  warning?: WarningLevel;
}

export function fetchUsers(): Promise<User[]> {
  return apiFetch<User[]>("/api/users");
}

export function fetchOrders(params: ListParams = {}): Promise<OrderListItem[]> {
  const qs = new URLSearchParams();
  if (params.role) qs.set("role", params.role);
  if (params.status) qs.set("status", params.status);
  if (params.stage) qs.set("stage", params.stage);
  if (params.warning) qs.set("warning", params.warning);
  const query = qs.toString();
  return apiFetch<OrderListItem[]>(`/api/orders${query ? "?" + query : ""}`);
}

export function fetchOrderDetail(id: number): Promise<OrderDetail> {
  return apiFetch<OrderDetail>(`/api/orders/${id}`);
}

export function fetchStats(): Promise<Stats> {
  return apiFetch<Stats>("/api/stats");
}

export function fetchWarnings(): Promise<{
  near_due: OrderListItem[];
  overdue: OrderListItem[];
}> {
  return apiFetch("/api/warnings");
}

export interface StageActionBody {
  action: "submit" | "approve" | "reject";
  actorRole: Role;
  actorId: number;
  materials?: { name: string; required: boolean; provided: boolean }[];
  processingOpinion?: string;
  reviewComment?: string;
  version: number;
}

export function processStage(
  id: number,
  stage: Stage,
  body: StageActionBody,
): Promise<OrderDetail> {
  return apiFetch<OrderDetail>(`/api/orders/${id}/stages/${stage}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface BatchBody {
  items: { id: number; version: number }[];
  action: "approve" | "reject";
  actorRole: Role;
  actorId: number;
  reviewComment: string;
}

export function batchProcess(body: BatchBody): Promise<BatchResultItem[]> {
  return apiFetch<BatchResultItem[]>(`/api/orders/batch`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface CreateOrderBody {
  title: string;
  customerName: string;
  customerPhone: string;
  address: string;
  repairType: string;
  priority: string;
  slaHours: number;
  createdBy: number;
}

export function createOrder(body: CreateOrderBody): Promise<OrderDetail> {
  return apiFetch<OrderDetail>(`/api/orders`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export { API_BASE };
export type { OrderStatus, Stage, StageStatus, Role, User, OrderListItem, OrderDetail, Stats };
