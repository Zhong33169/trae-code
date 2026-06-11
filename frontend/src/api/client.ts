const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['X-Token'] = token;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data.message || data.detail || '请求失败';
    throw new Error(message);
  }

  return data as T;
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),

    me: () => request<any>('/auth/me'),
  },

  tickets: {
    list: (params: Record<string, any> = {}) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
      return request<any>(`/tickets?${searchParams.toString()}`);
    },

    detail: (id: number) => request<any>(`/tickets/${id}`),

    create: (data: any) =>
      request<any>('/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    action: (id: number, data: any) =>
      request<any>(`/tickets/${id}/action`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    logs: (id: number) => request<any>(`/tickets/${id}/logs`),
  },

  stats: {
    dashboard: () => request<any>('/stats/dashboard'),
  },

  logs: {
    list: (params: Record<string, any> = {}) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
      return request<any>(`/logs?${searchParams.toString()}`);
    },
  },
};
