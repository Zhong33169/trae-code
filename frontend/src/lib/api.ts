import type { ApiResponse, Order, OrderDetail, Evidence } from "./types";

const BASE_URL = "/api";

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await res.json();
    return data;
  } catch {
    return {
      success: false,
      error: { code: "NETWORK_ERROR", message: "网络请求失败" },
    };
  }
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; user: { id: string; username: string; role: string; display_name: string } }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ username, password }),
        }
      ),
    me: () => request<{ id: string; username: string; role: string; display_name: string }>("/auth/me"),
    switchRole: (role: string) =>
      request<{ token: string; user: { id: string; username: string; role: string; display_name: string } }>(
        `/auth/switch-role?role=${role}`
      ),
  },

  orders: {
    list: (params?: { status?: string; role?: string; keyword?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.role) qs.set("role", params.role);
      if (params?.keyword) qs.set("keyword", params.keyword);
      const query = qs.toString();
      return request<Order[]>(`/orders${query ? `?${query}` : ""}`);
    },
    get: (id: string) => request<OrderDetail>(`/orders/${id}`),
    create: (data: { dish_name: string; dish_category: string; price: number; description: string }) =>
      request<Order>("/orders", { method: "POST", body: JSON.stringify(data) }),
    submit: (id: string, version: number, comment?: string) =>
      request<Order>(`/orders/${id}/submit`, {
        method: "PUT",
        body: JSON.stringify({ version, comment }),
      }),
    review: (id: string, version: number, comment?: string) =>
      request<Order>(`/orders/${id}/review`, {
        method: "PUT",
        body: JSON.stringify({ version, comment }),
      }),
    reviewReturn: (id: string, version: number, comment?: string) =>
      request<Order>(`/orders/${id}/review-return`, {
        method: "PUT",
        body: JSON.stringify({ version, comment }),
      }),
    archive: (id: string, version: number, comment?: string) =>
      request<Order>(`/orders/${id}/archive`, {
        method: "PUT",
        body: JSON.stringify({ version, comment }),
      }),
    archiveReturn: (id: string, version: number, comment?: string) =>
      request<Order>(`/orders/${id}/archive-return`, {
        method: "PUT",
        body: JSON.stringify({ version, comment }),
      }),
    amend: (
      id: string,
      version: number,
      data: { dish_name?: string; dish_category?: string; price?: number; description?: string; comment?: string }
    ) =>
      request<Order>(`/orders/${id}/amend`, {
        method: "PUT",
        body: JSON.stringify({ version, ...data }),
      }),
    batch: (action: string, orderIds: string[], comment?: string) =>
      request<{ id: string; success: boolean; error?: { code: string; message: string } }[]>("/orders/batch", {
        method: "POST",
        body: JSON.stringify({ action, orderIds, comment }),
      }),
  },

  evidence: {
    list: (orderId: string) => request<Evidence[]>(`/orders/${orderId}/evidence`),
    upload: (orderId: string, data: { type: string; file_name: string; description: string }) =>
      request<Evidence>(`/orders/${orderId}/evidence`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};
