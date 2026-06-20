import { Router } from 'express';
import { getDB } from '../models/database.js';
import { requireRole, auditLog } from '../middleware/auth.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDB();
  const { status, priority, keyword, anomaly, role, userId } = req.query;

  let sql = `
    SELECT cr.*,
      d.name as doctor_name, n.name as nurse_name, r.name as reviewer_name,
      (SELECT COUNT(*) FROM attachments WHERE care_record_id = cr.id) as attachment_count,
      (SELECT COUNT(*) FROM attachments WHERE care_record_id = cr.id AND status = 'rejected') as rejected_attachment_count,
      (SELECT COUNT(*) FROM attachments WHERE care_record_id = cr.id AND is_required = 1 AND status = 'pending') as missing_required_count
    FROM care_records cr
    LEFT JOIN users d ON cr.doctor_id = d.id
    LEFT JOIN users n ON cr.nurse_id = n.id
    LEFT JOIN users r ON cr.reviewer_id = r.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += ` AND cr.status = ?`;
    params.push(status);
  }
  if (priority) {
    sql += ` AND cr.priority = ?`;
    params.push(priority);
  }
  if (keyword) {
    sql += ` AND (cr.pet_name LIKE ? OR cr.owner_name LIKE ? OR cr.diagnosis LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (anomaly === 'true') {
    sql += ` AND (cr.status IN ('returned', 'overdue') OR (SELECT COUNT(*) FROM attachments WHERE care_record_id = cr.id AND status = 'rejected') > 0 OR (SELECT COUNT(*) FROM attachments WHERE care_record_id = cr.id AND is_required = 1 AND status = 'pending') > 0)`;
  }
  if (role === 'doctor' && userId) {
    sql += ` AND cr.doctor_id = ?`;
    params.push(userId);
  } else if (role === 'nurse' && userId) {
    sql += ` AND (cr.nurse_id = ? OR cr.nurse_id IS NULL)`;
    params.push(userId);
  } else if (role === 'reviewer' && userId) {
    sql += ` AND (cr.reviewer_id = ? OR cr.reviewer_id IS NULL)`;
    params.push(userId);
  }

  sql += ` ORDER BY cr.updated_at DESC`;

  const records = db.prepare(sql).all(...params);

  const enriched = records.map(record => {
    const isOverdue = record.deadline && new Date(record.deadline) < new Date() && record.status !== 'archived';
    return { ...record, is_overdue: isOverdue ? 1 : 0 };
  });

  res.json(enriched);
});

router.get('/stats/summary', (req, res) => {
  const db = getDB();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'initiated' THEN 1 ELSE 0 END) as initiated,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as reviewing,
      SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
      SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned,
      SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue
    FROM care_records
  `).get();
  res.json(stats);
});

router.put('/batch-status', requireRole('doctor', 'nurse', 'reviewer', 'admin'), (req, res) => {
  const db = getDB();
  const { ids, status, nurse_id, reviewer_id, return_reason, remark } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请选择至少一条护理单' });
  }
  if (!status) {
    return res.status(400).json({ error: '请指定目标状态' });
  }

  const roleTransitions = {
    doctor: ['processing'],
    nurse: ['reviewing', 'processing'],
    reviewer: ['archived', 'returned']
  };
  const roleAllowed = roleTransitions[req.user.role] || [];
  if (!roleAllowed.includes(status) && req.user.role !== 'admin') {
    return res.status(403).json({ error: `角色 ${req.user.role} 无权批量执行此操作` });
  }

  const transitions = {
    initiated: ['processing'],
    processing: ['reviewing', 'returned', 'overdue'],
    reviewing: ['archived', 'returned'],
    returned: ['processing'],
    overdue: ['processing']
  };

  let nurseInfo = null;
  if (status === 'processing' && nurse_id) {
    nurseInfo = db.prepare('SELECT id, name FROM users WHERE id = ? AND role = ?').get(parseInt(nurse_id), 'nurse');
  }
  let reviewerInfo = null;
  if (status === 'reviewing' && reviewer_id) {
    reviewerInfo = db.prepare('SELECT id, name FROM users WHERE id = ? AND role = ?').get(parseInt(reviewer_id), 'reviewer');
  }

  const operatorName = req.user.name;
  const operatorRole = req.user.role;
  const remarkStr = remark ? `，操作备注: ${remark}` : '';

  const results = [];
  const successIds = [];

  for (const rawId of ids) {
    const id = parseInt(rawId);
    const result = { id, success: false, message: '', responsible: '' };

    const current = db.prepare(`
      SELECT cr.*, d.name as doctor_name, n.name as nurse_name, r.name as reviewer_name
      FROM care_records cr
      LEFT JOIN users d ON cr.doctor_id = d.id
      LEFT JOIN users n ON cr.nurse_id = n.id
      LEFT JOIN users r ON cr.reviewer_id = r.id
      WHERE cr.id = ?
    `).get(id);

    if (!current) {
      result.message = '护理单不存在';
      result.responsible = '-';
      auditLog(id, 'batch_status_failed', null, null, '批量操作-护理单不存在', `${result.message}${remarkStr}`, req);
      results.push(result);
      continue;
    }

    const responsibleArr = [];
    if (current.doctor_name) responsibleArr.push(`医生: ${current.doctor_name}`);
    if (current.nurse_name) responsibleArr.push(`护士: ${current.nurse_name}`);
    if (current.reviewer_name) responsibleArr.push(`复核: ${current.reviewer_name}`);
    const currentResponsible = responsibleArr.length ? responsibleArr.join('、') : '暂无责任人';
    result.responsible = currentResponsible;

    const allowed = transitions[current.status] || [];
    if (!allowed.includes(status) && req.user.role !== 'admin') {
      result.message = `当前状态 ${current.status} 不允许转为 ${status}`;
      auditLog(id, 'batch_status_failed',
        { status: current.status, responsible: currentResponsible },
        { status, operator: operatorName },
        '批量操作-状态不允许', `${result.message}，当前责任人: ${currentResponsible}${remarkStr}`, req);
      results.push(result);
      continue;
    }

    if (status === 'processing') {
      let finalNurseId = null;
      let finalNurseName = null;
      if (req.user.role === 'nurse') {
        const self = db.prepare('SELECT id, name FROM users WHERE id = ? AND role = ?').get(req.user.id, 'nurse');
        if (self) { finalNurseId = self.id; finalNurseName = self.name; }
      } else if (nurseInfo) {
        finalNurseId = nurseInfo.id;
        finalNurseName = nurseInfo.name;
      }
      if (!finalNurseId) {
        result.message = '缺少经办护士，请选择护士';
        auditLog(id, 'batch_status_failed',
          { status: current.status, responsible: currentResponsible },
          { status: 'processing' },
          '批量操作-缺少经办护士', `${result.message}，当前责任人: ${currentResponsible}${remarkStr}`, req);
        results.push(result);
        continue;
      }

      const notApprovedRequired = db.prepare(
        "SELECT COUNT(*) as cnt FROM attachments WHERE care_record_id = ? AND is_required = 1 AND status != 'approved'"
      ).get(id);
      if (notApprovedRequired.cnt > 0) {
        result.message = `有 ${notApprovedRequired.cnt} 个必传附件未审核通过，无法开始办理`;
        auditLog(id, 'batch_status_failed',
          { status: current.status, responsible: currentResponsible },
          { status: 'processing', nurse_name: finalNurseName },
          '批量操作-必传附件未审核通过', `${result.message}，当前责任人: ${currentResponsible}${remarkStr}`, req);
        results.push(result);
        continue;
      }

      const updates = { status, nurse_id: finalNurseId, updated_at: new Date().toISOString(), id };
      db.prepare('UPDATE care_records SET status = @status, nurse_id = @nurse_id, updated_at = @updated_at WHERE id = @id').run(updates);

      const newResponsible = `医生: ${current.doctor_name || '-'}、护士: ${finalNurseName}`;
      const detail = `批量办理: 状态从 ${current.status} 变更为 processing，经办护士: ${finalNurseName}，操作人: ${operatorName}${remarkStr}`;
      auditLog(id, 'batch_status_change',
        { status: current.status, responsible: currentResponsible, nurse_id: current.nurse_id, nurse_name: current.nurse_name },
        { status: 'processing', responsible: newResponsible, nurse_id: finalNurseId, nurse_name: finalNurseName },
        remark || null, detail, req);

      result.success = true;
      result.message = `已分配给 ${finalNurseName} 开始办理`;
      result.nurse_name = finalNurseName;
      result.responsible = newResponsible;
      successIds.push(id);
    }

    if (status === 'reviewing') {
      let finalReviewerId = null;
      let finalReviewerName = null;
      if (req.user.role === 'reviewer') {
        const self = db.prepare('SELECT id, name FROM users WHERE id = ? AND role = ?').get(req.user.id, 'reviewer');
        if (self) { finalReviewerId = self.id; finalReviewerName = self.name; }
      } else if (reviewerInfo) {
        finalReviewerId = reviewerInfo.id;
        finalReviewerName = reviewerInfo.name;
      }
      if (!finalReviewerId) {
        result.message = '缺少复核人，请选择复核员';
        auditLog(id, 'batch_status_failed',
          { status: current.status, responsible: currentResponsible },
          { status: 'reviewing' },
          '批量操作-缺少复核人', `${result.message}，当前责任人: ${currentResponsible}${remarkStr}`, req);
        results.push(result);
        continue;
      }

      const rejectedRequired = db.prepare(
        "SELECT COUNT(*) as cnt FROM attachments WHERE care_record_id = ? AND is_required = 1 AND status = 'rejected'"
      ).get(id);
      if (rejectedRequired.cnt > 0) {
        result.message = `有 ${rejectedRequired.cnt} 个必传附件被驳回，需补正后才能提交复核`;
        auditLog(id, 'batch_status_failed',
          { status: current.status, responsible: currentResponsible },
          { status: 'reviewing', reviewer_name: finalReviewerName },
          '批量操作-必传附件被驳回', `${result.message}，当前责任人: ${currentResponsible}${remarkStr}`, req);
        results.push(result);
        continue;
      }

      const updates = { status, reviewer_id: finalReviewerId, updated_at: new Date().toISOString(), id };
      db.prepare('UPDATE care_records SET status = @status, reviewer_id = @reviewer_id, updated_at = @updated_at WHERE id = @id').run(updates);

      const newResponsible = `医生: ${current.doctor_name || '-'}、护士: ${current.nurse_name || '-'}、复核: ${finalReviewerName}`;
      const detail = `批量提交复核: 状态从 ${current.status} 变更为 reviewing，复核人: ${finalReviewerName}，操作人: ${operatorName}${remarkStr}`;
      auditLog(id, 'batch_status_change',
        { status: current.status, responsible: currentResponsible, reviewer_id: current.reviewer_id, reviewer_name: current.reviewer_name },
        { status: 'reviewing', responsible: newResponsible, reviewer_id: finalReviewerId, reviewer_name: finalReviewerName },
        remark || null, detail, req);

      result.success = true;
      result.message = `已提交 ${finalReviewerName} 复核`;
      result.reviewer_name = finalReviewerName;
      result.responsible = newResponsible;
      successIds.push(id);
    }

    if (status === 'returned') {
      if (!return_reason || !return_reason.trim()) {
        result.message = '退回必须填写原因';
        auditLog(id, 'batch_status_failed',
          { status: current.status, responsible: currentResponsible },
          { status: 'returned' },
          '批量操作-缺少退回原因', `${result.message}，当前责任人: ${currentResponsible}${remarkStr}`, req);
        results.push(result);
        continue;
      }

      const updates = { status, return_reason, updated_at: new Date().toISOString(), id };
      db.prepare('UPDATE care_records SET status = @status, return_reason = @return_reason, updated_at = @updated_at WHERE id = @id').run(updates);

      const responsible = [];
      if (current.nurse_name) responsible.push(`经办护士: ${current.nurse_name}`);
      if (current.reviewer_name) responsible.push(`复核人: ${current.reviewer_name}`);
      const responsibleStr = responsible.length ? responsible.join('、') : '暂无责任人';

      const newResponsible = `退回责任人: ${responsibleStr}`;
      const detail = `批量退回: 状态从 ${current.status} 变更为 returned，退回原因: ${return_reason}，退回责任人: ${responsibleStr}，操作人: ${operatorName}${remarkStr}`;
      auditLog(id, 'batch_status_change',
        { status: current.status, responsible: currentResponsible },
        { status: 'returned', responsible: newResponsible, return_reason },
        return_reason, detail, req);
      auditLog(id, 'returned_recorded',
        { responsible: currentResponsible },
        { responsible: newResponsible, operator: operatorName },
        return_reason,
        `批量退回，退回人: ${operatorName} (${operatorRole})，责任人: ${responsibleStr}，退回原因: ${return_reason}${remarkStr}`, req);

      result.success = true;
      result.message = `已退回，责任人: ${responsibleStr}`;
      result.responsible = newResponsible;
      successIds.push(id);
    }

    if (status === 'archived') {
      let archiverName = operatorName;
      if (req.user.role === 'reviewer') {
        const self = db.prepare('SELECT name FROM users WHERE id = ? AND role = ?').get(req.user.id, 'reviewer');
        if (self) archiverName = self.name;
      }

      const updates = { status, updated_at: new Date().toISOString(), id };
      db.prepare('UPDATE care_records SET status = @status, updated_at = @updated_at WHERE id = @id').run(updates);

      const newResponsible = `归档操作人: ${archiverName}`;
      const detail = `批量归档: 状态从 ${current.status} 变更为 archived，归档操作人: ${archiverName}${remarkStr}`;
      auditLog(id, 'batch_status_change',
        { status: current.status, responsible: currentResponsible },
        { status: 'archived', responsible: newResponsible },
        remark || null, detail, req);

      result.success = true;
      result.message = `已归档 (操作人: ${archiverName})`;
      result.responsible = newResponsible;
      result.archiver_name = archiverName;
      successIds.push(id);
    }

    results.push(result);
  }

  res.json({
    total: ids.length,
    success_count: successIds.length,
    fail_count: ids.length - successIds.length,
    operator: operatorName,
    remark,
    results
  });
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const record = db.prepare(`
    SELECT cr.*,
      d.name as doctor_name, n.name as nurse_name, r.name as reviewer_name
    FROM care_records cr
    LEFT JOIN users d ON cr.doctor_id = d.id
    LEFT JOIN users n ON cr.nurse_id = n.id
    LEFT JOIN users r ON cr.reviewer_id = r.id
    WHERE cr.id = ?
  `).get(req.params.id);

  if (!record) {
    return res.status(404).json({ error: '护理单不存在' });
  }

  const isOverdue = record.deadline && new Date(record.deadline) < new Date() && record.status !== 'archived';

  const attachments = db.prepare(`
    SELECT a.*, u.name as uploader_name, ru.name as attachment_reviewer_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    LEFT JOIN users ru ON a.reviewed_by = ru.id
    WHERE a.care_record_id = ?
    ORDER BY a.created_at
  `).all(req.params.id);

  const medications = db.prepare(`
    SELECT m.*, u.name as administer_name
    FROM medication_records m
    LEFT JOIN users u ON m.administered_by = u.id
    WHERE m.care_record_id = ?
    ORDER BY m.start_time
  `).all(req.params.id);

  const discharges = db.prepare(`
    SELECT dc.*, u1.name as discharger_name, u2.name as confirmer_name
    FROM discharge_confirmations dc
    LEFT JOIN users u1 ON dc.discharged_by = u1.id
    LEFT JOIN users u2 ON dc.confirmed_by = u2.id
    WHERE dc.care_record_id = ?
  `).all(req.params.id);

  const auditLogs = db.prepare(`
    SELECT * FROM audit_logs WHERE care_record_id = ? ORDER BY created_at DESC
  `).all(req.params.id);

  res.json({
    ...record,
    is_overdue: isOverdue ? 1 : 0,
    attachments,
    medications,
    discharges,
    audit_logs: auditLogs
  });
});

router.post('/', requireRole('doctor', 'admin'), (req, res) => {
  const db = getDB();
  const {
    pet_name, species, breed, owner_name, owner_phone,
    admission_date, diagnosis, treatment_plan, priority, ward, bed_number, deadline
  } = req.body;

  const doctorId = req.user.id;

  const result = db.prepare(`
    INSERT INTO care_records (pet_name, species, breed, owner_name, owner_phone,
      admission_date, diagnosis, treatment_plan, status, priority, ward, bed_number, doctor_id, deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'initiated', ?, ?, ?, ?, ?)
  `).run(pet_name, species, breed, owner_name, owner_phone,
    admission_date, diagnosis, treatment_plan, priority || 'normal', ward, bed_number, doctorId, deadline);

  const careRecordId = result.lastInsertRowid;

  auditLog(careRecordId, 'create', null, { pet_name, status: 'initiated' }, null, '创建住院护理单', req);

  const requiredCategories = ['admission_form', 'consent_form'];
  for (const category of requiredCategories) {
    db.prepare(`
      INSERT INTO attachments (care_record_id, file_name, category, is_required, upload_type, status)
      VALUES (?, ?, ?, 1, 'initial', 'pending')
    `).run(careRecordId, `[待上传]${category}`, category);
  }

  res.status(201).json({ id: careRecordId, message: '住院护理单已创建' });
});

router.put('/:id/status', requireRole('doctor', 'nurse', 'reviewer', 'admin'), (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const { status, return_reason, nurse_id, reviewer_id } = req.body;

  const current = db.prepare(`
    SELECT cr.*, d.name as doctor_name, n.name as nurse_name, r.name as reviewer_name
    FROM care_records cr
    LEFT JOIN users d ON cr.doctor_id = d.id
    LEFT JOIN users n ON cr.nurse_id = n.id
    LEFT JOIN users r ON cr.reviewer_id = r.id
    WHERE cr.id = ?
  `).get(id);
  if (!current) {
    return res.status(404).json({ error: '护理单不存在' });
  }

  const transitions = {
    initiated: ['processing'],
    processing: ['reviewing', 'returned', 'overdue'],
    reviewing: ['archived', 'returned'],
    returned: ['processing'],
    overdue: ['processing']
  };

  const roleTransitions = {
    doctor: ['processing'],
    nurse: ['reviewing', 'processing'],
    reviewer: ['archived', 'returned']
  };

  const allowed = transitions[current.status] || [];
  if (!allowed.includes(status) && req.user.role !== 'admin') {
    auditLog(id, 'status_change_failed', current.status, status, '无效的状态转换', `当前状态 ${current.status} 不允许转为 ${status}`, req);
    return res.status(400).json({ error: `不允许从 ${current.status} 转为 ${status}` });
  }

  const roleAllowed = roleTransitions[req.user.role] || [];
  if (!roleAllowed.includes(status) && req.user.role !== 'admin') {
    auditLog(id, 'status_change_failed', current.status, status, `角色 ${req.user.role} 无权执行此状态变更`, `角色 ${req.user.role} 不允许将状态变更为 ${status}`, req);
    return res.status(403).json({ error: `角色 ${req.user.role} 无权将状态变更为 ${status}` });
  }

  const updates = { status };
  let nurseInfo = null;
  let reviewerInfo = null;

  if (status === 'processing') {
    let finalNurseId = null;
    if (req.user.role === 'nurse') {
      finalNurseId = req.user.id;
    } else if (nurse_id) {
      finalNurseId = parseInt(nurse_id);
    }
    if (!finalNurseId) {
      auditLog(id, 'status_change_failed', current.status, status, '缺少经办护士', '进入办理状态必须指定经办护士', req);
      return res.status(400).json({ error: '进入办理状态必须选择经办护士' });
    }
    nurseInfo = db.prepare('SELECT id, name FROM users WHERE id = ? AND role = ?').get(finalNurseId, 'nurse');
    if (!nurseInfo) {
      auditLog(id, 'status_change_failed', current.status, status, '经办护士不存在', `指定的 nurse_id=${finalNurseId} 不是有效护士`, req);
      return res.status(400).json({ error: '选择的经办护士无效' });
    }
    updates.nurse_id = finalNurseId;
  }

  if (status === 'reviewing') {
    let finalReviewerId = null;
    if (req.user.role === 'reviewer') {
      finalReviewerId = req.user.id;
    } else if (reviewer_id) {
      finalReviewerId = parseInt(reviewer_id);
    }
    if (!finalReviewerId) {
      auditLog(id, 'status_change_failed', current.status, status, '缺少复核人', '进入复核状态必须指定复核人', req);
      return res.status(400).json({ error: '进入复核状态必须选择复核人' });
    }
    reviewerInfo = db.prepare('SELECT id, name FROM users WHERE id = ? AND role = ?').get(finalReviewerId, 'reviewer');
    if (!reviewerInfo) {
      auditLog(id, 'status_change_failed', current.status, status, '复核人不存在', `指定的 reviewer_id=${finalReviewerId} 不是有效复核员`, req);
      return res.status(400).json({ error: '选择的复核人无效' });
    }
    updates.reviewer_id = finalReviewerId;
  }

  if (status === 'returned' && return_reason) {
    updates.return_reason = return_reason;
  }

  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  updates.updated_at = new Date().toISOString();
  updates.id = id;

  db.prepare(`UPDATE care_records SET ${setClauses} WHERE id = @id`).run(updates);

  const oldInfo = { status: current.status };
  const newInfo = { status };
  if (updates.nurse_id) {
    oldInfo.nurse_id = current.nurse_id;
    oldInfo.nurse_name = current.nurse_name;
    newInfo.nurse_id = updates.nurse_id;
    newInfo.nurse_name = nurseInfo.name;
  }
  if (updates.reviewer_id) {
    oldInfo.reviewer_id = current.reviewer_id;
    oldInfo.reviewer_name = current.reviewer_name;
    newInfo.reviewer_id = updates.reviewer_id;
    newInfo.reviewer_name = reviewerInfo.name;
  }

  let detail = `状态从 ${current.status} 变更为 ${status}`;
  if (nurseInfo) detail += `，经办护士: ${nurseInfo.name}`;
  if (reviewerInfo) detail += `，复核人: ${reviewerInfo.name}`;
  if (status === 'returned' && return_reason) detail += `，退回原因: ${return_reason}`;

  auditLog(id, 'status_change', oldInfo, newInfo, return_reason, detail, req);

  if (status === 'returned') {
    const responsible = [];
    if (current.nurse_name) responsible.push(`经办护士: ${current.nurse_name}`);
    if (current.reviewer_name) responsible.push(`复核人: ${current.reviewer_name}`);
    const responsibleStr = responsible.length ? responsible.join('、') : '暂无责任人';
    auditLog(id, 'returned_recorded', null, null, return_reason || '未填写',
      `护理单被退回: ${return_reason}，责任人: ${responsibleStr}`, req);
  }
  if (status === 'overdue') {
    const responsible = [];
    if (current.nurse_name) responsible.push(`经办护士: ${current.nurse_name}`);
    if (current.reviewer_name) responsible.push(`复核人: ${current.reviewer_name}`);
    const responsibleStr = responsible.length ? responsible.join('、') : '暂无责任人';
    auditLog(id, 'overdue_recorded', null, null, '超时未处理',
      `护理单超时未处理，责任人: ${responsibleStr}`, req);
  }

  res.json({
    message: '状态已更新',
    nurse_name: nurseInfo ? nurseInfo.name : current.nurse_name,
    reviewer_name: reviewerInfo ? reviewerInfo.name : current.reviewer_name
  });
});

router.put('/:id', requireRole('doctor', 'nurse', 'admin'), (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const fields = req.body;

  const current = db.prepare('SELECT * FROM care_records WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: '护理单不存在' });
  }

  const allowedFields = ['pet_name', 'species', 'breed', 'owner_name', 'owner_phone',
    'diagnosis', 'treatment_plan', 'priority', 'ward', 'bed_number', 'deadline', 'nurse_id'];
  const updates = {};
  for (const key of allowedFields) {
    if (fields[key] !== undefined) {
      updates[key] = fields[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: '没有可更新的字段' });
  }

  updates.updated_at = new Date().toISOString();
  updates.id = id;

  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE care_records SET ${setClauses} WHERE id = @id`).run(updates);

  auditLog(id, 'update', current, updates, null, '更新护理单信息', req);

  res.json({ message: '护理单已更新' });
});

export default router;
