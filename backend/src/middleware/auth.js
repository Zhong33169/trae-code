const jwt = require('jsonwebtoken');
const db = require('../db');
const { ROLES } = require('../constants');

const JWT_SECRET = process.env.JWT_SECRET || 'supervision-record-secret-key-2024';

const authMiddleware = () => {
  return async (ctx, next) => {
    const authHeader = ctx.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ctx.status = 401;
      ctx.body = { code: 401, message: '未提供认证令牌' };
      return;
    }

    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const user = db.prepare('SELECT id, username, name, role, phone, department, created_at FROM users WHERE id = ?').get(decoded.userId);
      if (!user) {
        ctx.status = 401;
        ctx.body = { code: 401, message: '用户不存在' };
        return;
      }

      ctx.state.user = user;
      await next();
    } catch (err) {
      ctx.status = 401;
      ctx.body = { code: 401, message: '认证令牌无效或已过期' };
    }
  };
};

const roleMiddleware = (allowedRoles) => {
  return async (ctx, next) => {
    if (!ctx.state.user) {
      ctx.status = 401;
      ctx.body = { code: 401, message: '未登录' };
      return;
    }

    if (!allowedRoles.includes(ctx.state.user.role)) {
      ctx.status = 403;
      ctx.body = { code: 403, message: '权限不足' };
      return;
    }

    await next();
  };
};

const registrarOnly = roleMiddleware([ROLES.REGISTRAR]);
const supervisorOnly = roleMiddleware([ROLES.SUPERVISOR]);
const reviewerOnly = roleMiddleware([ROLES.REVIEWER]);
const supervisorOrReviewer = roleMiddleware([ROLES.SUPERVISOR, ROLES.REVIEWER]);
const registrarOrSupervisor = roleMiddleware([ROLES.REGISTRAR, ROLES.SUPERVISOR]);
const allRoles = roleMiddleware([ROLES.REGISTRAR, ROLES.SUPERVISOR, ROLES.REVIEWER]);

module.exports = {
  authMiddleware,
  roleMiddleware,
  registrarOnly,
  supervisorOnly,
  reviewerOnly,
  supervisorOrReviewer,
  registrarOrSupervisor,
  allRoles,
};
