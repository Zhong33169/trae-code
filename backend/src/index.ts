import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initDb } from './db.js';
import { registerAuthRoutes } from './auth.js';
import { registerOrderRoutes } from './orders.js';

const PORT = 8001;

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: 'http://localhost:3001',
    credentials: true,
  });

  await initDb();
  app.log.info('数据库初始化完成');

  await registerAuthRoutes(app);
  await registerOrderRoutes(app);

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`服务器已启动: http://0.0.0.0:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
