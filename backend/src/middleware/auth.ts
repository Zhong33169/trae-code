import { Context, Next } from 'hono'
import db from '../db/index.js'
import { ROLES, ROLE_LABELS, RoleType } from '../db/schema.js'

export interface AuthContext {
  userId: number
  role: RoleType
}

export function requireRole(...allowedRoles: RoleType[]) {
  return async (c: Context, next: Next) => {
    const userIdStr = c.req.header('X-User-Id')
    if (!userIdStr) {
      return c.json({ error: '未登录，请先登录' }, 401)
    }
    
    const userId = parseInt(userIdStr)
    if (isNaN(userId)) {
      return c.json({ error: '无效的用户ID' }, 401)
    }
    
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId) as any
    if (!user) {
      return c.json({ error: '用户不存在' }, 401)
    }
    
    if (!allowedRoles.includes(user.role as RoleType)) {
      const roleNames = allowedRoles.map(r => ROLE_LABELS[r]).join('、')
      return c.json({ error: `权限不足，需要角色：${roleNames}` }, 403)
    }
    
    c.set('userId', userId)
    c.set('role', user.role)
    
    await next()
  }
}

export function getUserId(c: Context): number {
  return c.get('userId') as number
}

export function getUserRole(c: Context): RoleType {
  return c.get('role') as RoleType
}

export { ROLES }
