const API_BASE = '/api';

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
}

export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (currentUser) {
    headers['X-User'] = currentUser.username;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(data.detail || `请求失败: ${res.status}`);
  }
  return res.json();
}

export async function login(username) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
  setCurrentUser(data);
  return data;
}

export async function fetchUsers() {
  return apiFetch('/users');
}

export async function fetchDashboard() {
  return apiFetch('/dashboard');
}

export async function fetchApplications(params = {}) {
  const qs = new URLSearchParams();
  if (params.role) qs.set('role', params.role);
  if (params.status) qs.set('status', params.status);
  if (params.keyword) qs.set('keyword', params.keyword);
  const query = qs.toString();
  return apiFetch(`/applications${query ? '?' + query : ''}`);
}

export async function fetchApplication(id) {
  return apiFetch(`/applications/${id}`);
}

export async function createApplication(data) {
  return apiFetch('/applications', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function executeAction(id, action, opinion, materials, correctionMaterials, version) {
  return apiFetch(`/applications/${id}/action`, {
    method: 'POST',
    body: JSON.stringify({
      action,
      opinion: opinion || null,
      materials: materials || null,
      correction_materials: correctionMaterials || null,
      version,
    }),
  });
}

export async function batchAction(ids, action, opinion) {
  return apiFetch('/applications/batch-action', {
    method: 'POST',
    body: JSON.stringify({
      application_ids: ids,
      action,
      opinion: opinion || null,
    }),
  });
}

export async function fetchCorrections(appId) {
  return apiFetch(`/applications/${appId}/corrections`);
}

export async function fetchProcessRecords(appId) {
  return apiFetch(`/applications/${appId}/process-records`);
}

export async function fetchAuditLogs(appId) {
  return apiFetch(`/applications/${appId}/audit-logs`);
}

export async function fetchQueue(role) {
  return apiFetch(`/queue/${role}`);
}

export async function fetchRoles() {
  return apiFetch('/roles');
}

export async function triggerOverdueCheck() {
  return apiFetch('/overdue-check', { method: 'POST' });
}
