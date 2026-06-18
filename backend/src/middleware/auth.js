import db from '../db/index.js';

export async function authMiddleware(c, next) {
  const userId = c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ error: '未登录，请选择角色' }, 401);
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(userId));
  if (!user) {
    return c.json({ error: '用户不存在' }, 401);
  }
  c.set('user', user);
  await next();
}

export function requireRole(...roles) {
  return async function(c, next) {
    const user = c.get('user');
    if (!roles.includes(user.role)) {
      return c.json({ error: '无权限执行此操作' }, 403);
    }
    await next();
  };
}
