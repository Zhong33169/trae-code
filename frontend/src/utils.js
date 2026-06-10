export const STATUS_LABELS = {
  draft: '草稿',
  pending_review: '待审核',
  review_passed: '审核通过',
  assigned: '已派单',
  in_progress: '维修中',
  completed: '待复核',
  revision_required: '待补正',
  archived: '已归档',
  rejected: '已驳回'
}

export const STATUS_COLORS = {
  draft: '#909399',
  pending_review: '#e6a23c',
  review_passed: '#67c23a',
  assigned: '#409eff',
  in_progress: '#409eff',
  completed: '#e6a23c',
  revision_required: '#f56c6c',
  archived: '#67c23a',
  rejected: '#f56c6c'
}

export const PRIORITY_LABELS = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急'
}

export const PRIORITY_COLORS = {
  low: '#909399',
  normal: '#409eff',
  high: '#e6a23c',
  urgent: '#f56c6c'
}

export const ROLE_LABELS = {
  registrar: '报修登记员',
  supervisor: '报修审核主管',
  reviewer: '物业服务中心复核负责人'
}

export const REPAIR_TYPES = ['水电维修', '家电维修', '土建维修', '公共设施', '绿化保洁', '安防门禁', '其他']

export function getUser() {
  const raw = localStorage.getItem('repair_user')
  return raw ? JSON.parse(raw) : null
}

export function setUser(user, token) {
  localStorage.setItem('repair_user', JSON.stringify(user))
  localStorage.setItem('repair_token', token)
}

export function clearAuth() {
  localStorage.removeItem('repair_user')
  localStorage.removeItem('repair_token')
}

export function formatTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatFileSize(bytes) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB'
  return (bytes/1048576).toFixed(2) + ' MB'
}
