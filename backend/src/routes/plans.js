import { db } from '../db/schema.js';
import { ROLES, STATUS, STATUS_LABEL } from '../db/seed.js';
import {
  checkTransition, checkEvidences, getPlanWithDetail, audit,
  TRANSITION_RULES, requiredEvidences, ERROR_CODES
} from '../utils/workflow.js';
import { nanoid } from 'nanoid';

function actionLabel(action) {
  return {
    submit: '提交核验',
    resubmit: '重新提交',
    verify_pass: '核验通过',
    confirm_pass: '确认归档',
    reject: '驳回'
  }[action] || action;
}

export default async function planRoutes(fastify) {
  fastify.get('/api/plans/queue', {
    preHandler: [fastify.auth]
  }, async (request) => {
    const d = db();
    const { status, risk_level, change_type, keyword, page = 1, size = 20 } = request.query;
    const user = request.user;

    const where = ['1=1'];
    const params = [];

    if (status) {
      where.push('p.status = ?');
      params.push(status);
    } else {
      if (user.role === ROLES.CSM) {
        where.push('(p.created_by = ? OR p.status IN (?, ?))');
        params.push(user.id, STATUS.DRAFT, STATUS.REJECTED);
      } else if (user.role === ROLES.DELIVERY) {
        where.push('p.status IN (?, ?, ?)');
        params.push(STATUS.PENDING_REVIEW, STATUS.PENDING_CONFIRM, STATUS.COMPLETED);
      } else if (user.role === ROLES.DIRECTOR) {
        where.push('p.status IN (?, ?, ?)');
        params.push(STATUS.PENDING_CONFIRM, STATUS.COMPLETED, STATUS.REJECTED);
      }
    }

    if (risk_level) { where.push('p.risk_level=?'); params.push(risk_level); }
    if (change_type) { where.push('p.change_type=?'); params.push(change_type); }
    if (keyword) {
      where.push('(p.title LIKE ? OR p.customer_name LIKE ? OR p.plan_no LIKE ?)');
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }

    const whereClause = where.join(' AND ');
    const countSql = `SELECT COUNT(DISTINCT p.id) AS c FROM launch_plans p LEFT JOIN users u ON p.created_by = u.id WHERE ${whereClause}`;
    const total = d.prepare(countSql).get(...params).c;

    let sql = `
      SELECT DISTINCT p.*, u.name AS creator_name
      FROM launch_plans p LEFT JOIN users u ON p.created_by = u.id
      WHERE ${whereClause} ORDER BY p.updated_at DESC, p.id DESC
    `;
    const offset = (Number(page) - 1) * Number(size);
    sql += ' LIMIT ? OFFSET ?';
    const listParams = [...params, Number(size), offset];
    const list = d.prepare(sql).all(...listParams);

    const planIds = list.map(p => p.id);
    const evidenceMap = {};
    if (planIds.length > 0) {
      const placeholders = planIds.map(() => '?').join(',');
      const evs = d.prepare(`
        SELECT plan_id, evidence_type, COUNT(*) AS c FROM plan_evidences
        WHERE plan_id IN (${placeholders}) GROUP BY plan_id, evidence_type
      `).all(...planIds);
      for (const e of evs) {
        if (!evidenceMap[e.plan_id]) evidenceMap[e.plan_id] = {};
        evidenceMap[e.plan_id][e.evidence_type] = e.c;
      }
    }

    const results = list.map(p => ({
      ...p,
      status_label: STATUS_LABEL[p.status],
      evidences: evidenceMap[p.id] || {}
    }));

    return {
      code: 0,
      data: { list: results, total, page: Number(page), size: Number(size) }
    };
  });

  fastify.get('/api/plans/stats', {
    preHandler: [fastify.auth]
  }, async (request) => {
    const d = db();
    const user = request.user;
    const baseWhere = ['1=1'];
    const baseParams = [];
    if (user.role === ROLES.CSM) {
      baseWhere.push('(p.created_by=? OR p.status IN (?,?))');
      baseParams.push(user.id, STATUS.DRAFT, STATUS.REJECTED);
    } else if (user.role === ROLES.DELIVERY) {
      baseWhere.push('p.status IN (?,?,?)');
      baseParams.push(STATUS.PENDING_REVIEW, STATUS.PENDING_CONFIRM, STATUS.COMPLETED);
    } else if (user.role === ROLES.DIRECTOR) {
      baseWhere.push('p.status IN (?,?,?)');
      baseParams.push(STATUS.PENDING_CONFIRM, STATUS.COMPLETED, STATUS.REJECTED);
    }
    const bw = baseWhere.join(' AND ');

    const counters = {
      DRAFT: '草稿',
      PENDING_REVIEW: '待核验',
      PENDING_CONFIRM: '待确认',
      COMPLETED: '已完成',
      REJECTED: '已驳回'
    };
    const statList = [];
    for (const [key, label] of Object.entries(counters)) {
      const c = d.prepare(`SELECT COUNT(*) AS c FROM launch_plans p WHERE ${bw} AND p.status='${key}'`).get(...baseParams).c;
      statList.push({ status: key, label, count: c });
    }
    const total = d.prepare(`SELECT COUNT(*) AS c FROM launch_plans p WHERE ${bw}`).get(...baseParams).c;
    const todoKey = user.role === ROLES.CSM ? 'DRAFT'
      : user.role === ROLES.DELIVERY ? 'PENDING_REVIEW'
      : 'PENDING_CONFIRM';
    const todoLabel = user.role === ROLES.CSM ? '待我提交'
      : user.role === ROLES.DELIVERY ? '待我核验'
      : '待我确认';
    const todoCount = d.prepare(`SELECT COUNT(*) AS c FROM launch_plans p WHERE ${bw} AND p.status='${todoKey}'`).get(...baseParams).c;

    return {
      code: 0,
      data: { by_status: statList, total, todo: { label: todoLabel, count: todoCount, status: todoKey } }
    };
  });

  fastify.get('/api/plans/:id', {
    preHandler: [fastify.auth]
  }, async (request, reply) => {
    const d = db();
    const plan = getPlanWithDetail(Number(request.params.id));
    if (!plan) return reply.code(404).send({ code: 404, message: '计划单不存在' });
    plan.status_label = STATUS_LABEL[plan.status];

    const availableActions = [];
    const rules = TRANSITION_RULES[plan.status] || {};
    for (const [action, rule] of Object.entries(rules)) {
      const canDo = rule.roles.includes(request.user.role);
      const missing = requiredEvidences(plan, action);
      availableActions.push({
        action,
        label: actionLabel(action),
        allowed: canDo,
        require_evidence: missing,
        reason: canDo ? null : `仅角色 ${rule.roles.join(',')} 可执行此操作`
      });
    }

    const allPlanIds = d.prepare('SELECT id, plan_no FROM launch_plans ORDER BY id').all();
    const idx = allPlanIds.findIndex(x => x.id === plan.id);
    const prev = idx > 0 ? allPlanIds[idx - 1] : null;
    const next = idx < allPlanIds.length - 1 ? allPlanIds[idx + 1] : null;

    audit(request.user.id, 'VIEW_PLAN', 'PLAN', plan.id, { plan_no: plan.plan_no }, request.ip);

    return {
      code: 0,
      data: { plan, available_actions: availableActions, nav: { prev, next } }
    };
  });

  fastify.post('/api/plans', {
    preHandler: [fastify.auth, fastify.requireRole(ROLES.CSM)]
  }, async (request) => {
    const d = db();
    const { title, customer_name, change_type, plan_date, risk_level, description } = request.body || {};
    if (!title || !customer_name || !change_type || !plan_date || !risk_level) {
      return { code: 400, message: '请填写必填字段' };
    }
    const d0 = new Date();
    const seq = String(Math.floor(Math.random() * 9000) + 1000);
    const no = `LP-${d0.getFullYear()}-${seq}`;
    const info = d.prepare(`
      INSERT INTO launch_plans (plan_no, title, customer_name, change_type, plan_date, risk_level, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(no, title, customer_name, change_type, plan_date, risk_level, description || '', request.user.id);

    audit(request.user.id, 'CREATE_PLAN', 'PLAN', info.lastInsertRowid, { plan_no: no, title }, request.ip);
    return { code: 0, data: { id: info.lastInsertRowid, plan_no: no } };
  });

  fastify.patch('/api/plans/:id', {
    preHandler: [fastify.auth, fastify.requireRole(ROLES.CSM)]
  }, async (request, reply) => {
    const d = db();
    const planId = Number(request.params.id);
    const plan = d.prepare('SELECT * FROM launch_plans WHERE id=?').get(planId);
    if (!plan) return reply.code(404).send({ code: 404, message: '不存在' });
    if (plan.status !== STATUS.DRAFT && plan.status !== STATUS.REJECTED) {
      return reply.code(400).send({
        code: ERROR_CODES.WRONG_STATUS,
        message: `仅草稿或驳回状态可编辑，当前状态：${plan.status}`
      });
    }
    if (plan.created_by !== request.user.id) {
      return reply.code(403).send({
        code: ERROR_CODES.WRONG_ROLE,
        message: '仅创建人可编辑此计划单'
      });
    }
    const { title, customer_name, change_type, plan_date, risk_level, description, version } = request.body || {};
    if (version !== undefined && Number(version) !== plan.version) {
      return reply.code(409).send({
        code: ERROR_CODES.OLD_VERSION,
        message: `版本冲突：传入版本${version}，当前版本${plan.version}，请刷新后重试`
      });
    }
    d.prepare(`
      UPDATE launch_plans SET
        title=COALESCE(?, title),
        customer_name=COALESCE(?, customer_name),
        change_type=COALESCE(?, change_type),
        plan_date=COALESCE(?, plan_date),
        risk_level=COALESCE(?, risk_level),
        description=COALESCE(?, description),
        version=version+1,
        updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(title, customer_name, change_type, plan_date, risk_level, description, planId);

    audit(request.user.id, 'EDIT_PLAN', 'PLAN', planId, { plan_no: plan.plan_no }, request.ip);
    const updated = getPlanWithDetail(planId);
    return { code: 0, data: updated };
  });

  fastify.post('/api/plans/:id/action', {
    preHandler: [fastify.auth]
  }, async (request, reply) => {
    const d = db();
    const planId = Number(request.params.id);
    const { action, comment, version } = request.body || {};
    const ip = request.ip;

    const plan = d.prepare('SELECT * FROM launch_plans WHERE id=?').get(planId);
    if (!plan) return reply.code(404).send({ code: 404, message: '计划单不存在' });

    if (version !== undefined && Number(version) !== plan.version) {
      return reply.code(409).send({
        code: ERROR_CODES.OLD_VERSION,
        message: `版本冲突：您基于版本${version}提交，但当前已更新至版本${plan.version}。请刷新页面核对后再操作。`
      });
    }

    const tCheck = checkTransition(plan, action, request.user.role);
    if (!tCheck.ok) {
      audit(request.user.id, 'ACTION_FAIL', 'PLAN', planId,
        { action, plan_no: plan.plan_no, reason: tCheck.message }, ip);
      return reply.code(400).send(tCheck);
    }

    const req = requiredEvidences(plan, action);
    const eCheck = checkEvidences(planId, req);
    if (!eCheck.ok) {
      audit(request.user.id, 'ACTION_FAIL', 'PLAN', planId,
        { action, plan_no: plan.plan_no, reason: eCheck.message }, ip);
      return reply.code(400).send(eCheck);
    }

    const nextStatus = tCheck.nextStatus;
    if (nextStatus === STATUS.REJECTED) {
      d.prepare(`
        UPDATE launch_plans SET status=?, version=version+1, reject_reason=?,
          updated_at=datetime('now','localtime') WHERE id=?
      `).run(nextStatus, comment || '未填写原因', planId);
    } else {
      d.prepare(`
        UPDATE launch_plans SET status=?, version=version+1, reject_reason=NULL,
          updated_at=datetime('now','localtime') WHERE id=?
      `).run(nextStatus, planId);
    }
    d.prepare(`
      INSERT INTO plan_transitions (plan_id, from_status, to_status, operated_by, comment)
      VALUES (?, ?, ?, ?, ?)
    `).run(planId, plan.status, nextStatus, request.user.id, comment || null);

    audit(request.user.id, `ACTION_${action.toUpperCase()}`, 'PLAN', planId,
      { plan_no: plan.plan_no, from: plan.status, to: nextStatus, comment: comment || '' }, ip);

    return {
      code: 0,
      message: actionLabel(action) + '成功',
      data: getPlanWithDetail(planId)
    };
  });

  fastify.post('/api/plans/:id/evidence', {
    preHandler: [fastify.auth]
  }, async (request, reply) => {
    const d = db();
    const planId = Number(request.params.id);
    const plan = d.prepare('SELECT * FROM launch_plans WHERE id=?').get(planId);
    if (!plan) return reply.code(404).send({ code: 404, message: '不存在' });

    const { evidence_type, name, url, version } = request.body || {};
    if (!['REGISTRATION', 'VERIFICATION', 'ARCHIVAL'].includes(evidence_type)) {
      return reply.code(400).send({ code: 400, message: '证据类型非法' });
    }
    if (!name || !url) return reply.code(400).send({ code: 400, message: '名称/地址必填' });

    if (version !== undefined && Number(version) !== plan.version) {
      return reply.code(409).send({
        code: ERROR_CODES.OLD_VERSION,
        message: `版本冲突：当前版本${plan.version}，请刷新后再上传`
      });
    }

    const isCSM = request.user.role === ROLES.CSM;
    const isDelivery = request.user.role === ROLES.DELIVERY;
    const isDirector = request.user.role === ROLES.DIRECTOR;
    const typeMap = {
      REGISTRATION: isCSM,
      VERIFICATION: isDelivery,
      ARCHIVAL: isDirector
    };
    if (!typeMap[evidence_type]) {
      return reply.code(403).send({
        code: ERROR_CODES.WRONG_ROLE,
        message: `证据「${evidence_type}」仅对应角色可上传：REGISTRATION→CSM, VERIFICATION→交付顾问, ARCHIVAL→负责人`
      });
    }
    if (plan.status === STATUS.COMPLETED) {
      return reply.code(400).send({
        code: ERROR_CODES.WRONG_STATUS,
        message: '已完成状态不可再上传证据'
      });
    }

    const info = d.prepare(`
      INSERT INTO plan_evidences (plan_id, evidence_type, name, url, uploaded_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(planId, evidence_type, name, url, request.user.id);

    d.prepare(`UPDATE launch_plans SET version=version+1, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(planId);

    audit(request.user.id, 'UPLOAD_EVIDENCE', 'PLAN', planId,
      { plan_no: plan.plan_no, evidence_type, name }, request.ip);

    return { code: 0, data: { id: info.lastInsertRowid } };
  });

  fastify.get('/api/plans/:id/audit', {
    preHandler: [fastify.auth]
  }, async (request) => {
    const d = db();
    const list = d.prepare(`
      SELECT * FROM audit_logs WHERE target_type='PLAN' AND target_id=?
      ORDER BY created_at DESC
    `).all(request.params.id);
    return { code: 0, data: list };
  });
}
