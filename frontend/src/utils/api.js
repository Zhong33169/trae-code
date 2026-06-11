const BASE = '';

function getToken() {
  return localStorage.getItem('bus_token') || '';
}

function setToken(t) {
  if (t) localStorage.setItem('bus_token', t);
  else localStorage.removeItem('bus_token');
}

function getUser() {
  const raw = localStorage.getItem('bus_user');
  return raw ? JSON.parse(raw) : null;
}

function setUser(u) {
  if (u) localStorage.setItem('bus_user', JSON.stringify(u));
  else localStorage.removeItem('bus_user');
}

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const resp = await fetch(BASE + url, { ...options, headers });
  let data;
  try { data = await resp.json(); } catch (e) { data = { code: resp.status, message: resp.statusText }; }

  if (resp.status === 401) {
    setToken(null); setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
  return { status: resp.status, ok: resp.ok, data };
}

export const api = {
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),

  listSchedules: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request('/api/schedules?' + qs);
  },
  getSchedule: (id) => request('/api/schedules/' + id),
  createSchedule: (body) => request('/api/schedules', { method: 'POST', body: JSON.stringify(body) }),
  updateSchedule: (id, body) => request('/api/schedules/' + id, { method: 'PUT', body: JSON.stringify(body) }),
  submitSchedule: (id) => request('/api/schedules/' + id + '/submit', { method: 'POST' }),
  auditSchedule: (id, result, opinion) => request('/api/schedules/' + id + '/audit', { method: 'POST', body: JSON.stringify({ result, opinion }) }),
  reviewSchedule: (id, result, opinion) => request('/api/schedules/' + id + '/review', { method: 'POST', body: JSON.stringify({ result, opinion }) }),
  deleteSchedule: (id) => request('/api/schedules/' + id, { method: 'DELETE' }),

  statistics: () => request('/api/statistics'),
  operationLogs: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request('/api/operation-logs?' + qs);
  },
  listUsers: () => request('/api/users/list')
};

export const authStore = { getToken, setToken, getUser, setUser };
