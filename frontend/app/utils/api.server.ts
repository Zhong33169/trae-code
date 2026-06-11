import { API_BASE_URL } from "./auth.server";

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const apiCall = async <T = any>(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  return data as ApiResponse<T>;
};

export const apiGet = async <T = any>(
  token: string,
  path: string,
  params?: Record<string, any>
) => {
  const queryString = params
    ? "?" + new URLSearchParams(params as any).toString()
    : "";
  return apiCall<T>(token, `${path}${queryString}`, { method: "GET" });
};

export const apiPost = async <T = any>(
  token: string,
  path: string,
  body?: any
) => {
  return apiCall<T>(token, path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
};

export const apiPut = async <T = any>(
  token: string,
  path: string,
  body?: any
) => {
  return apiCall<T>(token, path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
};

export const apiDelete = async <T = any>(
  token: string,
  path: string
) => {
  return apiCall<T>(token, path, {
    method: "DELETE",
  });
};
