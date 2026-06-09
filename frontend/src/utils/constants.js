export const ROLE_OPTIONS = [
  { value: 'registrar', label: '配镜登记员', color: '#1890ff' },
  { value: 'supervisor', label: '配镜审核主管', color: '#52c41a' },
  { value: 'reviewer', label: '眼科诊所复核负责人', color: '#722ed1' },
]

export const STATUS_OPTIONS = [
  { value: 'pending_registration', label: '待登记', color: '#8c8c8c' },
  { value: 'pending_review', label: '待审核', color: '#faad14' },
  { value: 'pending_final', label: '待复核', color: '#1890ff' },
  { value: 'returned', label: '已退回', color: '#f5222d' },
  { value: 'archived', label: '已归档', color: '#52c41a' },
  { value: 'abnormal', label: '异常', color: '#fa541c' },
]

export const ANOMALY_OPTIONS = [
  { value: 'duplicate_batch', label: '重复批次', color: '#fa541c' },
  { value: 'status_mismatch', label: '状态不一致', color: '#fa541c' },
  { value: 'missing_materials', label: '材料缺失', color: '#faad14' },
  { value: 'overdue', label: '超时', color: '#f5222d' },
]

export const OFFLINE_STATUS_OPTIONS = [
  { value: 'not_recorded', label: '线下未登记' },
  { value: 'registered', label: '线下已登记' },
  { value: 'reviewed', label: '线下已审核' },
  { value: 'finalized', label: '线下已复核' },
  { value: 'archived', label: '线下已归档' },
]

export function getStatusInfo(status) {
  return STATUS_OPTIONS.find((s) => s.value === status) || { label: status, color: '#8c8c8c' }
}

export function getAnomalyInfo(type) {
  return ANOMALY_OPTIONS.find((a) => a.value === type) || { label: type, color: '#8c8c8c' }
}

export function getRoleInfo(role) {
  return ROLE_OPTIONS.find((r) => r.value === role) || { label: role, color: '#8c8c8c' }
}

export const MATERIAL_ITEMS = [
  { key: 'has_prescription', label: '处方单' },
  { key: 'has_insurance', label: '医保材料' },
  { key: 'has_id_copy', label: '身份证复印件' },
  { key: 'has_receipt', label: '收费凭证' },
]
