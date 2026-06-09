import type { User } from "./types.ts";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getUser(): User | null {
  if (typeof localStorage === "undefined") return null;
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setUser(user: User): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
