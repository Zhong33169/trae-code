const Router = require('koa-router');
const authService = require('../services/auth.service');
const { authMiddleware } = require('../middleware/auth');

const router = new Router({ prefix: '/api/auth' });

router.post('/login', async (ctx) => {
  const { username, password } = ctx.request.body || {};
  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '用户名和密码必填' };
    return;
  }
  const res = authService.login(username, password);
  if (!res.ok) {
    ctx.status = res.code || 401;
    ctx.body = { code: res.code || 401, message: res.message };
    return;
  }
  ctx.body = { code: 0, message: 'ok', data: { token: res.token, user: res.user } };
});

router.get('/me', authMiddleware(), async (ctx) => {
  ctx.body = { code: 0, data: ctx.state.user };
});

router.get('/users', authMiddleware(), async (ctx) => {
  ctx.body = { code: 0, data: authService.listUsers() };
});

module.exports = router;
