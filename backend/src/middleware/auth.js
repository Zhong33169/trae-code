const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, realName: user.real_name },
    config.jwtSecret,
    { expiresIn: config.tokenExpiresIn }
  );
}

async function authMiddleware(ctx, next) {
  const token = ctx.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    ctx.status = 401;
    ctx.body = { code: 401, message: '未登录，请先登录' };
    return;
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = db.get('SELECT id, username, real_name, role FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      ctx.status = 401;
      ctx.body = { code: 401, message: '用户不存在' };
      return;
    }
    ctx.state.user = user;
    return next();
  } catch (e) {
    ctx.status = 401;
    ctx.body = { code: 401, message: '登录已过期，请重新登录' };
    return;
  }
}

function roleMiddleware(...allowedRoles) {
  return (ctx, next) => {
    if (!ctx.state.user) {
      ctx.status = 401;
      ctx.body = { code: 401, message: '未登录' };
      return;
    }
    if (!allowedRoles.includes(ctx.state.user.role)) {
      ctx.status = 403;
      ctx.body = { code: 403, message: '无权限执行该操作' };
      return;
    }
    return next();
  };
}

module.exports = { generateToken, authMiddleware, roleMiddleware };
