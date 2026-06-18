import { useAuth } from "./auth";

export async function apiFetch(url: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error(data.message || "未登录或登录已过期");
  }

  if (!res.ok || !data.success) {
    throw new Error(data.message || "请求失败");
  }

  return data.data;
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const statusMap: Record<string, { label: string; class: string }> = {
  draft: { label: "草稿", class: "badge-gray" },
  pending_audit: { label: "待审核", class: "badge-yellow" },
  audit_rejected: { label: "审核退回", class: "badge-red" },
  pending_review: { label: "待复核", class: "badge-blue" },
  review_rejected: { label: "复核退回", class: "badge-red" },
  archived: { label: "已归档", class: "badge-green" },
};

export const shiftMap: Record<string, string> = {
  morning: "早班",
  afternoon: "午班",
  night: "夜班",
};

export const statusLabel = (status: string) => statusMap[status]?.label || status;
export const statusClass = (status: string) => statusMap[status]?.class || "badge-gray";
