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

function buildQueryString(params) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    if (typeof value === 'boolean') {
      qs.set(key, value ? 'true' : 'false');
    } else {
      qs.set(key, String(value));
    }
  });
  if (currentToken) {
    qs.set('token', currentToken);
  }
  return qs.toString();
}

async function request(method, path, body = null, queryParams = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const qs = buildQueryString(queryParams);
  const url = `${API_BASE}${path}${qs ? '?' + qs : ''}`;

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

async function requestWithToken(method, path, body = null, queryParams = {}) {
  if (!currentToken) {
    throw new Error('未登录或会话已过期');
  }
  return request(method, path, body, queryParams);
}

export const api = {
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  getMe: () => requestWithToken('GET', '/auth/me'),
  getRoles: () => requestWithToken('GET', '/roles'),
  getStatuses: () => requestWithToken('GET', '/statuses'),
  getNodeTimeLimits: () => requestWithToken('GET', '/node-time-limits'),
  getVisibilityPolicy: () => requestWithToken('GET', '/visibility-policy'),

  listForms: (params = {}) => requestWithToken('GET', '/forms', null, params),
  getForm: (id) => requestWithToken('GET', `/forms/${id}`),
  createForm: (data) => requestWithToken('POST', '/forms', data),
  updateForm: (id, data) => requestWithToken('PUT', `/forms/${id}`, data),
  transitionStatus: (id, action, remark) => requestWithToken('POST', `/forms/${id}/transition`, { action, remark }),
  getAvailableActions: (id) => requestWithToken('GET', `/forms/${id}/available-actions`),
  getFormSubmitActions: (id) => requestWithToken('GET', `/forms/${id}/submit-actions`),

  reviewCourseware: (id, data) => requestWithToken('POST', `/forms/${id}/courseware-review`, data),
  getCoursewareReviews: (id) => requestWithToken('GET', `/forms/${id}/courseware-reviews`),
  createEvaluation: (id, data) => requestWithToken('POST', `/forms/${id}/evaluation`, data),
  getEvaluations: (id) => requestWithToken('GET', `/forms/${id}/evaluations`),
  confirmTeaching: (id) => requestWithToken('POST', `/forms/${id}/confirm-teaching`),

  getSchedules: (id) => requestWithToken('GET', `/forms/${id}/schedules`),
  addSchedule: (id, data) => requestWithToken('POST', `/forms/${id}/schedules`, data),

  getLogs: (id) => requestWithToken('GET', `/forms/${id}/logs`),
  getTimeoutRecords: (id) => requestWithToken('GET', `/forms/${id}/timeout-records`),
  handleTimeout: (id, data) => requestWithToken('POST', `/forms/${id}/timeout-handle`, data),
  listTimeoutRecords: () => requestWithToken('GET', '/timeout-records'),

  getStatistics: () => requestWithToken('GET', '/statistics'),
  batchAction: (data) => requestWithToken('POST', '/batch/action', data),

  initDb: () => request('POST', '/init-db'),
};

export function extractFormFromResponse(response) {
  if (!response) return null;
  if (response.form) return response.form;
  if (response.id) return response;
  return response;
}

export function extractActionsFromResponse(response) {
  if (!response) return [];
  if (response.submit_actions) return response.submit_actions;
  if (Array.isArray(response)) return response;
  return [];
}
