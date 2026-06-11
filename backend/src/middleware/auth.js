import jwt from 'jsonwebtoken';

const JWT_SECRET = 'launch-plan-demo-secret-key-2026';
const TOKEN_EXPIRES_IN = '8h';

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

export function authMiddleware(request, reply, done) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ code: 401, message: '未登录或token缺失' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    request.user = decoded;
    done();
  } catch (err) {
    return reply.code(401).send({ code: 401, message: 'token无效或已过期' });
  }
}

export function roleMiddleware(...allowedRoles) {
  return (request, reply, done) => {
    if (!request.user) {
      return reply.code(401).send({ code: 401, message: '未登录' });
    }
    if (!allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({
        code: 403,
        message: `角色权限不足：当前角色${request.user.role}不允许执行此操作，允许角色: ${allowedRoles.join(',')}`
      });
    }
    done();
  };
}
