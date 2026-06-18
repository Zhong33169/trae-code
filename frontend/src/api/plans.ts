import { api } from './client';

export async function listPlans(params: any) {
  return api<any>('/plans', { params });
}

export async function getPlan(id: number) {
  return api<any>('/plans/' + id);
}

export async function createPlan(data: any) {
  return api<any>('/plans', { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePlan(id: number, data: any) {
  return api<any>('/plans/' + id, { method: 'PUT', body: JSON.stringify(data) });
}

export async function submitAudit(id: number) {
  return api<any>(`/plans/${id}/submit-audit`, { method: 'POST' });
}

export async function audit(id: number, pass: boolean, remark?: string) {
  return api<any>(`/plans/${id}/audit`, { method: 'POST', body: JSON.stringify({ pass, remark }) });
}

export async function submitMaterial(id: number, materialInfo?: string) {
  return api<any>(`/plans/${id}/submit-material`, { method: 'POST', body: JSON.stringify({ materialInfo }) });
}

export async function auditMaterial(id: number, pass: boolean, remark?: string) {
  return api<any>(`/plans/${id}/audit-material`, { method: 'POST', body: JSON.stringify({ pass, remark }) });
}

export async function confirmDelivery(id: number, remark?: string) {
  return api<any>(`/plans/${id}/confirm-delivery`, { method: 'POST', body: JSON.stringify({ remark }) });
}

export async function archivePlan(id: number, remark?: string) {
  return api<any>(`/plans/${id}/archive`, { method: 'POST', body: JSON.stringify({ remark }) });
}

export async function handover(id: number, data: any) {
  return api<any>(`/plans/${id}/handover`, { method: 'POST', body: JSON.stringify(data) });
}

export async function acceptHandover(id: number, acceptRemark?: string) {
  return api<any>(`/plans/${id}/accept-handover`, { method: 'POST', body: JSON.stringify({ acceptRemark }) });
}

export async function listReceivers(role: string) {
  return api<any>(`/plans/receivers`, { params: { role } });
}

export async function statistics() {
  return api<any>('/plans/statistics');
}

export async function batchAudit(ids: number[], pass: boolean, remark?: string) {
  return api<any>('/plans/batch/audit', { method: 'POST', body: JSON.stringify({ ids, pass, remark }) });
}
