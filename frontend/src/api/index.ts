import type {
  User,
  CrossBorderOrder,
  AuditLog,
  BatchResult,
  Statistics,
  Material,
} from '../types';

const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data as T;
}

export async function login(username: string): Promise<{ token: string; user: User }> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}

export async function getCurrentUser(): Promise<User> {
  return request('/auth/me', { method: 'GET' });
}

export async function getOrders(params?: { status?: string; overdue?: string }): Promise<CrossBorderOrder[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.overdue) searchParams.set('overdue', params.overdue);
  
  const query = searchParams.toString();
  return request(`/orders/${query ? `?${query}` : ''}`, { method: 'GET' });
}

export async function getOrder(id: string): Promise<CrossBorderOrder> {
  return request(`/orders/${id}`, { method: 'GET' });
}

export async function createOrder(data: {
  productName: string;
  productSku: string;
  quantity: number;
  amount: number;
  currency: string;
  platform: string;
  buyerCountry: string;
  materials: { name: string; type: string; uploaded: boolean; required: boolean }[];
  deadlineHours: number;
  remark: string;
}): Promise<CrossBorderOrder> {
  return request('/orders/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function submitOrder(id: string, version: number): Promise<{ order: CrossBorderOrder; warning?: string }> {
  return request(`/orders/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
}

export async function updateMaterials(id: string, materials: Material[], version: number): Promise<CrossBorderOrder> {
  return request(`/orders/${id}/materials`, {
    method: 'PUT',
    body: JSON.stringify({ materials, version }),
  });
}

export async function supervisorProcessOrder(
  id: string,
  opinion: string,
  pass: boolean,
  version: number
): Promise<CrossBorderOrder> {
  return request(`/orders/${id}/supervisor-process`, {
    method: 'POST',
    body: JSON.stringify({ opinion, pass, version }),
  });
}

export async function reviewerProcessOrder(
  id: string,
  opinion: string,
  pass: boolean,
  version: number
): Promise<CrossBorderOrder> {
  return request(`/orders/${id}/reviewer-process`, {
    method: 'POST',
    body: JSON.stringify({ opinion, pass, version }),
  });
}

export async function batchSubmit(orderIds: string[], versions: number[]): Promise<BatchResult> {
  return request('/batch/submit', {
    method: 'POST',
    body: JSON.stringify({ orderIds, versions }),
  });
}

export async function batchSupervisorProcess(
  orderIds: string[],
  opinion: string,
  pass: boolean,
  versions: number[]
): Promise<BatchResult> {
  return request('/batch/supervisor-process', {
    method: 'POST',
    body: JSON.stringify({ orderIds, opinion, pass, versions }),
  });
}

export async function batchReviewerProcess(
  orderIds: string[],
  opinion: string,
  pass: boolean,
  versions: number[]
): Promise<BatchResult> {
  return request('/batch/reviewer-process', {
    method: 'POST',
    body: JSON.stringify({ orderIds, opinion, pass, versions }),
  });
}

export async function getAuditLogs(orderId: string): Promise<AuditLog[]> {
  return request(`/audit/${orderId}`, { method: 'GET' });
}

export async function getStatistics(): Promise<Statistics> {
  return request('/stats/', { method: 'GET' });
}
