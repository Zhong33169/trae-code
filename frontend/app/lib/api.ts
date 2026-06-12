'use client';

const API_BASE = '/api';

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();
  return data as T;
}

export async function getCurrentUser() {
  return apiFetch('/users/current');
}

export async function getUsers() {
  return apiFetch('/users');
}

export async function switchUser(userId: string) {
  return apiFetch('/users/switch', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function getForms(params?: {
  status?: string;
  hasException?: boolean;
  isOverdue?: boolean;
  currentRole?: string;
  keyword?: string;
  tabRoles?: string;
  tabStatuses?: string;
}) {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.hasException) queryParams.append('hasException', 'true');
  if (params?.isOverdue) queryParams.append('isOverdue', 'true');
  if (params?.currentRole) queryParams.append('currentRole', params.currentRole);
  if (params?.keyword) queryParams.append('keyword', params.keyword);
  if (params?.tabRoles) queryParams.append('tabRoles', params.tabRoles);
  if (params?.tabStatuses) queryParams.append('tabStatuses', params.tabStatuses);

  const query = queryParams.toString();
  return apiFetch(`/forms${query ? `?${query}` : ''}`);
}

export async function getForm(id: string) {
  return apiFetch(`/forms/${id}`);
}

export async function createForm(formData: any) {
  return apiFetch('/forms', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
}

export async function executeFormAction(
  id: string,
  action: string,
  data?: { reason?: string; remark?: string; formData?: any }
) {
  return apiFetch(`/forms/${id}/action`, {
    method: 'POST',
    body: JSON.stringify({ action, ...data }),
  });
}

export async function validateForm(id: string) {
  return apiFetch(`/forms/${id}/validate`);
}

export async function addAttachment(
  id: string,
  attachment: { fileName: string; fileType: string; fileSize: number; remark?: string }
) {
  return apiFetch(`/forms/${id}/attachments`, {
    method: 'POST',
    body: JSON.stringify(attachment),
  });
}

export async function deleteAttachment(id: string, attachmentId: string) {
  return apiFetch(`/forms/${id}/attachments/${attachmentId}`, {
    method: 'DELETE',
  });
}

export async function getAuditLogs(params?: {
  formId?: string;
  operator?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}) {
  const queryParams = new URLSearchParams();
  if (params?.formId) queryParams.append('formId', params.formId);
  if (params?.operator) queryParams.append('operator', params.operator);
  if (params?.action) queryParams.append('action', params.action);
  if (params?.startDate) queryParams.append('startDate', params.startDate);
  if (params?.endDate) queryParams.append('endDate', params.endDate);

  const query = queryParams.toString();
  return apiFetch(`/audit-logs${query ? `?${query}` : ''}`);
}

export async function batchProcess(data: {
  batchNo: string;
  forms: Array<{ id: string; merchantName: string }>;
  action: string;
  reason?: string;
}) {
  return apiFetch('/batch/process', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMeta() {
  return apiFetch('/meta');
}

export async function getHealth() {
  return apiFetch('/health');
}
