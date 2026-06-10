const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('未登录');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(data.error || '请求失败');
  }

  return response.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ user: any; token: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getMe: () => request<any>('/me'),
  getStats: () => request<any>('/stats'),

  getEnrollments: (params?: { status?: string; overdue?: string; keyword?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.overdue) query.set('overdue', params.overdue);
    if (params?.keyword) query.set('keyword', params.keyword);
    return request<any[]>(`/enrollments?${query.toString()}`);
  },

  getEnrollment: (id: number) => request<any>(`/enrollments/${id}`),

  getMaterialStatus: (id: number) =>
    request<any>(`/enrollments/${id}/material-status`),

  createEnrollment: (data: any) =>
    request<any>('/enrollments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  submitEnrollment: (id: number) =>
    request<any>(`/enrollments/${id}/submit`, { method: 'POST' }),

  verifyEnrollment: (id: number, pass: boolean, reason: string) =>
    request<any>(`/enrollments/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ enrollment_id: id, pass, reason }),
    }),

  reviewEnrollment: (id: number, pass: boolean, reason: string, remark: string) =>
    request<any>(`/enrollments/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ enrollment_id: id, pass, reason, remark }),
    }),

  batchVerify: (ids: number[], pass: boolean, reason: string) =>
    request<any[]>('/enrollments/batch-verify', {
      method: 'POST',
      body: JSON.stringify({ ids, pass, reason }),
    }),

  getAttachments: (enrollmentId: number) =>
    request<any[]>(`/attachments/enrollment/${enrollmentId}`),

  uploadAttachment: (enrollmentId: number, formData: FormData) =>
    request<any>(`/attachments/enrollment/${enrollmentId}`, {
      method: 'POST',
      body: formData as any,
      headers: {},
    }),

  approveAttachment: (id: number) =>
    request<any>(`/attachments/${id}/approve`, { method: 'POST' }),

  rejectAttachment: (attachmentId: number, reason: string) =>
    request<any>(`/attachments/${attachmentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  deleteAttachment: (id: number) =>
    request<any>(`/attachments/${id}`, { method: 'DELETE' }),

  getAuditLogs: (enrollmentId: number) =>
    request<any[]>(`/audit/enrollment/${enrollmentId}`),

  getAllAuditLogs: (params?: { user?: string }) => {
    const query = new URLSearchParams();
    if (params?.user) query.set('user', params.user);
    return request<any[]>(`/audit?${query.toString()}`);
  },
};

export function setAuth(token: string, user: any) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getCurrentUser(): any | null {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}
