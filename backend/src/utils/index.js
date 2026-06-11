const db = require('../db');

function logOperation({ scheduleId, userId, userName, action, actionDesc, oldStatus, newStatus }) {
  db.run(`
    INSERT INTO operation_logs (schedule_id, user_id, user_name, action, action_desc, old_status, new_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [scheduleId || null, userId, userName, action, actionDesc, oldStatus || null, newStatus || null]);
}

function getStatusText(status) {
  const map = {
    draft: '草稿',
    pending_audit: '待审核',
    audit_rejected: '审核退回',
    pending_review: '待复核',
    review_rejected: '复核退回',
    archived: '已归档'
  };
  return map[status] || status;
}

function getRoleText(role) {
  const map = {
    registrar: '发车登记员',
    auditor: '发车审核主管',
    reviewer: '城市公交公司复核负责人'
  };
  return map[role] || role;
}

module.exports = { logOperation, getStatusText, getRoleText };
