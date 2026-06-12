const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('fire_token') || '';
}

function setToken(token) {
  localStorage.setItem('fire_token', token);
}

function clearToken() {
  localStorage.removeItem('fire_token');
  localStorage.removeItem('fire_user');
}

function getUser() {
  try {
    const raw = localStorage.getItem('fire_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setUser(user) {
  localStorage.setItem('fire_user', JSON.stringify(user));
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resp = await fetch(API_BASE + path, {
    ...options,
    headers,
  });

  const text = await resp.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || '响应解析失败' };
  }

  if (!resp.ok) {
    const err = new Error(data.error || `请求失败 (${resp.status})`);
    err.detail = data.detail || '';
    err.code = data.code || resp.status;
    err.status = resp.status;
    throw err;
  }

  return data;
}

export const api = {
  login: (username, password) =>
    request('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request('/me'),
  users: () => request('/users'),
  statistics: () => request('/statistics'),
  listOrders: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/orders?${qs}`);
  },
  getOrder: (id) => request(`/orders/${id}`),
  createOrder: (data) =>
    request('/orders', { method: 'POST', body: JSON.stringify(data) }),
  assignOrder: (id, data) =>
    request(`/orders/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
  rectifyOrder: (id, data) =>
    request(`/orders/${id}/rectify`, { method: 'POST', body: JSON.stringify(data) }),
  recheckOrder: (id, data) =>
    request(`/orders/${id}/recheck`, { method: 'POST', body: JSON.stringify(data) }),
  confirmOrder: (id, data) =>
    request(`/orders/${id}/confirm`, { method: 'POST', body: JSON.stringify(data) }),
  handleTimeout: (id, data) =>
    request(`/orders/${id}/handle-timeout`, { method: 'POST', body: JSON.stringify(data) }),
  batchStatus: (ids) =>
    request('/orders/batch-status', { method: 'POST', body: JSON.stringify({ ids }) }),
};

export const auth = {
  getToken,
  setToken,
  clearToken,
  getUser,
  setUser,
};
