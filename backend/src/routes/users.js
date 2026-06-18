import { Hono } from 'hono';
import db from '../db/index.js';
import { ROLE_NAMES } from '../utils/constants.js';

const app = new Hono();

app.get('/', (c) => {
  const users = db.prepare(`
    SELECT id, username, name, role, created_at FROM users ORDER BY id
  `).all();
  return c.json(users.map(u => ({
    ...u,
    role_name: ROLE_NAMES[u.role] || u.role
  })));
});

app.get('/:id', (c) => {
  const user = db.prepare(`
    SELECT id, username, name, role, created_at FROM users WHERE id = ?
  `).get(parseInt(c.req.param('id')));
  if (!user) {
    return c.json({ error: '用户不存在' }, 404);
  }
  return c.json({
    ...user,
    role_name: ROLE_NAMES[user.role] || user.role
  });
});

export default app;
