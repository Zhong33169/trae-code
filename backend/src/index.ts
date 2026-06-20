import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRoutes from './routes/auth.js'
import orderRoutes from './routes/orders.js'
import attachmentRoutes from './routes/attachments.js'
import reviewRoutes from './routes/review.js'
import auditRoutes from './routes/audit.js'

const app = new Hono()

app.use('*', cors({
  origin: 'http://localhost:3001',
  allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true
}))

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.route('/api/auth', authRoutes)
app.route('/api/orders', orderRoutes)
app.route('/api/attachments', attachmentRoutes)
app.route('/api/review', reviewRoutes)
app.route('/api/audit', auditRoutes)

console.log('🚀 政策兑现单管理系统后端启动')
console.log('📡 端口: 8001')
console.log('🔗 前端地址: http://localhost:3001')
console.log('🧭 API基础路径: http://localhost:8001/api')

export default app
