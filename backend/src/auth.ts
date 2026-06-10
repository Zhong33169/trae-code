import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { prepare } from './db.js';
import { JwtPayload, UserRole } from './types.js';

const JWT_SECRET = 'hotel-supplement-demo-secret';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: '未提供认证令牌' });
    return;
  }
  try {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    request.user = payload;
  } catch {
    reply.code(401).send({ error: '无效或过期的令牌' });
  }
}

export function roleGuard(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user as JwtPayload | undefined;
    if (!user || !roles.includes(user.role)) {
      reply.code(403).send({ error: '权限不足', reason: '您没有执行此操作的权限' });
    }
  };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = request.body as { username: string; password: string };

    if (!username || !password) {
      reply.code(400).send({ error: '用户名和密码不能为空' });
      return;
    }

    const user = prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

    if (!user || user.password_hash !== password) {
      reply.code(401).send({ error: '用户名或密码错误' });
      return;
    }

    const payload: JwtPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    const token = signToken(payload);

    reply.send({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  });

  app.get('/api/auth/me', {
    preHandler: [authMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      reply.send({ id: user.id, username: user.username, role: user.role });
    },
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}
