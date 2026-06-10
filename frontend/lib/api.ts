import { ApiResponse, User, BorrowRecord, ProcessRecord, EvidenceItem, StatsResponse } from './types';

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const data = await res.json();
  return data as ApiResponse<T>;
}

export async function getUsers(): Promise<ApiResponse<User[]>> {
  return apiFetch<User[]>('/users');
}

export async function getStats(): Promise<ApiResponse<StatsResponse>> {
  return apiFetch<StatsResponse>('/stats');
}

export async function getRecords(params?: Record<string, string>): Promise<ApiResponse<BorrowRecord[]>> {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch<BorrowRecord[]>(`/records${query}`);
}

export async function getRecord(id: number): Promise<ApiResponse<BorrowRecord>> {
  return apiFetch<BorrowRecord>(`/records/${id}`);
}

export async function createRecord(data: any): Promise<ApiResponse<BorrowRecord>> {
  return apiFetch<BorrowRecord>('/records', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRecord(id: number, data: any): Promise<ApiResponse<BorrowRecord>> {
  return apiFetch<BorrowRecord>(`/records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function submitRecord(id: number, data: any): Promise<ApiResponse<BorrowRecord>> {
  return apiFetch<BorrowRecord>(`/records/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function auditRecord(id: number, data: any): Promise<ApiResponse<BorrowRecord>> {
  return apiFetch<BorrowRecord>(`/records/${id}/audit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function reviewRecord(id: number, data: any): Promise<ApiResponse<BorrowRecord>> {
  return apiFetch<BorrowRecord>(`/records/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function correctRecord(id: number, data: any): Promise<ApiResponse<BorrowRecord>> {
  return apiFetch<BorrowRecord>(`/records/${id}/correct`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProcessRecords(id: number): Promise<ApiResponse<ProcessRecord[]>> {
  return apiFetch<ProcessRecord[]>(`/records/${id}/process-records`);
}

export async function getEvidence(id: number): Promise<ApiResponse<EvidenceItem[]>> {
  return apiFetch<EvidenceItem[]>(`/records/${id}/evidence`);
}

export async function addEvidence(id: number, data: any): Promise<ApiResponse<EvidenceItem>> {
  return apiFetch<EvidenceItem>(`/records/${id}/evidence`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
