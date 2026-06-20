require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./src/routes');

const PORT = process.env.PORT || 8004;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3004';

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === CORS_ORIGIN || origin.startsWith('http://localhost:')) return cb(null, true);
    cb(null, true);
  },
  credentials: true,
  exposedHeaders: ['x-user-id', 'x-user-role'],
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  const method = req.method;
  const url = req.url;
  const ua = req.headers['user-agent'] || '';
  console.log(`[${new Date().toLocaleString('zh-CN')}] ${method} ${url}`);
  next();
});

app.use('/api', routes);

app.get('/', (_req, res) => {
  res.json({
    name: 'credit-backend',
    version: '1.0.0',
    docs: {
      login: 'POST /api/auth/login',
      apps: 'GET /api/applications',
      stats: 'GET /api/applications/stats',
      detail: 'GET /api/applications/:id',
      create: 'POST /api/applications',
      action: 'POST /api/applications/:id/action',
      dict_statuses: 'GET /api/dict/statuses',
      dict_roles: 'GET /api/dict/roles',
    },
  });
});

app.use((err, req, res, next) => {
  console.error('ERR:', err);
  res.status(500).json({ ok: false, msg: err.message || 'Server Error' });
});

app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`  授信申请审批系统 - 后端服务已启动`);
  console.log(`  端口: ${PORT}`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  前端允许: ${CORS_ORIGIN}`);
  console.log(`=============================================`);
});
