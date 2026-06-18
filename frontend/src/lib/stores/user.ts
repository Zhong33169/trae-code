import { writable } from 'svelte/store';
import type { User } from '$types';
import { authApi } from '$api';

export const currentUser = writable<User | null>(null);
export const isLoading = writable(false);
export const authError = writable<string | null>(null);

export async function loadCurrentUser(): Promise<User | null> {
  isLoading.set(true);
  authError.set(null);
  try {
    const response = await authApi.getCurrentUser();
    const user = response.data;
    currentUser.set(user);
    return user;
  } catch (e: any) {
    currentUser.set(null);
    authError.set(e.message || '获取用户信息失败');
    return null;
  } finally {
    isLoading.set(false);
  }
}

export async function login(username: string, password: string): Promise<User> {
  isLoading.set(true);
  authError.set(null);
  try {
    const response = await authApi.login({ username, password });
    const user = response.data.user;
    currentUser.set(user);
    return user;
  } catch (e: any) {
    authError.set(e.message || '登录失败');
    throw e;
  } finally {
    isLoading.set(false);
  }
}

export async function logout(): Promise<void> {
  try {
    await authApi.logout();
  } catch (e) {
    // ignore
  } finally {
    currentUser.set(null);
  }
}
