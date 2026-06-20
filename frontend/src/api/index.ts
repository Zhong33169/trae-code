const API_BASE = 'http://localhost:8005/api';

function getToken(): string | null {
  if (typeof document !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

export interface FetchOptions extends RequestInit {
  timeout?: number;
}

export async function apiFetch<T = any>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeout = 30000, headers, ...rest } = options;
  const token = getToken();

  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  };
  if (token) {
    finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: finalHeaders,
      signal: controller.signal,
      credentials: 'include',
    });
    clearTimeout(timeoutId);

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
      throw new Error('登录已过期，请重新登录');
    }

    const contentType = response.headers.get('content-type');
    let data: T;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = (await response.text()) as unknown as T;
    }

    if (!response.ok) {
      const errMsg = typeof data === 'object' && data !== null
        ? (data as any).message || (data as any).detail || `请求失败 ${response.status}`
        : `请求失败 ${response.status}`;
      throw new Error(errMsg);
    }

    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw err;
  }
}

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
  me: () => apiFetch('/auth/me'),
  logout: () =>
    apiFetch('/auth/logout', { method: 'POST' }),
};

export const bookingsApi = {
  list: (params: Record<string, any>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        sp.append(k, String(v));
      }
    });
    return apiFetch(`/bookings?${sp.toString()}`);
  },
  get: (id: number) => apiFetch(`/bookings/${id}`),
  create: (data: any) =>
    apiFetch('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  update: (id: number, data: any) =>
    apiFetch(`/bookings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  validate: (data: any) =>
    apiFetch('/bookings/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  submit: (id: number, data: any = {}) =>
    apiFetch(`/bookings/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  reviewPass: (id: number, data: any = {}) =>
    apiFetch(`/bookings/${id}/review-pass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  reviewReject: (id: number, data: any) =>
    apiFetch(`/bookings/${id}/review-reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  bookConfirm: (id: number, data: any = {}) =>
    apiFetch(`/bookings/${id}/book-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  bookFail: (id: number, data: any) =>
    apiFetch(`/bookings/${id}/book-fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  correct: (id: number, data: any = {}) =>
    apiFetch(`/bookings/${id}/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  resubmit: (id: number, data: any = {}) =>
    apiFetch(`/bookings/${id}/resubmit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  reviewArchive: (id: number, data: any = {}) =>
    apiFetch(`/bookings/${id}/review-archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  loadingArrange: (id: number, data: any = {}) =>
    apiFetch(`/bookings/${id}/loading/arrange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  loadingConfirm: (id: number, data: any = {}) =>
    apiFetch(`/bookings/${id}/loading/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  loadingFail: (id: number, data: any) =>
    apiFetch(`/bookings/${id}/loading/fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  blIssue: (id: number, data: any = {}) =>
    apiFetch(`/bookings/${id}/bl/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  blCollect: (id: number, data: any = {}) =>
    apiFetch(`/bookings/${id}/bl/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  offlineFill: (id: number, data: any) =>
    apiFetch(`/bookings/${id}/offline-fill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  auditNote: (id: number, data: any) =>
    apiFetch(`/bookings/${id}/audit-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  operationLogs: (id: number) =>
    apiFetch(`/bookings/${id}/operation-logs`),
  auditLogs: (id: number) =>
    apiFetch(`/bookings/${id}/audit-logs`),
  attachments: (id: number) =>
    apiFetch(`/bookings/${id}/attachments`),
  uploadAttachment: (id: number, file: File, category: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    return apiFetch(`/bookings/${id}/attachments`, {
      method: 'POST',
      body: formData,
    });
  },
  deleteAttachment: (id: number, attId: number) =>
    apiFetch(`/bookings/${id}/attachments/${attId}`, { method: 'DELETE' }),
  offlineRecords: (id: number) =>
    apiFetch(`/bookings/${id}/offline-records`),
  batch: (data: any) =>
    apiFetch('/bookings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

export const metaApi = {
  enums: () => apiFetch('/meta/enums'),
};
