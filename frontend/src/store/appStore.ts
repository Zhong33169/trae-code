import { create } from 'zustand';
import { User, Role } from '../types';
import { api } from '../services/api';

interface AppState {
  currentUser: User | null;
  mockUsers: User[];
  isLoading: boolean;
  error: string | null;
  setCurrentUser: (user: User | null) => void;
  switchUser: (userId: string) => Promise<void>;
  loadMockUsers: () => Promise<void>;
  clearError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: null,
  mockUsers: [],
  isLoading: false,
  error: null,

  setCurrentUser: (user) => set({ currentUser: user }),

  switchUser: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.withOperator(userId).users.getMe();
      set({ currentUser: response.data, isLoading: false });
      localStorage.setItem('operatorId', userId);
    } catch (error: any) {
      set({ error: error.response?.data?.message || '切换用户失败', isLoading: false });
      throw error;
    }
  },

  loadMockUsers: async () => {
    set({ isLoading: true });
    try {
      const response = await api.withOperator('reg1').users.getMockUsers();
      set({ mockUsers: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.message || '加载用户列表失败', isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
