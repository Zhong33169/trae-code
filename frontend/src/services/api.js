const API_BASE = '/api';

let currentToken = localStorage.getItem('scheduling_token') || '';

export function getToken() {
  return currentToken;
}

export function setToken(token) {
  currentToken = token;
  localStorage.setItem('scheduling_token', token);
}

export function clearToken() {
  currentToken = '';
  localStorage.removeItem('scheduling_token');
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const params = new URLSearchParams();
  if (currentToken) {
    params.set('token', currentToken);
  }
  const url = `${API_BASE}${path}${params.toString() ? '?' + params.toString() : ''}`;

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    const detail = data.detail || '操作失败';
    throw new Error(detail);
  }
  return data;
}

export const api = {
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  getMe: () => request('GET', '/auth/me'),
  getRoles: () => request('GET', '/roles'),
  getStatuses: () => request('GET', '/statuses'),
  getNodeTimeLimits: () => request('GET', '/node-time-limits'),

  listForms: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.keyword) qs.set('keyword', params.keyword);
    if (params.timeout_only) qs.set('timeout_only', 'true');
    return request('GET', `/forms?${qs.toString()}`);
  },
  getForm: (id) => request('GET', `/forms/${id}`),
  createForm: (data) => request('POST', '/forms', data),
  updateForm: (id, data) => request('PUT', `/forms/${id}`, data),
  transitionStatus: (id, action, remark) => request('POST', `/forms/${id}/transition`, { action, remark }),
  getAvailableActions: (id) => request('GET', `/forms/${id}/available-actions`),

  reviewCourseware: (id, data) => request('POST', `/forms/${id}/courseware-review`, data),
  getCoursewareReviews: (id) => request('GET', `/forms/${id}/courseware-reviews`),
  createEvaluation: (id, data) => request('POST', `/forms/${id}/evaluation`, data),
  getEvaluations: (id) => request('GET', `/forms/${id}/evaluations`),
  confirmTeaching: (id) => request('POST', `/forms/${id}/confirm-teaching`),

  getSchedules: (id) => request('GET', `/forms/${id}/schedules`),
  addSchedule: (id, data) => request('POST', `/forms/${id}/schedules`, data),

  getLogs: (id) => request('GET', `/forms/${id}/logs`),
  getTimeoutRecords: (id) => request('GET', `/forms/${id}/timeout-records`),
  handleTimeout: (id, data) => request('POST', `/forms/${id}/timeout-handle`, data),
  listTimeoutRecords: () => request('GET', '/timeout-records'),

  getStatistics: () => request('GET', '/statistics'),
  batchAction: (data) => request('POST', '/batch/action', data),

  initDb: () => request('POST', '/init-db'),
};
