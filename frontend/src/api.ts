import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const userId = localStorage.getItem('userId');
  if (userId) {
    config.headers['X-User-Id'] = userId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('userId');
      localStorage.removeItem('userInfo');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface LoginDto {
  username: string;
  password: string;
}

export interface CreateHarvestDto {
  batch_no: string;
  crop_type: string;
  crop_name: string;
  harvest_date: string;
  harvest_area: number;
  estimated_weight: number;
  field_location: string;
  planter: string;
  materials?: string;
}

export interface SubmitVerifyDto {
  comment?: string;
  deadline?: string;
}

export interface ProcessDto {
  action: 'PASS' | 'REJECT' | 'CORRECT' | 'REVIEW_PASS' | 'REVIEW_REJECT';
  comment: string;
  actual_weight?: number;
  deadline?: string;
}

export interface ScanVerifyDto {
  scan_code: string;
  credential: string;
  remark?: string;
}

export interface BatchProcessDto {
  ids: string[];
  action: 'SUBMIT' | 'VERIFY_PASS' | 'REVIEW_PASS';
  comment: string;
}

export const authApi = {
  login: (data: LoginDto) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const userApi = {
  findAll: () => api.get('/users'),
};

export const harvestApi = {
  findAll: (params?: { status?: string; keyword?: string }) =>
    api.get('/harvest', { params }),
  statistics: () => api.get('/harvest/statistics'),
  findById: (id: string) => api.get(`/harvest/${id}`),
  getScans: (id: string) => api.get(`/harvest/${id}/scans`),
  getAudits: (id: string) => api.get(`/harvest/${id}/audits`),
  getComments: (id: string) => api.get(`/harvest/${id}/comments`),
  create: (data: CreateHarvestDto) => api.post('/harvest', data),
  update: (id: string, data: Partial<CreateHarvestDto>) =>
    api.put(`/harvest/${id}`, data),
  submit: (id: string, data: SubmitVerifyDto) =>
    api.post(`/harvest/${id}/submit`, data),
  scan: (id: string, data: ScanVerifyDto) =>
    api.post(`/harvest/${id}/scan`, data),
  process: (id: string, data: ProcessDto) =>
    api.post(`/harvest/${id}/process`, data),
  batch: (data: BatchProcessDto) => api.post('/harvest/batch', data),
};

export default api;
