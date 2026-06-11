import { db } from '../db/schema.js';
import { verifyPassword } from '../db/seed.js';
import { signToken } from '../middleware/auth.js';

export default async function authRoutes(fastify) {
  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body || {};
    if (!username || !password) {
      return reply.code(400).send({ code: 400, message: '请输入用户名和密码' });
    }
    const d = db();
    const user = d.prepare('SELECT * FROM users WHERE username=?').get(username);
    if (!user || !verifyPassword(password, user.password)) {
      return reply.code(401).send({ code: 401, message: '用户名或密码错误' });
    }
    const token = signToken(user);
    return {
      code: 0,
      message: 'ok',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        }
      }
    };
  });

  fastify.get('/api/auth/me', {
    preHandler: [fastify.auth]
  }, async (request) => {
    const d = db();
    const user = d.prepare('SELECT id, username, name, role, created_at FROM users WHERE id=?')
      .get(request.user.id);
    return { code: 0, data: user };
  });

  fastify.get('/api/users', {
    preHandler: [fastify.auth]
  }, async () => {
    const d = db();
    const list = d.prepare('SELECT id, username, name, role, created_at FROM users ORDER BY id').all();
    return { code: 0, data: list };
  });
}
