import 'dotenv/config';
import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import expenseRoutes from './routes/expenseRoutes.js';

const app = new Koa();

const PORT = process.env.PORT || 8007;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3007';

app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  allowHeaders: ['Content-Type', 'X-User-Id'],
}));

app.use(bodyParser());

app.use(async (ctx, next) => {
  const start = Date.now();
  try {
    await next();
    const ms = Date.now() - start;
    console.log(`${ctx.method} ${ctx.url} - ${ctx.status} - ${ms}ms`);
  } catch (err) {
    console.error('Error:', err);
    ctx.status = err.status || 500;
    ctx.body = { success: false, error: err.message || '服务器内部错误' };
  }
});

app.use(expenseRoutes.routes());
app.use(expenseRoutes.allowedMethods());

app.use(async (ctx) => {
  if (ctx.path === '/api/health') {
    ctx.body = { success: true, message: '财务共享中心后端服务运行中', timestamp: new Date().toISOString() };
  }
});

app.listen(PORT, () => {
  console.log(`🚀 财务共享中心后端服务已启动`);
  console.log(`📍 端口: ${PORT}`);
  console.log(`🌐 允许跨域来源: ${CORS_ORIGIN}`);
  console.log(`📋 API前缀: /api/expenses`);
});
