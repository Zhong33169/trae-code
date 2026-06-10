const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('mc_token');
}

export function setAuth(token, user) {
  localStorage.setItem('mc_token', token);
  localStorage.setItem('mc_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('mc_token');
  localStorage.removeItem('mc_user');
}

export function getCurrentUser() {
  const u = localStorage.getItem('mc_user');
  return u ? JSON.parse(u) : null;
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || data.message || `请求失败 (${res.status})`);
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),

  login: (username, password) => request('POST', '/login', { username, password }),
  getRecords: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/records${qs ? '?' + qs : ''}`);
  },
  getRecord: (id) => request('GET', `/records/${id}`),
  createRecord: (data) => request('POST', '/records', data),
  submitAudit: (id, data) => request('PUT', `/records/${id}/submit-audit`, data),
  auditPass: (id, data) => request('PUT', `/records/${id}/audit-pass`, data),
  auditReject: (id, data) => request('PUT', `/records/${id}/audit-reject`, data),
  reviewPass: (id, data) => request('PUT', `/records/${id}/review-pass`, data),
  reviewReject: (id, data) => request('PUT', `/records/${id}/review-reject`, data),
  batchAuditPass: (ids, audit_note, remark) => request('PUT', '/records/batch/audit-pass', { ids, audit_note, remark }),
  batchReviewPass: (ids, review_note, remark) => request('PUT', '/records/batch/review-pass', { ids, review_note, remark }),
  getBatches: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/batches${qs ? '?' + qs : ''}`);
  },
  getBatch: (id) => request('GET', `/batches/${id}`),
  getRecordBatches: (id) => request('GET', `/records/${id}/batches`),

  getChildren: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/children${qs ? '?' + qs : ''}`);
  },
  getChild: (id) => request('GET', `/children/${id}`),
  createChild: (data) => request('POST', '/children', data),
  updateChild: (id, data) => request('PUT', `/children/${id}`, data),

  getStats: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/stats/dashboard${qs ? '?' + qs : ''}`);
  },

  getLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/logs${qs ? '?' + qs : ''}`);
  },
};

export function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateTime(d) {
  if (!d) return '';
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return '0分钟';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}小时${mins}分钟`;
  return `${mins}分钟`;
}

export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
