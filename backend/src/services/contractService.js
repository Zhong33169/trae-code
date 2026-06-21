import db from '../db/connection.js';
import { 
  ROLES, STAGES, STATUSES, RISK_LEVELS, RISK_PRIORITY,
  ACTIONS, REQUIRED_EVIDENCES_BY_STAGE, STAGE_NAMES, STATUS_NAMES
} from '../constants.js';

function generateFormNo() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `QY${yyyy}${mm}${dd}${random}`;
}

function calcPriorityScore(riskLevel, deadline, status) {
  let score = RISK_PRIORITY[riskLevel] || 0;
  if (deadline) {
    const now = Date.now();
    const deadlineTime = new Date(deadline).getTime();
    const daysLeft = (deadlineTime - now) / (1000 * 60 * 60 * 24);
    if (daysLeft < 1) score += 50;
    else if (daysLeft < 3) score += 30;
    else if (daysLeft < 7) score += 10;
  }
  if (status === STATUSES.OVERDUE) score += 80;
  if (status === STATUSES.NEEDS_CORRECTION) score += 40;
  return score;
}

function addOperationLog(formId, operator, action, opts = {}) {
  const stmt = db.prepare(`
    INSERT INTO operation_logs
    (contract_form_id, operator_id, operator_name, operator_role, action,
     from_stage, to_stage, from_status, to_status, opinion, result,
     version_before, version_after)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    formId,
    operator?.id || null,
    operator?.name || null,
    operator?.role || null,
    action,
    opts.fromStage || null,
    opts.toStage || null,
    opts.fromStatus || null,
    opts.toStatus || null,
    opts.opinion || null,
    opts.result || null,
    opts.versionBefore || null,
    opts.versionAfter || null
  );
}

export function getFormById(id) {
  const form = db.prepare('SELECT * FROM contract_forms WHERE id = ?').get(id);
  if (!form) return null;
  const evidences = db.prepare('SELECT * FROM evidences WHERE contract_form_id = ? ORDER BY uploaded_at').all(id);
  const logs = db.prepare('SELECT * FROM operation_logs WHERE contract_form_id = ? ORDER BY created_at DESC').all(id);
  return { ...form, evidences, logs };
}

export function getFormsByRole(role, { stage, status, riskLevel, keyword, page = 1, pageSize = 20 } = {}) {
  let whereClauses = [];
  let params = {};

  if (role === ROLES.REGISTER) {
    whereClauses.push("(current_role = 'REGISTER' OR created_by = :createdBy)");
    params.createdBy = 1;
  } else if (role === ROLES.AUDITOR) {
    whereClauses.push("current_role = 'AUDITOR'");
  } else if (role === ROLES.REVIEWER) {
    whereClauses.push("current_role = 'REVIEWER'");
  }

  if (stage) {
    whereClauses.push('stage = :stage');
    params.stage = stage;
  }
  if (status) {
    whereClauses.push('status = :status');
    params.status = status;
  }
  if (riskLevel) {
    whereClauses.push('risk_level = :riskLevel');
    params.riskLevel = riskLevel;
  }
  if (keyword) {
    whereClauses.push('(form_no LIKE :keyword OR resident_name LIKE :keyword)');
    params.keyword = `%${keyword}%`;
  }

  const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM contract_forms ${whereSql}`);
  const { total } = countStmt.get(params);

  const offset = (page - 1) * pageSize;
  const listStmt = db.prepare(`
    SELECT * FROM contract_forms
    ${whereSql}
    ORDER BY priority_score DESC, updated_at DESC
    LIMIT :pageSize OFFSET :offset
  `);
  const list = listStmt.all({ ...params, pageSize, offset });

  return { list, total, page, pageSize };
}

export function getStatsByRole(role) {
  let whereClause = '';
  if (role === ROLES.AUDITOR) {
    whereClause = "WHERE current_role = 'AUDITOR'";
  } else if (role === ROLES.REVIEWER) {
    whereClause = "WHERE current_role = 'REVIEWER'";
  } else if (role === ROLES.REGISTER) {
    whereClause = "WHERE current_role = 'REGISTER'";
  }

  const rows = db.prepare(`
    SELECT stage, status, risk_level, COUNT(*) as count
    FROM contract_forms
    ${whereClause}
    GROUP BY stage, status, risk_level
  `).all();

  const stats = {
    total: 0,
    byStage: {},
    byStatus: {},
    byRisk: {},
    pending: 0,
    overdue: 0,
    highRisk: 0
  };

  for (const row of rows) {
    stats.total += row.count;
    stats.byStage[row.stage] = (stats.byStage[row.stage] || 0) + row.count;
    stats.byStatus[row.status] = (stats.byStatus[row.status] || 0) + row.count;
    stats.byRisk[row.risk_level] = (stats.byRisk[row.risk_level] || 0) + row.count;
    if (row.status === STATUSES.PENDING || row.status === STATUSES.NEEDS_CORRECTION) {
      stats.pending += row.count;
    }
    if (row.status === STATUSES.OVERDUE) {
      stats.overdue += row.count;
    }
    if (row.risk_level === RISK_LEVELS.HIGH) {
      stats.highRisk += row.count;
    }
  }

  return stats;
}

export function createForm(user, data) {
  if (user.role !== ROLES.REGISTER) {
    return { success: false, error: '只有签约服务登记员可以创建签约服务单' };
  }

  if (!data.residentName || !data.residentName.trim()) {
    return { success: false, error: '居民姓名不能为空' };
  }

  const formNo = data.formNo || generateFormNo();
  const riskLevel = data.riskLevel || RISK_LEVELS.MEDIUM;

  let deadlineDays = 7;
  if (riskLevel === RISK_LEVELS.HIGH) {
    deadlineDays = 3;
  } else if (riskLevel === RISK_LEVELS.MEDIUM) {
    deadlineDays = 5;
  }

  const deadline = data.deadline || new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString();
  const priorityScore = calcPriorityScore(riskLevel, deadline, STATUSES.DRAFT);

  let signContent = data.signContent || '';
  if (riskLevel === RISK_LEVELS.HIGH && !data.signContent) {
    signContent = '高风险居民签约，需重点关注，处理时限缩短。';
  }

  const stmt = db.prepare(`
    INSERT INTO contract_forms
    (form_no, resident_name, id_card, phone, address, doctor_name, team_name,
     risk_level, stage, status, current_handler_id, current_role, version,
     deadline, sign_content, plan_content, perform_content,
     created_by, priority_score, evidence_required, evidence_submitted,
     last_opinion, last_result, last_handler_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SIGN', 'DRAFT', ?, 'REGISTER', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    formNo,
    data.residentName.trim(),
    data.idCard?.trim() || null,
    data.phone?.trim() || null,
    data.address?.trim() || null,
    data.doctorName?.trim() || null,
    data.teamName?.trim() || null,
    riskLevel,
    user.id,
    deadline,
    signContent || null,
    null,
    null,
    user.id,
    priorityScore,
    REQUIRED_EVIDENCES_BY_STAGE.SIGN.length,
    0,
    null,
    '创建完成',
    user.name
  );

  const formId = result.lastInsertRowid;

  const evidenceSubmitted = 0;
  if (data.evidences && data.evidences.length > 0) {
    const evStmt = db.prepare(`
      INSERT INTO evidences (contract_form_id, stage, name, description, is_required, uploaded_by)
      VALUES (?, 'SIGN', ?, ?, ?, ?)
    `);
    for (const ev of data.evidences) {
      evStmt.run(formId, ev.name, ev.description || '', ev.isRequired ? 1 : 0, user.id);
    }

    const count = db.prepare(
      "SELECT COUNT(*) as cnt FROM evidences WHERE contract_form_id = ? AND stage = 'SIGN' AND is_required = 1"
    ).get(formId).cnt;

    db.prepare('UPDATE contract_forms SET evidence_submitted = ? WHERE id = ?').run(count, formId);
  }

  addOperationLog(formId, user, ACTIONS.CREATE, {
    fromStage: null,
    toStage: STAGES.SIGN,
    fromStatus: null,
    toStatus: STATUSES.DRAFT,
    versionBefore: null,
    versionAfter: 1,
    opinion: `风险等级：${riskLevel === RISK_LEVELS.HIGH ? '高风险' : riskLevel === RISK_LEVELS.MEDIUM ? '中风险' : '低风险'}`,
    result: `创建成功，处理时限 ${deadlineDays} 天`
  });

  return { success: true, form: getFormById(formId) };
}

export function submitForm(user, formId, data) {
  const form = db.prepare('SELECT * FROM contract_forms WHERE id = ?').get(formId);
  if (!form) {
    return { success: false, error: '签约服务单不存在' };
  }

  if (form.current_handler_id !== user.id || form.current_role !== user.role) {
    return { success: false, error: '当前处理人不匹配，无权操作' };
  }

  if (user.role !== ROLES.REGISTER) {
    return { success: false, error: '只有签约服务登记员可以提交' };
  }

  if (data.version !== form.version) {
    addOperationLog(formId, user, ACTIONS.SUBMIT, {
      fromStatus: form.status,
      toStatus: STATUSES.STATUS_CONFLICT,
      fromStage: form.stage,
      toStage: form.stage,
      opinion: `版本冲突：提交版本 v${data.version}，当前版本 v${form.version}`,
      result: '提交失败：版本冲突',
      versionBefore: form.version,
      versionAfter: form.version
    });
    return { success: false, error: '版本冲突，请刷新后重试' };
  }

  const validStatuses = [STATUSES.DRAFT, STATUSES.NEEDS_CORRECTION];
  if (!validStatuses.includes(form.status)) {
    return { success: false, error: `当前状态 ${STATUS_NAMES[form.status]} 不可提交` };
  }

  const evidences = db.prepare(
    'SELECT * FROM evidences WHERE contract_form_id = ? AND stage = ?'
  ).all(formId, form.stage);

  const requiredCount = REQUIRED_EVIDENCES_BY_STAGE[form.stage]?.length || 0;
  const submittedRequired = evidences.filter(e => e.is_required).length;

  if (submittedRequired < requiredCount) {
    addOperationLog(formId, user, ACTIONS.SUBMIT, {
      fromStatus: form.status,
      toStatus: form.status,
      fromStage: form.stage,
      toStage: form.stage,
      opinion: data.opinion || '',
      result: `提交失败：缺少必填证据，需 ${requiredCount} 件，实有 ${submittedRequired} 件`,
      versionBefore: form.version,
      versionAfter: form.version
    });
    return { success: false, error: `缺少必填证据，需 ${requiredCount} 件，实有 ${submittedRequired} 件` };
  }

  const oldStatus = form.status;
  const newStatus = STATUSES.PENDING;
  let newRole = ROLES.AUDITOR;
  let newHandlerId = 2;
  const newStage = form.stage;

  if (form.stage === STAGES.PERFORM && form.status === STATUSES.NEEDS_CORRECTION) {
    newRole = ROLES.REVIEWER;
    newHandlerId = 3;
  }

  const newVersion = form.version + 1;
  let deadline = form.deadline;

  let actionResult = '';
  let submitType = '';

  if (oldStatus === STATUSES.NEEDS_CORRECTION) {
    submitType = '补正提交';
    actionResult = '补正材料已提交，请重新审核';

    if (form.risk_level === RISK_LEVELS.HIGH) {
      const newDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      if (form.deadline && newDeadline < new Date(form.deadline)) {
        deadline = newDeadline.toISOString();
        actionResult += '（高风险补正，审核时限2天）';
      }
    }
  } else {
    submitType = '提交审核';
    actionResult = '提交成功，等待审核';
  }

  const priorityScore = calcPriorityScore(form.risk_level, deadline, newStatus);

  db.prepare(`
    UPDATE contract_forms SET
      status = ?, current_role = ?, current_handler_id = ?,
      version = ?, updated_at = CURRENT_TIMESTAMP,
      deadline = ?,
      sign_content = COALESCE(?, sign_content),
      plan_content = COALESCE(?, plan_content),
      perform_content = COALESCE(?, perform_content),
      evidence_submitted = ?,
      last_opinion = ?, last_result = ?, last_handler_name = ?,
      priority_score = ?
    WHERE id = ?
  `).run(
    newStatus, newRole, newHandlerId,
    newVersion,
    deadline,
    data.signContent || null,
    data.planContent || null,
    data.performContent || null,
    submittedRequired,
    data.opinion || '',
    actionResult,
    user.name,
    priorityScore,
    formId
  );

  addOperationLog(formId, user, ACTIONS.SUBMIT, {
    fromStatus: oldStatus,
    toStatus: newStatus,
    fromStage: form.stage,
    toStage: newStage,
    opinion: data.opinion || '',
    result: actionResult,
    versionBefore: form.version,
    versionAfter: newVersion
  });

  return { success: true, form: getFormById(formId), submitType };
}

export function approveForm(user, formId, data) {
  const form = db.prepare('SELECT * FROM contract_forms WHERE id = ?').get(formId);
  if (!form) {
    return { success: false, error: '签约服务单不存在' };
  }

  if (form.current_handler_id !== user.id || form.current_role !== user.role) {
    return { success: false, error: '当前处理人不匹配，无权操作' };
  }

  if (data.version !== form.version) {
    return { success: false, error: '版本冲突，请刷新后重试' };
  }

  if (form.status !== STATUSES.PENDING) {
    return { success: false, error: '当前状态不可审核通过' };
  }

  let newStage = form.stage;
  let newStatus = STATUSES.APPROVED;
  let newRole = ROLES.REGISTER;
  let newHandlerId = 1;

  if (user.role === ROLES.AUDITOR) {
    if (form.stage === STAGES.SIGN) {
      newStage = STAGES.PLAN;
      newStatus = STATUSES.DRAFT;
      newRole = ROLES.REGISTER;
      newHandlerId = 1;
    } else if (form.stage === STAGES.PLAN) {
      newStage = STAGES.PERFORM;
      newStatus = STATUSES.DRAFT;
      newRole = ROLES.REGISTER;
      newHandlerId = 1;
    }
  } else if (user.role === ROLES.REVIEWER) {
    newStatus = STATUSES.ARCHIVED;
    newRole = null;
    newHandlerId = null;
  }

  const newVersion = form.version + 1;
  const priorityScore = calcPriorityScore(form.risk_level, form.deadline, newStatus);

  db.prepare(`
    UPDATE contract_forms SET
      stage = ?, status = ?, current_role = ?, current_handler_id = ?,
      version = ?, updated_at = CURRENT_TIMESTAMP,
      last_opinion = ?, last_result = ?, last_handler_name = ?,
      priority_score = ?,
      evidence_required = ?
    WHERE id = ?
  `).run(
    newStage, newStatus, newRole, newHandlerId,
    newVersion,
    data.opinion || '',
    '审核通过',
    user.name,
    priorityScore,
    newStage && newStage !== form.stage ? (REQUIRED_EVIDENCES_BY_STAGE[newStage]?.length || 0) : form.evidence_required,
    formId
  );

  addOperationLog(formId, user, ACTIONS.APPROVE, {
    fromStatus: form.status,
    toStatus: newStatus,
    fromStage: form.stage,
    toStage: newStage,
    opinion: data.opinion || '',
    result: '审核通过',
    versionBefore: form.version,
    versionAfter: newVersion
  });

  return { success: true, form: getFormById(formId) };
}

export function returnCorrection(user, formId, data) {
  const form = db.prepare('SELECT * FROM contract_forms WHERE id = ?').get(formId);
  if (!form) {
    return { success: false, error: '签约服务单不存在' };
  }

  if (form.current_handler_id !== user.id || form.current_role !== user.role) {
    return { success: false, error: '当前处理人不匹配，无权操作' };
  }

  if (data.version !== form.version) {
    return { success: false, error: '版本冲突，请刷新后重试' };
  }

  if (form.status !== STATUSES.PENDING) {
    return { success: false, error: '当前状态不可退回补正' };
  }

  const newStatus = STATUSES.NEEDS_CORRECTION;
  const newRole = ROLES.REGISTER;
  const newHandlerId = 1;
  const newVersion = form.version + 1;
  const priorityScore = calcPriorityScore(form.risk_level, form.deadline, newStatus);

  db.prepare(`
    UPDATE contract_forms SET
      status = ?, current_role = ?, current_handler_id = ?,
      version = ?, updated_at = CURRENT_TIMESTAMP,
      last_opinion = ?, last_result = ?, last_handler_name = ?,
      priority_score = ?
    WHERE id = ?
  `).run(
    newStatus, newRole, newHandlerId,
    newVersion,
    data.opinion || '',
    '退回补正',
    user.name,
    priorityScore,
    formId
  );

  addOperationLog(formId, user, ACTIONS.RETURN_CORRECTION, {
    fromStatus: form.status,
    toStatus: newStatus,
    fromStage: form.stage,
    toStage: form.stage,
    opinion: data.opinion || '',
    result: '退回补正',
    versionBefore: form.version,
    versionAfter: newVersion
  });

  return { success: true, form: getFormById(formId) };
}

export function rejectForm(user, formId, data) {
  const form = db.prepare('SELECT * FROM contract_forms WHERE id = ?').get(formId);
  if (!form) {
    return { success: false, error: '签约服务单不存在' };
  }

  if (form.current_handler_id !== user.id || form.current_role !== user.role) {
    return { success: false, error: '当前处理人不匹配，无权操作' };
  }

  if (data.version !== form.version) {
    return { success: false, error: '版本冲突，请刷新后重试' };
  }

  if (form.status !== STATUSES.PENDING) {
    return { success: false, error: '当前状态不可不予通过' };
  }

  const newStatus = STATUSES.REJECTED;
  const newRole = null;
  const newHandlerId = null;
  const newVersion = form.version + 1;
  const priorityScore = calcPriorityScore(form.risk_level, form.deadline, newStatus);

  db.prepare(`
    UPDATE contract_forms SET
      status = ?, current_role = ?, current_handler_id = ?,
      version = ?, updated_at = CURRENT_TIMESTAMP,
      last_opinion = ?, last_result = ?, last_handler_name = ?,
      priority_score = ?
    WHERE id = ?
  `).run(
    newStatus, newRole, newHandlerId,
    newVersion,
    data.opinion || '',
    '不予通过',
    user.name,
    priorityScore,
    formId
  );

  addOperationLog(formId, user, ACTIONS.REJECT, {
    fromStatus: form.status,
    toStatus: newStatus,
    fromStage: form.stage,
    toStage: form.stage,
    opinion: data.opinion || '',
    result: '不予通过',
    versionBefore: form.version,
    versionAfter: newVersion
  });

  return { success: true, form: getFormById(formId) };
}

export function archiveForm(user, formId, data) {
  const form = db.prepare('SELECT * FROM contract_forms WHERE id = ?').get(formId);
  if (!form) {
    return { success: false, error: '签约服务单不存在' };
  }

  if (form.current_handler_id !== user.id || form.current_role !== user.role) {
    return { success: false, error: '当前处理人不匹配，无权操作' };
  }

  if (data.version !== form.version) {
    return { success: false, error: '版本冲突，请刷新后重试' };
  }

  if (form.status !== STATUSES.PENDING || form.stage !== STAGES.PERFORM) {
    return { success: false, error: '当前状态不可归档' };
  }

  const newStatus = STATUSES.ARCHIVED;
  const newRole = null;
  const newHandlerId = null;
  const newVersion = form.version + 1;
  const priorityScore = 0;

  db.prepare(`
    UPDATE contract_forms SET
      status = ?, current_role = ?, current_handler_id = ?,
      version = ?, updated_at = CURRENT_TIMESTAMP,
      last_opinion = ?, last_result = ?, last_handler_name = ?,
      priority_score = ?
    WHERE id = ?
  `).run(
    newStatus, newRole, newHandlerId,
    newVersion,
    data.opinion || '',
    '复核归档',
    user.name,
    priorityScore,
    formId
  );

  addOperationLog(formId, user, ACTIONS.ARCHIVE, {
    fromStatus: form.status,
    toStatus: newStatus,
    fromStage: form.stage,
    toStage: form.stage,
    opinion: data.opinion || '',
    result: '复核归档完成',
    versionBefore: form.version,
    versionAfter: newVersion
  });

  return { success: true, form: getFormById(formId) };
}

export function addEvidence(user, formId, evidence) {
  const form = db.prepare('SELECT * FROM contract_forms WHERE id = ?').get(formId);
  if (!form) {
    return { success: false, error: '签约服务单不存在' };
  }

  if (form.current_handler_id !== user.id || form.current_role !== user.role) {
    return { success: false, error: '当前处理人不匹配，无权添加证据' };
  }

  if (user.role !== ROLES.REGISTER) {
    return { success: false, error: '只有签约服务登记员可以添加证据' };
  }

  const editableStatuses = [STATUSES.DRAFT, STATUSES.NEEDS_CORRECTION];
  if (!editableStatuses.includes(form.status)) {
    return { success: false, error: `当前状态 ${STATUS_NAMES[form.status]} 不允许添加证据` };
  }

  if (!evidence.name || !evidence.name.trim()) {
    return { success: false, error: '证据名称不能为空' };
  }

  const targetStage = evidence.stage || form.stage;
  if (targetStage !== form.stage) {
    return { success: false, error: `只能添加当前阶段 ${STAGE_NAMES[form.stage]} 的证据` };
  }

  const requiredList = REQUIRED_EVIDENCES_BY_STAGE[form.stage] || [];
  const isRequired = requiredList.includes(evidence.name.trim()) ? 1 : (evidence.isRequired ? 1 : 0);

  const existing = db.prepare(
    'SELECT * FROM evidences WHERE contract_form_id = ? AND stage = ? AND name = ?'
  ).get(formId, form.stage, evidence.name.trim());

  if (existing) {
    return { success: false, error: '该证据已存在' };
  }

  const newVersion = form.version + 1;

  const stmt = db.prepare(`
    INSERT INTO evidences (contract_form_id, stage, name, description, is_required, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    formId,
    form.stage,
    evidence.name.trim(),
    evidence.description?.trim() || '',
    isRequired,
    user.id
  );

  const submittedCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM evidences WHERE contract_form_id = ? AND stage = ? AND is_required = 1'
  ).get(formId, form.stage).cnt;

  const requiredCount = REQUIRED_EVIDENCES_BY_STAGE[form.stage]?.length || 0;
  const priorityScore = calcPriorityScore(form.risk_level, form.deadline, form.status);

  let lastResult = '添加证据';
  let lastOpinion = `添加证据：${evidence.name.trim()}${isRequired ? '（必需）' : '（补充）'}`;

  if (submittedCount >= requiredCount) {
    lastResult += '，必填证据已齐全';
    lastOpinion += '，必填证据已齐全';
  }

  db.prepare(`
    UPDATE contract_forms SET
      evidence_submitted = ?,
      version = ?,
      updated_at = CURRENT_TIMESTAMP,
      priority_score = ?,
      last_opinion = ?,
      last_result = ?,
      last_handler_name = ?
    WHERE id = ?
  `).run(submittedCount, newVersion, priorityScore, lastOpinion, lastResult, user.name, formId);

  addOperationLog(formId, user, ACTIONS.ADD_EVIDENCE, {
    fromStatus: form.status,
    toStatus: form.status,
    fromStage: form.stage,
    toStage: form.stage,
    opinion: lastOpinion,
    result: lastResult,
    versionBefore: form.version,
    versionAfter: newVersion
  });

  return { success: true, evidenceId: result.lastInsertRowid, form: getFormById(formId) };
}

export function removeEvidence(user, evidenceId) {
  const evidence = db.prepare('SELECT * FROM evidences WHERE id = ?').get(evidenceId);
  if (!evidence) {
    return { success: false, error: '证据不存在' };
  }

  const form = db.prepare('SELECT * FROM contract_forms WHERE id = ?').get(evidence.contract_form_id);
  if (!form) {
    return { success: false, error: '签约服务单不存在' };
  }

  if (form.current_handler_id !== user.id || form.current_role !== user.role) {
    return { success: false, error: '当前处理人不匹配，无权删除证据' };
  }

  if (user.role !== ROLES.REGISTER) {
    return { success: false, error: '只有签约服务登记员可以删除证据' };
  }

  const editableStatuses = [STATUSES.DRAFT, STATUSES.NEEDS_CORRECTION];
  if (!editableStatuses.includes(form.status)) {
    return { success: false, error: `当前状态 ${STATUS_NAMES[form.status]} 不允许删除证据` };
  }

  if (evidence.stage !== form.stage) {
    return { success: false, error: `只能删除当前阶段 ${STAGE_NAMES[form.stage]} 的证据` };
  }

  const newVersion = form.version + 1;

  db.prepare('DELETE FROM evidences WHERE id = ?').run(evidenceId);

  const submittedCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM evidences WHERE contract_form_id = ? AND stage = ? AND is_required = 1'
  ).get(evidence.contract_form_id, evidence.stage).cnt;

  const requiredCount = REQUIRED_EVIDENCES_BY_STAGE[form.stage]?.length || 0;
  const priorityScore = calcPriorityScore(form.risk_level, form.deadline, form.status);

  let lastResult = '移除证据';
  let lastOpinion = `移除证据：${evidence.name}${evidence.is_required ? '（必需）' : '（补充）'}`;

  if (evidence.is_required && submittedCount < requiredCount) {
    lastResult += '，必填证据不完整';
    lastOpinion += '，必填证据不完整';
  }

  db.prepare(`
    UPDATE contract_forms SET
      evidence_submitted = ?,
      version = ?,
      updated_at = CURRENT_TIMESTAMP,
      priority_score = ?,
      last_opinion = ?,
      last_result = ?,
      last_handler_name = ?
    WHERE id = ?
  `).run(submittedCount, newVersion, priorityScore, lastOpinion, lastResult, user.name, form.id);

  addOperationLog(form.id, user, ACTIONS.REMOVE_EVIDENCE, {
    fromStatus: form.status,
    toStatus: form.status,
    fromStage: form.stage,
    toStage: form.stage,
    opinion: lastOpinion,
    result: lastResult,
    versionBefore: form.version,
    versionAfter: newVersion
  });

  return { success: true, form: getFormById(form.id) };
}

export function updateFormContent(user, formId, data) {
  const form = db.prepare('SELECT * FROM contract_forms WHERE id = ?').get(formId);
  if (!form) {
    return { success: false, error: '签约服务单不存在' };
  }

  if (form.current_handler_id !== user.id || form.current_role !== user.role) {
    return { success: false, error: '当前处理人不匹配，无权操作' };
  }

  if (user.role !== ROLES.REGISTER) {
    return { success: false, error: '只有签约服务登记员可以编辑内容' };
  }

  const editableStatuses = [STATUSES.DRAFT, STATUSES.NEEDS_CORRECTION];
  if (!editableStatuses.includes(form.status)) {
    return { success: false, error: `当前状态 ${STATUS_NAMES[form.status]} 不允许编辑` };
  }

  if (data.version !== undefined && data.version !== form.version) {
    addOperationLog(formId, user, ACTIONS.CORRECT, {
      fromStatus: form.status,
      toStatus: STATUSES.STATUS_CONFLICT,
      fromStage: form.stage,
      toStage: form.stage,
      opinion: `版本冲突：提交版本 v${data.version}，当前版本 v${form.version}`,
      result: '编辑失败：版本冲突',
      versionBefore: form.version,
      versionAfter: form.version
    });
    return { success: false, error: '版本冲突，请刷新后重试' };
  }

  const changes = [];
  const newRiskLevel = data.riskLevel || form.risk_level;
  const newDeadline = data.deadline || form.deadline;

  if (data.residentName !== undefined && data.residentName !== form.resident_name) {
    changes.push(`居民姓名: ${form.resident_name} → ${data.residentName}`);
  }
  if (data.riskLevel && data.riskLevel !== form.risk_level) {
    const oldRisk = form.risk_level === RISK_LEVELS.HIGH ? '高风险' : form.risk_level === RISK_LEVELS.MEDIUM ? '中风险' : '低风险';
    const newRisk = data.riskLevel === RISK_LEVELS.HIGH ? '高风险' : data.riskLevel === RISK_LEVELS.MEDIUM ? '中风险' : '低风险';
    changes.push(`风险等级: ${oldRisk} → ${newRisk}`);

    if (data.riskLevel === RISK_LEVELS.HIGH && form.risk_level !== RISK_LEVELS.HIGH) {
      changes.push('⚠️ 升级为高风险，处理时限缩短');
    }
  }

  const contentField = form.stage === STAGES.SIGN ? 'sign_content' :
                       form.stage === STAGES.PLAN ? 'plan_content' : 'perform_content';
  const contentDataKey = form.stage === STAGES.SIGN ? 'signContent' :
                         form.stage === STAGES.PLAN ? 'planContent' : 'performContent';
  if (data[contentDataKey] !== undefined && data[contentDataKey] !== form[contentField]) {
    changes.push(`${STAGE_NAMES[form.stage]}内容已更新`);
  }

  let deadline = newDeadline;
  if (newRiskLevel === RISK_LEVELS.HIGH && !data.deadline) {
    const currentDeadline = form.deadline ? new Date(form.deadline) : new Date();
    const newDeadlineHighRisk = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    if (newDeadlineHighRisk < currentDeadline) {
      deadline = newDeadlineHighRisk.toISOString();
      changes.push('高风险自动缩短处理时限至3天');
    }
  }

  const newVersion = form.version + 1;
  const priorityScore = calcPriorityScore(newRiskLevel, deadline, form.status);
  const lastResult = form.status === STATUSES.NEEDS_CORRECTION ? '补正更新' : '编辑更新';

  db.prepare(`
    UPDATE contract_forms SET
      resident_name = COALESCE(?, resident_name),
      id_card = COALESCE(?, id_card),
      phone = COALESCE(?, phone),
      address = COALESCE(?, address),
      doctor_name = COALESCE(?, doctor_name),
      team_name = COALESCE(?, team_name),
      risk_level = COALESCE(?, risk_level),
      deadline = ?,
      sign_content = COALESCE(?, sign_content),
      plan_content = COALESCE(?, plan_content),
      perform_content = COALESCE(?, perform_content),
      version = ?,
      updated_at = CURRENT_TIMESTAMP,
      priority_score = ?,
      last_opinion = ?,
      last_result = ?,
      last_handler_name = ?,
      evidence_required = ?
    WHERE id = ?
  `).run(
    data.residentName?.trim() ?? null,
    data.idCard?.trim() ?? null,
    data.phone?.trim() ?? null,
    data.address?.trim() ?? null,
    data.doctorName?.trim() ?? null,
    data.teamName?.trim() ?? null,
    newRiskLevel,
    deadline,
    data.signContent ?? null,
    data.planContent ?? null,
    data.performContent ?? null,
    newVersion,
    priorityScore,
    changes.length > 0 ? changes.join('；') : '内容无变化',
    lastResult,
    user.name,
    REQUIRED_EVIDENCES_BY_STAGE[form.stage]?.length || form.evidence_required,
    formId
  );

  addOperationLog(formId, user, ACTIONS.CORRECT, {
    fromStatus: form.status,
    toStatus: form.status,
    fromStage: form.stage,
    toStage: form.stage,
    opinion: changes.length > 0 ? changes.join('；') : '内容无变化',
    result: lastResult,
    versionBefore: form.version,
    versionAfter: newVersion
  });

  return { success: true, form: getFormById(formId) };
}

export function markOverdue() {
  const now = new Date().toISOString();
  const forms = db.prepare(`
    SELECT * FROM contract_forms
    WHERE status IN ('PENDING', 'NEEDS_CORRECTION')
      AND deadline IS NOT NULL
      AND deadline < ?
  `).all(now);

  for (const form of forms) {
    const priorityScore = calcPriorityScore(form.risk_level, form.deadline, STATUSES.OVERDUE);
    db.prepare(`
      UPDATE contract_forms SET
        status = 'OVERDUE',
        priority_score = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(priorityScore, form.id);

    addOperationLog(form.id, null, ACTIONS.MARK_OVERDUE, {
      fromStatus: form.status,
      toStatus: STATUSES.OVERDUE,
      fromStage: form.stage,
      toStage: form.stage,
      result: '系统自动标记逾期',
      versionBefore: form.version,
      versionAfter: form.version
    });
  }

  return { count: forms.length };
}
