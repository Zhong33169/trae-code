import axios from 'axios';
import type {
  LoginResponse,
  RectificationOrder,
  OrderListResponse,
  StatusUpdateRequest,
  StatusUpdateResponse,
  BatchOperationRequest,
  BatchOperationResult,
  Statistics,
  OverdueCheckResponse,
} from '@/types';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    const message = error.response?.data?.detail || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }).then((r) => r.data),

  getMe: () => api.get('/auth/me').then((r) => r.data),

  initDatabase: () => api.post('/auth/init').then((r) => r.data),
};

export const orderApi = {
  getList: (params?: {
    status?: string;
    department?: string;
    is_overdue?: boolean;
    skip?: number;
    limit?: number;
  }) => api.get<OrderListResponse>('/rectification', { params }).then((r) => r.data),

  getDetail: (orderId: number) =>
    api.get<RectificationOrder>(`/rectification/${orderId}`).then((r) => r.data),

  create: (data: {
    patient_name: string;
    medical_record_no: string;
    department?: string;
    diagnosis?: string;
    content?: string;
    rectification_requirements?: string;
  }) => api.post<RectificationOrder>('/rectification', data).then((r) => r.data),

  updateStatus: (orderId: number, data: StatusUpdateRequest) =>
    api.patch<StatusUpdateResponse>(`/rectification/${orderId}/status`, data).then((r) => r.data),

  batchOperation: (data: BatchOperationRequest) =>
    api.post<BatchOperationResult>('/rectification/batch', data).then((r) => r.data),

  checkOverdue: (orderId: number) =>
    api.get<OverdueCheckResponse>(`/rectification/${orderId}/overdue`).then((r) => r.data),
};

export const qualityApi = {
  submitQuality: (orderId: number, data: {
    problems_found?: string;
    quality_score?: number;
    check_result: string;
    quality_opinion?: string;
    remark?: string;
  }) => api.post(`/quality/${orderId}/quality/submit`, data).then((r) => r.data),

  sendNotice: (orderId: number, data: {
    notice_title: string;
    notice_content: string;
    deadline: string;
    recipient_department: string;
    remark?: string;
  }) => api.post(`/quality/${orderId}/notice`, data).then((r) => r.data),

  reviewArchive: (orderId: number, data: {
    review_opinion: string;
    review_result: string;
    archive_location?: string;
    remark?: string;
  }) => api.post(`/quality/${orderId}/review`, data).then((r) => r.data),

  getLinked: (orderId: number) =>
    api.get(`/quality/${orderId}/linked`).then((r) => r.data),
};

export const statisticsApi = {
  getOverview: () => api.get<Statistics>('/statistics/overview').then((r) => r.data),

  getByDepartment: () =>
    api.get<Record<string, Record<string, number>>>('/statistics/by-department').then((r) => r.data),

  getOverdueReport: () =>
    api.get<{ total: number; items: any[] }>('/statistics/overdue-report').then((r) => r.data),
};

export const logsApi = {
  getLogs: (params?: { order_id?: number; skip?: number; limit?: number }) =>
    api.get('/logs', { params }).then((r) => r.data),

  getOrderLogs: (orderId: number, params?: { skip?: number; limit?: number }) =>
    api.get(`/logs/order/${orderId}`, { params }).then((r) => r.data),
};

export default api;
