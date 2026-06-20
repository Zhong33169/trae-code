const Koa = require('koa');
const cors = require('@koa/cors');
const { koaBody } = require('koa-body');
const { PORT, FRONTEND_ORIGIN } = require('./config');
const { init } = require('./init-db');
const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');

init();

const app = new Koa();

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization']
}));

app.use(koaBody({ jsonLimit: '5mb' }));

app.use(async (ctx, next) => {
  const start = Date.now();
  try {
    await next();
    console.log(`[${ctx.method}] ${ctx.url} - ${ctx.status} - ${Date.now() - start}ms`);
  } catch (err) {
    console.error('[ERROR]', err);
    ctx.status = 500;
    ctx.body = { code: 500, message: `服务器错误: ${err.message}` };
  }
});

app.use(authRoutes.routes()).use(authRoutes.allowedMethods());
app.use(orderRoutes.routes()).use(orderRoutes.allowedMethods());

app.use(async (ctx) => {
  if (ctx.path === '/health' && ctx.method === 'GET') {
    ctx.body = { code: 0, message: 'pong', time: new Date().toISOString() };
    return;
  }
  ctx.status = 404;
  ctx.body = { code: 404, message: `Not Found: ${ctx.path}` };
});

app.listen(PORT, () => {
  console.log(`🚀 器材借用后端已启动: http://localhost:${PORT}`);
  console.log(`   前端来源: ${FRONTEND_ORIGIN}`);
});
