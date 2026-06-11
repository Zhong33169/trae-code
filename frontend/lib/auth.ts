import api from './api';
import { User, LoginResponse, ApiResponse, UserRole } from '@/types';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export const setToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
};

export const removeToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

export const setUser = (user: User): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};

export const getUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
  }
  return null;
};

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', {
    username,
    password,
  });
  const data = response.data.data!;
  setToken(data.token);
  setUser(data.user);
  return data;
};

export const logout = (): void => {
  removeToken();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};

export const getUserRole = (): UserRole | null => {
  const user = getUser();
  return (user?.role as UserRole) || null;
};

export const isRegistrar = (): boolean => {
  return getUserRole() === 'registrar';
};

export const isAuditor = (): boolean => {
  return getUserRole() === 'auditor';
};

export const isReviewer = (): boolean => {
  return getUserRole() === 'reviewer';
};

export const formatDuration = (hours: number): string => {
  const absHours = Math.abs(hours);
  if (absHours >= 1) {
    return `${Math.floor(absHours)}小时`;
  }
  return '不足1小时';
};

export const formatTimeoutDisplay = (timeoutHours: number): string => {
  if (timeoutHours > 0) {
    return `已超时${timeoutHours}小时`;
  }
  return '';
};

export const canHandleTask = (current_node: string, status: string): boolean => {
  const role = getUserRole();
  if (!role) return false;

  if (role === 'registrar') {
    return current_node === 'order_sampling' && status !== 'archived';
  }

  if (role === 'auditor') {
    return current_node === 'sample_confirmation' || current_node === 'production_scheduling';
  }

  if (role === 'reviewer') {
    return current_node === 'production_scheduling';
  }

  return false;
};
