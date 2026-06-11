const API_BASE = '/api';

export async function request(path, options = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const res = await fetch(API_BASE + path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = { code: 500, message: '服务器返回格式错误: ' + text };
  }

  if (res.status === 401 || data.code === 1001) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    if (location.hash !== '#/login') {
      location.hash = '#/login';
    }
    throw new Error(data.message || '登录已过期，请重新登录');
  }

  return data;
}

export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  const icons = {
    success: '✓',
    error: '✗',
    warning: '!',
    info: 'ℹ',
  };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span></span>`;
  toast.querySelector('span:last-child').textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function storeUser(user, token) {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('current_user', JSON.stringify(user));
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('current_user') || 'null');
  } catch {
    return null;
  }
}

export function clearUser() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('current_user');
}

export function statusClass(status) {
  const map = {
    DRAFT: 'tag-draft',
    PENDING_AUDIT: 'tag-pending-audit',
    NEED_CORRECTION: 'tag-need-correction',
    PENDING_REVIEW: 'tag-pending-review',
    ARCHIVED: 'tag-archived',
  };
  return map[status] || 'tag-draft';
}

export function handoverStatusClass(status) {
  const map = {
    PENDING: 'tag-handover-pending',
    ACCEPTED: 'tag-handover-accepted',
    REJECTED: 'tag-handover-rejected',
  };
  return map[status] || 'tag-handover-pending';
}

export function formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  return (
    dt.getFullYear() +
    '-' + pad(dt.getMonth() + 1) +
    '-' + pad(dt.getDate()) +
    ' ' + pad(dt.getHours()) +
    ':' + pad(dt.getMinutes())
  );
}

export function formatDateOnly(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
}

export function canEditApplication(app, user) {
  if (!user || !app) return false;
  if (user.role !== 'register') return false;
  if (app.status !== 'DRAFT' && app.status !== 'NEED_CORRECTION') return false;
  return app.registerId === user.id;
}

export function canSubmitApplication(app, user) {
  if (!user || !app) return false;
  if (user.role !== 'register') return false;
  if (app.status !== 'DRAFT' && app.status !== 'NEED_CORRECTION') return false;
  return app.registerId === user.id;
}

export function canAuditApplication(app, user) {
  if (!user || !app) return false;
  if (user.role !== 'auditor') return false;
  if (app.status !== 'PENDING_AUDIT') return false;
  return app.currentHandlerId === user.id;
}

export function canReviewApplication(app, user) {
  if (!user || !app) return false;
  if (user.role !== 'reviewer') return false;
  if (app.status !== 'PENDING_REVIEW') return false;
  return app.currentHandlerId === user.id;
}

export function canHandoverApplication(app, user) {
  if (!user || !app) return false;
  if (app.status === 'ARCHIVED') return false;
  switch (user.role) {
    case 'register':
      return (
        app.currentHandlerId === user.id ||
        (app.registerId === user.id &&
          (app.status === 'DRAFT' || app.status === 'NEED_CORRECTION'))
      );
    case 'auditor':
    case 'reviewer':
      return app.currentHandlerId === user.id;
    default:
      return false;
  }
}

export function roleDisplayName(role) {
  const map = {
    register: '开户登记员',
    auditor: '开户审核主管',
    reviewer: '水务营业厅复核负责人',
  };
  return map[role] || role;
}

export function processingRecordTypeClass(type) {
  const map = {
    TODO: 'tag-handover-pending',
    CORRECTION: 'tag-need-correction',
    REMARK: 'tag-draft',
  };
  return map[type] || 'tag-draft';
}

export function processingRecordStatusClass(status) {
  const map = {
    PENDING: 'tag-handover-pending',
    PROCESSING: 'tag-pending-audit',
    COMPLETED: 'tag-archived',
  };
  return map[status] || 'tag-draft';
}

export function canAddProcessingRecord(app, user) {
  if (!user || !app) return false;
  if (app.status === 'ARCHIVED') return false;
  return app.currentHandlerId === user.id;
}

export function canUpdateProcessingRecord(record, user) {
  if (!user || !record) return false;
  if (record.status === 'COMPLETED') return false;
  return record.handlerId === user.id;
}
