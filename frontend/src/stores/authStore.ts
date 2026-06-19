import { create } from "zustand";
import type { User, UserRole } from "../lib/types";
import { api } from "../lib/api";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("token", token);
}

function removeStoredToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  switchRole: (role: UserRole) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getStoredToken(),
  loading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    const res = await api.auth.login(username, password);
    if (res.success && res.data) {
      const { token, user } = res.data;
      setStoredToken(token);
      set({
        token,
        user: { id: user.id, username: user.username, role: user.role as UserRole, display_name: user.display_name },
        loading: false,
        error: null,
      });
      return true;
    }
    set({ loading: false, error: res.error?.message || "登录失败" });
    return false;
  },

  switchRole: async (role: UserRole) => {
    set({ loading: true, error: null });
    const res = await api.auth.switchRole(role);
    if (res.success && res.data) {
      const { token, user } = res.data;
      setStoredToken(token);
      set({
        token,
        user: { id: user.id, username: user.username, role: user.role as UserRole, display_name: user.display_name },
        loading: false,
      });
      return true;
    }
    set({ loading: false, error: res.error?.message || "切换角色失败" });
    return false;
  },

  logout: () => {
    removeStoredToken();
    set({ user: null, token: null, error: null });
  },

  checkAuth: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ user: null, token: null });
      return;
    }
    const res = await api.auth.me();
    if (res.success && res.data) {
      set({
        user: {
          id: res.data.id,
          username: res.data.username,
          role: res.data.role as UserRole,
          display_name: res.data.display_name,
        },
      });
    } else {
      removeStoredToken();
      set({ user: null, token: null });
    }
  },

  clearError: () => set({ error: null }),
}));
