const Router = require('koa-router');
const orderService = require('../services/order.service');
const { authMiddleware } = require('../middleware/auth');
const { ROLES } = require('../config');

const router = new Router({ prefix: '/api/orders' });

router.get('/', authMiddleware(), async (ctx) => {
  const q = ctx.query;
  const filters = {};
  if (q.status) filters.status = q.status;
  if (q.statusIn) filters.statusIn = q.statusIn.split(',').filter(Boolean);
  if (q.keyword) filters.keyword = q.keyword;
  if (q.myCreated === '1') filters.myCreated = ctx.state.user.id;
  const page = Math.max(1, parseInt(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize) || 20));
  ctx.body = { code: 0, data: orderService.listOrders(filters, page, pageSize) };
});

router.get('/stats', authMiddleware(), async (ctx) => {
  ctx.body = { code: 0, data: orderService.getQueueStats() };
});

router.get('/:id', authMiddleware(), async (ctx) => {
  const detail = orderService.getOrderDetail(parseInt(ctx.params.id));
  if (!detail) {
    ctx.status = 404;
    ctx.body = { code: 404, message: '借用单不存在' };
    return;
  }
  ctx.body = { code: 0, data: detail };
});

router.post('/', authMiddleware([ROLES.REGISTRAR]), async (ctx) => {
  const data = ctx.request.body || {};
  const required = ['applicant', 'department', 'equipment_name', 'borrow_reason', 'expected_return_date'];
  const missing = required.filter(k => !data[k]);
  if (missing.length) {
    ctx.status = 400;
    ctx.body = { code: 400, message: `缺少必填字段: ${missing.join(', ')}` };
    return;
  }
  const result = orderService.createOrder(ctx.state.user, data);
  ctx.body = { code: 0, data: result };
});

router.post('/:id/submit', authMiddleware([ROLES.REGISTRAR]), async (ctx) => {
  const data = ctx.request.body || {};
  const res = orderService.submitForAudit(ctx.state.user, parseInt(ctx.params.id), data);
  if (!res.ok) {
    ctx.status = 400;
    ctx.body = { code: 400, message: res.message };
    return;
  }
  ctx.body = { code: 0, data: res.data };
});

router.post('/:id/audit', authMiddleware([ROLES.AUDITOR]), async (ctx) => {
  const data = ctx.request.body || {};
  if (!['approve', 'reject'].includes(data.decision)) {
    ctx.status = 400;
    ctx.body = { code: 400, message: 'decision 必须是 approve 或 reject' };
    return;
  }
  const res = orderService.auditOrder(ctx.state.user, parseInt(ctx.params.id), data.decision, data);
  if (!res.ok) {
    ctx.status = 400;
    ctx.body = { code: 400, message: res.message };
    return;
  }
  ctx.body = { code: 0, data: res.data };
});

router.post('/:id/review', authMiddleware([ROLES.REVIEWER]), async (ctx) => {
  const data = ctx.request.body || {};
  if (!['approve', 'reject'].includes(data.decision)) {
    ctx.status = 400;
    ctx.body = { code: 400, message: 'decision 必须是 approve 或 reject' };
    return;
  }
  const res = orderService.reviewOrder(ctx.state.user, parseInt(ctx.params.id), data.decision, data);
  if (!res.ok) {
    ctx.status = 400;
    ctx.body = { code: 400, message: res.message, failureReason: res.failureReason };
    return;
  }
  ctx.body = { code: 0, data: res.data };
});

router.post('/batch-review', authMiddleware([ROLES.REVIEWER]), async (ctx) => {
  const data = ctx.request.body || {};
  if (!Array.isArray(data.orderIds) || data.orderIds.length === 0) {
    ctx.status = 400;
    ctx.body = { code: 400, message: 'orderIds 必须是非空数组' };
    return;
  }
  const results = orderService.batchReviewOrders(ctx.state.user, data.orderIds, data);
  ctx.body = { code: 0, data: results };
});

router.post('/:id/evidences', authMiddleware([ROLES.REGISTRAR]), async (ctx) => {
  const data = ctx.request.body || {};
  if (!data.type || !data.description) {
    ctx.status = 400;
    ctx.body = { code: 400, message: 'type 和 description 必填' };
    return;
  }
  const res = orderService.addEvidence(ctx.state.user, parseInt(ctx.params.id), data);
  if (!res.ok) {
    ctx.status = 400;
    ctx.body = { code: 400, message: res.message };
    return;
  }
  ctx.body = { code: 0, data: res };
});

router.delete('/evidences/:evidenceId', authMiddleware([ROLES.REGISTRAR]), async (ctx) => {
  const res = orderService.deleteEvidence(ctx.state.user, parseInt(ctx.params.evidenceId));
  if (!res.ok) {
    ctx.status = 400;
    ctx.body = { code: 400, message: res.message };
    return;
  }
  ctx.body = { code: 0, data: res };
});

module.exports = router;
