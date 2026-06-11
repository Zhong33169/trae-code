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
  const data = response.data.data;
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
  return user?.role || null;
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

export const canHandleTask = (currentNode: string, status: string): boolean => {
  const role = getUserRole();
  if (!role) return false;

  if (role === 'registrar') {
    return (currentNode === 'order_sampling' && status === 'pending') ||
           (status === 'rejected');
  }

  if (role === 'auditor') {
    return (currentNode === 'sample_confirmation' && status === 'pending') ||
           (currentNode === 'mass_production' && status === 'pending');
  }

  if (role === 'reviewer') {
    return currentNode === 'archived' && status === 'pending';
  }

  return false;
};

export const formatDuration = (seconds: number): string => {
  const absSeconds = Math.abs(seconds);
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const secs = absSeconds % 60;

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${secs}秒`;
  } else {
    return `${secs}秒`;
  }
};

export const formatTimeoutDuration = (seconds: number): string => {
  if (seconds <= 0) return '';
  return `已超时 ${formatDuration(seconds)}`;
};
