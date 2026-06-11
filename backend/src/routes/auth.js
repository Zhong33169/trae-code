const Router = require('koa-router');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');
const { getRoleText } = require('../utils');

const router = new Router({ prefix: '/api/auth' });

router.post('/login', async (ctx) => {
  const { username, password } = ctx.request.body;
  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '用户名和密码不能为空' };
    return;
  }
  const user = db.get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '用户名或密码错误' };
    return;
  }
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '用户名或密码错误' };
    return;
  }
  const token = generateToken(user);
  ctx.body = {
    code: 0,
    message: '登录成功',
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        realName: user.real_name,
        role: user.role,
        roleText: getRoleText(user.role)
      }
    }
  };
});

router.get('/me', authMiddleware, async (ctx) => {
  ctx.body = {
    code: 0,
    data: {
      ...ctx.state.user,
      realName: ctx.state.user.real_name,
      roleText: getRoleText(ctx.state.user.role)
    }
  };
});

router.post('/logout', authMiddleware, async (ctx) => {
  ctx.body = { code: 0, message: '已退出登录' };
});

module.exports = router;
