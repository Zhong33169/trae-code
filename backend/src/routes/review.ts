import { Hono } from 'hono'
import db from '../db/index.js'
import { STATUS, ROLES, ABNORMAL_TYPES } from '../db/schema.js'

const app = new Hono()

const insertReview = db.prepare(`
  INSERT INTO review_records (order_id, operator_id, action, remark, from_status, to_status)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const insertAudit = db.prepare(`
  INSERT INTO audit_logs (order_id, operator_id, action, failure_reason, detail)
  VALUES (?, ?, ?, ?, ?)
`)

const updateOrderStatus = db.prepare(`
  UPDATE policy_orders SET status = ?, reject_reason = ?, audit_remark = ?, result_content = ?, abnormal_type = ?, timeout_deadline = ?, updated_at = ?
  WHERE id = ?
`)

const checkAttachments = (orderId: number) => {
  const required = db.prepare('SELECT COUNT(*) as cnt FROM attachments WHERE order_id = ? AND required = 1').get(orderId) as any
  const valid = db.prepare('SELECT COUNT(*) as cnt FROM attachments WHERE order_id = ? AND required = 1 AND rejected = 0').get(orderId) as any
  return { required: required.cnt, valid: valid.cnt, allValid: required.cnt > 0 && valid.cnt >= required.cnt }
}

app.post('/submit', async (c) => {
  const { orderId, userId, remark } = await c.req.json()
  
  const order = db.prepare('SELECT * FROM policy_orders WHERE id = ?').get(orderId) as any
  if (!order) return c.json({ error: '兑现单不存在' }, 404)
  
  if (order.status !== STATUS.DRAFT) {
    return c.json({ error: '只有草稿状态可以提交审核' }, 400)
  }
  
  const { allValid, required, valid } = checkAttachments(orderId)
  if (!allValid) {
    insertAudit.run(orderId, userId, '提交审核失败', '附件不齐全', `需要 ${required} 个必要附件，当前只有 ${valid} 个有效附件`)
    return c.json({ error: `附件不齐全，需要补齐 ${required - valid} 个必要附件才能提交` }, 400)
  }
  
  updateOrderStatus.run(STATUS.PENDING_REVIEW, null, null, null, null, null, new Date().toISOString(), orderId)
  insertReview.run(orderId, userId, '发起审核', remark || '材料齐全，申请审核', order.status, STATUS.PENDING_REVIEW)
  
  return c.json({ success: true, status: STATUS.PENDING_REVIEW })
})

app.post('/correction/submit', async (c) => {
  const { orderId, userId, remark } = await c.req.json()
  
  const order = db.prepare('SELECT * FROM policy_orders WHERE id = ?').get(orderId) as any
  if (!order) return c.json({ error: '兑现单不存在' }, 404)
  
  if (order.status !== STATUS.PENDING_CORRECTION) {
    return c.json({ error: '只有待补正状态可以提交审核' }, 400)
  }
  
  const { allValid, required, valid } = checkAttachments(orderId)
  if (!allValid) {
    insertAudit.run(orderId, userId, '补正提交失败', '附件不齐全', `需要 ${required} 个必要附件，当前只有 ${valid} 个有效附件，尚有 ${required - valid} 个被驳回或缺失`)
    return c.json({ error: `附件不齐全，还有 ${required - valid} 个必要附件被驳回或缺失，请补齐后再提交` }, 400)
  }
  
  updateOrderStatus.run(STATUS.PENDING_REVIEW, null, null, null, null, null, new Date().toISOString(), orderId)
  insertReview.run(orderId, userId, '补正完成', remark || '已补齐附件，申请重新审核', order.status, STATUS.PENDING_REVIEW)
  
  return c.json({ success: true, status: STATUS.PENDING_REVIEW })
})

app.post('/review/approve', async (c) => {
  const { orderId, userId, remark, auditRemark } = await c.req.json()
  
  const order = db.prepare('SELECT * FROM policy_orders WHERE id = ?').get(orderId) as any
  if (!order) return c.json({ error: '兑现单不存在' }, 404)
  
  if (order.status !== STATUS.PENDING_REVIEW) {
    return c.json({ error: '只有待审核状态可以审核通过' }, 400)
  }
  
  const { allValid, required, valid } = checkAttachments(orderId)
  if (!allValid) {
    insertAudit.run(orderId, userId, '审核通过失败', '附件不齐全', `需要 ${required} 个必要附件，当前只有 ${valid} 个有效附件`)
    return c.json({ error: '附件不齐全，不能通过审核' }, 400)
  }
  
  updateOrderStatus.run(STATUS.REVIEWED, null, auditRemark || null, null, null, null, new Date().toISOString(), orderId)
  insertReview.run(orderId, userId, '审核通过', remark || '材料齐全，符合条件', order.status, STATUS.REVIEWED)
  
  return c.json({ success: true, status: STATUS.REVIEWED })
})

app.post('/review/reject', async (c) => {
  const { orderId, userId, remark, rejectReason, failureReason, timeoutDays } = await c.req.json()
  
  const order = db.prepare('SELECT * FROM policy_orders WHERE id = ?').get(orderId) as any
  if (!order) return c.json({ error: '兑现单不存在' }, 404)
  
  if (order.status !== STATUS.PENDING_REVIEW) {
    return c.json({ error: '只有待审核状态可以驳回补正' }, 400)
  }
  
  const deadline = timeoutDays ? new Date(Date.now() + timeoutDays * 24 * 60 * 60 * 1000).toISOString() : null
  
  updateOrderStatus.run(STATUS.PENDING_CORRECTION, rejectReason, null, null, ABNORMAL_TYPES.MISSING_ATTACHMENT, deadline, new Date().toISOString(), orderId)
  insertReview.run(orderId, userId, '驳回补正', remark || '材料需要补正', order.status, STATUS.PENDING_CORRECTION)
  
  if (failureReason) {
    insertAudit.run(orderId, userId, '审核驳回', failureReason, rejectReason || remark)
  }
  
  return c.json({ success: true, status: STATUS.PENDING_CORRECTION })
})

app.post('/approver/approve', async (c) => {
  const { orderId, userId, remark, resultContent, auditRemark } = await c.req.json()
  
  const order = db.prepare('SELECT * FROM policy_orders WHERE id = ?').get(orderId) as any
  if (!order) return c.json({ error: '兑现单不存在' }, 404)
  
  if (order.status !== STATUS.REVIEWED) {
    return c.json({ error: '只有审核通过状态可以复核通过' }, 400)
  }
  
  updateOrderStatus.run(STATUS.APPROVED, null, auditRemark || null, resultContent || null, null, null, new Date().toISOString(), orderId)
  insertReview.run(orderId, userId, '复核通过', remark || '符合条件，同意补贴', order.status, STATUS.APPROVED)
  
  return c.json({ success: true, status: STATUS.APPROVED })
})

app.post('/approver/reject', async (c) => {
  const { orderId, userId, remark, rejectReason, failureReason } = await c.req.json()
  
  const order = db.prepare('SELECT * FROM policy_orders WHERE id = ?').get(orderId) as any
  if (!order) return c.json({ error: '兑现单不存在' }, 404)
  
  if (![STATUS.REVIEWED, STATUS.APPROVED].includes(order.status)) {
    return c.json({ error: '只有审核通过或复核通过状态可以退回' }, 400)
  }
  
  updateOrderStatus.run(STATUS.REJECTED, rejectReason, null, null, ABNORMAL_TYPES.REJECTED, null, new Date().toISOString(), orderId)
  insertReview.run(orderId, userId, '复核退回', remark || '不符合条件，予以退回', order.status, STATUS.REJECTED)
  
  if (failureReason) {
    insertAudit.run(orderId, userId, '复核驳回', failureReason, rejectReason || remark)
  }
  
  return c.json({ success: true, status: STATUS.REJECTED })
})

app.post('/approver/archive', async (c) => {
  const { orderId, userId, remark, auditRemark } = await c.req.json()
  
  const order = db.prepare('SELECT * FROM policy_orders WHERE id = ?').get(orderId) as any
  if (!order) return c.json({ error: '兑现单不存在' }, 404)
  
  if (order.status !== STATUS.APPROVED) {
    return c.json({ error: '只有复核通过状态可以归档' }, 400)
  }
  
  updateOrderStatus.run(STATUS.ARCHIVED, null, auditRemark || order.audit_remark, order.result_content, null, null, new Date().toISOString(), orderId)
  insertReview.run(orderId, userId, '归档', remark || '流程完成，已归档', order.status, STATUS.ARCHIVED)
  
  return c.json({ success: true, status: STATUS.ARCHIVED })
})

export default app
