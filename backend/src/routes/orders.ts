import { Hono } from 'hono'
import db from '../db/index.js'
import { STATUS, STATUS_LABELS, ABNORMAL_TYPES, ABNORMAL_LABELS, ROLES } from '../db/schema.js'

const app = new Hono()

app.get('/', (c) => {
  const status = c.req.query('status')
  const abnormal = c.req.query('abnormal')
  const role = c.req.query('role')
  
  let sql = `
    SELECT o.*, u.name as creator_name,
      (SELECT COUNT(*) FROM attachments a WHERE a.order_id = o.id AND a.required = 1 AND a.rejected = 0) as valid_attachments,
      (SELECT COUNT(*) FROM attachments a WHERE a.order_id = o.id AND a.required = 1) as required_attachments
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
  
  if (role) {
    if (role === ROLES.REGISTRAR) {
    } else if (role === ROLES.REVIEWER) {
      sql += ` AND o.status IN (?, ?)`
      params.push(STATUS.PENDING_REVIEW, STATUS.PENDING_CORRECTION)
    } else if (role === ROLES.APPROVER) {
      sql += ` AND o.status IN (?, ?, ?)`
      params.push(STATUS.REVIEWED, STATUS.APPROVED, STATUS.ARCHIVED)
    }
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

app.get('/:id', (c) => {
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
  
  const attachments = db.prepare(`
    SELECT a.*, u.name as uploader_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    WHERE a.order_id = ?
    ORDER BY a.created_at
  `).all(id)
  
  const reviews = db.prepare(`
    SELECT r.*, u.name as operator_name
    FROM review_records r
    LEFT JOIN users u ON r.operator_id = u.id
    WHERE r.order_id = ?
    ORDER BY r.created_at
  `).all(id)
  
  const audits = db.prepare(`
    SELECT a.*, u.name as operator_name
    FROM audit_logs a
    LEFT JOIN users u ON a.operator_id = u.id
    WHERE a.order_id = ?
    ORDER BY a.created_at
  `).all(id)
  
  return c.json({ order, attachments, reviews, audits })
})

app.post('/', async (c) => {
  const body = await c.req.json()
  const { title, applicant, amount, userId } = body
  
  const orderNo = 'ZC' + new Date().getFullYear() + String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  
  const info = db.prepare(`
    INSERT INTO policy_orders (order_no, title, applicant, amount, status, created_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(orderNo, title, applicant, amount, STATUS.DRAFT, userId, new Date().toISOString())
  
  return c.json({ id: info.lastInsertRowid, orderNo })
})

app.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { title, applicant, amount } = body
  
  db.prepare(`
    UPDATE policy_orders SET title = ?, applicant = ?, amount = ?, updated_at = ?
    WHERE id = ?
  `).run(title, applicant, amount, new Date().toISOString(), id)
  
  return c.json({ success: true })
})

app.delete('/:id', (c) => {
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

app.post('/batch-result', async (c) => {
  const { orderIds, action, userId, remark } = await c.req.json()
  
  const results: any[] = []
  
  const order = db.prepare('SELECT * FROM policy_orders WHERE id = ?')
  const updateStatus = db.prepare('UPDATE policy_orders SET status = ?, updated_at = ? WHERE id = ?')
  const insertReview = db.prepare('INSERT INTO review_records (order_id, operator_id, action, remark, from_status, to_status) VALUES (?, ?, ?, ?, ?, ?)')
  const insertAudit = db.prepare('INSERT INTO audit_logs (order_id, operator_id, action, failure_reason, detail) VALUES (?, ?, ?, ?, ?)')
  
  for (const orderId of orderIds) {
    const orderData = order.get(orderId) as any
    if (!orderData) {
      results.push({ orderId, success: false, reason: '兑现单不存在' })
      continue
    }
    
    try {
      if (action === 'BATCH_SUBMIT' && orderData.status === STATUS.DRAFT) {
        const attachments = db.prepare('SELECT * FROM attachments WHERE order_id = ? AND required = 1 AND rejected = 0').all(orderId)
        const requiredCount = db.prepare('SELECT COUNT(*) as cnt FROM attachments WHERE order_id = ? AND required = 1').get(orderId) as any
        
        if (attachments.length < requiredCount.cnt) {
          results.push({ 
            orderId, 
            success: false, 
            orderNo: orderData.order_no,
            reason: '缺少必要附件',
            detail: `需要 ${requiredCount.cnt} 个必要附件，当前只有 ${attachments.length} 个有效附件`
          })
          insertAudit.run(orderId, userId, '批量提交失败', '缺少必要附件', `需要 ${requiredCount.cnt} 个必要附件，当前只有 ${attachments.length} 个有效附件`)
          continue
        }
        
        updateStatus.run(STATUS.PENDING_REVIEW, new Date().toISOString(), orderId)
        insertReview.run(orderId, userId, '批量提交审核', remark || '批量提交', orderData.status, STATUS.PENDING_REVIEW)
        results.push({ orderId, success: true, orderNo: orderData.order_no, action: '提交审核' })
      } else {
        results.push({ 
          orderId, 
          success: false, 
          orderNo: orderData.order_no,
          reason: `当前状态「${STATUS_LABELS[orderData.status]}」不支持该操作`
        })
      }
    } catch (e: any) {
      results.push({ orderId, success: false, orderNo: orderData.order_no, reason: e.message })
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
