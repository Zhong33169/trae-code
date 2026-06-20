import { Router } from 'express';
import { getDB } from '../models/database.js';
import { requireRole, auditLog } from '../middleware/auth.js';

const router = Router();

router.get('/:careRecordId', (req, res) => {
  const db = getDB();
  const discharges = db.prepare(`
    SELECT dc.*, u1.name as discharger_name, u2.name as confirmer_name
    FROM discharge_confirmations dc
    LEFT JOIN users u1 ON dc.discharged_by = u1.id
    LEFT JOIN users u2 ON dc.confirmed_by = u2.id
    WHERE dc.care_record_id = ?
  `).all(req.params.careRecordId);
  res.json(discharges);
});

router.post('/:careRecordId', requireRole('doctor', 'admin'), (req, res) => {
  const db = getDB();
  const { careRecordId } = req.params;
  const {
    discharge_date, discharge_summary, follow_up, condition_at_discharge
  } = req.body;

  const result = db.prepare(`
    INSERT INTO discharge_confirmations (care_record_id, discharge_date, discharge_summary, follow_up, condition_at_discharge, discharged_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(careRecordId, discharge_date, discharge_summary, follow_up, condition_at_discharge, req.user.id);

  auditLog(careRecordId, 'create_discharge', null, { discharge_date, discharge_summary }, null, '创建出院确认', req);

  res.status(201).json({ id: result.lastInsertRowid, message: '出院确认已创建' });
});

router.put('/:id/confirm', requireRole('reviewer', 'admin'), (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const { status, reject_reason } = req.body;

  const current = db.prepare('SELECT * FROM discharge_confirmations WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: '出院确认不存在' });
  }

  db.prepare(`
    UPDATE discharge_confirmations SET status = ?, confirmed_by = ?, confirmed_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(status, req.user.id, id);

  if (status === 'confirmed') {
    db.prepare("UPDATE care_records SET status = 'archived', updated_at = datetime('now', 'localtime') WHERE id = ?").run(current.care_record_id);
    auditLog(current.care_record_id, 'discharge_confirmed', { status: 'pending' }, { status: 'confirmed' }, null, '出院确认已通过，护理单归档', req);
  } else {
    auditLog(current.care_record_id, 'discharge_rejected', { status: 'pending' }, { status: 'rejected' }, reject_reason, `出院确认被驳回: ${reject_reason}`, req);
  }

  res.json({ message: '出院确认已处理' });
});

export default router;
