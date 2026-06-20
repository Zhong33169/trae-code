import axios from 'axios';
import { message } from 'antd';

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function transformKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(transformKeys);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[toCamelCase(key)] = transformKeys(value);
    }
    return result;
  }
  return obj;
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8004/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.response.use(
  (response) => {
    response.data = transformKeys(response.data);
    return response;
  },
  (error) => {
    const msg = error.response?.data?.message || error.message || '请求失败';
    message.error(Array.isArray(msg) ? msg.join('; ') : msg);
    return Promise.reject(error);
  },
);

export async function getInvitations(params: Record<string, unknown>) {
  const res = await client.get('/invitations', { params });
  return res.data;
}

export async function getInvitation(id: string) {
  const res = await client.get(`/invitations/${id}`);
  return res.data;
}

export async function createInvitation(data: Record<string, unknown>) {
  const res = await client.post('/invitations', data);
  return res.data;
}

export async function updateInvitation(id: string, data: Record<string, unknown>) {
  const res = await client.put(`/invitations/${id}`, data);
  return res.data;
}

export async function submitInvitation(id: string, data: Record<string, unknown>) {
  const res = await client.post(`/invitations/${id}/submit`, data);
  return res.data;
}

export async function approveInvitation(id: string, data: Record<string, unknown>) {
  const res = await client.post(`/invitations/${id}/approve`, data);
  return res.data;
}

export async function rejectInvitation(id: string, data: Record<string, unknown>) {
  const res = await client.post(`/invitations/${id}/reject`, data);
  return res.data;
}

export async function reviewInvitation(id: string, data: Record<string, unknown>) {
  const res = await client.post(`/invitations/${id}/review`, data);
  return res.data;
}

export async function reviewRejectInvitation(id: string, data: Record<string, unknown>) {
  const res = await client.post(`/invitations/${id}/review-reject`, data);
  return res.data;
}

export async function reprocessInvitation(id: string, data: Record<string, unknown>) {
  const res = await client.post(`/invitations/${id}/reprocess`, data);
  return res.data;
}

export async function batchAction(data: Record<string, unknown>) {
  const res = await client.post('/invitations/batch', data);
  return res.data;
}

export async function getStats(params?: Record<string, string>) {
  const res = await client.get('/invitations/stats', { params });
  return res.data;
}

export async function uploadMaterial(id: string, file: File, operatorId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('operatorId', operatorId);
  const res = await client.post(`/invitations/${id}/materials`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function guestConfirm(id: string, data: Record<string, unknown>) {
  const res = await client.post(`/invitations/${id}/guest-confirm`, data);
  return res.data;
}

export async function checkinFeedback(id: string, data: Record<string, unknown>) {
  const res = await client.post(`/invitations/${id}/checkin-feedback`, data);
  return res.data;
}

export async function getAuditLogs(params: Record<string, unknown>) {
  const res = await client.get('/audit', { params });
  return res.data;
}
