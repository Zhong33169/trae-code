import { api } from './client';
import type { User, ApiResponse } from '$types';

export interface LoginData {
  username: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: User;
}

export const authApi = {
  login: (data: LoginData) => api.post<LoginResult>('/auth/login', data),
  logout: () => api.post<void>('/auth/logout'),
  getCurrentUser: () => api.get<User>('/auth/me'),
};
