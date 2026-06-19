export const API_BASE = 'http://localhost:8001/api'

export const roleLabel = (role: string) => {
  switch (role) {
    case 'registrar': return '苗种登记员'
    case 'auditor': return '苗种审核主管'
    case 'reviewer': return '水产养殖基地复核负责人'
    default: return role
  }
}

export const nodeLabel = (node: string) => {
  switch (node) {
    case 'registration': return '苗种登记'
    case 'audit': return '苗种审核'
    case 'pond_entry': return '苗种入塘'
    case 'survival_observe': return '成活观察'
    case 'archive_review': return '批次归档复核'
    case 'done': return '已完成'
    default: return node
  }
}

export const statusLabel = (status: string) => {
  switch (status) {
    case 'pending': return '待处理'
    case 'processing': return '处理中'
    case 'approved': return '审核通过'
    case 'completed': return '已完成'
    case 'rejected': return '已驳回'
    case 'correction': return '待补正'
    default: return status
  }
}

export const statusColor = (status: string) => {
  switch (status) {
    case 'pending': return '#f59e0b'
    case 'processing': return '#3b82f6'
    case 'approved': return '#10b981'
    case 'completed': return '#059669'
    case 'correction': return '#ef4444'
    case 'rejected': return '#dc2626'
    default: return '#6b7280'
  }
}

export const formatTime = (s?: string) => {
  if (!s) return '-'
  try {
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    return d.toLocaleString('zh-CN', { hour12: false })
  } catch { return s }
}

export const fmtDateTimeInput = (s?: string) => {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
