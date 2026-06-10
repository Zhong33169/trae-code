export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function formatDateOnly(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return `¥${num.toFixed(2)}`;
}

export function truncateText(text: string | null | undefined, maxLength: number): string {
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function getCheckResultLabel(result: string | null | undefined): string {
  const labels: Record<string, string> = {
    normal: "正常",
    abnormal: "异常",
    not_applicable: "不适用",
  };
  return result ? labels[result] || result : "-";
}

export function getCheckResultColor(result: string | null | undefined): string {
  const colors: Record<string, string> = {
    normal: "#10b981",
    abnormal: "#ef4444",
    not_applicable: "#6b7280",
  };
  return result ? colors[result] || "#374151" : "#6b7280";
}

export function downloadFile(content: string, filename: string, mimeType: string = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard
    .writeText(text)
    .then(() => true)
    .catch(() => false);
}

export function validateRequired(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") {
    return "此项为必填项";
  }
  return null;
}

export function validatePhone(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(value.trim())) {
    return "请输入有效的手机号码";
  }
  return null;
}

export function validateEmail(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value.trim())) {
    return "请输入有效的邮箱地址";
  }
  return null;
}

export function parseQueryString(query: string): Record<string, string> {
  const params: Record<string, string> = {};
  const search = query.startsWith("?") ? query.substring(1) : query;
  if (!search) return params;
  const pairs = search.split("&");
  for (const pair of pairs) {
    const [key, value] = pair.split("=");
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || "");
    }
  }
  return params;
}

export function buildQueryString(params: Record<string, any>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export function classNames(...classes: (string | null | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}
