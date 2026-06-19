import axios, { AxiosInstance } from 'axios';
import { HarvestRecord, User, ScanRecord, AuditLog, Comment, Statistics } from './types';

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
  version?: number;
}

export interface SubmitVerifyDto {
  comment?: string;
  deadline?: string;
  version?: number;
}

export interface ProcessDto {
  action: 'PASS' | 'REJECT' | 'CORRECT' | 'REVIEW_PASS' | 'REVIEW_REJECT';
  comment: string;
  actual_weight?: number;
  deadline?: string;
  version?: number;
}

export interface ScanVerifyDto {
  scan_code: string;
  credential: string;
  remark?: string;
  version?: number;
}

export interface BatchProcessDto {
  ids: string[];
  action: 'SUBMIT' | 'VERIFY_PASS' | 'REVIEW_PASS';
  comment: string;
}

export const authApi = {
  login: (data: LoginDto): Promise<User> => api.post('/auth/login', data),
  me: (): Promise<User> => api.get('/auth/me'),
};

export const userApi = {
  findAll: (): Promise<User[]> => api.get('/users'),
};

export const harvestApi = {
  findAll: (params?: { status?: string; keyword?: string }): Promise<HarvestRecord[]> =>
    api.get('/harvest', { params }),
  statistics: (): Promise<Statistics> => api.get('/harvest/statistics'),
  findById: (id: string): Promise<HarvestRecord> => api.get(`/harvest/${id}`),
  getScans: (id: string): Promise<ScanRecord[]> => api.get(`/harvest/${id}/scans`),
  getAudits: (id: string): Promise<AuditLog[]> => api.get(`/harvest/${id}/audits`),
  getComments: (id: string): Promise<Comment[]> => api.get(`/harvest/${id}/comments`),
  create: (data: CreateHarvestDto): Promise<HarvestRecord> => api.post('/harvest', data),
  update: (id: string, data: Partial<CreateHarvestDto> & { version?: number }): Promise<HarvestRecord> =>
    api.put(`/harvest/${id}`, data),
  submit: (id: string, data: SubmitVerifyDto): Promise<HarvestRecord> =>
    api.post(`/harvest/${id}/submit`, data),
  scan: (id: string, data: ScanVerifyDto): Promise<{ result: string; message: string; passed: boolean }> =>
    api.post(`/harvest/${id}/scan`, data),
  process: (id: string, data: ProcessDto): Promise<HarvestRecord> =>
    api.post(`/harvest/${id}/process`, data),
  batch: (data: BatchProcessDto): Promise<{ success: number; failed: number; details: any[] }> =>
    api.post('/harvest/batch', data),
};
