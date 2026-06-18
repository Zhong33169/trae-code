import type {
  Application,
  ApplicationListResponse,
  LoginResponse,
  Statistics,
  BatchActionResult,
  User,
} from '../types';

const API_BASE = '/api';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data.message || data.detail || `请求失败 (${res.status})`;
    const error = new Error(message) as Error & { code?: string; statusCode?: number; data?: any };
    error.code = data.code;
    error.statusCode = res.status;
    error.data = data.data;
    throw error;
  }

  return data as T;
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function getCurrentUser(): User | null {
  if (typeof localStorage === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setAuth(data: LoginResponse) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('token', data.access_token);
  localStorage.setItem('user', JSON.stringify(data.user));
  // 同时写 cookie，供 SSR 路由守卫使用
  document.cookie = `token=${data.access_token}; path=/; SameSite=Lax`;
  document.cookie = `user=${encodeURIComponent(JSON.stringify(data.user))}; path=/; SameSite=Lax`;
}

export function clearAuth() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

export function getUserFromCookie(cookieHeader?: string): { user: any } | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.split('; ').find((c) => c.startsWith('user='));
  if (!match) return null;
  try {
    return { user: JSON.parse(decodeURIComponent(match.slice(5))) };
  } catch {
    return null;
  }
}

export function getApplications(params: {
  page?: number;
  page_size?: number;
  status?: string;
  is_overdue?: boolean;
  keyword?: string;
}): Promise<ApplicationListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  if (params.status) qs.set('status', params.status);
  if (params.is_overdue !== undefined) qs.set('is_overdue', String(params.is_overdue));
  if (params.keyword) qs.set('keyword', params.keyword);
  return request<ApplicationListResponse>(`/applications?${qs.toString()}`);
}

export function getApplication(id: number): Promise<Application> {
  return request<Application>(`/applications/${id}`);
}

export interface MaterialInput {
  material_type: string;
  material_name: string;
  file_path?: string;
}

export interface ApplicationInput {
  company_name: string;
  contact_person: string;
  contact_phone: string;
  contact_email?: string;
  booth_type?: string;
  booth_size?: string;
  expected_area?: number;
  industry?: string;
  product_description?: string;
  materials?: MaterialInput[];
}

export function createApplication(data: ApplicationInput): Promise<Application> {
  return request<Application>('/applications', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateApplication(id: number, version: number, data: ApplicationInput): Promise<Application> {
  return request<Application>(`/applications/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...data, version }),
  });
}

export function submitApplication(id: number, version: number): Promise<Application> {
  return request<Application>(`/applications/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
}

export function startAudit(id: number, version: number, remark?: string): Promise<Application> {
  return request<Application>(`/applications/${id}/start-audit`, {
    method: 'POST',
    body: JSON.stringify({ version, remark }),
  });
}

export function requestCorrection(
  id: number,
  version: number,
  correctionRequest: string,
  materialReviews: Record<number, { is_approved: boolean; review_comment: string }>
): Promise<Application> {
  return request<Application>(`/applications/${id}/request-correction`, {
    method: 'POST',
    body: JSON.stringify({
      version,
      correction_request: correctionRequest,
      material_reviews: materialReviews,
    }),
  });
}

export function auditPass(
  id: number,
  version: number,
  opinion?: string,
  materialReviews?: Record<number, { is_approved: boolean; review_comment: string }>
): Promise<Application> {
  return request<Application>(`/applications/${id}/audit-pass`, {
    method: 'POST',
    body: JSON.stringify({ version, opinion, material_reviews: materialReviews }),
  });
}

export function auditReject(id: number, version: number, opinion: string): Promise<Application> {
  return request<Application>(`/applications/${id}/audit-reject`, {
    method: 'POST',
    body: JSON.stringify({ version, opinion }),
  });
}

export function reviewPass(id: number, version: number, opinion?: string): Promise<Application> {
  return request<Application>(`/applications/${id}/review-pass`, {
    method: 'POST',
    body: JSON.stringify({ version, opinion }),
  });
}

export function reviewReject(id: number, version: number, opinion: string): Promise<Application> {
  return request<Application>(`/applications/${id}/review-reject`, {
    method: 'POST',
    body: JSON.stringify({ version, opinion }),
  });
}

export function archiveApplication(id: number, version: number, opinion?: string): Promise<Application> {
  return request<Application>(`/applications/${id}/archive`, {
    method: 'POST',
    body: JSON.stringify({ version, opinion }),
  });
}

export interface BatchItem {
  id: number;
  version: number;
}

export function batchAction(
  items: BatchItem[],
  action: string,
  remark?: string
): Promise<BatchActionResult> {
  return request<BatchActionResult>('/applications/batch', {
    method: 'POST',
    body: JSON.stringify({ items, action, remark }),
  });
}

export function getStatistics(): Promise<Statistics> {
  return request<Statistics>('/statistics');
}

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

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch {
    return dateStr;
  }
}

export function getOverdueNextAction(status: string, isOverdue: boolean): string {
  if (!isOverdue) return '';
  switch (status) {
    case 'submitted':
    case 'corrected':
      return '请审核主管尽快开始审核，点击详情填写逾期处理说明后可推进';
    case 'under_review':
      return '请审核主管尽快给出审核结论，通过/驳回均需填写逾期处理说明';
    case 'audit_passed':
      return '请复核负责人尽快复核，通过/退回均需填写逾期处理说明';
    case 'review_passed':
      return '请复核负责人尽快归档，归档需填写逾期处理说明';
    case 'correction_requested':
      return '请展商登记员尽快完成材料补正并重新提交';
    default:
      return '请相关岗位尽快处理，推进时需填写逾期处理说明';
  }
}
