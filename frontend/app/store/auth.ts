import { create } from 'zustand';
import { api } from '~/api/client';
import type { UserRole } from '~/lib/constants';

export interface User {
  id: string;
  username: string;
  real_name: string;
  role: UserRole;
  role_id?: number;
  role_code?: string;
  role_name?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  setUser: (user: User | null) => void;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post<{ token: string; user: User }>('/login', {
        username,
        password,
      });
      const payload = response.data;
      if (!payload) throw new Error('登录失败：响应数据为空');
      const { token, user } = payload;
      const mappedUser: User = {
        id: String(user.id),
        username: user.username,
        real_name: user.real_name,
        role: (user.role_code as UserRole) || ('registrar' as UserRole),
        role_name: user.role_name,
      };
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(mappedUser));
      set({ token, user: mappedUser, isLoading: false });
      return { success: true, message: response.message };
    } catch (error) {
      set({ isLoading: false });
      const message = error instanceof Error ? error.message : '登录失败';
      return { success: false, message };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },

  setUser: (user) => set({ user }),

  init: () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({ token, user });
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  },
}));
