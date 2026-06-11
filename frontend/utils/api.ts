const API_BASE = "http://localhost:8009/api";

export interface User {
  id: string;
  username: string;
  role: "registrar" | "supervisor" | "reviewer";
  name: string;
}

export interface Attachment {
  id: string;
  selection_id: string;
  name: string;
  type: string;
  url: string;
  uploaded_by: string;
  uploaded_at: string;
  rejected: boolean;
  reject_reason?: string;
  rejected_by?: string;
  rejected_at?: string;
}

export interface AuditLog {
  id: string;
  selection_id: string;
  user_id: string;
  user_name: string;
  action: string;
  detail: string;
  created_at: string;
}

export interface Selection {
  id: string;
  product_name: string;
  product_category: string;
  brand: string;
  supplier: string;
  estimated_price: number;
  commission_rate: number;
  planned_live_date?: string;
  description: string;
  status: SelectionStatus;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  deadline?: string;
  reject_reason?: string;
  audit_note?: string;
  process_result?: string;
  attachments?: Attachment[];
  audit_logs?: AuditLog[];
}

export type SelectionStatus =
  | "draft"
  | "pending"
  | "missing_attachment"
  | "rejected"
  | "approved"
  | "archived"
  | "timeout";

export const STATUS_LABELS: Record<SelectionStatus, string> = {
  draft: "草稿",
  pending: "待审核",
  missing_attachment: "缺材料待补正",
  rejected: "已退回",
  approved: "审核通过",
  archived: "已归档",
  timeout: "超时",
};

export const STATUS_COLORS: Record<SelectionStatus, string> = {
  draft: "#6b7280",
  pending: "#f59e0b",
  missing_attachment: "#ef4444",
  rejected: "#991b1b",
  approved: "#10b981",
  archived: "#3b82f6",
  timeout: "#7c3aed",
};

export const ROLE_LABELS: Record<string, string> = {
  registrar: "直播选品登记员",
  supervisor: "直播选品审核主管",
  reviewer: "复核负责人",
};

const getHeaders = (userId: string): Record<string, string> => ({
  "Content-Type": "application/json",
  "X-User-ID": userId,
});

async function request<T>(
  path: string,
  userId: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getHeaders(userId),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `请求失败: ${res.status}`);
  }
  return data as T;
}

export const api = {
  listUsers(): Promise<User[]> {
    return fetch(`${API_BASE}/users`).then((r) => r.json());
  },
  me(userId: string): Promise<User> {
    return request<User>("/me", userId);
  },
  listSelections(userId: string, status?: string): Promise<Selection[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<Selection[]>(`/selections${q}`, userId);
  },
  getSelection(userId: string, id: string): Promise<Selection> {
    return request<Selection>(`/selections/${id}`, userId);
  },
  createSelection(
    userId: string,
    data: {
      product_name: string;
      product_category: string;
      brand: string;
      supplier: string;
      estimated_price: number;
      commission_rate: number;
      description: string;
    }
  ): Promise<Selection> {
    return request<Selection>("/selections", userId, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  submitForReview(userId: string, id: string) {
    return request(`/selections/${id}/submit`, userId, { method: "POST" });
  },
  review(
    userId: string,
    id: string,
    data: {
      approved: boolean;
      reason?: string;
      reject_attach_ids?: string[];
      attach_reasons?: Record<string, string>;
    }
  ) {
    return request(`/selections/${id}/review`, userId, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  setProcessResult(
    userId: string,
    id: string,
    data: { result: string; note?: string }
  ) {
    return request(`/selections/${id}/result`, userId, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  archive(userId: string, id: string, data: { note?: string } = {}) {
    return request(`/selections/${id}/archive`, userId, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  returnSelection(userId: string, id: string, reason: string) {
    return request(`/selections/${id}/return`, userId, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
  addAttachment(
    userId: string,
    id: string,
    data: { name: string; type: string; url: string }
  ) {
    return request(`/selections/${id}/attachments`, userId, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  batchProcess(
    userId: string,
    data: {
      ids: string[];
      action: "approve" | "reject" | "archive";
      reason?: string;
      result?: string;
    }
  ) {
    return request<{ results: Array<Record<string, any>> }>(
      "/selections/batch",
      userId,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },
};
