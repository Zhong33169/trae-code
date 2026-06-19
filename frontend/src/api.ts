const API_BASE = "/api";

let currentUser: { id: string; name: string; role: string } | null = null;

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user: { id: string; name: string; role: string } | null) {
  currentUser = user;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (currentUser) {
    h["X-User-Id"] = currentUser.id;
    h["X-User-Role"] = currentUser.role;
  }
  return h;
}

export async function login(userId: string, password: string) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "登录失败");
  currentUser = data;
  return data;
}

export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/users`, { headers: headers() });
  return res.json();
}

export async function fetchForms(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${API_BASE}/forms${qs}`, { headers: headers() });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "获取列表失败");
  }
  return res.json();
}

export async function fetchFormDetail(id: string) {
  const res = await fetch(`${API_BASE}/forms/${id}`, { headers: headers() });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "获取详情失败");
  }
  return res.json();
}

export async function createForm(data: {
  title: string;
  department: string;
  adjustment_type: string;
  amount: number;
  reason: string;
}) {
  const res = await fetch(`${API_BASE}/forms`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "创建失败");
  return result;
}

export async function submitFormAction(
  formId: string,
  action: string,
  comment?: string
) {
  const res = await fetch(`${API_BASE}/forms/${formId}/action`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ action, comment }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "操作失败");
  return result;
}

export async function addEvidence(
  formId: string,
  evidence_type: string,
  description: string,
  file_name?: string
) {
  const res = await fetch(`${API_BASE}/forms/${formId}/evidence`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ evidence_type, description, file_name }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "添加证据失败");
  return result;
}

export async function addSupplement(
  formId: string,
  supplement_type: string,
  content: string,
  reason: string
) {
  const res = await fetch(`${API_BASE}/forms/${formId}/supplement`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ supplement_type, content, reason }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "补录失败");
  return result;
}

export async function batchAction(
  formIds: string[],
  action: string,
  comment?: string
) {
  const res = await fetch(`${API_BASE}/forms/batch-action`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ formIds, action, comment }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "批量操作失败");
  return result;
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`, { headers: headers() });
  return res.json();
}

export async function validateAction(formId: string, action: string) {
  const res = await fetch(
    `${API_BASE}/forms/${formId}/validate-action?action=${action}`,
    { headers: headers() }
  );
  return res.json();
}
