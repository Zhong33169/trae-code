export const API_BASE = 'http://localhost:8004/api';

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const defaultHeaders = {};
  
  if (options.body && !(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }
  
  const res = await fetch(url, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers }
  });
  
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      errMsg = err.detail || err.message || errMsg;
    } catch (e) {}
    throw new Error(errMsg);
  }
  
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res;
}

export const api = {
  getUsers: (role) => apiFetch(`/users${role ? `?role=${role}` : ''}`),
  getRoles: () => apiFetch('/roles'),
  getStatuses: () => apiFetch('/statuses'),
  
  listOrders: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/orders${qs ? `?${qs}` : ''}`);
  },
  getOrder: (id) => apiFetch(`/orders/${id}`),
  createOrder: (data) => apiFetch('/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id, data, operatorId) => apiFetch(`/orders/${id}`, { 
    method: 'PUT', 
    body: JSON.stringify({ ...data, operator_id: operatorId }) 
  }),
  submitOrder: (id, data, operatorId) => apiFetch(`/orders/${id}/submit`, { 
    method: 'POST', 
    body: JSON.stringify({ ...data, operator_id: operatorId }) 
  }),
  supervisorApprove: (id, data, operatorId) => apiFetch(`/orders/${id}/supervisor/approve`, { 
    method: 'POST', 
    body: JSON.stringify({ ...data, operator_id: operatorId }) 
  }),
  supervisorReturn: (id, data, operatorId) => apiFetch(`/orders/${id}/supervisor/return`, { 
    method: 'POST', 
    body: JSON.stringify({ ...data, operator_id: operatorId }) 
  }),
  supplementOrder: (id, data, operatorId) => apiFetch(`/orders/${id}/supplement`, { 
    method: 'POST', 
    body: JSON.stringify({ ...data, operator_id: operatorId }) 
  }),
  reviewerApprove: (id, data, operatorId) => apiFetch(`/orders/${id}/reviewer/approve`, { 
    method: 'POST', 
    body: JSON.stringify({ ...data, operator_id: operatorId }) 
  }),
  reviewerReturn: (id, data, operatorId) => apiFetch(`/orders/${id}/reviewer/return`, { 
    method: 'POST', 
    body: JSON.stringify({ ...data, operator_id: operatorId }) 
  }),
  markOverdue: (id, userId) => apiFetch(`/orders/${id}/mark-overdue?user_id=${userId}`, { method: 'POST' }),
  
  uploadAttachment: (orderId, file, userId) => {
    const form = new FormData();
    form.append('file', file);
    form.append('user_id', userId);
    form.append('file_name', file.name);
    return apiFetch(`/orders/${orderId}/attachments`, { method: 'POST', body: form });
  },
  listAttachments: (orderId) => apiFetch(`/orders/${orderId}/attachments`),
  deleteAttachment: (id, operatorId) => apiFetch(`/attachments/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ operator_id: operatorId })
  }),
  rejectAttachment: (id, reason, userId) =>
    apiFetch(`/attachments/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason, operator_id: userId })
    }),
  
  listAuditLogs: (orderId) => apiFetch(`/orders/${orderId}/audit-logs`),
  getStats: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/stats${qs ? `?${qs}` : ''}`);
  }
};
