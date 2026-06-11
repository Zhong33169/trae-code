export const ROLE_LABELS = {
  registrar: '投保登记员',
  supervisor: '投保审核主管',
  reviewer: '复核负责人',
}

export const STATUS_LABELS = {
  draft: '草稿',
  pending_scan: '待扫码核验',
  scan_failed: '扫码失败',
  pending_review: '待主管审核',
  revision_required: '待补正',
  pending_approval: '待复核归档',
  approved: '已通过',
  rejected: '已拒保',
  archived: '已归档',
}

export const STATUS_COLORS = {
  draft: 'default',
  pending_scan: 'blue',
  scan_failed: 'red',
  pending_review: 'orange',
  revision_required: 'warning',
  pending_approval: 'cyan',
  approved: 'green',
  rejected: 'red',
  archived: 'purple',
}

export const ACTION_LABELS = {
  scan_pass: '扫码通过',
  scan_fail: '扫码失败',
  approve: '审核通过',
  reject: '拒保',
  request_revise: '要求补正',
  submit_revise: '提交补正',
  archive: '归档',
}

export const INSURANCE_TYPES = [
  { label: '重疾险', value: '重疾险' },
  { label: '寿险', value: '寿险' },
  { label: '医疗险', value: '医疗险' },
  { label: '意外险', value: '意外险' },
]

export const DEFAULT_MATERIALS = [
  { name: '投保单', required: true, provided: true, verified: true },
  { name: '身份证复印件', required: true, provided: true, verified: false },
  { name: '银行卡复印件', required: true, provided: true, verified: false },
]

export const getMaterialsByType = (type) => {
  const materials = [...DEFAULT_MATERIALS]
  if (['重疾险', '医疗险', '寿险'].includes(type)) {
    materials.push({ name: '健康告知书', required: true, provided: false, verified: false })
    materials.push({ name: '体检报告', required: false, provided: false, verified: false })
  } else if (type === '意外险') {
    materials.push({ name: '职业证明', required: false, provided: false, verified: false })
  }
  return materials
}
