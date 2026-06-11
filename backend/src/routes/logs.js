const Router = require('@koa/router');
const db = require('../db');
const { success, paginate } = require('../utils/response');
const { authMiddleware, allRoles } = require('../middleware/auth');
const { OPERATION_NAMES, ROLE_NAMES } = require('../constants');

const router = new Router({ prefix: '/api/logs' });

router.get('/', authMiddleware(), allRoles, async (ctx) => {
  const { page = 1, pageSize = 20, operationType, userId } = ctx.query;

  const conditions = [];
  const params = [];

  if (operationType) {
    conditions.push('l.operation_type = ?');
    params.push(operationType);
  }

  if (userId) {
    conditions.push('l.user_id = ?');
    params.push(userId);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countStmt = db.prepare(`
    SELECT COUNT(*) as total FROM operation_logs l ${whereSql}
  `);
  const { total } = countStmt.get(...params);

  const offset = (page - 1) * pageSize;
  const listStmt = db.prepare(`
    SELECT l.*, u.name as user_name, u.role as user_role, r.record_no
    FROM operation_logs l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN supervision_records r ON l.record_id = r.id
    ${whereSql}
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `);
  const list = listStmt.all(...params, parseInt(pageSize), offset);

  const formattedList = list.map(l => ({
    ...l,
    operationTypeName: OPERATION_NAMES[l.operation_type] || l.operation_type,
    userRoleName: ROLE_NAMES[l.user_role] || l.user_role,
  }));

  paginate(ctx, formattedList, total, parseInt(page), parseInt(pageSize));
});

module.exports = router;
