export const STATUS_MAP = {
  draft: { label: '草稿', color: '#999' },
  pending: { label: '待审核', color: '#fa8c16' },
  supplement: { label: '待补正', color: '#fa541c' },
  processing: { label: '审核中', color: '#1890ff' },
  review: { label: '待复核', color: '#722ed1' },
  completed: { label: '已完成', color: '#52c41a' },
  rejected: { label: '已驳回', color: '#f5222d' },
  returned: { label: '已退回', color: '#eb2f96' }
}

export const ROLE_MAP = {
  registrar: { label: '会员服务登记员', color: '#1890ff' },
  auditor: { label: '会员服务审核主管', color: '#722ed1' },
  reviewer: { label: '口腔连锁门诊复核负责人', color: '#52c41a' }
}

export const PRIORITY_MAP = {
  high: { label: '高', color: '#f5222d' },
  normal: { label: '普通', color: '#1890ff' },
  low: { label: '低', color: '#8c8c8c' }
}

export const ATTACHMENT_STATUS_MAP = {
  pending: { label: '待审核', color: '#fa8c16' },
  approved: { label: '已通过', color: '#52c41a' },
  rejected: { label: '已驳回', color: '#f5222d' }
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function isOverdue(dueAt) {
  if (!dueAt) return false
  return new Date(dueAt) < new Date()
}
