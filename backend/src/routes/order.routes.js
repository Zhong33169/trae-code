const Router = require('koa-router');
const orderService = require('../services/order.service');
const { authMiddleware } = require('../middleware/auth');
const { ROLES } = require('../config');

const router = new Router({ prefix: '/api/orders' });

function getRequestId(ctx) {
  return ctx.request.headers['x-request-id'] || ctx.request.body?.requestId;
}

function badRequest(ctx, message, code = 400, extra = {}) {
  ctx.status = code;
  ctx.body = { code, message, ...extra };
}

function writeResponse(ctx, res) {
  if (res?.idempotent) {
    ctx.set('X-Idempotent-Hit', '1');
    ctx.set('X-Idempotent-Cached-At', res.cachedAt || '');
  }
  if (!res.ok) {
    const code = res.code || 400;
    ctx.status = code;
    ctx.body = {
      code,
      message: res.message,
      failureReason: res.failureReason || null
    };
    return;
  }
  ctx.body = { code: 0, message: res.message || 'success', data: res.data };
}

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
  if (!detail) return badRequest(ctx, '借用单不存在', 404);
  ctx.body = { code: 0, data: detail };
});

router.post('/', authMiddleware([ROLES.REGISTRAR]), async (ctx) => {
  const data = ctx.request.body || {};
  const required = ['applicant', 'department', 'equipment_name', 'borrow_reason', 'expected_return_date'];
  const missing = required.filter(k => !data[k]);
  if (missing.length) return badRequest(ctx, `缺少必填字段: ${missing.join(', ')}`);
  const requestId = getRequestId(ctx);
  if (!requestId) return badRequest(ctx, '缺少幂等请求 ID (X-Request-Id header)');
  const res = orderService.createOrder(ctx.state.user, requestId, data);
  writeResponse(ctx, res);
});

router.post('/:id/submit', authMiddleware([ROLES.REGISTRAR]), async (ctx) => {
  const data = ctx.request.body || {};
  const requestId = getRequestId(ctx);
  if (!requestId) return badRequest(ctx, '缺少幂等请求 ID (X-Request-Id header)');
  const res = orderService.submitForAudit(ctx.state.user, requestId, parseInt(ctx.params.id), data);
  writeResponse(ctx, res);
});

router.post('/:id/audit', authMiddleware([ROLES.AUDITOR]), async (ctx) => {
  const data = ctx.request.body || {};
  if (!['approve', 'reject'].includes(data.decision)) return badRequest(ctx, 'decision 必须是 approve 或 reject');
  const requestId = getRequestId(ctx);
  if (!requestId) return badRequest(ctx, '缺少幂等请求 ID (X-Request-Id header)');
  const res = orderService.auditOrder(ctx.state.user, requestId, parseInt(ctx.params.id), data.decision, data);
  writeResponse(ctx, res);
});

router.post('/:id/review', authMiddleware([ROLES.REVIEWER]), async (ctx) => {
  const data = ctx.request.body || {};
  if (!['approve', 'reject'].includes(data.decision)) return badRequest(ctx, 'decision 必须是 approve 或 reject');
  const requestId = getRequestId(ctx);
  if (!requestId) return badRequest(ctx, '缺少幂等请求 ID (X-Request-Id header)');
  const res = orderService.reviewOrder(ctx.state.user, requestId, parseInt(ctx.params.id), data.decision, data);
  if (!res.ok) {
    writeResponse(ctx, res);
    return;
  }
  writeResponse(ctx, res);
});

router.post('/batch-review', authMiddleware([ROLES.REVIEWER]), async (ctx) => {
  const data = ctx.request.body || {};
  if (!Array.isArray(data.orderIds) || data.orderIds.length === 0) return badRequest(ctx, 'orderIds 必须是非空数组');
  const requestId = getRequestId(ctx);
  if (!requestId) return badRequest(ctx, '缺少幂等请求 ID (X-Request-Id header)');
  const res = orderService.batchReviewOrders(ctx.state.user, requestId, data.orderIds, data);
  writeResponse(ctx, res);
});

router.post('/:id/evidences', authMiddleware([ROLES.REGISTRAR]), async (ctx) => {
  const data = ctx.request.body || {};
  if (!data.type || !data.description) return badRequest(ctx, 'type 和 description 必填');
  const requestId = getRequestId(ctx);
  if (!requestId) return badRequest(ctx, '缺少幂等请求 ID (X-Request-Id header)');
  const res = orderService.addEvidence(ctx.state.user, requestId, parseInt(ctx.params.id), data);
  writeResponse(ctx, res);
});

router.delete('/evidences/:evidenceId', authMiddleware([ROLES.REGISTRAR]), async (ctx) => {
  const data = ctx.request.body || {};
  const requestId = getRequestId(ctx);
  if (!requestId) return badRequest(ctx, '缺少幂等请求 ID (X-Request-Id header)');
  const res = orderService.deleteEvidence(ctx.state.user, requestId, parseInt(ctx.params.evidenceId), data);
  writeResponse(ctx, res);
});

module.exports = router;
