import type {
  User,
  LoginResponse,
  ReplenishmentApplication,
  ApplicationVersion,
  Store,
  BatchReviewResponse,
  ApiError,
} from '../types';

const BACKEND_PORT = import.meta.env.BACKEND_PORT || '8000';
const API_BASE = `http://localhost:${BACKEND_PORT}/api`;

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

function setAuthToken(token: string) {
  localStorage.setItem('auth_token', token);
}

function clearAuthToken() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('current_user');
}

export function getCurrentUser(): User | null {
  const userStr = localStorage.getItem('current_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User, token: string) {
  localStorage.setItem('current_user', JSON.stringify(user));
  setAuthToken(token);
}

export function logout() {
  clearAuthToken();
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: ApiError | null = null;
    try {
      errorData = await response.json();
    } catch {
      // ignore parse error
    }
    throw new Error(errorData?.details || errorData?.error || `请求失败: ${response.status}`);
  }

  return response.json();
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function getApplications(status?: string, storeId?: number): Promise<ReplenishmentApplication[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (storeId) params.set('store_id', String(storeId));
  const query = params.toString() ? `?${params.toString()}` : '';
  return request<ReplenishmentApplication[]>(`/applications${query}`);
}

export async function getApplication(id: number): Promise<ReplenishmentApplication> {
  return request<ReplenishmentApplication>(`/applications/${id}`);
}

export async function getApplicationHistory(id: number): Promise<ApplicationVersion[]> {
  return request<ApplicationVersion[]>(`/applications/${id}/history`);
}

export async function createApplication(data: {
  store_id: number;
  items: { sku: string; name: string; quantity: number; unit: string }[];
  evidence_store_replenishment?: string | null;
  evidence_delivery_confirmation?: string | null;
  evidence_registration?: string | null;
  remarks?: string | null;
}): Promise<ReplenishmentApplication> {
  return request<ReplenishmentApplication>('/applications', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateApplication(id: number, data: {
  current_version: number;
  items?: { sku: string; name: string; quantity: number; unit: string }[];
  evidence_store_replenishment?: string | null;
  evidence_delivery_confirmation?: string | null;
  evidence_registration?: string | null;
  remarks?: string | null;
}): Promise<ReplenishmentApplication> {
  return request<ReplenishmentApplication>(`/applications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function submitApplication(id: number): Promise<ReplenishmentApplication> {
  return request<ReplenishmentApplication>(`/applications/${id}/submit`, {
    method: 'POST',
  });
}

export async function reviewApplication(id: number, data: {
  current_version: number;
  approved: boolean;
  remarks?: string | null;
}): Promise<ReplenishmentApplication> {
  return request<ReplenishmentApplication>(`/applications/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function finalReviewApplication(id: number, data: {
  current_version: number;
  approved: boolean;
  remarks?: string | null;
}): Promise<ReplenishmentApplication> {
  return request<ReplenishmentApplication>(`/applications/${id}/final-review`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function batchReview(data: {
  application_ids: number[];
  approved: boolean;
  remarks?: string | null;
}): Promise<BatchReviewResponse> {
  return request<BatchReviewResponse>('/applications/batch-review', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getStores(): Promise<Store[]> {
  return request<Store[]>('/stores');
}
