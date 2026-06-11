const Router = require('koa-router');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getStatusText } = require('../utils');
const config = require('../config');
const dayjs = require('dayjs');

const router = new Router({ prefix: '/api' });

router.get('/statistics', authMiddleware, async (ctx) => {
  const user = ctx.state.user;

  let userWhere = '';
  let userParams = [];
  if (user.role === config.roles.REGISTRAR) {
    userWhere = 'WHERE created_by = ?';
    userParams = [user.id];
  }

  const statusCounts = db.all(`
    SELECT status, COUNT(*) as count
    FROM bus_schedules
    ${userWhere}
    GROUP BY status
  `, userParams);

  const totalRow = db.get(`SELECT COUNT(*) as count FROM bus_schedules ${userWhere}`, userParams);
  const total = totalRow?.count || 0;

  const today = dayjs().format('YYYY-MM-DD');
  const todayParams = user.role === config.roles.REGISTRAR ? [today, user.id] : [today];
  const todayWhere = user.role === config.roles.REGISTRAR ? 'AND created_by = ?' : '';
  const todayRow = db.get(`
    SELECT COUNT(*) as count FROM bus_schedules
    WHERE date(created_at) = ? ${todayWhere}
  `, todayParams);
  const todayCount = todayRow?.count || 0;

  const archivedParams = user.role === config.roles.REGISTRAR ? [user.id] : [];
  const archivedWhere = user.role === config.roles.REGISTRAR ? 'AND created_by = ?' : '';
  const archivedRow = db.get(`
    SELECT COUNT(*) as count FROM bus_schedules
    WHERE status = 'archived' ${archivedWhere}
  `, archivedParams);
  const archivedCount = archivedRow?.count || 0;

  const statusMap = {};
  for (const s of statusCounts) {
    statusMap[s.status] = { count: s.count, text: getStatusText(s.status) };
  }

  const allStatuses = ['draft', 'pending_audit', 'audit_rejected', 'pending_review', 'review_rejected', 'archived'];
  const statusList = allStatuses.map(s => ({
    status: s,
    text: getStatusText(s),
    count: statusMap[s]?.count || 0
  }));

  ctx.body = {
    code: 0,
    data: {
      total,
      todayCount,
      archivedCount,
      statusList
    }
  };
});

router.get('/operation-logs', authMiddleware, async (ctx) => {
  const { page = 1, pageSize = 20, scheduleId } = ctx.query;
  const user = ctx.state.user;

  let whereClauses = [];
  let params = [];

  if (scheduleId) {
    whereClauses.push('schedule_id = ?');
    params.push(scheduleId);
  }

  if (user.role === config.roles.REGISTRAR) {
    whereClauses.push(`schedule_id IN (SELECT id FROM bus_schedules WHERE created_by = ${user.id})`);
  }

  const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const totalRow = db.get(`SELECT COUNT(*) as count FROM operation_logs ${whereSQL}`, params);
  const total = totalRow?.count || 0;

  const offset = (page - 1) * pageSize;
  const list = db.all(`
    SELECT * FROM operation_logs
    ${whereSQL}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(pageSize), offset]);

  const formatted = list.map(l => ({
    ...l,
    oldStatusText: l.old_status ? getStatusText(l.old_status) : null,
    newStatusText: l.new_status ? getStatusText(l.new_status) : null
  }));

  ctx.body = {
    code: 0,
    data: { list: formatted, total, page: Number(page), pageSize: Number(pageSize) }
  };
});

router.get('/users/list', authMiddleware, async (ctx) => {
  const list = db.all('SELECT id, username, real_name, role FROM users ORDER BY id');
  ctx.body = { code: 0, data: list };
});

module.exports = router;
