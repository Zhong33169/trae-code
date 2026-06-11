const Koa = require('koa');
const cors = require('koa2-cors');
const bodyParser = require('koa-bodyparser');
const config = require('./config');
const initDB = require('./scripts/initDB');

const authRoutes = require('./routes/auth');
const scheduleRoutes = require('./routes/schedules');
const commonRoutes = require('./routes/common');

async function start() {
  await initDB();

  const app = new Koa();

  app.use(cors({
    origin: '*',
    exposeHeaders: ['WWW-Authenticate', 'Server-Authorization'],
    maxAge: 5,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept']
  }));

  app.use(bodyParser({ enableTypes: ['json'] }));

  app.use(async (ctx, next) => {
    try {
      await next();
      if (ctx.status === 404 && !ctx.body) {
        ctx.body = { code: 404, message: '接口不存在' };
      }
    } catch (err) {
      console.error('[Server Error]', err);
      ctx.status = err.status || 500;
      ctx.body = { code: ctx.status, message: err.message || '服务器内部错误' };
    }
  });

  app.use(authRoutes.routes()).use(authRoutes.allowedMethods());
  app.use(scheduleRoutes.routes()).use(scheduleRoutes.allowedMethods());
  app.use(commonRoutes.routes()).use(commonRoutes.allowedMethods());

  app.listen(config.port, () => {
    console.log(`公交发车计划后端服务已启动: http://localhost:${config.port}`);
  });
}

start().catch(e => {
  console.error('启动失败:', e);
  process.exit(1);
});
