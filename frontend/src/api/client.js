const BASE_URL = '/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(err.error || err.message || '请求失败');
    error.details = err;
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export function fetchUsers() {
  return request('/users');
}

export function fetchOrders(filters = {}) {
  const params = new URLSearchParams();
  if (filters.risk_level) params.set('risk_level', filters.risk_level);
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  return request(`/orders${qs ? '?' + qs : ''}`);
}

export function fetchOrderDetail(id) {
  return request(`/orders/${id}`);
}

export function createOrder(data) {
  return request('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function submitAction(orderId, actionData) {
  return request(`/orders/${orderId}/action`, {
    method: 'POST',
    body: JSON.stringify(actionData),
  });
}

export function changeRiskLevel(orderId, data) {
  return request(`/orders/${orderId}/risk`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateEvidence(orderId, data) {
  return request(`/orders/${orderId}/evidence`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function fetchStats() {
  return request('/stats');
}
