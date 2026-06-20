import { Hono } from 'hono'
import db from '../db/index.js'

const app = new Hono()

app.get('/', (c) => {
  const orderId = c.req.query('orderId')
  const operatorId = c.req.query('operatorId')
  
  let sql = `
    SELECT a.*, o.order_no, o.title, u.name as operator_name, u.role as operator_role
    FROM audit_logs a
    LEFT JOIN policy_orders o ON a.order_id = o.id
    LEFT JOIN users u ON a.operator_id = u.id
    WHERE 1=1
  `
  const params: any[] = []
  
  if (orderId) {
    sql += ' AND a.order_id = ?'
    params.push(orderId)
  }
  
  if (operatorId) {
    sql += ' AND a.operator_id = ?'
    params.push(operatorId)
  }
  
  sql += ' ORDER BY a.created_at DESC'
  
  const logs = db.prepare(sql).all(...params)
  
  return c.json({ logs })
})

app.get('/failures', (c) => {
  const logs = db.prepare(`
    SELECT a.*, o.order_no, o.title, u.name as operator_name, u.role as operator_role
    FROM audit_logs a
    LEFT JOIN policy_orders o ON a.order_id = o.id
    LEFT JOIN users u ON a.operator_id = u.id
    WHERE a.failure_reason IS NOT NULL AND a.failure_reason != ''
    ORDER BY a.created_at DESC
  `).all()
  
  return c.json({ logs })
})

export default app
