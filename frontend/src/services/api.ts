import {
  TreatmentPlan,
  PlanListResponse,
  PlanDetailResponse,
  PlanStats,
  User,
  AuditLog,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8003';
const API_PREFIX = `${API_BASE}/api`;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `请求失败: ${res.status}`);
  }

  return res.json();
}

export const api = {
  getUsers: (): Promise<User[]> => request('/auth/users'),

  getPlans: (params: Record<string, string | undefined> = {}): Promise<PlanListResponse> => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.set(key, value);
    });
    return request(`/treatment-plans?${searchParams.toString()}`);
  },

  getPlanDetail: (id: string, userId: string): Promise<PlanDetailResponse> =>
    request(`/treatment-plans/${id}?userId=${userId}`),

  getStats: (userId: string): Promise<PlanStats> =>
    request(`/treatment-plans/stats?userId=${userId}`),

  createPlan: (data: any): Promise<TreatmentPlan> =>
    request('/treatment-plans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePlan: (id: string, data: any, userId: string): Promise<TreatmentPlan> =>
    request(`/treatment-plans/${id}?userId=${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  submitVerification: (id: string, data: any): Promise<TreatmentPlan> =>
    request(`/treatment-plans/${id}/submit-verification`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  verifyPlan: (id: string, data: any): Promise<TreatmentPlan> =>
    request(`/treatment-plans/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  submitReview: (id: string, data: any): Promise<TreatmentPlan> =>
    request(`/treatment-plans/${id}/submit-review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reviewPlan: (id: string, data: any): Promise<TreatmentPlan> =>
    request(`/treatment-plans/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addAttachment: (id: string, data: any): Promise<any> =>
    request(`/treatment-plans/${id}/attachments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeAttachment: (id: string, attachmentId: string, userId: string): Promise<any> =>
    request(`/treatment-plans/${id}/attachments/${attachmentId}?userId=${userId}`, {
      method: 'DELETE',
    }),

  batchSubmitVerification: (data: any): Promise<any> =>
    request('/treatment-plans/batch/submit-verification', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  batchVerify: (data: any): Promise<any> =>
    request('/treatment-plans/batch/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  batchReview: (data: any): Promise<any> =>
    request('/treatment-plans/batch/review', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAuditLogs: (planId: string): Promise<AuditLog[]> =>
    request(`/audit/plan/${planId}`),
};
