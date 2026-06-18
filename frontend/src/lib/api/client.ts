import { PUBLIC_API_BASE_URL } from '$env/static/public';
import type { ApiResponse } from '$types';

async function request<T>(
  path: string,
  options: RequestInit = {},
  authToken?: string | null,
): Promise<ApiResponse<T>> {
  const url = path.startsWith('/api') ? path : `${PUBLIC_API_BASE_URL}${path}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    defaultHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: authToken ? 'omit' : 'include',
  });

  const data = (await response.json()) as ApiResponse<T>;

  if (!data.success) {
    throw new Error(data.message || '请求失败');
  }

  return data;
}

export const api = {
  get: <T>(path: string, params?: Record<string, any>, authToken?: string | null) => {
    let url = path;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return request<T>(url, { method: 'GET' }, authToken);
  },

  post: <T>(path: string, data?: any, authToken?: string | null) =>
    request<T>(
      path,
      {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      },
      authToken,
    ),

  patch: <T>(path: string, data?: any, authToken?: string | null) =>
    request<T>(
      path,
      {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
      },
      authToken,
    ),

  delete: <T>(path: string, authToken?: string | null) =>
    request<T>(path, { method: 'DELETE' }, authToken),
};
