const API_BASE = "/api";

interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
}

export async function request<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<{ code: number; message: string; data: T }> {
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let fullUrl = API_BASE + url;
  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += `?${queryString}`;
    }
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(data.message || "请求失败");
  }

  return data;
}

export const api = {
  login: (username: string, password: string) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  getProfile: () => request("/auth/profile"),

  logout: () =>
    request("/auth/logout", {
      method: "POST",
    }),

  getTaskList: (params: any) =>
    request("/tasks", {
      params,
    }),

  getTaskDetail: (id: number) => request(`/tasks/${id}`),

  getTaskLogs: (id: number) => request(`/tasks/${id}/logs`),

  getStatistics: () => request("/tasks/statistics"),

  createTask: (data: any) =>
    request("/tasks/create", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  registerTask: (taskId: number) =>
    request("/tasks/register", {
      method: "POST",
      body: JSON.stringify({ taskId }),
    }),

  auditTask: (data: any) =>
    request("/tasks/audit", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  reviewTask: (data: any) =>
    request("/tasks/review", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
