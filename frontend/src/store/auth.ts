import { createContextId, useContext, useContextProvider, useStore, useTask$ } from "@builder.io/qwik";
import type { User } from "~/types";
import { authApi } from "~/api";

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

export const AuthContext = createContextId<AuthState>("auth-context");

export function useAuthProvider(): AuthState {
  const state = useStore<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  useTask$(async () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      if (token && userStr) {
        try {
          state.token = token;
          state.user = JSON.parse(userStr);
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      state.loading = false;
    }
  });

  useContextProvider(AuthContext, state);
  return state;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function setAuthData(user: User, token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }
}

export function clearAuthData() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}

export async function doLogin(username: string, password: string): Promise<{ success: boolean; message: string; user?: User }> {
  try {
    const res: any = await authApi.login(username, password);
    if (res.success && res.user && res.token) {
      setAuthData(res.user, res.token);
      return { success: true, message: res.message || '登录成功', user: res.user };
    }
    return { success: false, message: res.message || '登录失败' };
  } catch (err: any) {
    return { success: false, message: err.message || '网络错误' };
  }
}

export async function doLogout(): Promise<boolean> {
  try {
    await authApi.logout();
  } catch {
  }
  clearAuthData();
  return true;
}
