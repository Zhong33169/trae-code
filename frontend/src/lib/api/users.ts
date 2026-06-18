import { api } from './client';
import type { User } from '$types';

export const usersApi = {
  getList: () => api.get<User[]>('/users'),
  getDetail: (id: string) => api.get<User>(`/users/${id}`),
};
