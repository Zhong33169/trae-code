import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initSchema } from './db/schema.js';
import { seedData } from './db/seed.js';
import { authMiddleware, roleMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import planRoutes from './routes/plans.js';
import batchRoutes from './routes/batch.js';

const PORT = process.env.PORT || 8009;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3009';

async function start() {
  await initSchema();
  seedData();

  const fastify = Fastify({ logger: true });

  fastify.register(cors, {
    origin: [CORS_ORIGIN, /^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  });

  fastify.decorate('auth', authMiddleware);
  fastify.decorate('requireRole', (...roles) => roleMiddleware(...roles));

  fastify.get('/api/health', async () => ({ code: 0, data: { status: 'ok', now: new Date().toISOString() } }));
  fastify.get('/api/constants', async () => ({
    code: 0,
    data: {
      roles: [
        { value: 'CSM', label: '客户成功经理' },
        { value: 'DELIVERY', label: '交付顾问' },
        { value: 'DIRECTOR', label: '客户成功负责人' }
      ],
      statuses: [
        { value: 'DRAFT', label: '草稿' },
        { value: 'PENDING_REVIEW', label: '待交付核验' },
        { value: 'PENDING_CONFIRM', label: '待负责人确认' },
        { value: 'COMPLETED', label: '已完成' },
        { value: 'REJECTED', label: '已驳回' }
      ],
      risk_levels: [
        { value: 'LOW', label: '低风险' },
        { value: 'MEDIUM', label: '中风险' },
        { value: 'HIGH', label: '高风险' }
      ],
      evidence_types: [
        { value: 'REGISTRATION', label: '登记证据', allowed_role: 'CSM' },
        { value: 'VERIFICATION', label: '过程核验证据', allowed_role: 'DELIVERY' },
        { value: 'ARCHIVAL', label: '复核归档证据', allowed_role: 'DIRECTOR' }
      ],
      workflow: {
        CSM: ['DRAFT→PENDING_REVIEW (提交核验)', 'REJECTED→PENDING_REVIEW (重新提交)'],
        DELIVERY: ['PENDING_REVIEW→PENDING_CONFIRM (核验通过)', 'PENDING_REVIEW→REJECTED (驳回)'],
        DIRECTOR: ['PENDING_CONFIRM→COMPLETED (确认归档)', 'PENDING_CONFIRM→REJECTED (驳回)']
      }
    }
  }));

  await fastify.register(authRoutes);
  await fastify.register(planRoutes);
  await fastify.register(batchRoutes);

  fastify.setErrorHandler((err, request, reply) => {
    fastify.log.error(err);
    reply.code(err.statusCode || 500).send({
      code: err.statusCode || 500,
      message: err.message || '服务器内部错误'
    });
  });

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 后端服务已启动: http://localhost:${PORT}`);
    console.log(`   CORS 放行: ${CORS_ORIGIN}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
