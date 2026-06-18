import axios from 'axios';
import type {
  User,
  SparePartOrder,
  OrderListResponse,
  ActionRequest,
  ProcessRecord,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const userApi = {
  listUsers: (): Promise<User[]> => api.get('/users').then((r) => r.data),
};

export const orderApi = {
  list: (params?: {
    status?: string;
    role?: string;
    user_id?: string;
  }): Promise<OrderListResponse> =>
    api.get('/orders', { params }).then((r) => r.data),

  detail: (id: string): Promise<SparePartOrder> =>
    api.get(`/orders/${id}`).then((r) => r.data),

  records: (id: string): Promise<ProcessRecord[]> =>
    api.get(`/orders/${id}/records`).then((r) => r.data),

  create: (data: Partial<SparePartOrder>): Promise<SparePartOrder> =>
    api.post('/orders', data).then((r) => r.data),

  submit: (data: ActionRequest): Promise<SparePartOrder> =>
    api.post('/orders/submit', data).then((r) => r.data),

  verify: (data: ActionRequest): Promise<SparePartOrder> =>
    api.post('/orders/verify', data).then((r) => r.data),

  appeal: (data: ActionRequest): Promise<SparePartOrder> =>
    api.post('/orders/appeal', data).then((r) => r.data),

  review: (data: ActionRequest): Promise<SparePartOrder> =>
    api.post('/orders/review', data).then((r) => r.data),

  archive: (data: ActionRequest): Promise<SparePartOrder> =>
    api.post('/orders/archive', data).then((r) => r.data),
};
