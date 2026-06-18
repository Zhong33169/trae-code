import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import usersRouter from './routes/users.js';
import applicationsRouter from './routes/applications.js';
import auditRouter from './routes/audit.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3004'],
  allowHeaders: ['Content-Type', 'X-User-Id'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', message: '换表申请管理系统后端运行正常' });
});

app.route('/api/users', usersRouter);
app.route('/api/applications', applicationsRouter);
app.route('/api/audit', auditRouter);

const PORT = 8004;

console.log(`换表申请管理系统后端启动中...`);
console.log(`端口: ${PORT}`);
console.log(`API 基础地址: http://localhost:${PORT}/api`);
console.log(`健康检查: http://localhost:${PORT}/api/health`);
console.log(`CORS 允许来源: http://localhost:3004`);

serve({
  fetch: app.fetch,
  port: PORT
});
