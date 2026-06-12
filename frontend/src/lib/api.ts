import { User, RepairOrder, Stats, OperationRecord } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8009/api';

export class ApiError extends Error {
  currentVersion?: number;
  currentStatus?: string;
  constructor(message: string, currentVersion?: number, currentStatus?: string) {
    super(message);
    this.currentVersion = currentVersion;
    this.currentStatus = currentStatus;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = (data as any).error || (data as any).detail || (data as any).message || `请求失败: ${res.status}`;
    throw new ApiError(msg, (data as any).current_version, (data as any).current_status);
  }
  return res.json();
}

export async function fetchUsers(): Promise<User[]> {
  return request<User[]>('/users');
}

export async function fetchStats(): Promise<Stats> {
  return request<Stats>('/stats');
}

export interface OrderListParams {
  status?: string;
  handler_role?: string;
  keyword?: string;
  offset?: number;
  limit?: number;
}

export interface OrderListResult {
  total: number;
  items: RepairOrder[];
  offset: number;
  limit: number;
}

export async function fetchOrders(params?: OrderListParams): Promise<OrderListResult> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.handler_role) searchParams.set('handler_role', params.handler_role);
  if (params?.keyword) searchParams.set('keyword', params.keyword);
  if (params?.offset !== undefined) searchParams.set('offset', String(params.offset));
  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();
  return request<OrderListResult>(`/orders${qs ? `?${qs}` : ''}`);
}

export async function fetchOrder(id: number): Promise<RepairOrder> {
  return request<RepairOrder>(`/orders/${id}`);
}

export interface CreateOrderData {
  title: string;
  description: string;
  enterprise_name: string;
  contact_person: string;
  contact_phone: string;
  repair_type: string;
  urgency: string;
  location: string;
  evidence_descriptions: string[];
  operator_id: number;
}

export async function createOrder(data: CreateOrderData): Promise<{ id: number; order_no: string }> {
  return request<{ id: number; order_no: string }>('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface UpdateOrderData {
  title?: string;
  description?: string;
  enterprise_name?: string;
  contact_person?: string;
  contact_phone?: string;
  repair_type?: string;
  urgency?: string;
  location?: string;
  evidence_descriptions?: string[];
  operator_id: number;
  version?: number;
  opinion?: string;
}

export async function updateOrder(id: number, data: UpdateOrderData): Promise<RepairOrder> {
  return request<RepairOrder>(`/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export interface ActionData {
  operator_id: number;
  opinion?: string;
  reason?: string;
  version?: number;
}

export async function submitOrder(id: number, data: ActionData): Promise<RepairOrder> {
  return request<RepairOrder>(`/orders/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function acceptReview(id: number, data: ActionData): Promise<RepairOrder> {
  return request<RepairOrder>(`/orders/${id}/accept_review`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface ReviewData extends ActionData {
  result: string;
}

export async function reviewOrder(id: number, data: ReviewData): Promise<RepairOrder> {
  return request<RepairOrder>(`/orders/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function acceptRecheck(id: number, data: ActionData): Promise<RepairOrder> {
  return request<RepairOrder>(`/orders/${id}/accept_recheck`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface RecheckData extends ActionData {
  result: string;
}

export async function recheckOrder(id: number, data: RecheckData): Promise<RepairOrder> {
  return request<RepairOrder>(`/orders/${id}/recheck`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
