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
  login: (data: LoginData, authToken?: string | null) =>
    api.post<LoginResult>('/auth/login', data, authToken),
  logout: (authToken?: string | null) => api.post<void>('/auth/logout', undefined, authToken),
  getCurrentUser: (authToken?: string | null) => api.get<User>('/auth/me', undefined, authToken),
};
