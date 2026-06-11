const BASE = '/api';

async function request(url, options = {}) {
  const resp = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await resp.json();
  if (!resp.ok || data.ok === false) {
    const err = new Error(data.reason || `请求失败 (${resp.status})`);
    err.status = resp.status;
    err.details = data.details;
    err.responseData = data;
    throw err;
  }
  return data;
}

export const api = {
  login(username) {
    return request('/login', { method: 'POST', body: JSON.stringify({ username }) });
  },
  getUsers() {
    return request('/users');
  },
  getTickets(params = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.pen_id) qs.set('pen_id', params.pen_id);
    if (params.role) qs.set('role', params.role);
    const query = qs.toString();
    return request('/tickets' + (query ? '?' + query : ''));
  },
  getTicketDetail(id) {
    return request(`/tickets/${id}`);
  },
  createTicket(data) {
    return request('/tickets', { method: 'POST', body: JSON.stringify(data) });
  },
  updateTicket(id, data) {
    return request(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  ticketAction(id, data) {
    return request(`/tickets/${id}/action`, { method: 'POST', body: JSON.stringify(data) });
  },
  supplementTicket(id, data) {
    return request(`/tickets/${id}/supplement`, { method: 'POST', body: JSON.stringify(data) });
  },
  batchAction(data) {
    return request('/tickets/batch-action', { method: 'POST', body: JSON.stringify(data) });
  },
  addEvidence(ticketId, data) {
    return request(`/tickets/${ticketId}/evidence`, { method: 'POST', body: JSON.stringify(data) });
  },
  addPenInspection(ticketId, data) {
    return request(`/tickets/${ticketId}/pen-inspections`, { method: 'POST', body: JSON.stringify(data) });
  },
  addHealthReport(ticketId, data) {
    return request(`/tickets/${ticketId}/health-reports`, { method: 'POST', body: JSON.stringify(data) });
  },
  addTreatmentTracking(ticketId, data) {
    return request(`/tickets/${ticketId}/treatment-trackings`, { method: 'POST', body: JSON.stringify(data) });
  },
  getStats() {
    return request('/stats');
  },
};

export const STATUS_LABELS = {
  draft: '草稿',
  submitted: '已提交',
  under_review: '审核中',
  reviewed: '已审核',
  archived: '已归档',
  rejected: '已驳回',
  returned: '已退回',
};

export const ROLE_LABELS = {
  registrar: '登记员',
  supervisor: '审核主管',
  reviewer: '复核负责人',
};

export const STATUS_COLORS = {
  draft: '#909399',
  submitted: '#409eff',
  under_review: '#e6a23c',
  reviewed: '#67c23a',
  archived: '#909399',
  rejected: '#f56c6c',
  returned: '#f56c6c',
};

export const HEALTH_LABELS = {
  healthy: '健康',
  mild: '轻微异常',
  sick: '患病',
  critical: '危重',
};

export const CLEANLINESS_LABELS = {
  clean: '清洁',
  acceptable: '可接受',
  dirty: '脏污',
};

export const VENTILATION_LABELS = {
  good: '良好',
  fair: '一般',
  poor: '差',
};
