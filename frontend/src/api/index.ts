import type {
  User,
  InventoryAdjustOrder,
  OrderDetailResponse,
  OrderListResult,
  ApiResponse,
  RoleInfo,
  OrderStatus,
  SupplementType,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8003/api';

let currentUser: User | null = null;

export function setCurrentUser(user: User | null) {
  currentUser = user;
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  } else {
    localStorage.removeItem('currentUser');
  }
}

export function getCurrentUser(): User | null {
  if (!currentUser) {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      currentUser = JSON.parse(stored);
    }
  }
  return currentUser;
}

function getHeaders(): Record<string, string> {
  const user = getCurrentUser();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (user) {
    headers['X-User-ID'] = String(user.id);
    headers['X-User-Role'] = user.role;
    headers['X-User-Name'] = user.real_name;
    headers['X-Username'] = user.username;
  }
  return headers;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await response.json();
  return data;
}

export async function login(username: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function getUsers(): Promise<ApiResponse<User[]>> {
  return request('/users', { method: 'GET' });
}

export async function getRoleInfo(): Promise<ApiResponse<RoleInfo>> {
  return request('/role-info', { method: 'GET' });
}

export async function getStatistics(): Promise<ApiResponse<any>> {
  return request('/statistics', { method: 'GET' });
}

export interface OrderQuery {
  status?: OrderStatus[];
  warehouse?: string;
  keyword?: string;
  page?: number;
  page_size?: number;
}

export async function getOrderList(query: OrderQuery = {}): Promise<ApiResponse<OrderListResult>> {
  const params = new URLSearchParams();
  if (query.status && query.status.length > 0) {
    query.status.forEach((s) => params.append('status[]', s));
  }
  if (query.warehouse) params.append('warehouse', query.warehouse);
  if (query.keyword) params.append('keyword', query.keyword);
  if (query.page) params.append('page', String(query.page));
  if (query.page_size) params.append('page_size', String(query.page_size));

  const queryString = params.toString();
  return request(`/orders${queryString ? '?' + queryString : ''}`, { method: 'GET' });
}

export async function getOrderDetail(id: number): Promise<ApiResponse<OrderDetailResponse>> {
  return request(`/orders/${id}`, { method: 'GET' });
}

export async function submitOrder(orderId: number, version: number): Promise<ApiResponse<InventoryAdjustOrder>> {
  return request('/orders/submit', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, version }),
  });
}

export async function resubmitOrder(orderId: number, version: number): Promise<ApiResponse<InventoryAdjustOrder>> {
  return request('/orders/resubmit', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, version }),
  });
}

export async function verifyOrder(orderId: number, version: number, pass: boolean, opinion: string): Promise<ApiResponse<InventoryAdjustOrder>> {
  return request('/orders/verify', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, version, pass, opinion }),
  });
}

export async function reviewOrder(orderId: number, version: number, pass: boolean, opinion: string): Promise<ApiResponse<InventoryAdjustOrder>> {
  return request('/orders/review', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, version, pass, opinion }),
  });
}

export async function archiveOrder(orderId: number, version: number): Promise<ApiResponse<InventoryAdjustOrder>> {
  return request('/orders/archive', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, version }),
  });
}

export interface SupplementRequest {
  order_id: number;
  type: SupplementType;
  content: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  reason: string;
}

export async function addSupplement(req: SupplementRequest): Promise<ApiResponse<any>> {
  return request('/orders/supplement', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export interface AddEvidenceRequest {
  order_id: number;
  type: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  remark?: string;
}

export async function addEvidence(req: AddEvidenceRequest): Promise<ApiResponse<any>> {
  return request('/orders/evidence', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function batchSubmit(orderIds: number[]): Promise<ApiResponse<any>> {
  return request('/orders/batch-submit', {
    method: 'POST',
    body: JSON.stringify({ order_ids: orderIds }),
  });
}
