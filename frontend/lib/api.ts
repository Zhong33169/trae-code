import { API_BASE_URL } from "./constants.ts";

export interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

export interface Evidence {
  id: number;
  contract_form_id: number;
  stage: string;
  name: string;
  description: string;
  is_required: number;
  uploaded_by: number | null;
  uploaded_at: string;
}

export interface OperationLog {
  id: number;
  contract_form_id: number;
  operator_id: number | null;
  operator_name: string | null;
  operator_role: string | null;
  action: string;
  from_stage: string | null;
  to_stage: string | null;
  from_status: string | null;
  to_status: string | null;
  opinion: string | null;
  result: string | null;
  version_before: number | null;
  version_after: number | null;
  created_at: string;
}

export interface ContractForm {
  id: number;
  form_no: string;
  resident_name: string;
  id_card: string | null;
  phone: string | null;
  address: string | null;
  doctor_name: string | null;
  team_name: string | null;
  risk_level: string;
  stage: string;
  status: string;
  current_handler_id: number | null;
  current_role: string | null;
  version: number;
  deadline: string | null;
  sign_content: string | null;
  plan_content: string | null;
  perform_content: string | null;
  evidence_required: number;
  evidence_submitted: number;
  last_opinion: string | null;
  last_result: string | null;
  last_handler_name: string | null;
  priority_score: number;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  evidences?: Evidence[];
  logs?: OperationLog[];
}

export interface ListResponse {
  list: ContractForm[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StatsResponse {
  total: number;
  byStage: Record<string, number>;
  byStatus: Record<string, number>;
  byRisk: Record<string, number>;
  pending: number;
  overdue: number;
  highRisk: number;
}

let currentUser: User | null = null;

export function setCurrentUser(user: User) {
  currentUser = user;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (currentUser) {
    headers["X-User-Id"] = String(currentUser.id);
    headers["X-User-Role"] = currentUser.role;
  }
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "请求失败" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function getStats(role?: string): Promise<StatsResponse> {
  const qs = role ? `?role=${role}` : "";
  return request<StatsResponse>(`/contracts/stats${qs}`);
}

export function getContracts(params: {
  role?: string;
  stage?: string;
  status?: string;
  riskLevel?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<ListResponse> {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      sp.set(k, String(v));
    }
  });
  const qs = sp.toString() ? `?${sp.toString()}` : "";
  return request<ListResponse>(`/contracts${qs}`);
}

export function getContract(id: number): Promise<ContractForm> {
  return request<ContractForm>(`/contracts/${id}`);
}

export function createContract(data: Record<string, unknown>): Promise<ContractForm> {
  return request<ContractForm>("/contracts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateContract(id: number, data: Record<string, unknown>): Promise<ContractForm> {
  return request<ContractForm>(`/contracts/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function submitContract(id: number, data: Record<string, unknown>): Promise<ContractForm> {
  return request<ContractForm>(`/contracts/${id}/submit`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function approveContract(id: number, data: Record<string, unknown>): Promise<ContractForm> {
  return request<ContractForm>(`/contracts/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function returnCorrection(id: number, data: Record<string, unknown>): Promise<ContractForm> {
  return request<ContractForm>(`/contracts/${id}/return-correction`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function rejectContract(id: number, data: Record<string, unknown>): Promise<ContractForm> {
  return request<ContractForm>(`/contracts/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function archiveContract(id: number, data: Record<string, unknown>): Promise<ContractForm> {
  return request<ContractForm>(`/contracts/${id}/archive`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function addEvidence(formId: number, data: Record<string, unknown>): Promise<{ id: number }> {
  return request<{ id: number }>(`/contracts/${formId}/evidences`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function removeEvidence(evidenceId: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/evidences/${evidenceId}`, {
    method: "DELETE",
  });
}
