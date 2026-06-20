const isBrowser = typeof window !== "undefined";

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  code?: number;
  data?: T;
  [key: string]: any;
}

function getToken(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem("token");
}

export async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
      credentials: "include",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = data?.detail || data;
      if (typeof error === "object" && error !== null && error.message) {
        throw new Error(error.message);
      }
      throw new Error(
        typeof data === "string" ? data :
        data?.message || `请求失败: ${response.status} ${response.statusText}`
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("网络请求失败，请检查后端服务是否启动");
  }
}

export const api = {
  login: (username: string, password: string) =>
    request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  getMe: () => request("/api/me"),

  getBills: (params?: Record<string, any>) => {
    const query = new URLSearchParams(params || {}).toString();
    return request(`/api/bills${query ? `?${query}` : ""}`);
  },

  getBillStats: () => request("/api/bills/stats"),

  getBill: (id: number) => request(`/api/bills/${id}`),

  createBill: (data: any) =>
    request("/api/bills", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateBill: (id: number, data: any) =>
    request(`/api/bills/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteBill: (id: number) =>
    request(`/api/bills/${id}`, {
      method: "DELETE",
    }),

  performAction: (id: number, action: string, anomaly_reason?: string, remark?: string) =>
    request(`/api/bills/${id}/action`, {
      method: "POST",
      body: JSON.stringify({ action, anomaly_reason, remark }),
    }),

  batchAction: (billIds: number[], action: string, anomaly_reason?: string, remark?: string) =>
    request("/api/bills/batch-action", {
      method: "POST",
      body: JSON.stringify({ bill_ids: billIds, action, anomaly_reason, remark }),
    }),

  addMeterReading: (data: any) =>
    request("/api/meter-readings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMeterReadings: (billId: number) =>
    request(`/api/meter-readings/${billId}`),

  generateBill: (id: number) =>
    request(`/api/bills/${id}/generate-bill`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  addPayment: (data: any) =>
    request("/api/payments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  verifyPayment: (paymentId: number, is_verified: boolean, remark?: string) =>
    request(`/api/payments/${paymentId}/verify`, {
      method: "POST",
      body: JSON.stringify({ is_verified, remark }),
    }),

  refreshOverdue: () =>
    request("/api/refresh-overdue", {
      method: "POST",
    }),

  health: () => request("/api/health"),
};
