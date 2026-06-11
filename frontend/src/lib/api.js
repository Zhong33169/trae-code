const API_BASE = '/api';

export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/users`);
  const json = await res.json();
  return json.data || [];
}

export async function fetchOrders(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.risk_level) query.set('risk_level', params.risk_level);
  if (params.handler_id) query.set('handler_id', params.handler_id);
  const qs = query.toString();
  const res = await fetch(`${API_BASE}/orders${qs ? '?' + qs : ''}`);
  const json = await res.json();
  return json.data || [];
}

export async function fetchOrder(id) {
  const res = await fetch(`${API_BASE}/orders/${id}`);
  const json = await res.json();
  return json.data || null;
}

export async function createOrder(data) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function processOrder(id, data) {
  const res = await fetch(`${API_BASE}/orders/${id}/process`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  const json = await res.json();
  return json.data || {};
}

export async function markOverdue() {
  const res = await fetch(`${API_BASE}/orders/mark-overdue`, { method: 'POST' });
  return res.json();
}

export async function fetchManagerWorkbench() {
  const res = await fetch(`${API_BASE}/manager/workbench`);
  const json = await res.json();
  return json.data || null;
}

export const STATUS_MAP = {
  registered: { label: '登记',     color: '#3b82f6', bg: '#eff6ff' },
  verifying:  { label: '核验',     color: '#f59e0b', bg: '#fffbeb' },
  reviewing:  { label: '待复核',   color: '#6366f1', bg: '#eef2ff' },
  archived:   { label: '归档',     color: '#10b981', bg: '#ecfdf5' },
  rejected:   { label: '驳回',     color: '#b91c1c', bg: '#fef2f2' },
  returned:   { label: '退回补正', color: '#ef4444', bg: '#fef2f2' },
  overdue:    { label: '逾期',     color: '#dc2626', bg: '#fef2f2' },
  conflict:   { label: '冲突',     color: '#7c3aed', bg: '#f5f3ff' }
};

export const STATUS_ACTIONS = {
  registered: [
    { action: 'advance', label: '推进至核验',   icon: '➡️' },
    { action: 'return',  label: '退回补正',     icon: '↩️' }
  ],
  verifying: [
    { action: 'advance', label: '推进至经理复核', icon: '➡️' },
    { action: 'return',  label: '退回补正',       icon: '↩️' }
  ],
  reviewing: [
    { action: 'approve', label: '复核通过归档', icon: '✅' },
    { action: 'reject',  label: '经理驳回',     icon: '❌' },
    { action: 'return',  label: '退回补正',     icon: '↩️' }
  ],
  rejected: [
    { action: 'correct',   label: '经理特批回核验', icon: '🔄' },
    { action: 'force_fix', label: '强制回登记重走', icon: '🔧' }
  ],
  returned: [
    { action: 'correct', label: '补正提交', icon: '🔄' }
  ],
  overdue: [
    { action: 'advance', label: '推进至核验', icon: '➡️' }
  ],
  conflict: [
    { action: 'force_fix', label: '强制修复（回登记）', icon: '🔧' }
  ],
  archived: []
};

export const RISK_MAP = {
  high:   { label: '高风险', color: '#dc2626', bg: '#fef2f2', priority: 0 },
  medium: { label: '中风险', color: '#f59e0b', bg: '#fffbeb', priority: 1 },
  low:    { label: '低风险', color: '#10b981', bg: '#ecfdf5', priority: 2 }
};

export const ROLE_MAP = {
  warehouse_keeper:  { label: '仓管员', icon: '📋' },
  temp_supervisor:   { label: '温控主管', icon: '🌡️' },
  warehouse_manager: { label: '仓储经理', icon: '👔' }
};

export const RESULT_MAP = {
  passed:      { label: '通过', color: '#10b981' },
  returned:    { label: '退回', color: '#ef4444' },
  rejected:    { label: '驳回', color: '#dc2626' },
  corrected:   { label: '已补正', color: '#3b82f6' },
  conflict:    { label: '冲突', color: '#7c3aed' },
  force_fixed: { label: '已强制修复', color: '#8b5cf6' }
};

export const ACTION_MAP = {
  submit:    { label: '提交登记', icon: '📝' },
  advance:   { label: '推进处理', icon: '➡️' },
  return:    { label: '退回补正', icon: '↩️' },
  approve:   { label: '复核通过', icon: '✅' },
  reject:    { label: '驳回', icon: '❌' },
  correct:   { label: '补正提交', icon: '🔄' },
  force_fix: { label: '强制修复冲突', icon: '🔧' }
};
