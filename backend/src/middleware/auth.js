const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const db = require('../db');

function authMiddleware(requiredRoles = []) {
  return async (ctx, next) => {
    const header = ctx.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      ctx.status = 401;
      ctx.body = { code: 401, message: '未登录或令牌缺失' };
      return;
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.prepare('SELECT id, username, real_name, role FROM users WHERE id = ?').get(decoded.userId);
      if (!user) {
        ctx.status = 401;
        ctx.body = { code: 401, message: '用户不存在或已被删除' };
        return;
      }
      if (requiredRoles.length && !requiredRoles.includes(user.role)) {
        ctx.status = 403;
        ctx.body = { code: 403, message: `无权操作，需要角色: ${requiredRoles.join('/')}` };
        return;
      }
      ctx.state.user = user;
      await next();
    } catch (err) {
      ctx.status = 401;
      ctx.body = { code: 401, message: '令牌无效或已过期' };
    }
  };
}

module.exports = { authMiddleware };
