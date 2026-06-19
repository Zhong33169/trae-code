const API_BASE = "http://localhost:8002/api";

async function apiFetch(path: string, options?: RequestInit) {
  const userId = typeof window !== "undefined" ? localStorage.getItem("currentUserId") || "1" : "1";
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw err;
  }
  return res.json();
}

export async function fetchUsers() {
  return apiFetch("/users");
}

export async function fetchPlans(status?: string) {
  const params = status ? `?status=${status}` : "";
  return apiFetch(`/immunization-plans${params}`);
}

export async function fetchPlan(id: number) {
  return apiFetch(`/immunization-plans/${id}`);
}

export async function createPlan(data: any) {
  return apiFetch("/immunization-plans", { method: "POST", body: JSON.stringify(data) });
}

export async function submitPlan(id: number) {
  return apiFetch(`/immunization-plans/${id}/submit`, { method: "POST" });
}

export async function fetchRecords(filters?: { status?: string; plan_id?: string; is_abnormal?: string; is_overdue?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.plan_id) params.set("plan_id", filters.plan_id);
  if (filters?.is_abnormal) params.set("is_abnormal", filters.is_abnormal);
  if (filters?.is_overdue) params.set("is_overdue", filters.is_overdue);
  const qs = params.toString();
  return apiFetch(`/vaccination-records${qs ? `?${qs}` : ""}`);
}

export async function fetchRecord(id: number) {
  return apiFetch(`/vaccination-records/${id}`);
}

export async function createRecord(data: any) {
  return apiFetch("/vaccination-records", { method: "POST", body: JSON.stringify(data) });
}

export async function submitRecord(id: number) {
  return apiFetch(`/vaccination-records/${id}/submit`, { method: "POST" });
}

export async function reviewRecord(id: number, data: { result?: string; audit_note?: string }) {
  return apiFetch(`/vaccination-records/${id}/review`, { method: "POST", body: JSON.stringify(data) });
}

export async function approveRecord(id: number, data?: { audit_note?: string }) {
  return apiFetch(`/vaccination-records/${id}/approve`, { method: "POST", body: JSON.stringify(data || {}) });
}

export async function returnRecord(id: number, data: { return_reason: string; audit_note?: string; reject_attachment_ids?: number[]; rejection_reason?: string }) {
  return apiFetch(`/vaccination-records/${id}/return`, { method: "POST", body: JSON.stringify(data) });
}

export async function uploadAttachment(recordId: number, data: { file_name: string; file_path: string; attachment_type: string; label: string }) {
  return apiFetch(`/vaccination-records/${recordId}/attachments`, { method: "POST", body: JSON.stringify(data) });
}

export async function updateAttachment(recordId: number, attId: number, data: any) {
  return apiFetch(`/vaccination-records/${recordId}/attachments/${attId}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function fetchRechecks(filters?: { status?: string; is_overdue?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.is_overdue) params.set("is_overdue", filters.is_overdue);
  const qs = params.toString();
  return apiFetch(`/abnormal-rechecks${qs ? `?${qs}` : ""}`);
}

export async function fetchRecheck(id: number) {
  return apiFetch(`/abnormal-rechecks/${id}`);
}

export async function processRecheck(id: number, data: { recheck_result: string }) {
  return apiFetch(`/abnormal-rechecks/${id}/recheck`, { method: "POST", body: JSON.stringify(data) });
}

export async function resolveRecheck(id: number, data: { resolution: string }) {
  return apiFetch(`/abnormal-rechecks/${id}/resolve`, { method: "POST", body: JSON.stringify(data) });
}

export async function batchProcess(data: { action: string; record_ids: number[]; extra?: any }) {
  return apiFetch("/batch/process", { method: "POST", body: JSON.stringify(data) });
}

export async function fetchAuditLogs(filters?: { record_id?: string; recheck_id?: string; has_failure?: string }) {
  const params = new URLSearchParams();
  if (filters?.record_id) params.set("record_id", filters.record_id);
  if (filters?.recheck_id) params.set("recheck_id", filters.recheck_id);
  if (filters?.has_failure) params.set("has_failure", filters.has_failure);
  const qs = params.toString();
  return apiFetch(`/audit-logs${qs ? `?${qs}` : ""}`);
}

export async function fetchDashboardStats() {
  return apiFetch("/dashboard/stats");
}
