const Koa = require('koa');
const { koaBody } = require('koa-body');
const cors = require('koa-cors');
const config = require('./config');
const router = require('./routes');
const { getDb } = require('./db');

const app = new Koa();

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(koaBody({
  jsonLimit: '10mb',
  formLimit: '10mb'
}));

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('API Error:', err);
    ctx.status = err.status || 500;
    ctx.body = {
      success: false,
      message: err.message || '服务器内部错误'
    };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

const startServer = async () => {
  await getDb();

  const port = config.port;
  app.listen(port, () => {
    console.log(`\n🚀 连锁药房风险分级处置处方订单系统 - 后端服务`);
    console.log(`📍 服务地址: http://localhost:${port}`);
    console.log(`📊 数据库路径: ${config.db.path}`);
    console.log(`\n💡 提示: 前端端口默认为 3003，可通过环境变量修改`);
  });
};

startServer().catch(err => {
  console.error('服务启动失败:', err);
  process.exit(1);
});

module.exports = app;
