import axios from 'axios';
import type {
  AccountApplication,
  OperationRecord,
  RiskLevelLog,
  Statistics,
  UserInfo,
  OperationSubmitRequest,
  ApiResponse,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8002';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export const healthCheck = async () => {
  const res = await api.get('/health');
  return res.data;
};

export const getApplications = async (params?: {
  stage?: string;
  status?: string;
  risk_level?: string;
  handler_id?: number;
}) => {
  const res = await api.get<ApiResponse<AccountApplication[]>>('/api/applications', { params });
  return res.data;
};

export const getApplicationDetail = async (id: number) => {
  const res = await api.get<ApiResponse<AccountApplication>>(`/api/applications/${id}`);
  return res.data;
};

export const getApplicationOperations = async (id: number) => {
  const res = await api.get<ApiResponse<OperationRecord[]>>(`/api/applications/${id}/operations`);
  return res.data;
};

export const getApplicationRiskLogs = async (id: number) => {
  const res = await api.get<ApiResponse<RiskLevelLog[]>>(`/api/applications/${id}/risk-logs`);
  return res.data;
};

export const submitOperation = async (data: OperationSubmitRequest) => {
  const res = await api.post<ApiResponse<AccountApplication>>('/api/applications/operation', data);
  return res.data;
};

export const getStatistics = async () => {
  const res = await api.get<ApiResponse<Statistics>>('/api/statistics');
  return res.data;
};

export const getUsers = async () => {
  const res = await api.get<ApiResponse<UserInfo[]>>('/api/users');
  return res.data;
};

export const createApplication = async (data: any) => {
  const res = await api.post<ApiResponse<AccountApplication>>('/api/applications', data);
  return res.data;
};
