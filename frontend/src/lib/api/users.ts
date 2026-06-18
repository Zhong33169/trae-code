import { api } from './client';
import type { User } from '$types';

export const usersApi = {
  getList: (authToken?: string | null) => api.get<User[]>('/users', undefined, authToken),
  getDetail: (id: string, authToken?: string | null) => api.get<User>(`/users/${id}`, undefined, authToken),
};
