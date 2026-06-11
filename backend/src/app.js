const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const cors = require('koa-cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const authRoutes = require('./routes/auth');
const recordRoutes = require('./routes/records');
const logRoutes = require('./routes/logs');

const app = new Koa();

app.use(cors({
  origin: true,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

app.use(bodyParser({
  enableTypes: ['json', 'form'],
  formLimit: '10mb',
  jsonLimit: '10mb',
}));

app.use(async (ctx, next) => {
  try {
    await next();
    if (ctx.status === 404) {
      ctx.body = { code: 404, message: '接口不存在', data: null };
    }
  } catch (err) {
    console.error('Server Error:', err);
    ctx.status = err.statusCode || err.status || 500;
    ctx.body = {
      code: ctx.status,
      message: err.message || '服务器内部错误',
      data: null,
    };
  }
});

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ctx.status} - ${duration}ms`);
});

app.use(authRoutes.routes()).use(authRoutes.allowedMethods());
app.use(recordRoutes.routes()).use(recordRoutes.allowedMethods());
app.use(logRoutes.routes()).use(logRoutes.allowedMethods());

const PORT = process.env.PORT || 8004;

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`工程监理旁站记录系统 - 后端服务`);
  console.log(`运行端口: ${PORT}`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`数据库: ${process.env.DB_PATH || './data/supervision.db'}`);
  console.log(`========================================\n`);
});

module.exports = app;
