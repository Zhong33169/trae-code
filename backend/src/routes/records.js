const Router = require('@koa/router');
const db = require('../db');
const { success, error, paginate } = require('../utils/response');
const { validateObject } = require('../utils/validation');
const { authMiddleware, registrarOnly, supervisorOnly, reviewerOnly, allRoles } = require('../middleware/auth');
const {
  ValidationError,
  getRecordById,
  getEvidencesByRecordId,
  getReviewRecordsByRecordId,
  getOperationLogsByRecordId,
  logOperation,
  addReviewRecord,
  updateRecordStatus,
  incrementVersion,
  validateVersion,
  validateHandler,
  validateStatusTransition,
  getAvailableOperations,
  getRecordList,
  getStatistics,
  getSupervisorList,
  getReviewerList,
  getRoleForStatus,
} = require('../services/record-service');
const { generateRecordNo } = require('../utils/record-no');
const { RECORD_STATUSES, OPERATION_TYPES, ROLES, STATUS_NAMES, OPERATION_NAMES, ROLE_NAMES } = require('../constants');

const router = new Router({ prefix: '/api/records' });

router.get('/options', authMiddleware(), allRoles, async (ctx) => {
  success(ctx, {
    statuses: Object.entries(RECORD_STATUSES).map(([key, value]) => ({ key, value, label: STATUS_NAMES[value] })),
    operations: Object.entries(OPERATION_TYPES).map(([key, value]) => ({ key, value, label: OPERATION_NAMES[value] })),
    roles: Object.entries(ROLES).map(([key, value]) => ({ key, value, label: ROLE_NAMES[value] })),
    supervisors: getSupervisorList(),
    reviewers: getReviewerList(),
  });
});

router.get('/statistics', authMiddleware(), allRoles, async (ctx) => {
  const user = ctx.state.user;
  const stats = getStatistics(user.id, user.role);
  success(ctx, stats);
});

router.get('/', authMiddleware(), allRoles, async (ctx) => {
  const { page = 1, pageSize = 10, status, projectName, recordNo, scope } = ctx.query;
  const user = ctx.state.user;

  const filters = {};
  if (status) filters.status = status.split(',');
  if (projectName) filters.projectName = projectName;
  if (recordNo) filters.recordNo = recordNo;

  if (scope === 'my') {
    filters.role = user.role;
    filters.userId = user.id;
  }

  const result = getRecordList(filters, parseInt(page), parseInt(pageSize));
  
  const list = result.list.map(r => ({
    ...r,
    statusName: STATUS_NAMES[r.status] || r.status,
  }));

  paginate(ctx, list, result.total, result.page, result.pageSize);
});

router.get('/:id', authMiddleware(), allRoles, async (ctx) => {
  const { id } = ctx.params;
  const user = ctx.state.user;

  const record = getRecordById(id);
  if (!record) {
    return error(ctx, '记录不存在', 404);
  }

  const evidences = getEvidencesByRecordId(id);
  const reviewRecords = getReviewRecordsByRecordId(id);
  const operationLogs = getOperationLogsByRecordId(id);
  const availableOps = getAvailableOperations(record, user.role);

  const lastReview = reviewRecords.length > 0 ? reviewRecords[reviewRecords.length - 1] : null;

  success(ctx, {
    record: {
      ...record,
      statusName: STATUS_NAMES[record.status] || record.status,
    },
    evidences,
    reviewRecords: reviewRecords.map(r => ({
      ...r,
      operationTypeName: OPERATION_NAMES[r.operation_type] || r.operation_type,
      handlerRoleName: ROLE_NAMES[r.handler_role] || r.handler_role,
      previousStatusName: STATUS_NAMES[r.previous_status] || r.previous_status,
      newStatusName: STATUS_NAMES[r.new_status] || r.new_status,
    })),
    operationLogs: operationLogs.map(l => ({
      ...l,
      operationTypeName: OPERATION_NAMES[l.operation_type] || l.operation_type,
      userRoleName: ROLE_NAMES[l.user_role] || l.user_role,
    })),
    availableOperations: availableOps,
    lastReview,
  });
});

const createSchema = {
  projectName: [{ type: 'required', label: '工程名称' }, { type: 'length', label: '工程名称', max: 200 }],
  recordDate: [{ type: 'required', label: '旁站日期' }, { type: 'date', label: '旁站日期' }],
  content: [{ type: 'required', label: '旁站内容' }, { type: 'length', label: '旁站内容', min: 10, max: 2000 }],
};

router.post('/', authMiddleware(), registrarOnly, async (ctx) => {
  const body = ctx.request.body;
  const user = ctx.state.user;

  const errors = validateObject(body, createSchema);
  if (errors) {
    return error(ctx, errors[0].message, 400);
  }

  const recordNo = generateRecordNo();

  const result = db.prepare(`
    INSERT INTO supervision_records (
      record_no, project_name, construction_unit, supervision_unit, location,
      record_date, weather, temperature, content, issues, requirement,
      status, version, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    recordNo,
    body.projectName,
    body.constructionUnit || '',
    body.supervisionUnit || '',
    body.location || '',
    body.recordDate,
    body.weather || '',
    body.temperature || '',
    body.content,
    body.issues || '',
    body.requirement || '',
    RECORD_STATUSES.DRAFT,
    1,
    user.id
  );

  const recordId = result.lastInsertRowid;

  if (body.evidences && body.evidences.length > 0) {
    const insertEvidence = db.prepare(`
      INSERT INTO evidences (record_id, type, name, description, file_url, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    body.evidences.forEach(e => {
      insertEvidence.run(recordId, e.type, e.name, e.description || '', e.fileUrl, user.id);
    });
  }

  logOperation(recordId, user.id, OPERATION_TYPES.CREATE, `创建旁站记录单 ${recordNo}`, ctx.request.ip);

  success(ctx, { id: recordId, recordNo }, '创建成功');
});

const updateSchema = {
  projectName: [{ type: 'length', label: '工程名称', max: 200 }],
  content: [{ type: 'length', label: '旁站内容', min: 10, max: 2000 }],
};

router.put('/:id', authMiddleware(), registrarOnly, async (ctx) => {
  const { id } = ctx.params;
  const body = ctx.request.body;
  const user = ctx.state.user;

  const record = getRecordById(id);
  if (!record) {
    return error(ctx, '记录不存在', 404);
  }

  if (record.created_by !== user.id) {
    return error(ctx, '只有创建人才能修改此记录', 403);
  }

  if (![RECORD_STATUSES.DRAFT, RECORD_STATUSES.NEEDS_CORRECTION, RECORD_STATUSES.EVIDENCE_MISSING, RECORD_STATUSES.REVIEW_REJECTED, RECORD_STATUSES.STATUS_CONFLICT].includes(record.status)) {
    return error(ctx, '当前状态下不能修改记录', 400);
  }

  const errors = validateObject(body, updateSchema);
  if (errors) {
    return error(ctx, errors[0].message, 400);
  }

  db.prepare(`
    UPDATE supervision_records
    SET project_name = COALESCE(?, project_name),
        construction_unit = COALESCE(?, construction_unit),
        supervision_unit = COALESCE(?, supervision_unit),
        location = COALESCE(?, location),
        record_date = COALESCE(?, record_date),
        weather = COALESCE(?, weather),
        temperature = COALESCE(?, temperature),
        content = COALESCE(?, content),
        issues = COALESCE(?, issues),
        requirement = COALESCE(?, requirement),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    body.projectName,
    body.constructionUnit,
    body.supervisionUnit,
    body.location,
    body.recordDate,
    body.weather,
    body.temperature,
    body.content,
    body.issues,
    body.requirement,
    id
  );

  if (body.evidences && body.evidences.length > 0) {
    db.prepare('DELETE FROM evidences WHERE record_id = ?').run(id);
    const insertEvidence = db.prepare(`
      INSERT INTO evidences (record_id, type, name, description, file_url, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    body.evidences.forEach(e => {
      insertEvidence.run(id, e.type, e.name, e.description || '', e.fileUrl, user.id);
    });
  }

  logOperation(id, user.id, OPERATION_TYPES.UPDATE, `更新旁站记录单 ${record.record_no}`, ctx.request.ip);

  success(ctx, null, '更新成功');
});

const operationSchema = {
  operation: [{ type: 'required', label: '操作类型' }],
  opinion: [{ type: 'length', label: '处理意见', max: 1000 }],
  rejectReason: [{ type: 'length', label: '驳回原因', max: 500 }],
};

router.post('/:id/operate', authMiddleware(), allRoles, async (ctx) => {
  const { id } = ctx.params;
  const { operation, opinion, rejectReason, version, deadline, handlerId, evidences } = ctx.request.body;
  const user = ctx.state.user;

  const errors = validateObject({ operation, opinion, rejectReason }, operationSchema);
  if (errors) {
    return error(ctx, errors[0].message, 400);
  }

  const record = getRecordById(id);
  if (!record) {
    return error(ctx, '记录不存在', 404);
  }

  const versionCheck = validateVersion(record, version);
  if (!versionCheck.valid) {
    logOperation(id, user.id, operation, `操作失败: ${versionCheck.message}`, ctx.request.ip);
    return error(ctx, versionCheck.message, 409);
  }

  const handlerCheck = validateHandler(record, user.id, user.role);
  if ([OPERATION_TYPES.CORRECT, OPERATION_TYPES.RESUBMIT, OPERATION_TYPES.SUBMIT].includes(operation)) {
    if (record.created_by !== user.id) {
      logOperation(id, user.id, operation, '操作失败: 只有记录创建人才能执行此操作', ctx.request.ip);
      return error(ctx, '只有记录创建人才能执行此操作', 403);
    }
  } else if (record.current_handler_id && record.current_handler_id !== user.id) {
    if (!handlerCheck.valid) {
      logOperation(id, user.id, operation, `操作失败: ${handlerCheck.message}`, ctx.request.ip);
      return error(ctx, handlerCheck.message, 403);
    }
  }

  let transition;
  try {
    transition = validateStatusTransition(record, operation, user.id, user.role);
  } catch (e) {
    if (e instanceof ValidationError) {
      logOperation(id, user.id, operation, `操作失败: ${e.message}`, ctx.request.ip);
      return error(ctx, e.message, 400);
    }
    throw e;
  }

  if (transition.requireOpinion && !opinion) {
    return error(ctx, '请填写处理意见', 400);
  }

  if (transition.requireRejectReason && !rejectReason) {
    return error(ctx, '请填写驳回原因', 400);
  }

  if (transition.requireEvidence) {
    const existingEvidences = getEvidencesByRecordId(id);
    let allEvidences = [...existingEvidences];
    if (evidences && evidences.length > 0 && [OPERATION_TYPES.CORRECT, OPERATION_TYPES.RESUBMIT, OPERATION_TYPES.SUBMIT].includes(operation)) {
      allEvidences = [...allEvidences, ...evidences];
    }
    const hasPhoto = allEvidences.some(e => e.type === 'photo');
    if (!hasPhoto) {
      logOperation(id, user.id, operation, '操作失败: 缺少必要证据-照片证据', ctx.request.ip);
      return error(ctx, '缺少必要证据：至少需要包含1份照片证据', 400);
    }
  }

  const previousStatus = record.status;
  const newStatus = transition.newStatus;
  const resultType = operation.includes('pass') ? 'pass' : 
                     operation.includes('reject') ? 'reject' : 
                     operation === OPERATION_TYPES.CORRECT ? 'corrected' :
                     operation.includes('correction') ? 'correction' : 'process';

  let nextHandlerId = null;
  const nextRole = getRoleForStatus(newStatus);

  if (nextRole === ROLES.SUPERVISOR) {
    nextHandlerId = handlerId || null;
  } else if (nextRole === ROLES.REVIEWER) {
    nextHandlerId = handlerId || null;
  } else if (nextRole === ROLES.REGISTRAR) {
    nextHandlerId = record.created_by;
  }

  if ([OPERATION_TYPES.REVIEW, OPERATION_TYPES.FINAL_REVIEW].includes(operation)) {
    nextHandlerId = user.id;
  }

  db.exec('BEGIN TRANSACTION');
  try {
    if (evidences && evidences.length > 0 && [OPERATION_TYPES.CORRECT, OPERATION_TYPES.RESUBMIT].includes(operation)) {
      const insertEvidence = db.prepare(`
        INSERT INTO evidences (record_id, type, name, description, file_url, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      evidences.forEach(e => {
        insertEvidence.run(id, e.type, e.name, e.description || '', e.fileUrl || e.file_url || '', user.id);
      });
    }

    addReviewRecord(
      id, user.id, operation, opinion || '', resultType,
      previousStatus, newStatus, rejectReason || null, version
    );

    const updateResult = updateRecordStatus(id, newStatus, version, nextHandlerId);
    if (updateResult.changes === 0) {
      throw new ValidationError('记录已被修改，请刷新后重试');
    }

    incrementVersion(id);

    if (deadline && [RECORD_STATUSES.IN_REVIEW, RECORD_STATUSES.IN_FINAL_REVIEW, RECORD_STATUSES.NEEDS_CORRECTION, RECORD_STATUSES.EVIDENCE_MISSING].includes(newStatus)) {
      db.prepare('UPDATE supervision_records SET deadline = ? WHERE id = ?').run(deadline, id);
    }

    const evidenceNote = evidences && evidences.length > 0 ? `（新增证据${evidences.length}份）` : '';
    logOperation(
      id, user.id, operation,
      `${OPERATION_NAMES[operation] || operation}${evidenceNote} - ${opinion || ''}`,
      ctx.request.ip
    );

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    if (e instanceof ValidationError) {
      return error(ctx, e.message, 409);
    }
    throw e;
  }

  const updatedRecord = getRecordById(id);
  const updatedEvidences = getEvidencesByRecordId(id);
  const updatedReviews = getReviewRecordsByRecordId(id);
  const updatedLogs = getOperationLogsByRecordId(id);
  const updatedLastReview = updatedReviews.length > 0 ? updatedReviews[updatedReviews.length - 1] : null;
  const updatedAvailableOps = getAvailableOperations({ ...updatedRecord }, user.role);

  success(ctx, {
    record: {
      ...updatedRecord,
      statusName: STATUS_NAMES[updatedRecord.status] || updatedRecord.status,
    },
    evidences: updatedEvidences,
    reviewRecords: updatedReviews.map(r => ({
      ...r,
      operationTypeName: OPERATION_NAMES[r.operation_type] || r.operation_type,
      handlerRoleName: ROLE_NAMES[r.handler_role] || r.handler_role,
      previousStatusName: STATUS_NAMES[r.previous_status] || r.previous_status,
      newStatusName: STATUS_NAMES[r.new_status] || r.new_status,
    })),
    operationLogs: updatedLogs.map(l => ({
      ...l,
      operationTypeName: OPERATION_NAMES[l.operation_type] || l.operation_type,
      userRoleName: ROLE_NAMES[l.user_role] || l.user_role,
    })),
    availableOperations: updatedAvailableOps,
    lastReview: updatedLastReview,
    newStatus,
    previousStatus,
  }, `${OPERATION_NAMES[operation] || '操作'}成功`);
});

router.delete('/:id', authMiddleware(), registrarOnly, async (ctx) => {
  const { id } = ctx.params;
  const user = ctx.state.user;

  const record = getRecordById(id);
  if (!record) {
    return error(ctx, '记录不存在', 404);
  }

  if (record.created_by !== user.id) {
    return error(ctx, '只有创建人才能删除此记录', 403);
  }

  if (record.status !== RECORD_STATUSES.DRAFT) {
    return error(ctx, '只能删除草稿状态的记录', 400);
  }

  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare('DELETE FROM evidences WHERE record_id = ?').run(id);
    db.prepare('DELETE FROM review_records WHERE record_id = ?').run(id);
    db.prepare('DELETE FROM operation_logs WHERE record_id = ?').run(id);
    db.prepare('DELETE FROM supervision_records WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  success(ctx, null, '删除成功');
});

router.post('/:id/evidences', authMiddleware(), allRoles, async (ctx) => {
  const { id } = ctx.params;
  const { type, name, description, fileUrl } = ctx.request.body;
  const user = ctx.state.user;

  const record = getRecordById(id);
  if (!record) {
    return error(ctx, '记录不存在', 404);
  }

  if (record.created_by !== user.id) {
    return error(ctx, '只有创建人才能上传证据', 403);
  }

  const result = db.prepare(`
    INSERT INTO evidences (record_id, type, name, description, file_url, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, type, name, description || '', fileUrl, user.id);

  logOperation(id, user.id, 'upload_evidence', `上传证据: ${name}`, ctx.request.ip);

  success(ctx, { id: result.lastInsertRowid }, '上传成功');
});

router.delete('/:id/evidences/:evidenceId', authMiddleware(), allRoles, async (ctx) => {
  const { id, evidenceId } = ctx.params;
  const user = ctx.state.user;

  const evidence = db.prepare('SELECT * FROM evidences WHERE id = ? AND record_id = ?').get(evidenceId, id);
  if (!evidence) {
    return error(ctx, '证据不存在', 404);
  }

  if (evidence.uploaded_by !== user.id) {
    return error(ctx, '只有上传人才能删除此证据', 403);
  }

  const record = getRecordById(id);
  if (record.status !== RECORD_STATUSES.DRAFT && 
      ![RECORD_STATUSES.NEEDS_CORRECTION, RECORD_STATUSES.EVIDENCE_MISSING, RECORD_STATUSES.REVIEW_REJECTED, RECORD_STATUSES.STATUS_CONFLICT].includes(record.status)) {
    return error(ctx, '当前状态下不能删除证据', 400);
  }

  db.prepare('DELETE FROM evidences WHERE id = ?').run(evidenceId);
  logOperation(id, user.id, 'delete_evidence', `删除证据: ${evidence.name}`, ctx.request.ip);

  success(ctx, null, '删除成功');
});

module.exports = router;
