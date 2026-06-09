const API_BASE = import.meta.env.PUBLIC_API_BASE || 'http://localhost:8002/api';

let currentUserId = 'u001';
let currentUserRole = 'registrar';

export function setCurrentUser(userId: string, role: string) {
  currentUserId = userId;
  currentUserRole = role;
}

export function getCurrentUserId(): string {
  return currentUserId;
}

export function getCurrentUserRole(): string {
  return currentUserRole;
}

export interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-ID': currentUserId,
    'X-User-Role': currentUserRole,
    ...(options.headers || {}),
  };

  const config: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, config);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `请求失败: ${res.status}`);
  }

  return data as T;
}

export function getConsultations(status?: string) {
  const url = status ? `/consultations?status=${encodeURIComponent(status)}` : '/consultations';
  return apiRequest<{ data: any[]; total: number }>(url);
}

export function getConsultation(id: string) {
  return apiRequest<any>(`/consultations/${id}`);
}

export function getConsultationHistory(id: string) {
  return apiRequest<{ data: any[]; total: number }>(`/consultations/${id}/history`);
}

export function getStats() {
  return apiRequest<any>('/stats');
}

export function getCurrentUserInfo() {
  return apiRequest<any>('/users/me');
}

export function createConsultation(data: any) {
  return apiRequest<any>('/consultations', {
    method: 'POST',
    body: data,
  });
}

export function updateConsultation(id: string, data: any) {
  return apiRequest<any>(`/consultations/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export function submitConsultation(id: string, data: any) {
  return apiRequest<any>(`/consultations/${id}/submit`, {
    method: 'POST',
    body: data,
  });
}

export function reviewConsultation(id: string, data: any) {
  return apiRequest<any>(`/consultations/${id}/review`, {
    method: 'POST',
    body: data,
  });
}

export function correctConsultation(id: string, data: any) {
  return apiRequest<any>(`/consultations/${id}/correct`, {
    method: 'POST',
    body: data,
  });
}

export function finalReviewConsultation(id: string, data: any) {
  return apiRequest<any>(`/consultations/${id}/final-review`, {
    method: 'POST',
    body: data,
  });
}

export function archiveConsultation(id: string, data: any) {
  return apiRequest<any>(`/consultations/${id}/archive`, {
    method: 'POST',
    body: data,
  });
}

export function submitAppeal(id: string, data: any) {
  return apiRequest<any>(`/consultations/${id}/appeal`, {
    method: 'POST',
    body: data,
  });
}

export function acceptAppeal(id: string, data: any) {
  return apiRequest<any>(`/consultations/${id}/appeal/accept`, {
    method: 'POST',
    body: data,
  });
}

export function rejectAppeal(id: string, data: any) {
  return apiRequest<any>(`/consultations/${id}/appeal/reject`, {
    method: 'POST',
    body: data,
  });
}

export function getStatusDict() {
  return apiRequest<any[]>('/dict/statuses');
}

export function getRoleDict() {
  return apiRequest<any[]>('/dict/roles');
}

export function getUsers(role?: string) {
  const url = role ? `/users?role=${encodeURIComponent(role)}` : '/users';
  return apiRequest<{ data: any[]; total: number }>(url);
}
