import { getToken, clearAuth } from "./auth.ts";
import type {
  User,
  PrescriptionTransfer,
  TransferEvidence,
  BatchOperation,
  BatchDetail,
  BatchAuditDetail,
  AuditLog,
  ListResponse,
} from "./types.ts";

const API_BASE = "http://localhost:8004/api";

export interface ApiError {
  error: string;
  status: number;
}

async function request<T>(
  path: string,
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

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    throw { error: data.error || "请求失败", status: response.status } as ApiError;
  }

  return data as T;
}

export async function login(username: string, password: string): Promise<{ user: User; token: string }> {
  return request<{ user: User; token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function getMe(): Promise<User> {
  return request<User>("/auth/me");
}

export async function getTransfers(
  params: { status?: string; keyword?: string; page?: number; page_size?: number } = {}
): Promise<ListResponse<PrescriptionTransfer>> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.keyword) searchParams.set("keyword", params.keyword);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.page_size) searchParams.set("page_size", String(params.page_size));
  return request<ListResponse<PrescriptionTransfer>>(`/transfers?${searchParams.toString()}`);
}

export async function getTransfer(id: number): Promise<PrescriptionTransfer> {
  return request<PrescriptionTransfer>(`/transfers/${id}`);
}

export async function createTransfer(data: {
  patient_name: string;
  id_card: string;
  department: string;
  doctor_name: string;
  medicine_list: string;
  total_amount: number;
}): Promise<PrescriptionTransfer> {
  return request<PrescriptionTransfer>("/transfers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function registerTransfer(
  id: number,
  data: { evidence_content: string; remark?: string; version: number }
): Promise<PrescriptionTransfer> {
  return request<PrescriptionTransfer>(`/transfers/${id}/register`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function verifyTransfer(
  id: number,
  data: { evidence_content: string; remark?: string; version: number }
): Promise<PrescriptionTransfer> {
  return request<PrescriptionTransfer>(`/transfers/${id}/verify`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function reviewTransfer(
  id: number,
  data: { evidence_content: string; remark?: string; version: number }
): Promise<PrescriptionTransfer> {
  return request<PrescriptionTransfer>(`/transfers/${id}/review`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function getEvidences(id: number): Promise<TransferEvidence[]> {
  return request<TransferEvidence[]>(`/transfers/${id}/evidences`);
}

export async function batchRegister(data: {
  transfer_ids: number[];
  evidence_content: string;
  remark?: string;
}): Promise<BatchOperation> {
  return request<BatchOperation>("/batch/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function batchVerify(data: {
  transfer_ids: number[];
  evidence_content: string;
  remark?: string;
}): Promise<BatchOperation> {
  return request<BatchOperation>("/batch/verify", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function batchReview(data: {
  transfer_ids: number[];
  evidence_content: string;
  remark?: string;
}): Promise<BatchOperation> {
  return request<BatchOperation>("/batch/review", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getBatch(batchNo: string): Promise<BatchDetail> {
  return request<BatchDetail>(`/batch/${batchNo}`);
}

export async function retryBatch(batchNo: string): Promise<BatchDetail> {
  return request<BatchDetail>(`/batch/${batchNo}/retry`, {
    method: "POST",
  });
}

export async function getBatches(
  params: { page?: number; page_size?: number } = {}
): Promise<ListResponse<BatchOperation>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.page_size) searchParams.set("page_size", String(params.page_size));
  return request<ListResponse<BatchOperation>>(`/batch?${searchParams.toString()}`);
}

export async function getAuditLogs(
  params: { page?: number; page_size?: number; action?: string; user_id?: number } = {}
): Promise<ListResponse<AuditLog>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.page_size) searchParams.set("page_size", String(params.page_size));
  if (params.action) searchParams.set("action", params.action);
  if (params.user_id) searchParams.set("user_id", String(params.user_id));
  return request<ListResponse<AuditLog>>(`/audit?${searchParams.toString()}`);
}

export async function getBatchAudit(batchNo: string): Promise<BatchAuditDetail> {
  return request<BatchAuditDetail>(`/audit/batch/${batchNo}`);
}
