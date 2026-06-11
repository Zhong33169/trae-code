const API_BASE = import.meta.env.VITE_API_BASE || '';

function getHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'X-Role': localStorage.getItem('role') || 'registrar',
    'X-User': localStorage.getItem('user') || '演示用户',
    ...extra,
  };
}

async function handleResponse(res) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const msg = data.detail || data.error || `请求失败 (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function listContracts(roleFilter, statusFilter) {
  const params = new URLSearchParams();
  if (roleFilter) params.set('role_filter', roleFilter);
  if (statusFilter) params.set('status_filter', statusFilter);
  const url = `${API_BASE}/api/contracts/?${params.toString()}`;
  const res = await fetch(url, { headers: getHeaders() });
  return handleResponse(res);
}

export async function getContract(id) {
  const res = await fetch(`${API_BASE}/api/contracts/${id}`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function getStatistics() {
  const res = await fetch(`${API_BASE}/api/contracts/statistics`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function listRoles() {
  const res = await fetch(`${API_BASE}/api/roles`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function createContract(title) {
  const res = await fetch(`${API_BASE}/api/contracts/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ title }),
  });
  return handleResponse(res);
}

export async function updateDraft(id, payload) {
  const res = await fetch(`${API_BASE}/api/contracts/${id}/draft`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function submitContract(id, payload) {
  const res = await fetch(`${API_BASE}/api/contracts/${id}/submit`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function auditPass(id, payload) {
  const res = await fetch(`${API_BASE}/api/contracts/${id}/audit-pass`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function auditReject(id, payload) {
  const res = await fetch(`${API_BASE}/api/contracts/${id}/audit-reject`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function reviewPass(id, payload) {
  const res = await fetch(`${API_BASE}/api/contracts/${id}/review-pass`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function reviewReject(id, payload) {
  const res = await fetch(`${API_BASE}/api/contracts/${id}/review-reject`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function batchProcess(payload) {
  const res = await fetch(`${API_BASE}/api/contracts/batch`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}
