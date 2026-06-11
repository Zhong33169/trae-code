const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8007';

const getUserId = () => {
  return localStorage.getItem('fsc_user_id') || '';
};

const request = async (path, options = {}) => {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const userId = getUserId();
  if (userId) {
    headers['X-User-Id'] = userId;
  }

  const config = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body !== 'string') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, config);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `请求失败 (${res.status})`);
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('无法连接到服务器，请确认后端服务已启动');
    }
    throw err;
  }
};

export const expenseApi = {
  getList: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/expenses${query ? `?${query}` : ''}`);
  },

  getDetail: (id) => {
    return request(`/api/expenses/${id}`);
  },

  getStats: () => {
    return request('/api/expenses/stats');
  },

  getUsers: () => {
    return request('/api/expenses/users');
  },

  getMaterialConfig: () => {
    return request('/api/expenses/material-config');
  },

  getAuditLogs: (id) => {
    return request(`/api/expenses/${id}/audit-logs`);
  },

  create: (data) => {
    return request('/api/expenses', { method: 'POST', body: data });
  },

  updateMaterials: (id, data) => {
    return request(`/api/expenses/${id}/update-materials`, { method: 'POST', body: data });
  },

  submit: (id, version) => {
    return request(`/api/expenses/${id}/submit`, { method: 'POST', body: { version } });
  },

  startVerify: (id, version) => {
    return request(`/api/expenses/${id}/start-verify`, { method: 'POST', body: { version } });
  },

  passVerify: (id, data) => {
    return request(`/api/expenses/${id}/pass-verify`, { method: 'POST', body: data });
  },

  rejectVerify: (id, data) => {
    return request(`/api/expenses/${id}/reject-verify`, { method: 'POST', body: data });
  },

  requestSupplement: (id, data) => {
    return request(`/api/expenses/${id}/request-supplement`, { method: 'POST', body: data });
  },

  passReview: (id, data) => {
    return request(`/api/expenses/${id}/pass-review`, { method: 'POST', body: data });
  },

  rejectReview: (id, data) => {
    return request(`/api/expenses/${id}/reject-review`, { method: 'POST', body: data });
  },

  updateDeadline: (id, deadline) => {
    return request(`/api/expenses/${id}/update-deadline`, { method: 'POST', body: { deadline } });
  },

  batchStartVerify: (items) => {
    return request('/api/expenses/batch/start-verify', { method: 'POST', body: { items } });
  },

  batchPassReview: (items, opinion) => {
    return request('/api/expenses/batch/pass-review', { method: 'POST', body: { items, opinion } });
  },

  batchRejectReview: (items, reason) => {
    return request('/api/expenses/batch/reject-review', { method: 'POST', body: { items, reason } });
  },
};

export const setCurrentUser = (userId) => {
  localStorage.setItem('fsc_user_id', userId);
};

export const getCurrentUserId = () => {
  return localStorage.getItem('fsc_user_id') || '';
};
