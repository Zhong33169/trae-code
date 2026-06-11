import { users } from '../data/database.js';

export const authMiddleware = async (ctx, next) => {
  const userId = ctx.request.headers['x-user-id'];

  if (!userId) {
    ctx.status = 401;
    ctx.body = { error: '未登录，请先选择用户身份' };
    return;
  }

  const user = users.find(u => u.id === userId);
  if (!user) {
    ctx.status = 401;
    ctx.body = { error: '用户不存在' };
    return;
  }

  ctx.state.user = user;
  ctx.state.userId = user.id;
  ctx.state.userRole = user.role;

  await next();
};

export const optionalAuthMiddleware = async (ctx, next) => {
  const userId = ctx.request.headers['x-user-id'];
  if (userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
      ctx.state.user = user;
      ctx.state.userId = user.id;
      ctx.state.userRole = user.role;
    }
  }
  await next();
};
