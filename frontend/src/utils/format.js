export const STATUS_TEXT = {
  pending: '待分派',
  assigned: '已转办',
  revisited: '已回访',
};

export const NODE_TEXT = {
  report: '隐患上报',
  assign: '分派转办',
  rectify: '整改通知',
  recheck: '复查销项',
  confirm: '确认完成',
};

export const ROLE_TEXT = {
  clerk: '消防文员',
  supervisor: '防火监督员',
  station_chief: '站点负责人',
};

export const HAZARD_LEVEL_TEXT = {
  general: '一般',
  high: '较大',
  critical: '重大',
};

export const RECHECK_RESULT_TEXT = {
  pass: '通过',
  fail: '不通过',
};

export function formatTime(t) {
  if (!t) return '-';
  const d = new Date(t);
  if (isNaN(d.getTime())) return t;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(t) {
  if (!t) return '-';
  const d = new Date(t);
  if (isNaN(d.getTime())) return t;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysBetween(from, to) {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
}

export function isDeadlinePassed(deadline) {
  if (!deadline) return false;
  return new Date(deadline).getTime() < Date.now();
}

export function getDeadlineRemain(deadline) {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (diff < 0) {
    const abs = Math.abs(hours);
    if (abs > 24) return `已超时 ${Math.floor(abs / 24)} 天 ${abs % 24} 小时`;
    return `已超时 ${abs} 小时`;
  }
  if (hours > 24) return `剩余 ${Math.floor(hours / 24)} 天 ${hours % 24} 小时`;
  return `剩余 ${hours} 小时`;
}

export function canDo(user, order, action) {
  const status = order.status;
  const node = order.current_node;
  const isTimeout = order.is_timeout;

  switch (action) {
    case 'assign':
      return user.role === 'supervisor' && status === 'pending' && node === 'report';
    case 'rectify':
      return user.role === 'supervisor' && status === 'assigned' && node === 'rectify';
    case 'recheck':
      return user.role === 'station_chief' && status === 'assigned' && node === 'recheck';
    case 'confirm':
      return user.role === 'station_chief' && status === 'revisited';
    case 'handle_timeout':
      return isTimeout;
    default:
      return false;
  }
}

export function actionDisabledReason(user, order, action) {
  const roleText = ROLE_TEXT[user.role] || user.role;
  const statusText = STATUS_TEXT[order.status] || order.status;
  const nodeText = NODE_TEXT[order.current_node] || order.current_node;

  switch (action) {
    case 'assign':
      if (user.role !== 'supervisor') return `仅防火监督员可转办（当前岗位：${roleText}）`;
      if (order.status !== 'pending') return `仅「待分派」可转办（当前状态：${statusText}）`;
      return '';
    case 'rectify':
      if (user.role !== 'supervisor') return `仅防火监督员可提交整改（当前岗位：${roleText}）`;
      if (order.status !== 'assigned' || order.current_node !== 'rectify')
        return `仅「已转办-整改通知」可整改（当前：${statusText}-${nodeText}）`;
      return '';
    case 'recheck':
      if (user.role !== 'station_chief') return `仅站点负责人可复查（当前岗位：${roleText}）`;
      if (order.status !== 'assigned' || order.current_node !== 'recheck')
        return `仅「已转办-复查销项」可复查（当前：${statusText}-${nodeText}）`;
      return '';
    case 'confirm':
      if (user.role !== 'station_chief') return `仅站点负责人可确认（当前岗位：${roleText}）`;
      if (order.status !== 'revisited') return `仅「已回访」可确认（当前状态：${statusText}）`;
      return '';
    case 'handle_timeout':
      if (!order.is_timeout) return '该单据当前节点未超时，无需处理';
      return '';
    default:
      return '';
  }
}
