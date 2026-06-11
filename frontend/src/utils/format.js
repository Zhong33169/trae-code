export function getStatusText(s) {
  const m = { draft: '草稿', pending_audit: '待审核', audit_rejected: '审核退回', pending_review: '待复核', review_rejected: '复核退回', archived: '已归档' };
  return m[s] || s;
}
export function getStatusColor(s) {
  const m = {
    draft: '#909399',
    pending_audit: '#e6a23c',
    audit_rejected: '#f56c6c',
    pending_review: '#409eff',
    review_rejected: '#f56c6c',
    archived: '#67c23a'
  };
  return m[s] || '#606266';
}
export function getRoleText(r) {
  const m = { registrar: '发车登记员', auditor: '发车审核主管', reviewer: '城市公交公司复核负责人' };
  return m[r] || r;
}
