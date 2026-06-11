const Router = require('@koa/router');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { success, error } = require('../utils/response');
const { authMiddleware, allRoles } = require('../middleware/auth');
const { ROLE_NAMES } = require('../constants');

const router = new Router({ prefix: '/api/auth' });

const JWT_SECRET = process.env.JWT_SECRET || 'supervision-record-secret-key-2024';
const TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || '24h';

router.post('/login', async (ctx) => {
  const { username, password } = ctx.request.body;

  if (!username || !password) {
    return error(ctx, '用户名和密码不能为空');
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return error(ctx, '用户名或密码错误');
  }

  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) {
    return error(ctx, '用户名或密码错误');
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );

  db.prepare(`
    INSERT INTO operation_logs (user_id, operation_type, description, ip_address)
    VALUES (?, ?, ?, ?)
  `).run(user.id, 'login', `${user.name}登录系统`, ctx.request.ip || '127.0.0.1');

  const userInfo = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    roleName: ROLE_NAMES[user.role],
    phone: user.phone,
    department: user.department,
  };

  success(ctx, { token, user: userInfo }, '登录成功');
});

router.post('/logout', authMiddleware(), async (ctx) => {
  const user = ctx.state.user;
  db.prepare(`
    INSERT INTO operation_logs (user_id, operation_type, description, ip_address)
    VALUES (?, ?, ?, ?)
  `).run(user.id, 'logout', `${user.name}退出系统`, ctx.request.ip || '127.0.0.1');
  success(ctx, null, '退出成功');
});

router.get('/profile', authMiddleware(), allRoles, async (ctx) => {
  const user = ctx.state.user;
  success(ctx, {
    ...user,
    roleName: ROLE_NAMES[user.role],
  }, '获取用户信息成功');
});

module.exports = router;
