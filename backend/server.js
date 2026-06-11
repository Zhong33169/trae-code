const express = require('express');
const cors = require('cors');
require('dotenv').config();

const workOrderRoutes = require('./routes/workorders');
const authRoutes = require('./routes/auth');
const auditRoutes = require('./routes/audit');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 8001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3001';

app.use(cors({
  origin: CORS_ORIGIN.split(','),
  credentials: true
}));

app.use(express.json());

app.use((req, res, next) => {
  const role = req.headers['x-user-role'];
  const userId = req.headers['x-user-id'];
  const userName = req.headers['x-user-name'];
  req.user = {
    id: userId || 'anonymous',
    name: userName || '匿名用户',
    role: role || 'guest'
  };
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/workorders', workOrderRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/stats', statsRoutes);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
    code: err.code || 'INTERNAL_ERROR'
  });
});

app.listen(PORT, () => {
  console.log(`生产工单系统后端已启动`);
  console.log(`端口: ${PORT}`);
  console.log(`CORS 允许源: ${CORS_ORIGIN}`);
  console.log(`API 基础路径: http://localhost:${PORT}/api`);
});
