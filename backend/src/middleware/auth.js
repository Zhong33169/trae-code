import { getDB } from '../models/database.js';

export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];
    const userName = req.headers['x-user-name'];
    if (!role || !userId) {
      return res.status(401).json({ error: '缺少用户角色或ID' });
    }
    if (!roles.includes(role) && role !== 'admin') {
      return res.status(403).json({ error: `角色 ${role} 无权执行此操作` });
    }
    req.user = { id: parseInt(userId), role, name: userName || '' };
    next();
  };
}

export function auditLog(careRecordId, action, oldValue, newValue, reason, detail, req) {
  const db = getDB();
  const actorName = req.headers['x-user-name'] || 'unknown';
  const actorRole = req.headers['x-user-role'] || 'unknown';
  const actorId = parseInt(req.headers['x-user-id']) || 0;

  db.prepare(`
    INSERT INTO audit_logs (care_record_id, action, actor_id, actor_name, actor_role, old_value, new_value, reason, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(careRecordId, action, actorId, actorName, actorRole,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    reason || null,
    detail || null
  );
}
