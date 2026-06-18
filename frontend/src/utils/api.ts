import type {
  LoginResponse,
  Application,
  ApplicationListResponse,
  Statistics,
  BatchActionResult,
} from '../types';

const API_BASE = '/api';

function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

export function getUserFromStorage() {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
}

export function setUserToStorage(user: any) {
  localStorage.setItem('user', JSON.stringify(user));
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
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

  let data: any = {};
  try {
    data = await response.json();
  } catch {
    // ignore
  }

  if (!response.ok) {
    const detail = data?.detail || `请求失败 (${response.status})`;
    throw new Error(detail);
  }

  return data as T;
}

export const api = {
  login: (username: string, password: string): Promise<LoginResponse> =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getCurrentUser: (): Promise<any> =>
    request('/auth/me', { method: 'GET' }),

  getApplications: (params: {
    page?: number;
    page_size?: number;
    status?: string;
    is_overdue?: boolean;
    search?: string;
  } = {}): Promise<ApplicationListResponse> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    if (params.status) query.set('status', params.status);
    if (params.is_overdue !== undefined) query.set('is_overdue', String(params.is_overdue));
    if (params.search) query.set('search', params.search);
    const queryStr = query.toString();
    return request(`/applications/${queryStr ? '?' + queryStr : ''}`);
  },

  getApplication: (id: number): Promise<Application> =>
    request(`/applications/${id}`),

  createApplication: (data: any): Promise<Application> =>
    request('/applications/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateApplication: (id: number, data: any): Promise<Application> =>
    request(`/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  submitApplication: (id: number): Promise<Application> =>
    request(`/applications/${id}/submit`, { method: 'POST' }),

  startAudit: (id: number): Promise<Application> =>
    request(`/applications/${id}/start-audit`, { method: 'POST' }),

  requestCorrection: (id: number, correctionRequest: string, materialReviews?: any): Promise<Application> =>
    request(`/applications/${id}/request-correction`, {
      method: 'POST',
      body: JSON.stringify({
        correction_request: correctionRequest,
        material_reviews: materialReviews,
      }),
    }),

  auditPass: (id: number, opinion?: string, materialReviews?: any): Promise<Application> =>
    request(`/applications/${id}/audit-pass`, {
      method: 'POST',
      body: JSON.stringify({
        opinion,
        material_reviews: materialReviews,
      }),
    }),

  auditReject: (id: number, opinion?: string): Promise<Application> =>
    request(`/applications/${id}/audit-reject`, {
      method: 'POST',
      body: JSON.stringify({ opinion }),
    }),

  reviewPass: (id: number, opinion?: string): Promise<Application> =>
    request(`/applications/${id}/review-pass`, {
      method: 'POST',
      body: JSON.stringify({ opinion }),
    }),

  reviewReject: (id: number, opinion?: string): Promise<Application> =>
    request(`/applications/${id}/review-reject`, {
      method: 'POST',
      body: JSON.stringify({ opinion }),
    }),

  archiveApplication: (id: number, remark?: string): Promise<Application> =>
    request(`/applications/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ opinion: remark }),
    }),

  batchAction: (ids: number[], action: string, remark?: string): Promise<BatchActionResult> =>
    request('/applications/batch', {
      method: 'POST',
      body: JSON.stringify({ ids, action, remark }),
    }),

  checkOverdue: (): Promise<{ overdue_count: number }> =>
    request('/applications/check-overdue', { method: 'POST' }),

  getStatistics: (): Promise<Statistics> =>
    request('/statistics/'),
};

export const statusLabels: Record<string, string> = {
  draft: '草稿',
  submitted: '待审核',
  under_review: '审核中',
  correction_requested: '待补正',
  corrected: '已补正',
  audit_passed: '待复核',
  rejected: '已拒绝',
  review_passed: '复核通过',
  archived: '已归档',
};

export const roleLabels: Record<string, string> = {
  registrar: '展商登记员',
  audit_supervisor: '展商审核主管',
  review_leader: '展会主办方复核负责人',
};

export const materialTypeLabels: Record<string, string> = {
  business_license: '营业执照',
  tax_certificate: '税务登记证',
  product_catalog: '产品目录',
  booth_design: '展位设计图',
  other: '其他材料',
};

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
