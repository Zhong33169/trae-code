export const statusNames = {
  pending_registration: '待登记',
  registered: '已登记',
  dispatched: '已派单',
  completed: '已完工',
  archived: '已归档',
  returned_for_correction: '退回补正',
  missing_evidence: '缺证据',
  overdue: '逾期',
  status_conflict: '状态冲突',
}

export const riskNames = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
}

export const stageNames = {
  registration: '报修登记',
  dispatch: '师傅派单',
  acceptance: '完工验收',
  review: '复核归档',
}

export const actionNames = {
  '创建订单': '创建订单',
  '派单': '师傅派单',
  '完工验收': '完工验收',
  '归档': '复核归档',
  '退回补正': '退回补正',
  '标记缺证据': '标记缺证据',
  '标记逾期': '标记逾期',
  '标记状态冲突': '标记状态冲突',
  're_submit': '补正重提',
  'return_to_registrar': '退回登记员',
  'dispatch': '师傅派单',
  'complete': '完工验收',
  'archive': '复核归档',
}

export const roleNames = {
  registrar: '维修登记员',
  supervisor: '维修审核主管',
  reviewer: '复核负责人',
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const now = new Date()
  const diff = d - now
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  const dateStr2 = d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  if (days < 0) {
    return `${dateStr2} (逾期${Math.abs(days)}天)`
  } else if (days <= 1) {
    return `${dateStr2} (剩余${days}天)`
  }
  return dateStr2
}

export function getPriorityClass(priority) {
  if (priority >= 80) return 'high'
  if (priority >= 40) return 'medium'
  return 'low'
}
