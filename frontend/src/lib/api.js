export const API_BASE = 'http://localhost:8004/api';

export function getCurrentUserId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('currentUserId');
}

export async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const currentUser = getCurrentUserId();
  if (currentUser) {
    headers['X-User-Id'] = currentUser;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || `请求失败 (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  getUsers: () => apiRequest('/users'),
  getApplications: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/applications${qs ? '?' + qs : ''}`);
  },
  getApplication: (id) => apiRequest(`/applications/${id}`),
  createApplication: (data) => apiRequest('/applications', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  submitApplication: (id, data = {}) => apiRequest(`/applications/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  approveApplication: (id, data = {}) => apiRequest(`/applications/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  rejectApplication: (id, data) => apiRequest(`/applications/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  archiveApplication: (id, data = {}) => apiRequest(`/applications/${id}/archive`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  batchArchive: (data) => apiRequest('/applications/batch-archive', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  addAttachment: (id, data) => apiRequest(`/applications/${id}/attachments`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteAttachment: (id, attachId) => apiRequest(`/applications/${id}/attachments/${attachId}`, {
    method: 'DELETE'
  }),
  updateAuditRemark: (id, data) => apiRequest(`/applications/${id}/audit-remark`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  validateLedger: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/applications/validate/ledger?${qs}`);
  },
  getAuditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/audit${qs ? '?' + qs : ''}`);
  },
  getAuditFailures: () => apiRequest('/audit/failures')
};
