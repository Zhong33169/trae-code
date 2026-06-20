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
    sql += ` AND cr.nurse_id = ?`;
    params.push(userId);
  } else if (role === 'reviewer' && userId) {
    sql += ` AND cr.reviewer_id = ?`;
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

  const current = db.prepare('SELECT * FROM care_records WHERE id = ?').get(id);
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
  if (status === 'processing' && nurse_id) {
    updates.nurse_id = nurse_id;
  }
  if (status === 'reviewing' && reviewer_id) {
    updates.reviewer_id = reviewer_id;
  }
  if (status === 'returned' && return_reason) {
    updates.return_reason = return_reason;
  }

  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  updates.updated_at = new Date().toISOString();
  updates.id = id;

  db.prepare(`UPDATE care_records SET ${setClauses} WHERE id = @id`).run(updates);

  const detail = return_reason ? `退回原因: ${return_reason}` : `状态从 ${current.status} 变更为 ${status}`;
  auditLog(id, 'status_change', { status: current.status }, { status, return_reason }, null, detail, req);

  if (status === 'returned' || status === 'overdue') {
    auditLog(id, `${status}_recorded`, null, null, return_reason || '超时未处理',
      status === 'returned' ? `护理单被退回: ${return_reason}` : '护理单超时未处理', req);
  }

  res.json({ message: '状态已更新' });
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
