import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type {
  User,
  OrderSummary,
  OrderDetail,
  Statistics,
  ScanResult,
  BatchProcessResult,
  OrderAction,
  MaterialItem,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8107';

const createApiClient = (operatorId: string): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'x-operator-id': operatorId,
    },
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('API Error:', error.response?.data || error.message);
      return Promise.reject(error);
    },
  );

  return client;
};

export const api = {
  withOperator: (operatorId: string) => {
    const client = createApiClient(operatorId);

    return {
      users: {
        getMe: (): Promise<AxiosResponse<User>> => client.get('/api/users/me'),
        getMockUsers: (): Promise<AxiosResponse<User[]>> => client.get('/api/users/mock'),
      },

      scan: {
        validate: (qrCode: string): Promise<AxiosResponse<ScanResult>> =>
          client.post('/api/scan/validate', { qrCode }),
        scan: (qrCode: string): Promise<AxiosResponse<ScanResult>> =>
          client.post('/api/scan/scan', { qrCode }),
      },

      orders: {
        getList: (params?: {
          status?: string;
          handlerRole?: string;
          myTasks?: boolean;
        }): Promise<AxiosResponse<{ total: number; items: OrderSummary[] }>> =>
          client.get('/api/orders', {
            params: {
              status: params?.status,
              handlerRole: params?.handlerRole,
              myTasks: params?.myTasks,
            },
          }),

        getDetail: (id: string): Promise<AxiosResponse<OrderDetail>> =>
          client.get(`/api/orders/${id}`),

        getStatistics: (): Promise<AxiosResponse<Statistics>> =>
          client.get('/api/orders/statistics'),

        getAuditLogs: (id: string): Promise<AxiosResponse<{ orderId: string; orderNo: string; logs: any[] }>> =>
          client.get(`/api/orders/${id}/audit-logs`),

        create: (data: {
          venueName: string;
          venueType: string;
          bookingDate: string;
          bookingTime: string;
          applicantName: string;
          applicantPhone: string;
          applicantIdCard: string;
          materials: Array<{ type: string; uploaded: boolean; url?: string }>;
          comment: string;
        }): Promise<AxiosResponse<OrderDetail>> => client.post('/api/orders', data),

        process: (
          id: string,
          data: {
            action: OrderAction;
            comment: string;
            materials?: Array<{ id?: string; type: string; uploaded: boolean; url?: string }>;
          },
        ): Promise<AxiosResponse<OrderDetail>> =>
          client.put(`/api/orders/${id}/process`, data),

        batchProcess: (data: {
          orderIds: string[];
          action: OrderAction;
          comment: string;
        }): Promise<AxiosResponse<BatchProcessResult>> =>
          client.post('/api/orders/batch-process', data),
      },
    };
  },
};

export const extractError = (error: any): { message: string; details?: any } => {
  if (error.response?.data) {
    return {
      message: error.response.data.message || error.message,
      details: error.response.data.details,
    };
  }
  return { message: error.message || '未知错误' };
};
