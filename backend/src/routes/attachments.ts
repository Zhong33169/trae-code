import { Hono } from 'hono'
import db from '../db/index.js'
import { STATUS, ABNORMAL_TYPES } from '../db/schema.js'

const app = new Hono()

app.post('/', async (c) => {
  const body = await c.req.json()
  const { orderId, name, fileType, fileSize, required, userId } = body
  
  const order = db.prepare('SELECT status FROM policy_orders WHERE id = ?').get(orderId) as any
  if (!order) {
    return c.json({ error: '兑现单不存在' }, 404)
  }
  
  if (![STATUS.DRAFT, STATUS.PENDING_CORRECTION].includes(order.status)) {
    return c.json({ error: '当前状态不能添加附件' }, 400)
  }
  
  const info = db.prepare(`
    INSERT INTO attachments (order_id, name, file_type, file_size, required, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(orderId, name, fileType, fileSize, required ? 1 : 0, userId)
  
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(info.lastInsertRowid)
  
  return c.json({ attachment })
})

app.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, fileType, fileSize, userId } = body
  
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as any
  if (!attachment) {
    return c.json({ error: '附件不存在' }, 404)
  }
  
  const order = db.prepare('SELECT status FROM policy_orders WHERE id = ?').get(attachment.order_id) as any
  if (![STATUS.DRAFT, STATUS.PENDING_CORRECTION].includes(order.status)) {
    return c.json({ error: '当前状态不能修改附件' }, 400)
  }
  
  db.prepare(`
    UPDATE attachments SET name = ?, file_type = ?, file_size = ?, rejected = 0, reject_reason = NULL
    WHERE id = ?
  `).run(name, fileType, fileSize, id)
  
  const updated = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id)
  
  return c.json({ attachment: updated })
})

app.post('/:id/reject', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { rejectReason, userId } = body
  
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as any
  if (!attachment) {
    return c.json({ error: '附件不存在' }, 404)
  }
  
  db.prepare(`
    UPDATE attachments SET rejected = 1, reject_reason = ?
    WHERE id = ?
  `).run(rejectReason, id)
  
  db.prepare(`
    UPDATE policy_orders SET abnormal_type = ?, updated_at = ?
    WHERE id = ?
  `).run(ABNORMAL_TYPES.MISSING_ATTACHMENT, new Date().toISOString(), attachment.order_id)
  
  const updated = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id)
  
  return c.json({ attachment: updated })
})

app.delete('/:id', (c) => {
  const id = c.req.param('id')
  
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as any
  if (!attachment) {
    return c.json({ error: '附件不存在' }, 404)
  }
  
  const order = db.prepare('SELECT status FROM policy_orders WHERE id = ?').get(attachment.order_id) as any
  if (![STATUS.DRAFT, STATUS.PENDING_CORRECTION].includes(order.status)) {
    return c.json({ error: '当前状态不能删除附件' }, 400)
  }
  
  db.prepare('DELETE FROM attachments WHERE id = ?').run(id)
  
  return c.json({ success: true })
})

export default app
