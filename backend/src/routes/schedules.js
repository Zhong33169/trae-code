const Router = require('koa-router');
const db = require('../db');
const dayjs = require('dayjs');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { logOperation, getStatusText } = require('../utils');
const config = require('../config');

const router = new Router({ prefix: '/api/schedules' });

function validateHandover(handover) {
  if (!handover) return '交接信息缺失';
  if (!handover.shift_no?.trim()) return '班次不能为空';
  if (!handover.handover_person?.trim()) return '交出人不能为空';
  if (!handover.receiver_person?.trim()) return '接收人不能为空';
  if (!handover.confirm_time?.trim()) return '确认时间不能为空';
  return null;
}

function buildScheduleWithDetails(row) {
  if (!row) return null;
  const handover = db.get('SELECT * FROM handover_records WHERE schedule_id = ?', [row.id]);
  const creator = db.get('SELECT real_name FROM users WHERE id = ?', [row.created_by]);
  const audits = db.all(`
    SELECT ar.*, u.real_name as auditor_real_name
    FROM audit_records ar
    LEFT JOIN users u ON ar.auditor_id = u.id
    WHERE ar.schedule_id = ?
    ORDER BY ar.created_at DESC
  `, [row.id]);
  const logs = db.all(`
    SELECT * FROM operation_logs
    WHERE schedule_id = ?
    ORDER BY created_at DESC
  `, [row.id]);

  return {
    ...row,
    statusText: getStatusText(row.status),
    creatorName: creator?.real_name || '-',
    handover,
    audits,
    operationLogs: logs
  };
}

router.get('/', authMiddleware, async (ctx) => {
  const { status, keyword, page = 1, pageSize = 10 } = ctx.query;
  const user = ctx.state.user;

  let whereClauses = [];
  let params = [];

  if (status) {
    whereClauses.push('bs.status = ?');
    params.push(status);
  }
  if (keyword) {
    whereClauses.push('(bs.schedule_no LIKE ? OR bs.route_name LIKE ? OR bs.bus_no LIKE ?)');
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }

  if (user.role === config.roles.REGISTRAR) {
    whereClauses.push('bs.created_by = ?');
    params.push(user.id);
  }

  const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const totalRow = db.get(`SELECT COUNT(*) as count FROM bus_schedules bs ${whereSQL}`, params);
  const total = totalRow?.count || 0;

  const offset = (page - 1) * pageSize;
  const rows = db.all(`
    SELECT bs.*, u.real_name as creator_name
    FROM bus_schedules bs
    LEFT JOIN users u ON bs.created_by = u.id
    ${whereSQL}
    ORDER BY bs.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(pageSize), offset]);

  const list = rows.map(r => ({
    id: r.id,
    scheduleNo: r.schedule_no,
    routeName: r.route_name,
    busNo: r.bus_no,
    driverName: r.driver_name,
    departureTime: r.departure_time,
    startStation: r.start_station,
    endStation: r.end_station,
    shiftType: r.shift_type,
    status: r.status,
    statusText: getStatusText(r.status),
    creatorName: r.creator_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdBy: r.created_by
  }));

  ctx.body = { code: 0, data: { list, total, page: Number(page), pageSize: Number(pageSize) } };
});

router.get('/:id', authMiddleware, async (ctx) => {
  const row = db.get('SELECT * FROM bus_schedules WHERE id = ?', [ctx.params.id]);
  if (!row) {
    ctx.status = 404;
    ctx.body = { code: 404, message: '发车计划不存在' };
    return;
  }
  ctx.body = { code: 0, data: buildScheduleWithDetails(row) };
});

router.post('/', authMiddleware, roleMiddleware(config.roles.REGISTRAR), async (ctx) => {
  const body = ctx.request.body;
  const user = ctx.state.user;

  if (!body.routeName?.trim()) {
    ctx.status = 400; ctx.body = { code: 400, message: '线路名称不能为空' }; return;
  }
  if (!body.departureTime?.trim()) {
    ctx.status = 400; ctx.body = { code: 400, message: '发车时间不能为空' }; return;
  }
  if (!body.startStation?.trim()) {
    ctx.status = 400; ctx.body = { code: 400, message: '起点站不能为空' }; return;
  }
  if (!body.endStation?.trim()) {
    ctx.status = 400; ctx.body = { code: 400, message: '终点站不能为空' }; return;
  }

  const scheduleNo = 'FC' + dayjs().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);

  db.run(`
    INSERT INTO bus_schedules
    (schedule_no, route_name, bus_no, driver_name, departure_time, start_station, end_station, shift_type, status, remark, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
  `, [
    scheduleNo,
    body.routeName.trim(),
    body.busNo || '',
    body.driverName || '',
    body.departureTime,
    body.startStation.trim(),
    body.endStation.trim(),
    body.shiftType || '',
    body.remark || '',
    user.id
  ]);

  const newId = db.lastInsertRowid();

  if (body.handover) {
    db.run(`
      INSERT INTO handover_records
      (schedule_id, shift_no, handover_person, receiver_person, confirm_time, handover_remark)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      newId,
      body.handover.shiftNo || '',
      body.handover.handoverPerson || '',
      body.handover.receiverPerson || '',
      body.handover.confirmTime || '',
      body.handover.handoverRemark || ''
    ]);
  }

  logOperation({
    scheduleId: newId,
    userId: user.id,
    userName: user.real_name,
    action: 'create',
    actionDesc: '创建发车计划'
  });

  const row = db.get('SELECT * FROM bus_schedules WHERE id = ?', [newId]);
  ctx.body = { code: 0, message: '创建成功', data: buildScheduleWithDetails(row) };
});

router.put('/:id', authMiddleware, roleMiddleware(config.roles.REGISTRAR), async (ctx) => {
  const body = ctx.request.body;
  const user = ctx.state.user;
  const id = Number(ctx.params.id);

  const exist = db.get('SELECT * FROM bus_schedules WHERE id = ?', [id]);
  if (!exist) {
    ctx.status = 404; ctx.body = { code: 404, message: '发车计划不存在' }; return;
  }
  if (exist.created_by !== user.id) {
    ctx.status = 403; ctx.body = { code: 403, message: '只能编辑自己创建的发车计划' }; return;
  }
  if (!['draft', 'audit_rejected', 'review_rejected'].includes(exist.status)) {
    ctx.status = 400;
    ctx.body = { code: 400, message: `当前状态「${getStatusText(exist.status)}」不允许编辑` };
    return;
  }

  db.run(`
    UPDATE bus_schedules SET
      route_name = ?, bus_no = ?, driver_name = ?, departure_time = ?,
      start_station = ?, end_station = ?, shift_type = ?, remark = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `, [
    body.routeName || exist.route_name,
    body.busNo ?? exist.bus_no,
    body.driverName ?? exist.driver_name,
    body.departureTime || exist.departure_time,
    body.startStation || exist.start_station,
    body.endStation || exist.end_station,
    body.shiftType ?? exist.shift_type,
    body.remark ?? exist.remark,
    id
  ]);

  if (body.handover) {
    const hExist = db.get('SELECT id FROM handover_records WHERE schedule_id = ?', [id]);
    if (hExist) {
      db.run(`
        UPDATE handover_records SET
          shift_no = ?, handover_person = ?, receiver_person = ?,
          confirm_time = ?, handover_remark = ?,
          updated_at = datetime('now', 'localtime')
        WHERE schedule_id = ?
      `, [
        body.handover.shiftNo || '',
        body.handover.handoverPerson || '',
        body.handover.receiverPerson || '',
        body.handover.confirmTime || '',
        body.handover.handoverRemark || '',
        id
      ]);
    } else {
      db.run(`
        INSERT INTO handover_records
        (schedule_id, shift_no, handover_person, receiver_person, confirm_time, handover_remark)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        id,
        body.handover.shiftNo || '',
        body.handover.handoverPerson || '',
        body.handover.receiverPerson || '',
        body.handover.confirmTime || '',
        body.handover.handoverRemark || ''
      ]);
    }
  }

  logOperation({
    scheduleId: id,
    userId: user.id,
    userName: user.real_name,
    action: 'update',
    actionDesc: exist.status === 'draft' ? '编辑发车计划' : '补正发车计划（' + getStatusText(exist.status) + '）'
  });

  const row = db.get('SELECT * FROM bus_schedules WHERE id = ?', [id]);
  ctx.body = { code: 0, message: '保存成功', data: buildScheduleWithDetails(row) };
});

router.post('/:id/submit', authMiddleware, roleMiddleware(config.roles.REGISTRAR), async (ctx) => {
  const user = ctx.state.user;
  const id = Number(ctx.params.id);

  const exist = db.get('SELECT * FROM bus_schedules WHERE id = ?', [id]);
  if (!exist) {
    ctx.status = 404; ctx.body = { code: 404, message: '发车计划不存在' }; return;
  }
  if (exist.created_by !== user.id) {
    ctx.status = 403; ctx.body = { code: 403, message: '只能提交自己创建的发车计划' }; return;
  }
  if (!['draft', 'audit_rejected', 'review_rejected'].includes(exist.status)) {
    ctx.status = 400;
    ctx.body = { code: 400, message: `当前状态「${getStatusText(exist.status)}」不允许提交审核` };
    return;
  }

  const handover = db.get('SELECT * FROM handover_records WHERE schedule_id = ?', [id]);
  const handoverErr = validateHandover(handover);
  if (handoverErr) {
    ctx.status = 400;
    ctx.body = { code: 400, message: `提交审核失败：${handoverErr}，请完善交接信息` };
    return;
  }

  const oldStatus = exist.status;
  db.run(`
    UPDATE bus_schedules SET status = 'pending_audit', updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `, [id]);

  logOperation({
    scheduleId: id,
    userId: user.id,
    userName: user.real_name,
    action: 'submit',
    actionDesc: '提交发车计划进入审核',
    oldStatus,
    newStatus: 'pending_audit'
  });

  const row = db.get('SELECT * FROM bus_schedules WHERE id = ?', [id]);
  ctx.body = { code: 0, message: '提交成功，已进入审核', data: buildScheduleWithDetails(row) };
});

router.post('/:id/audit', authMiddleware, roleMiddleware(config.roles.AUDITOR), async (ctx) => {
  const { result, opinion } = ctx.request.body;
  const user = ctx.state.user;
  const id = Number(ctx.params.id);

  const exist = db.get('SELECT * FROM bus_schedules WHERE id = ?', [id]);
  if (!exist) {
    ctx.status = 404; ctx.body = { code: 404, message: '发车计划不存在' }; return;
  }
  if (exist.status !== 'pending_audit') {
    ctx.status = 400;
    ctx.body = { code: 400, message: `当前状态「${getStatusText(exist.status)}」不允许审核` };
    return;
  }
  if (!['pass', 'reject'].includes(result)) {
    ctx.status = 400; ctx.body = { code: 400, message: '审核结果无效' }; return;
  }
  if (result === 'reject' && !opinion?.trim()) {
    ctx.status = 400; ctx.body = { code: 400, message: '退回时必须填写审核意见' }; return;
  }

  const handover = db.get('SELECT * FROM handover_records WHERE schedule_id = ?', [id]);
  const handoverErr = validateHandover(handover);
  if (handoverErr) {
    ctx.status = 400;
    ctx.body = { code: 400, message: `审核失败：交接信息${handoverErr}，请先退回补正` };
    return;
  }

  const oldStatus = exist.status;
  const newStatus = result === 'pass' ? 'pending_review' : 'audit_rejected';

  db.run(`
    UPDATE bus_schedules SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
  `, [newStatus, id]);

  db.run(`
    INSERT INTO audit_records (schedule_id, auditor_id, auditor_name, audit_type, result, opinion)
    VALUES (?, ?, ?, 'audit', ?, ?)
  `, [id, user.id, user.real_name, result, opinion || '']);

  logOperation({
    scheduleId: id,
    userId: user.id,
    userName: user.real_name,
    action: result === 'pass' ? 'audit_pass' : 'audit_reject',
    actionDesc: result === 'pass' ? '审核通过，进入复核' : `审核退回：${opinion}`,
    oldStatus,
    newStatus
  });

  const row = db.get('SELECT * FROM bus_schedules WHERE id = ?', [id]);
  ctx.body = {
    code: 0,
    message: result === 'pass' ? '审核通过，已进入复核' : '已退回登记员补正',
    data: buildScheduleWithDetails(row)
  };
});

router.post('/:id/review', authMiddleware, roleMiddleware(config.roles.REVIEWER), async (ctx) => {
  const { result, opinion } = ctx.request.body;
  const user = ctx.state.user;
  const id = Number(ctx.params.id);

  const exist = db.get('SELECT * FROM bus_schedules WHERE id = ?', [id]);
  if (!exist) {
    ctx.status = 404; ctx.body = { code: 404, message: '发车计划不存在' }; return;
  }
  if (exist.status !== 'pending_review') {
    ctx.status = 400;
    ctx.body = { code: 400, message: `当前状态「${getStatusText(exist.status)}」不允许复核` };
    return;
  }
  if (!['pass', 'reject'].includes(result)) {
    ctx.status = 400; ctx.body = { code: 400, message: '复核结果无效' }; return;
  }
  if (result === 'reject' && !opinion?.trim()) {
    ctx.status = 400; ctx.body = { code: 400, message: '退回时必须填写复核意见' }; return;
  }

  const handover = db.get('SELECT * FROM handover_records WHERE schedule_id = ?', [id]);
  const handoverErr = validateHandover(handover);
  if (handoverErr) {
    ctx.status = 400;
    ctx.body = { code: 400, message: `复核失败：交接信息${handoverErr}` };
    return;
  }

  const oldStatus = exist.status;
  const newStatus = result === 'pass' ? 'archived' : 'review_rejected';

  db.run(`
    UPDATE bus_schedules SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
  `, [newStatus, id]);

  db.run(`
    INSERT INTO audit_records (schedule_id, auditor_id, auditor_name, audit_type, result, opinion)
    VALUES (?, ?, ?, 'review', ?, ?)
  `, [id, user.id, user.real_name, result, opinion || '']);

  logOperation({
    scheduleId: id,
    userId: user.id,
    userName: user.real_name,
    action: result === 'pass' ? 'review_pass' : 'review_reject',
    actionDesc: result === 'pass' ? '复核通过，已归档' : `复核退回：${opinion}`,
    oldStatus,
    newStatus
  });

  const row = db.get('SELECT * FROM bus_schedules WHERE id = ?', [id]);
  ctx.body = {
    code: 0,
    message: result === 'pass' ? '复核通过，已归档' : '已退回登记员补正',
    data: buildScheduleWithDetails(row)
  };
});

router.delete('/:id', authMiddleware, roleMiddleware(config.roles.REGISTRAR), async (ctx) => {
  const user = ctx.state.user;
  const id = Number(ctx.params.id);
  const exist = db.get('SELECT * FROM bus_schedules WHERE id = ?', [id]);
  if (!exist) {
    ctx.status = 404; ctx.body = { code: 404, message: '发车计划不存在' }; return;
  }
  if (exist.created_by !== user.id) {
    ctx.status = 403; ctx.body = { code: 403, message: '只能删除自己创建的发车计划' }; return;
  }
  if (exist.status !== 'draft') {
    ctx.status = 400;
    ctx.body = { code: 400, message: `当前状态「${getStatusText(exist.status)}」不允许删除，仅草稿可删除` };
    return;
  }
  db.run('DELETE FROM bus_schedules WHERE id = ?', [id]);
  logOperation({
    scheduleId: id,
    userId: user.id,
    userName: user.real_name,
    action: 'delete',
    actionDesc: '删除发车计划'
  });
  ctx.body = { code: 0, message: '删除成功' };
});

module.exports = router;
