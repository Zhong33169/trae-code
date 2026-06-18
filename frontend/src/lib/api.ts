const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  error_code: string | null;
  status?: string;
  version?: number;
  risk_level?: string;
  current_handler?: string;
  current_handler_name?: string;
  last_opinion?: string;
  last_result?: string;
  message?: string;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' }
  });
  const data: ApiResponse<T> = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `请求失败: ${res.status}`);
  }
  return data.data as T;
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data: ApiResponse<T> = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `请求失败: ${res.status}`);
  }
  return data.data as T;
}

export async function apiPostFull<T>(path: string, body: any): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data: ApiResponse<T> = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `请求失败: ${res.status}`);
  }
  return data;
}
