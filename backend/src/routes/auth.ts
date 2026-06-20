import { Hono } from 'hono'
import db from '../db/index.js'
import bcrypt from 'bcryptjs'
import { ROLE_LABELS } from '../db/schema.js'
import { requireRole, ROLES } from '../middleware/auth.js'

const ALL_ROLES = [ROLES.REGISTRAR, ROLES.REVIEWER, ROLES.APPROVER] as const

const app = new Hono()

app.post('/login', async (c) => {
  const { username, password } = await c.req.json()
  
  const user = db.prepare('SELECT id, username, name, role, password FROM users WHERE username = ?').get(username) as any
  
  if (!user) {
    return c.json({ error: '用户名或密码错误' }, 401)
  }
  
  const valid = bcrypt.compareSync(password, user.password)
  if (!valid) {
    return c.json({ error: '用户名或密码错误' }, 401)
  }
  
  const { password: _, ...userWithoutPassword } = user
  userWithoutPassword.roleLabel = ROLE_LABELS[user.role]
  
  return c.json({ user: userWithoutPassword })
})

app.get('/users', requireRole(...ALL_ROLES), (c) => {
  const users = db.prepare('SELECT id, username, name, role FROM users').all() as any[]
  users.forEach(u => {
    u.roleLabel = ROLE_LABELS[u.role]
  })
  return c.json({ users })
})

app.post('/switch-role', requireRole(...ALL_ROLES), async (c) => {
  const { userId } = await c.req.json()
  
  const user = db.prepare('SELECT id, username, name, role FROM users WHERE id = ?').get(userId) as any
  
  if (!user) {
    return c.json({ error: '用户不存在' }, 404)
  }
  
  user.roleLabel = ROLE_LABELS[user.role]
  
  return c.json({ user })
})

export default app
