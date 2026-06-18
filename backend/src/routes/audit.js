import { Hono } from 'hono';
import db from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { ROLE_NAMES, ACTION_NAMES } from '../utils/constants.js';

const app = new Hono();

app.use('*', authMiddleware);

app.get('/', (c) => {
  const { application_id, user_role, action, keyword } = c.req.query();

  let query = `
    SELECT al.*, u.name as user_name, a.customer_name, a.batch_no
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    LEFT JOIN applications a ON al.application_id = a.id
    WHERE 1=1
  `;
  const params = [];

  if (application_id) {
    query += ' AND al.application_id = ?';
    params.push(application_id);
  }
  if (user_role) {
    query += ' AND al.user_role = ?';
    params.push(user_role);
  }
  if (action) {
    query += ' AND al.action = ?';
    params.push(action);
  }
  if (keyword) {
    query += ' AND (al.details LIKE ? OR al.failure_reason LIKE ?';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  query += ' ORDER BY al.created_at DESC LIMIT 200';

  const logs = db.prepare(query).all(...params).map(l => ({
    ...l,
    user_role_name: ROLE_NAMES[l.user_role] || l.user_role,
    action_name: ACTION_NAMES[l.action] || l.action,
    has_failure: !!l.failure_reason
  }));

  return c.json(logs);
});

app.get('/failures', (c) => {
  const logs = db.prepare(`
    SELECT al.*, u.name as user_name, a.customer_name, a.batch_no
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    LEFT JOIN applications a ON al.application_id = a.id
    WHERE al.failure_reason IS NOT NULL AND al.failure_reason != ''
    ORDER BY al.created_at DESC
  `).all().map(l => ({
    ...l,
    user_role_name: ROLE_NAMES[l.user_role] || l.user_role,
    action_name: ACTION_NAMES[l.action] || l.action
  }));

  return c.json(logs);
});

export default app;
