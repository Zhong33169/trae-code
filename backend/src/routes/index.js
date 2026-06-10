const Router = require('koa-router');
const orderModel = require('../models/prescriptionOrder');
const userModel = require('../models/user');

const router = new Router({ prefix: '/api' });

router.get('/orders', async (ctx) => {
  const { userId, userRole, status, riskLevel, storeId, keyword } = ctx.query;

  if (!userId || !userRole) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少 userId 或 userRole 参数' };
    return;
  }

  const user = await userModel.getUserById(userId);
  if (!user) {
    ctx.status = 404;
    ctx.body = { success: false, message: '用户不存在' };
    return;
  }

  if (user.role !== userRole) {
    ctx.status = 403;
    ctx.body = { success: false, message: '用户角色不匹配' };
    return;
  }

  const orders = await orderModel.getOrdersByRole(userId, userRole, {
    status,
    riskLevel,
    storeId,
    keyword
  });

  ctx.body = {
    success: true,
    data: orders,
    total: orders.length
  };
});

router.get('/orders/:id', async (ctx) => {
  const { id } = ctx.params;
  const { userId } = ctx.query;

  if (!userId) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少 userId 参数' };
    return;
  }

  const user = await userModel.getUserById(userId);
  if (!user) {
    ctx.status = 404;
    ctx.body = { success: false, message: '用户不存在' };
    return;
  }

  const order = await orderModel.getOrderById(id);
  if (!order) {
    ctx.status = 404;
    ctx.body = { success: false, message: '订单不存在' };
    return;
  }

  const evidences = await orderModel.getOrderEvidences(id);
  const logs = await orderModel.getOrderLogs(id);
  const availableActions = orderModel.getAvailableActions(order, userId, user.role);
  const evidenceCheck = await orderModel.validateRequiredEvidences(id, order.risk_level);
  const fieldChanges = await orderModel.getFieldChanges(id);
  const evidenceChanges = await orderModel.getEvidenceChanges(id);

  ctx.body = {
    success: true,
    order,
    evidences,
    logs,
    availableActions,
    evidenceCheck,
    fieldChanges,
    evidenceChanges,
    canEdit: order.registrar_id === userId && ['draft', 'returned'].includes(order.status)
  };
});

router.get('/stats', async (ctx) => {
  const { userId, userRole } = ctx.query;

  if (!userId || !userRole) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少 userId 或 userRole 参数' };
    return;
  }

  const user = await userModel.getUserById(userId);
  if (!user) {
    ctx.status = 404;
    ctx.body = { success: false, message: '用户不存在' };
    return;
  }

  if (user.role !== userRole) {
    ctx.status = 403;
    ctx.body = { success: false, message: '用户角色不匹配' };
    return;
  }

  const stats = await orderModel.getStats(userId, userRole);
  ctx.body = { success: true, stats };
});

router.post('/orders/:id/actions/:action', async (ctx) => {
  const { id, action } = ctx.params;
  const { userId, userRole, opinion, version } = ctx.request.body;

  if (!userId || !userRole) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少 userId 或 userRole' };
    return;
  }

  const result = await orderModel.performAction(id, userId, userRole, action, opinion, version);

  if (!result.success) {
    ctx.status = 400;
  }

  ctx.body = result;
});

router.post('/orders', async (ctx) => {
  const { userId, ...data } = ctx.request.body;

  if (!userId) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少 userId' };
    return;
  }

  const result = await orderModel.createOrder(data, userId);
  if (!result.success) {
    ctx.status = 400;
  }
  ctx.body = result;
});

router.put('/orders/:id', async (ctx) => {
  const { id } = ctx.params;
  const { userId, version, ...data } = ctx.request.body;

  if (!userId) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少 userId' };
    return;
  }

  const result = await orderModel.updateOrderBasic(id, data, userId, version);
  if (!result.success) {
    ctx.status = 400;
  }
  ctx.body = result;
});

router.get('/orders/:id/evidences', async (ctx) => {
  const { id } = ctx.params;
  const evidences = await orderModel.getOrderEvidences(id);
  ctx.body = { success: true, evidences };
});

router.post('/orders/:id/evidences', async (ctx) => {
  const { id } = ctx.params;
  const { userId, type, name } = ctx.request.body;

  if (!userId || !type || !name) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少必要参数' };
    return;
  }

  const result = await orderModel.addEvidence(id, type, name, userId);
  if (!result.success) {
    ctx.status = 400;
  }
  ctx.body = result;
});

router.delete('/evidences/:id', async (ctx) => {
  const { id } = ctx.params;
  const { userId } = ctx.request.body;

  if (!userId) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少 userId' };
    return;
  }

  const result = await orderModel.deleteEvidence(id, userId);
  if (!result.success) {
    ctx.status = 400;
  }
  ctx.body = result;
});

router.get('/users/current', async (ctx) => {
  const { userId } = ctx.query;
  if (!userId) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少 userId' };
    return;
  }

  const user = await userModel.getUserById(userId);
  if (!user) {
    ctx.status = 404;
    ctx.body = { success: false, message: '用户不存在' };
    return;
  }

  ctx.body = {
    success: true,
    user: {
      ...user,
      roleLabel: orderModel.getRoleLabel(user.role)
    }
  };
});

router.get('/users', async (ctx) => {
  const users = await userModel.getAllUsers();
  ctx.body = {
    success: true,
    users: users.map(u => ({
      ...u,
      roleLabel: orderModel.getRoleLabel(u.role)
    }))
  };
});

router.get('/stores', async (ctx) => {
  const { getDb } = require('../db');
  const db = await getDb();
  const stores = db.prepare('SELECT * FROM stores').all();
  ctx.body = { success: true, stores };
});

module.exports = router;
