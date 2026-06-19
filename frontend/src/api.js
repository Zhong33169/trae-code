const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('transfer_token');
}

function setToken(token) {
  localStorage.setItem('transfer_token', token);
}

function clearToken() {
  localStorage.removeItem('transfer_token');
  localStorage.removeItem('transfer_user');
}

function getCurrentUser() {
  const u = localStorage.getItem('transfer_user');
  return u ? JSON.parse(u) : null;
}

function setCurrentUser(user) {
  localStorage.setItem('transfer_user', JSON.stringify(user));
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const data = await resp.json().catch(() => ({}));

  if (resp.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('app:logout'));
    throw new Error(data.message || '登录已过期，请重新登录');
  }

  if (data.code !== 0) {
    throw new Error(data.message || '请求失败');
  }

  return data.data;
}

export const api = {
  login(username, password) {
    return request('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },
  me() {
    return request('/me');
  },
  listEmployees() {
    return request('/employees');
  },
  listApplications(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/applications${qs ? '?' + qs : ''}`);
  },
  getApplication(id) {
    return request(`/applications/${id}`);
  },
  createApplication(data) {
    return request('/applications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  processApplication(id, data) {
    return request(`/applications/${id}/process`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  batchProcess(data) {
    return request('/applications/batch', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  getStatistics() {
    return request('/statistics');
  },
  listOperationLogs() {
    return request('/operation-logs');
  },
  getToken, setToken, clearToken, getCurrentUser, setCurrentUser
};

export const ROLE_LABELS = {
  hr_specialist: '人事专员',
  salary_supervisor: '薪酬主管',
  hrbp_leader: 'HRBP负责人'
};

export const NODE_LABELS = {
  hr_specialist: '人事专员',
  salary_supervisor: '薪酬主管',
  hrbp_leader: 'HRBP负责人',
  completed: '已完成'
};

export const STATUS_LABELS = {
  pending_review: '待审核',
  budget_checking: '预算校验中',
  pending_confirm: '待确认',
  approved: '审核通过',
  synced: '已同步',
  rejected: '已驳回'
};

export const STATUS_COLORS = {
  pending_review: '#fa8c16',
  budget_checking: '#1890ff',
  pending_confirm: '#722ed1',
  approved: '#52c41a',
  synced: '#13c2c2',
  rejected: '#f5222d'
};

export const TYPE_LABELS = {
  transfer: '调岗',
  salary_adjustment: '调薪',
  both: '调岗调薪'
};
