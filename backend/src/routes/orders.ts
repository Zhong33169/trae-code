import { Hono } from 'hono'
import db from '../db/index.js'
import { STATUS, STATUS_LABELS, ABNORMAL_TYPES, ABNORMAL_LABELS, ROLES, ATTACHMENT_STATUS, ATTACHMENT_STATUS_LABELS } from '../db/schema.js'
import { requireRole, getUserId, ROLES as ROLE_CONST } from '../middleware/auth.js'

const app = new Hono()

export const checkAttachmentsByDefs = (orderId: number) => {
  const defs = db.prepare('SELECT COUNT(*) as cnt FROM required_attachment_defs WHERE order_id = ?').get(orderId) as any
  const required = defs.cnt
  const valid = db.prepare(`
    SELECT COUNT(*) as cnt FROM required_attachment_defs def
    WHERE def.order_id = ?
    AND EXISTS (
      SELECT 1 FROM attachments a
      WHERE a.required_def_id = def.id
        AND a.att_status = ?
        AND a.rejected = 0
    )
  `).get(orderId, ATTACHMENT_STATUS.ACTIVE) as any
  return { required, valid: valid.cnt, allValid: required > 0 && valid.cnt >= required }
}

export const getAttachmentCompletion = (orderId: number) => {
  const rows = db.prepare(`
    SELECT 
      def.id as def_id,
      def.name as def_name,
      def.sort_order,
      a.id as attachment_id,
      a.name as attachment_name,
      a.att_status,
      a.rejected,
      a.reject_reason,
      a.version,
      a.created_at
    FROM required_attachment_defs def
    LEFT JOIN attachments a ON a.required_def_id = def.id AND a.att_status = ?
    WHERE def.order_id = ?
    ORDER BY def.sort_order, def.id
  `).all(ATTACHMENT_STATUS.ACTIVE, orderId) as any[]
  return rows
}

app.get('/', requireRole(ROLES.REGISTRAR, ROLES.REVIEWER, ROLES.APPROVER), (c) => {
  const status = c.req.query('status')
  const abnormal = c.req.query('abnormal')
  const role = c.req.query('role')
  const currentRole = (c as any).get('role') as string
  
  let sql = `
    SELECT o.*, u.name as creator_name,
      (SELECT COUNT(*) FROM required_attachment_defs def WHERE def.order_id = o.id) as required_attachments,
      (SELECT COUNT(*) FROM required_attachment_defs def
        WHERE def.order_id = o.id AND EXISTS (
          SELECT 1 FROM attachments a 
          WHERE a.required_def_id = def.id 
            AND a.att_status = 'ACTIVE' 
            AND a.rejected = 0
        )) as valid_attachments
    FROM policy_orders o
    LEFT JOIN users u ON o.created_by = u.id
    WHERE 1=1
  `
  const params: any[] = []
  
  if (status && status !== 'ALL') {
    sql += ' AND o.status = ?'
    params.push(status)
  }
  
  if (abnormal && abnormal !== 'ALL') {
    if (abnormal === 'NORMAL') {
      sql += ' AND o.abnormal_type IS NULL'
    } else {
      sql += ' AND o.abnormal_type = ?'
      params.push(abnormal)
    }
  }
  
  const effectiveRole = role || currentRole
  if (effectiveRole === ROLES.REVIEWER) {
    sql += ` AND o.status IN (?, ?)`
    params.push(STATUS.PENDING_REVIEW, STATUS.PENDING_CORRECTION)
  } else if (effectiveRole === ROLES.APPROVER) {
    sql += ` AND o.status IN (?, ?, ?)`
    params.push(STATUS.REVIEWED, STATUS.APPROVED, STATUS.ARCHIVED)
  }
  
  sql += ' ORDER BY o.created_at DESC'
  
  const orders = db.prepare(sql).all(...params) as any[]
  
  orders.forEach(order => {
    order.statusLabel = STATUS_LABELS[order.status]
    order.abnormalLabel = order.abnormal_type ? ABNORMAL_LABELS[order.abnormal_type] : null
    order.isTimeout = order.timeout_deadline && new Date(order.timeout_deadline) < new Date()
    order.hasAllAttachments = order.required_attachments > 0 && order.valid_attachments >= order.required_attachments
  })
  
  return c.json({ orders })
})

app.get('/:id', requireRole(ROLES.REGISTRAR, ROLES.REVIEWER, ROLES.APPROVER), (c) => {
  const id = c.req.param('id')
  
  const order = db.prepare(`
    SELECT o.*, u.name as creator_name
    FROM policy_orders o
    LEFT JOIN users u ON o.created_by = u.id
    WHERE o.id = ?
  `).get(id) as any
  
  if (!order) {
    return c.json({ error: '兑现单不存在' }, 404)
  }
  
  order.statusLabel = STATUS_LABELS[order.status]
  order.abnormalLabel = order.abnormal_type ? ABNORMAL_LABELS[order.abnormal_type] : null
  order.isTimeout = order.timeout_deadline && new Date(order.timeout_deadline) < new Date()
  
  const requiredDefs = db.prepare(`
    SELECT * FROM required_attachment_defs WHERE order_id = ? ORDER BY sort_order, id
  `).all(id) as any[]
  
  const attachments = db.prepare(`
    SELECT a.*, u.name as uploader_name, def.name as def_name, def.sort_order as def_sort
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    LEFT JOIN required_attachment_defs def ON a.required_def_id = def.id
    WHERE a.order_id = ?
    ORDER BY COALESCE(def.sort_order, 999), a.required_def_id, a.version, a.created_at
  `).all(id) as any[]
  
  attachments.forEach(a => {
    a.statusLabel = ATTACHMENT_STATUS_LABELS[a.att_status] || a.att_status
  })
  
  const groupedAttachments: Record<string, any[]> = {}
  attachments.forEach(a => {
    const key = a.required_def_id ? `def_${a.required_def_id}` : `extra_${a.id}`
    if (!groupedAttachments[key]) groupedAttachments[key] = []
    groupedAttachments[key].push(a)
  })
  
  const reviews = db.prepare(`
    SELECT r.*, u.name as operator_name, u.role as operator_role
    FROM review_records r
    LEFT JOIN users u ON r.operator_id = u.id
    WHERE r.order_id = ?
    ORDER BY r.created_at
  `).all(id)
  
  const audits = db.prepare(`
    SELECT a.*, u.name as operator_name, u.role as operator_role
    FROM audit_logs a
    LEFT JOIN users u ON a.operator_id = u.id
    WHERE a.order_id = ?
    ORDER BY a.created_at DESC
  `).all(id)
  
  const completion = getAttachmentCompletion(Number(id))
  
  return c.json({ order, requiredDefs, attachments, groupedAttachments, attachmentCompletion: completion, reviews, audits })
})

app.post('/', requireRole(ROLES.REGISTRAR), async (c) => {
  const body = await c.req.json()
  const { title, applicant, amount, requiredAttachmentNames = [] } = body
  const userId = getUserId(c)
  
  const orderNo = 'ZC' + new Date().getFullYear() + String(Math.floor(Math.random() * 9000) + 1000)
  
  const insertOrder = db.prepare(`
    INSERT INTO policy_orders (order_no, title, applicant, amount, status, created_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertDef = db.prepare(`
    INSERT INTO required_attachment_defs (order_id, name, sort_order) VALUES (?, ?, ?)
  `)
  
  const tx = db.transaction(() => {
    const info = insertOrder.run(orderNo, title, applicant, amount, STATUS.DRAFT, userId, new Date().toISOString())
    const orderId = info.lastInsertRowid as number
    
    requiredAttachmentNames.forEach((name: string, idx: number) => {
      if (name && name.trim()) {
        insertDef.run(orderId, name.trim(), idx)
      }
    })
    
    return { orderId, orderNo }
  })
  
  const result = tx()
  
  return c.json({ id: result.orderId, orderNo: result.orderNo })
})

app.put('/:id', requireRole(ROLES.REGISTRAR), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { title, applicant, amount } = body
  
  const order = db.prepare('SELECT status FROM policy_orders WHERE id = ?').get(id) as any
  if (!order) {
    return c.json({ error: '兑现单不存在' }, 404)
  }
  if (![STATUS.DRAFT, STATUS.PENDING_CORRECTION].includes(order.status)) {
    return c.json({ error: '当前状态不能修改兑现单' }, 400)
  }
  
  db.prepare(`
    UPDATE policy_orders SET title = ?, applicant = ?, amount = ?, updated_at = ?
    WHERE id = ?
  `).run(title, applicant, amount, new Date().toISOString(), id)
  
  return c.json({ success: true })
})

app.delete('/:id', requireRole(ROLES.REGISTRAR), (c) => {
  const id = c.req.param('id')
  
  const order = db.prepare('SELECT status FROM policy_orders WHERE id = ?').get(id) as any
  if (!order) {
    return c.json({ error: '兑现单不存在' }, 404)
  }
  
  if (order.status !== STATUS.DRAFT) {
    return c.json({ error: '只能删除草稿状态的兑现单' }, 400)
  }
  
  db.prepare('DELETE FROM policy_orders WHERE id = ?').run(id)
  
  return c.json({ success: true })
})

app.post('/batch-result', requireRole(ROLES.REGISTRAR), async (c) => {
  const { orderIds, action, remark } = await c.req.json()
  const userId = getUserId(c)
  
  const results: any[] = []
  
  const getOrder = db.prepare('SELECT * FROM policy_orders WHERE id = ?')
  const updateStatus = db.prepare('UPDATE policy_orders SET status = ?, abnormal_type = NULL, updated_at = ? WHERE id = ?')
  const insertReview = db.prepare('INSERT INTO review_records (order_id, operator_id, action, remark, from_status, to_status) VALUES (?, ?, ?, ?, ?, ?)')
  const insertAudit = db.prepare('INSERT INTO audit_logs (order_id, operator_id, action, failure_reason, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  
  const txProcess = db.transaction((orderId: number) => {
    const orderData = getOrder.get(orderId) as any
    if (!orderData) {
      results.push({ orderId, success: false, reason: '兑现单不存在' })
      return
    }
    
    if (action !== 'BATCH_SUBMIT') {
      results.push({ 
        orderId, 
        success: false, 
        orderNo: orderData.order_no,
        reason: `不支持的操作类型：${action}`
      })
      insertAudit.run(orderId, userId, `批量${action}失败`, '不支持的操作类型', `操作类型：${action}`, new Date().toISOString())
      return
    }
    
    if (orderData.status !== STATUS.DRAFT) {
      results.push({ 
        orderId, 
        success: false, 
        orderNo: orderData.order_no,
        reason: `当前状态「${STATUS_LABELS[orderData.status]}」不支持提交审核`
      })
      insertAudit.run(
        orderId, userId, '批量提交失败', 
        '状态不允许提交', 
        `当前状态为「${STATUS_LABELS[orderData.status]}」，只有草稿状态可以提交审核`, 
        new Date().toISOString()
      )
      return
    }
    
    const { required, valid, allValid } = checkAttachmentsByDefs(orderId)
    if (!allValid) {
      const missing = required - valid
      results.push({ 
        orderId, 
        success: false, 
        orderNo: orderData.order_no,
        reason: '附件不齐全',
        detail: `需要 ${required} 个必备附件，当前只有 ${valid} 个有效附件，尚缺 ${missing} 个`
      })
      insertAudit.run(
        orderId, userId, '批量提交失败', 
        '附件不齐全', 
        `需要 ${required} 个必备附件，当前只有 ${valid} 个有效附件，尚缺 ${missing} 个必备附件`,
        new Date().toISOString()
      )
      return
    }
    
    updateStatus.run(STATUS.PENDING_REVIEW, new Date().toISOString(), orderId)
    insertReview.run(orderId, userId, '批量提交审核', remark || '批量提交审核', orderData.status, STATUS.PENDING_REVIEW)
    results.push({ orderId, success: true, orderNo: orderData.order_no, action: '提交审核', detail: '已提交至审核队列' })
  })
  
  for (const orderId of orderIds) {
    try {
      txProcess(orderId)
    } catch (e: any) {
      const orderData = getOrder.get(orderId) as any
      results.push({ 
        orderId, 
        success: false, 
        orderNo: orderData?.order_no, 
        reason: e.message || '系统错误'
      })
      try {
        insertAudit.run(orderId, userId, '批量操作异常', e.message || '系统错误', JSON.stringify(e), new Date().toISOString())
      } catch {
      }
    }
  }
  
  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length
  
  return c.json({ 
    success: true, 
    summary: `成功 ${successCount} 条，失败 ${failCount} 条`,
    results 
  })
})

export default app
