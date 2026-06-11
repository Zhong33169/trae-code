import { db } from '../db/schema.js';
import { ROLES, STATUS, STATUS_LABEL } from '../db/seed.js';
import {
  checkTransition, checkEvidences, audit, requiredEvidences, ERROR_CODES,
  getPlanWithDetail, TRANSITION_RULES, EVIDENCE_LABEL
} from '../utils/workflow.js';
import { nanoid } from 'nanoid';

function genBatchNo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `BATCH-${y}${m}${day}-${nanoid(6).toUpperCase()}`;
}

function actionLabel(action) {
  return {
    submit: '提交核验', resubmit: '重新提交', verify_pass: '核验通过',
    confirm_pass: '确认归档', reject: '驳回'
  }[action] || action;
}

function executeSingleAction(plan, action, user, comment, planVersions) {
  const d = db();
  const versionLock = planVersions[plan.id];
  if (versionLock !== undefined && Number(versionLock) !== plan.version) {
    return {
      ok: false,
      code: ERROR_CODES.OLD_VERSION,
      message: `版本冲突：传入版本${versionLock}，当前版本${plan.version}，请刷新后重试`
    };
  }

  const tCheck = checkTransition(plan, action, user.role);
  if (!tCheck.ok) return tCheck;

  const req = requiredEvidences(plan, action);
  const eCheck = checkEvidences(plan.id, req);
  if (!eCheck.ok) return eCheck;

  const nextStatus = tCheck.nextStatus;
  const isReject = nextStatus === STATUS.REJECTED;

  if (isReject) {
    d.prepare(`
      UPDATE launch_plans SET status=?, version=version+1, reject_reason=?,
        updated_at=datetime('now','localtime') WHERE id=?
    `).run(nextStatus, comment || '未填写原因', plan.id);
  } else {
    d.prepare(`
      UPDATE launch_plans SET status=?, version=version+1, reject_reason=NULL,
        updated_at=datetime('now','localtime') WHERE id=?
    `).run(nextStatus, plan.id);
  }
  d.prepare(`
    INSERT INTO plan_transitions (plan_id, from_status, to_status, operated_by, comment)
    VALUES (?, ?, ?, ?, ?)
  `).run(plan.id, plan.status, nextStatus, user.id, comment || null);

  return { ok: true, nextStatus };
}

export default async function batchRoutes(fastify) {
  fastify.post('/api/batch/action', {
    preHandler: [fastify.auth]
  }, async (request) => {
    const d = db();
    const { plan_ids, action, comment, plan_versions } = request.body || {};
    const ids = Array.isArray(plan_ids) ? plan_ids.map(Number).filter(Boolean) : [];
    if (ids.length === 0) return { code: 400, message: '请选择要操作的计划单' };
    if (!action) return { code: 400, message: '缺少action参数' };

    const batchNo = genBatchNo();
    const placeholders = ids.map(() => '?').join(',');
    const plans = d.prepare(`SELECT * FROM launch_plans WHERE id IN (${placeholders}) ORDER BY id`)
      .all(...ids);
    const versionMap = plan_versions || {};

    let success = 0, failed = 0;
    const itemResults = [];

    const batchInfo = d.prepare(`
      INSERT INTO batches (batch_no, action, target_status, created_by, total_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(batchNo, action, null, request.user.id, ids.length);
    const batchId = batchInfo.lastInsertRowid;

    const insertItem = d.prepare(`
      INSERT INTO batch_items (batch_id, plan_id, status, error_code, error_message, retry_count, last_attempt_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `);

    for (const plan of plans) {
      const result = executeSingleAction(plan, action, request.user, comment, versionMap);
      if (result.ok) {
        success++;
        insertItem.run(batchId, plan.id, 'SUCCESS', null, null, 0);
        itemResults.push({
          plan_id: plan.id, plan_no: plan.plan_no, title: plan.title,
          result: 'SUCCESS', prev_status: plan.status, next_status: result.nextStatus
        });
        audit(request.user.id, `BATCH_${action.toUpperCase()}`, 'PLAN', plan.id,
          { batch_no: batchNo, plan_no: plan.plan_no, prev: plan.status, next: result.nextStatus }, request.ip);
      } else {
        failed++;
        insertItem.run(batchId, plan.id, 'FAILED', result.code, result.message, 0);
        itemResults.push({
          plan_id: plan.id, plan_no: plan.plan_no, title: plan.title,
          result: 'FAILED', error_code: result.code, error_message: result.message
        });
      }
    }

    d.prepare('UPDATE batches SET success_count=?, failed_count=? WHERE id=?')
      .run(success, failed, batchId);

    audit(request.user.id, 'CREATE_BATCH', 'BATCH', batchNo,
      { action, total: ids.length, success, failed, ids }, request.ip);

    return {
      code: 0,
      data: {
        batch_no: batchNo,
        total: ids.length,
        success_count: success,
        failed_count: failed,
        items: itemResults
      }
    };
  });

  fastify.post('/api/batch/:batchId/retry', {
    preHandler: [fastify.auth]
  }, async (request) => {
    const d = db();
    const batchId = Number(request.params.batchId);
    const batch = d.prepare('SELECT * FROM batches WHERE id=?').get(batchId);
    if (!batch) return { code: 404, message: '批次不存在' };

    const { comment } = request.body || {};
    const failedItems = d.prepare(`
      SELECT bi.id AS item_id, bi.plan_id, bi.status AS item_status, bi.error_code, bi.error_message, bi.retry_count,
        lp.* FROM batch_items bi
      JOIN launch_plans lp ON bi.plan_id = lp.id
      WHERE bi.batch_id=? AND bi.status='FAILED'
    `).all(batchId);
    if (failedItems.length === 0) {
      return { code: 400, message: '该批次没有可重试的失败项' };
    }

    let retrySuccess = 0, retryFailed = 0;
    const results = [];

    for (const item of failedItems) {
      const plan = d.prepare('SELECT * FROM launch_plans WHERE id=?').get(item.plan_id);
      const result = executeSingleAction(plan, batch.action, request.user, comment, {});
      const newRetry = item.retry_count + 1;
      if (result.ok) {
        retrySuccess++;
        d.prepare(`
          UPDATE batch_items SET status='SUCCESS', error_code=NULL, error_message=NULL,
            retry_count=?, last_attempt_at=datetime('now','localtime') WHERE id=?
        `).run(newRetry, item.item_id);
        results.push({
          plan_id: plan.id, plan_no: plan.plan_no,
          result: 'SUCCESS', prev_status: plan.status, next_status: result.nextStatus
        });
        audit(request.user.id, `BATCH_RETRY_${batch.action.toUpperCase()}`, 'PLAN', plan.id,
          {
            batch_no: batch.batch_no,
            batch_id: batchId,
            plan_no: plan.plan_no,
            retry_no: newRetry,
            prev: plan.status,
            next: result.nextStatus
          }, request.ip);
      } else {
        retryFailed++;
        d.prepare(`
          UPDATE batch_items SET error_code=?, error_message=?,
            retry_count=?, last_attempt_at=datetime('now','localtime') WHERE id=?
        `).run(result.code, result.message, newRetry, item.item_id);
        results.push({
          plan_id: plan.id, plan_no: plan.plan_no,
          result: 'FAILED', error_code: result.code, error_message: result.message
        });
        audit(request.user.id, `BATCH_RETRY_FAIL`, 'PLAN', plan.id,
          {
            batch_no: batch.batch_no,
            batch_id: batchId,
            plan_no: plan.plan_no,
            retry_no: newRetry,
            error_code: result.code,
            error_message: result.message
          }, request.ip);
      }
    }

    const succCnt = d.prepare(`
      SELECT COUNT(*) AS c FROM batch_items WHERE batch_id=? AND status='SUCCESS'
    `).get(batchId).c;
    const failCnt = d.prepare(`
      SELECT COUNT(*) AS c FROM batch_items WHERE batch_id=? AND status='FAILED'
    `).get(batchId).c;
    d.prepare(`
      UPDATE batches SET success_count=?, failed_count=? WHERE id=?
    `).run(succCnt, failCnt, batchId);

    const newBatch = d.prepare('SELECT * FROM batches WHERE id=?').get(batchId);

    audit(request.user.id, 'BATCH_RETRY', 'BATCH', batch.batch_no,
      { retry_success: retrySuccess, retry_failed: retryFailed }, request.ip);

    return {
      code: 0,
      data: {
        batch_no: batch.batch_no,
        retry_success: retrySuccess,
        retry_failed: retryFailed,
        total_success: newBatch.success_count,
        total_failed: newBatch.failed_count,
        items: results
      }
    };
  });

  fastify.get('/api/batches', {
    preHandler: [fastify.auth]
  }, async (request) => {
    const d = db();
    const { page = 1, size = 20 } = request.query;
    const total = d.prepare('SELECT COUNT(*) AS c FROM batches').get().c;
    const offset = (Number(page) - 1) * Number(size);
    const list = d.prepare(`
      SELECT b.*, u.name AS creator_name FROM batches b
      LEFT JOIN users u ON b.created_by = u.id
      ORDER BY b.created_at DESC LIMIT ? OFFSET ?
    `).all(Number(size), offset);
    return {
      code: 0,
      data: { list, total, page: Number(page), size: Number(size) }
    };
  });

  fastify.get('/api/batches/:batchId', {
    preHandler: [fastify.auth]
  }, async (request, reply) => {
    const d = db();
    const batchId = Number(request.params.batchId);
    const batch = d.prepare(`
      SELECT b.*, u.name AS creator_name FROM batches b
      LEFT JOIN users u ON b.created_by = u.id WHERE b.id=?
    `).get(batchId);
    if (!batch) return reply.code(404).send({ code: 404, message: '不存在' });
    const items = d.prepare(`
      SELECT bi.id AS item_id, bi.batch_id, bi.plan_id, bi.status, bi.error_code,
        bi.error_message, bi.retry_count, bi.last_attempt_at,
        lp.plan_no, lp.title, lp.status AS current_status, lp.version AS plan_version
      FROM batch_items bi LEFT JOIN launch_plans lp ON bi.plan_id = lp.id
      WHERE bi.batch_id=? ORDER BY bi.id
    `).all(batchId);

    const userRole = request.user.role;
    const ROLE_EVIDENCE_RULES = {
      CSM: ['REGISTRATION'],
      DELIVERY: ['VERIFICATION'],
      DIRECTOR: ['ARCHIVAL']
    };

    for (const item of items) {
      if (item.plan_id) {
        const reqTypes = requiredEvidences({ status: item.current_status }, batch.action);
        const eCheck = checkEvidences(item.plan_id, reqTypes);
        item.missing_evidences = eCheck.missing_types || [];
        item.missing_labels = eCheck.missing_labels || [];
        item.required_evidences = reqTypes;
      } else {
        item.missing_evidences = [];
        item.missing_labels = [];
        item.required_evidences = [];
      }

      const rules = TRANSITION_RULES[item.current_status] || {};
      const nextActions = [];
      for (const [action, rule] of Object.entries(rules)) {
        if (rule.roles.includes(userRole)) {
          const reqTypes = requiredEvidences({ status: item.current_status }, action);
          const eCheck = checkEvidences(item.plan_id, reqTypes);
          nextActions.push({
            action,
            label: actionLabel(action),
            allowed: eCheck.ok,
            missing_evidences: eCheck.missing_types || [],
            missing_labels: eCheck.missing_labels || []
          });
        }
      }
      item.next_allowed_actions = nextActions;

      const uploadable = [];
      const myTypes = ROLE_EVIDENCE_RULES[userRole] || [];
      for (const t of myTypes) {
        if (item.missing_evidences.includes(t)) {
          uploadable.push({ type: t, label: EVIDENCE_LABEL[t] });
        }
      }
      item.uploadable_evidence = uploadable;
    }

    batch.items = items;
    batch.role_evidence_rules = ROLE_EVIDENCE_RULES;
    return { code: 0, data: batch };
  });

  fastify.get('/api/audit-logs', {
    preHandler: [fastify.auth]
  }, async (request) => {
    const d = db();
    const { user_id, action, page = 1, size = 50 } = request.query;
    const where = ['1=1'];
    const params = [];
    if (user_id) { where.push('user_id=?'); params.push(Number(user_id)); }
    if (action) { where.push('action LIKE ?'); params.push(`%${action}%`); }
    const offset = (Number(page) - 1) * Number(size);
    const list = d.prepare(`SELECT * FROM audit_logs WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, Number(size), offset);
    return { code: 0, data: list };
  });
}
