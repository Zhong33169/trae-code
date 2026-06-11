const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8007').replace(/\/$/, '');

let currentUser = {
  id: localStorage.getItem('__demo_user_id') || 'registrar_demo',
  role: localStorage.getItem('__demo_user_role') || 'registrar',
};

export function getCurrentUser() {
  return { ...currentUser };
}

export function setCurrentUser(userId, role) {
  currentUser = { id: userId, role };
  localStorage.setItem('__demo_user_id', userId);
  localStorage.setItem('__demo_user_role', role);
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': currentUser.id,
    'X-User-Role': currentUser.role,
  };
}

async function request(path, options = {}) {
  const url = API_BASE + path;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = { success: false, error: `响应解析失败：${text.slice(0, 100)}` };
  }
  if (!res.ok || !json.success) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.detail = json.errorDetail;
    err.concurrencyError = json.concurrencyError;
    err.versionError = json.versionError;
    err.currentVersion = json.currentVersion;
    err.status = res.status;
    throw err;
  }
  return json.data;
}

export const api = {
  health: () => request('/api/health'),
  meta: () => request('/api/meta'),
  me: () => request('/api/auth/me'),
  switchUser: (userId, role) =>
    request('/api/auth/switch', {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    }),
  statistics: () => request('/api/statistics'),
  listOrders: (params = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    }
    return request('/api/orders' + (q.toString() ? `?${q.toString()}` : ''));
  },
  getOrder: (id) => request(`/api/orders/${id}`),
  createOrder: (data) =>
    request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDraftOrder: (id, data) =>
    request(`/api/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  lockOrder: (id) =>
    request(`/api/orders/lock/${id}`, {
      method: 'POST',
    }),
  doAction: (id, payload) =>
    request(`/api/orders/${id}/action`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  batch: (payload) =>
    request('/api/orders/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  previewBatch: (payload) =>
    request('/api/orders/batch/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  auditLogs: (params = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    }
    return request('/api/audit-logs' + (q.toString() ? `?${q.toString()}` : ''));
  },
  auditLogsByOrder: (orderId) => request(`/api/audit-logs/order/${orderId}`),
};
