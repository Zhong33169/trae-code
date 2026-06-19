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

const ACTION_WHITELIST = [
  { action: 'submit', role: 'hr_specialist', node: 'hr_specialist', status: 'pending_review', types: null },
  { action: 'submit', role: 'salary_supervisor', node: 'salary_supervisor', status: 'budget_checking', types: null },
  { action: 'submit', role: 'hrbp_leader', node: 'hrbp_leader', status: 'pending_confirm', types: null },

  { action: 'reject', role: 'hr_specialist', node: 'hr_specialist', status: 'pending_review', types: null },
  { action: 'reject', role: 'salary_supervisor', node: 'salary_supervisor', status: 'budget_checking', types: null },
  { action: 'reject', role: 'hrbp_leader', node: 'hrbp_leader', status: 'pending_confirm', types: null },

  { action: 'verify_budget', role: 'salary_supervisor', node: 'salary_supervisor', status: 'budget_checking',
    types: ['transfer', 'salary_adjustment', 'both'] },
  { action: 'process_salary', role: 'salary_supervisor', node: 'salary_supervisor', status: 'budget_checking',
    types: ['salary_adjustment', 'both'] },

  { action: 'register', role: 'hr_specialist', node: 'completed', status: 'approved', types: null },
];

export function prerequisitesForType(type) {
  switch (type) {
    case 'transfer': return { needBudget: true, needSalary: false };
    case 'salary_adjustment': return { needBudget: true, needSalary: true };
    case 'both':
    default: return { needBudget: true, needSalary: true };
  }
}

export function canPerformAction(appType, appStatus, appNode, userRole, action) {
  return ACTION_WHITELIST.some(rule =>
    rule.action === action &&
    rule.role === userRole &&
    rule.node === appNode &&
    rule.status === appStatus &&
    (!rule.types || rule.types.includes(appType))
  );
}

export function actionPermissionError(appType, action, userRole, appNode, appStatus) {
  switch (action) {
    case 'verify_budget':
      if (userRole !== 'salary_supervisor') return '仅薪酬主管可执行预算校验';
      return '当前节点/状态不支持预算校验';
    case 'process_salary':
      if (userRole !== 'salary_supervisor') return '仅薪酬主管可执行调薪处理';
      const { needSalary } = prerequisitesForType(appType);
      if (!needSalary) return '此异动类型（调岗）不涉及调薪，无需执行调薪处理';
      return '当前节点/状态不支持调薪处理';
    case 'register':
      return '仅人事专员可在审核通过后进行异动登记';
    case 'submit':
    case 'reject':
      return '当前节点需由' + (NODE_LABELS[appNode] || appNode) + '处理，您无操作权限';
    default:
      return '不支持的操作类型';
  }
}
