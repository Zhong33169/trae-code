const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || '';
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
  }
}

export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
  }
}

export function getCurrentUser(): any {
  if (typeof window === 'undefined') return null;
  const s = localStorage.getItem('current_user');
  return s ? JSON.parse(s) : null;
}

export function setCurrentUser(user: any) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('current_user', JSON.stringify(user));
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data: T; error?: string }> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });
    const text = await res.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}

    if (!res.ok) {
      const msg = data?.error || `请求失败 (HTTP ${res.status})`;
      if (res.status === 401) {
        clearAuthToken();
      }
      return { ok: false, data, error: msg };
    }
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, data: {} as T, error: e.message || '网络错误' };
  }
}

export function formatDateTime(s?: string | null): string {
  if (!s) return '-';
  try {
    const d = new Date(s);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return s;
  }
}

export function formatMoney(n?: number): string {
  if (n == null || isNaN(n)) return '¥0.00';
  return `¥${n.toFixed(2)}`;
}
