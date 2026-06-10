import api from "./api";
import Cookies from "js-cookie";

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  role_label: string;
  station_code: string | null;
  is_active: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
  expires_in: number;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>("/api/auth/login", {
    username,
    password,
  });
  return response.data;
}

export async function getCurrentUser(): Promise<User> {
  const response = await api.get<User>("/api/auth/me");
  return response.data;
}

export async function getUsers(): Promise<User[]> {
  const response = await api.get<User[]>("/api/auth/users");
  return response.data;
}

export function setAuthData(data: LoginResponse) {
  Cookies.set("access_token", data.access_token, {
    expires: data.expires_in / 86400,
  });
  Cookies.set("user", JSON.stringify(data.user), {
    expires: data.expires_in / 86400,
  });
}

export function clearAuthData() {
  Cookies.remove("access_token");
  Cookies.remove("user");
}

export function getCurrentUserFromCookie(): User | null {
  const userStr = Cookies.get("user");
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
}
