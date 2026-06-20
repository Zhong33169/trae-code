import { Hono } from 'hono'
import db from '../db/index.js'
import { STATUS, ABNORMAL_TYPES, ATTACHMENT_STATUS, ROLES } from '../db/schema.js'
import { requireRole, getUserId } from '../middleware/auth.js'

const app = new Hono()

app.post('/', requireRole(ROLES.REGISTRAR), async (c) => {
  const body = await c.req.json()
  const { orderId, name, fileType, fileSize, required, requiredDefId } = body
  const userId = getUserId(c)
  
  const order = db.prepare('SELECT status FROM policy_orders WHERE id = ?').get(orderId) as any
  if (!order) {
    return c.json({ error: '兑现单不存在' }, 404)
  }
  
  if (![STATUS.DRAFT, STATUS.PENDING_CORRECTION].includes(order.status)) {
    return c.json({ error: '当前状态不能添加附件' }, 400)
  }
  
  if (requiredDefId) {
    const def = db.prepare('SELECT id, order_id FROM required_attachment_defs WHERE id = ?').get(requiredDefId) as any
    if (!def || def.order_id !== orderId) {
      return c.json({ error: '无效的必备附件清单ID' }, 400)
    }
    
    const existing = db.prepare(`
      SELECT id FROM attachments 
      WHERE required_def_id = ? AND att_status = ?
    `).get(requiredDefId, ATTACHMENT_STATUS.ACTIVE) as any
    if (existing) {
      return c.json({ error: '该必备附件已有有效版本，请使用"重新上传"进行替换' }, 400)
    }
  }
  
  const info = db.prepare(`
    INSERT INTO attachments (order_id, required_def_id, name, file_type, file_size, att_status, required, version, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    orderId, 
    requiredDefId || null, 
    name, fileType, fileSize, ATTACHMENT_STATUS.ACTIVE,
    required ? 1 : 0, userId
  )
  
  const attachment = db.prepare(`
    SELECT a.*, u.name as uploader_name, def.name as def_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    LEFT JOIN required_attachment_defs def ON a.required_def_id = def.id
    WHERE a.id = ?
  `).get(info.lastInsertRowid)
  
  return c.json({ attachment })
})

app.post('/:id/reupload', requireRole(ROLES.REGISTRAR), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, fileType, fileSize } = body
  const userId = getUserId(c)
  
  const oldAtt = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as any
  if (!oldAtt) {
    return c.json({ error: '原附件不存在' }, 404)
  }
  
  const order = db.prepare('SELECT status FROM policy_orders WHERE id = ?').get(oldAtt.order_id) as any
  if (![STATUS.DRAFT, STATUS.PENDING_CORRECTION].includes(order.status)) {
    return c.json({ error: '当前状态不能重新上传附件' }, 400)
  }
  
  const newVersion = (oldAtt.version || 1) + 1
  const originalRejectReason = oldAtt.reject_reason
  
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE attachments 
      SET att_status = ?, rejected = 0
      WHERE id = ?
    `).run(ATTACHMENT_STATUS.SUPERSEDED, id)
    
    const newInfo = db.prepare(`
      INSERT INTO attachments (order_id, required_def_id, parent_id, name, file_type, file_size, att_status, required, rejected, reject_reason, version, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
    `).run(
      oldAtt.order_id,
      oldAtt.required_def_id,
      id,
      name, fileType, fileSize, ATTACHMENT_STATUS.ACTIVE,
      oldAtt.required, newVersion, userId
    )
    
    return { newId: newInfo.lastInsertRowid }
  })
  
  const { newId } = tx()
  
  const newAttachment = db.prepare(`
    SELECT a.*, u.name as uploader_name, def.name as def_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    LEFT JOIN required_attachment_defs def ON a.required_def_id = def.id
    WHERE a.id = ?
  `).get(newId)
  
  return c.json({
    attachment: newAttachment,
    oldRejectReason: originalRejectReason,
    replacedAttachmentId: id
  })
})

app.put('/:id', requireRole(ROLES.REGISTRAR), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, fileType, fileSize } = body
  getUserId(c)
  
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as any
  if (!attachment) {
    return c.json({ error: '附件不存在' }, 404)
  }
  
  const order = db.prepare('SELECT status FROM policy_orders WHERE id = ?').get(attachment.order_id) as any
  if (![STATUS.DRAFT, STATUS.PENDING_CORRECTION].includes(order.status)) {
    return c.json({ error: '当前状态不能修改附件' }, 400)
  }
  
  db.prepare(`
    UPDATE attachments SET name = ?, file_type = ?, file_size = ?
    WHERE id = ? AND att_status = ?
  `).run(name, fileType, fileSize, id, ATTACHMENT_STATUS.ACTIVE)
  
  const updated = db.prepare(`
    SELECT a.*, u.name as uploader_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    WHERE a.id = ?
  `).get(id)
  
  return c.json({ attachment: updated })
})

app.post('/:id/reject', requireRole(ROLES.REVIEWER), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { rejectReason } = body
  const userId = getUserId(c)
  
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as any
  if (!attachment) {
    return c.json({ error: '附件不存在' }, 404)
  }
  
  if (attachment.att_status !== ATTACHMENT_STATUS.ACTIVE) {
    return c.json({ error: '只能驳回当前有效附件' }, 400)
  }
  
  db.prepare(`
    UPDATE attachments SET att_status = ?, rejected = 1, reject_reason = ?
    WHERE id = ?
  `).run(ATTACHMENT_STATUS.REJECTED, rejectReason, id)
  
  db.prepare(`
    UPDATE policy_orders 
    SET abnormal_type = ?, updated_at = ?
    WHERE id = ?
  `).run(ABNORMAL_TYPES.MISSING_ATTACHMENT, new Date().toISOString(), attachment.order_id)
  
  db.prepare(`
    INSERT INTO audit_logs (order_id, operator_id, action, failure_reason, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    attachment.order_id, userId, '附件驳回', 
    `附件 ${attachment.name} 被驳回`,
    rejectReason, new Date().toISOString()
  )
  
  const updated = db.prepare(`
    SELECT a.*, u.name as uploader_name, def.name as def_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    LEFT JOIN required_attachment_defs def ON a.required_def_id = def.id
    WHERE a.id = ?
  `).get(id)
  
  return c.json({ attachment: updated })
})

app.delete('/:id', requireRole(ROLES.REGISTRAR), (c) => {
  const id = c.req.param('id')
  
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as any
  if (!attachment) {
    return c.json({ error: '附件不存在' }, 404)
  }
  
  const order = db.prepare('SELECT status FROM policy_orders WHERE id = ?').get(attachment.order_id) as any
  if (order.status !== STATUS.DRAFT) {
    return c.json({ error: '只能删除草稿状态的附件' }, 400)
  }
  
  db.prepare('DELETE FROM attachments WHERE id = ?').run(id)
  
  return c.json({ success: true })
})

app.get('/required-defs/:orderId', requireRole(ROLES.REGISTRAR, ROLES.REVIEWER, ROLES.APPROVER), (c) => {
  const orderId = c.req.param('orderId')
  
  const defs = db.prepare(`
    SELECT def.*,
      (SELECT COUNT(*) FROM attachments a 
        WHERE a.required_def_id = def.id 
          AND a.att_status = ? 
          AND a.rejected = 0) as has_active
    FROM required_attachment_defs def
    WHERE def.order_id = ?
    ORDER BY def.sort_order, def.id
  `).all(ATTACHMENT_STATUS.ACTIVE, orderId)
  
  return c.json({ defs })
})

export default app
