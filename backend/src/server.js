const express = require('express');
const cors = require('cors');
const { DataStore } = require('./store');
const {
  ROLES,
  ROLE_NAMES,
  STATUS_NAMES,
  ACTION_NAMES,
} = require('./constants');

const app = express();
const store = new DataStore();

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = process.env.CORS_ORIGIN || '*';
      if (allowed === '*' || !origin || origin === allowed || origin.startsWith(allowed.split(':').slice(0,2).join(':'))) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  const role = req.headers['x-user-role'];
  const userId = req.headers['x-user-id'];
  req.user = store.getUserInfo(userId || 'registrar_demo');
  if (role && Object.values(ROLES).includes(role)) {
    req.user.role = role;
  }
  next();
});

function ok(res, data) {
  res.json({ success: true, data });
}

function fail(res, message, status = 400, extra = {}) {
  res.status(status).json({ success: false, error: message, ...extra });
}

app.get('/api/health', (req, res) => {
  ok(res, {
    status: 'ok',
    time: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

app.get('/api/meta', (req, res) => {
  ok(res, {
    ...store.getReference(),
    currentUser: req.user,
    roleNames: ROLE_NAMES,
    statusNames: STATUS_NAMES,
    actionNames: ACTION_NAMES,
  });
});

app.get('/api/auth/me', (req, res) => {
  ok(res, {
    user: req.user,
    roleName: store.getRoleName(req.user.role),
  });
});

app.post('/api/auth/switch', (req, res) => {
  const { userId, role } = req.body || {};
  if (!userId) return fail(res, '缺少用户ID');
  const user = store.getUserInfo(userId);
  if (role && Object.values(ROLES).includes(role)) {
    user.role = role;
  }
  ok(res, {
    user,
    roleName: store.getRoleName(user.role),
  });
});

app.get('/api/statistics', (req, res) => {
  ok(res, store.getStatistics(req.user.role));
});

app.get('/api/orders', (req, res) => {
  const { status, store: s, overdue, keyword, page, pageSize } = req.query;
  const result = store.listOrders({
    role: req.user.role,
    status,
    store: s,
    overdue,
    keyword,
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 20,
  });
  ok(res, result);
});

app.get('/api/orders/:id', (req, res) => {
  const order = store.getOrderById(req.params.id);
  if (!order) return fail(res, '订货单不存在', 404);
  const lockToken = store.acquireLock(order.id);
  const allowedActions = store.getAllowedActions(order, req.user.role);
  const reasons = order.overdue
    ? store.validateMaterialsComplete(order.currentStage, order)
    : null;
  ok(res, {
    order,
    lockToken,
    allowedActions,
    role: req.user.role,
    roleName: store.getRoleName(req.user.role),
  });
});

app.post('/api/orders/lock/:id', (req, res) => {
  const token = store.acquireLock(req.params.id);
  if (!token) return fail(res, '订货单正在被他人处理，请稍后重试', 409);
  ok(res, { lockToken: token });
});

app.post('/api/orders', (req, res) => {
  if (req.user.role !== ROLES.REGISTRAR) {
    return fail(res, '只有门店订货登记员可以创建订货单', 403);
  }
  const { title, store: s, category, supplier, totalAmount, items, materials } = req.body || {};
  if (!title || !s || !category || !supplier) {
    return fail(res, '缺少必填字段（标题、门店、品类、供应商）');
  }
  const order = store.createOrder({
    createdBy: req.user.id,
    title,
    store: s,
    category,
    supplier,
    totalAmount,
    items,
    materials,
  });
  ok(res, order);
});

app.put('/api/orders/:id', (req, res) => {
  if (req.user.role !== ROLES.REGISTRAR) {
    return fail(res, '只有门店订货登记员可以编辑草稿', 403);
  }
  const { title, store: s, category, supplier, totalAmount, items, materials } = req.body || {};
  const result = store.updateDraftOrder({
    orderId: req.params.id,
    updatedBy: req.user.id,
    title,
    store: s,
    category,
    supplier,
    totalAmount,
    items,
    materials,
  });
  if (result.error) return fail(res, result.error);
  ok(res, result.order);
});

app.post('/api/orders/:id/action', (req, res) => {
  const { action, opinion, lockToken, version, materials, extendHours } = req.body || {};
  if (!action) return fail(res, '缺少操作类型');
  const result = store.processAction({
    orderId: req.params.id,
    action,
    operator: req.user.id,
    opinion,
    lockToken,
    version,
    materials,
    extendHours,
  });
  if (result.error) {
    return fail(res, result.error, 400, {
      errorDetail: result.errorDetail,
      concurrencyError: result.concurrencyError,
      versionError: result.versionError,
      currentVersion: result.currentVersion,
    });
  }
  ok(res, result.order);
});

app.post('/api/orders/batch', (req, res) => {
  const { action, orderIds, opinion, lockTokens } = req.body || {};
  if (!action || !Array.isArray(orderIds) || orderIds.length === 0) {
    return fail(res, '缺少操作类型或订货单列表');
  }
  const result = store.batchProcess({
    operator: req.user.id,
    action,
    orderIds,
    opinion,
    lockTokens,
  });
  ok(res, result);
});

app.get('/api/audit-logs', (req, res) => {
  const { orderId, operator, action, page, pageSize } = req.query;
  const result = store.listAuditLogs({
    orderId,
    operator,
    action,
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 50,
  });
  ok(res, result);
});

app.get('/api/audit-logs/order/:orderId', (req, res) => {
  const result = store.listAuditLogs({
    orderId: req.params.orderId,
    pageSize: 200,
  });
  ok(res, result);
});

const PORT = Number(process.env.PORT) || 8007;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[store-order-warning] backend listening on http://0.0.0.0:${PORT}`);
  console.log(`[store-order-warning] CORS_ORIGIN=${process.env.CORS_ORIGIN || '*'}`);
});
