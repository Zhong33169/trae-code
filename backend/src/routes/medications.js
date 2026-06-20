import { Router } from 'express';
import { getDB } from '../models/database.js';
import { requireRole, auditLog } from '../middleware/auth.js';

const router = Router();

router.get('/:careRecordId', (req, res) => {
  const db = getDB();
  const medications = db.prepare(`
    SELECT m.*, u.name as administer_name
    FROM medication_records m
    LEFT JOIN users u ON m.administered_by = u.id
    WHERE m.care_record_id = ?
    ORDER BY m.start_time
  `).all(req.params.careRecordId);
  res.json(medications);
});

router.post('/:careRecordId', requireRole('nurse', 'doctor', 'admin'), (req, res) => {
  const db = getDB();
  const { careRecordId } = req.params;
  const {
    medicine_name, dosage, route, frequency, start_time, end_time, notes
  } = req.body;

  const result = db.prepare(`
    INSERT INTO medication_records (care_record_id, medicine_name, dosage, route, frequency, start_time, end_time, administered_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(careRecordId, medicine_name, dosage, route, frequency, start_time, end_time, req.user.id, notes);

  auditLog(careRecordId, 'add_medication', null, { medicine_name, dosage }, null, `添加用药记录: ${medicine_name} ${dosage}`, req);

  db.prepare('UPDATE care_records SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), careRecordId);

  res.status(201).json({ id: result.lastInsertRowid, message: '用药记录已添加' });
});

router.put('/:id', requireRole('nurse', 'doctor', 'admin'), (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const fields = req.body;

  const current = db.prepare('SELECT * FROM medication_records WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: '用药记录不存在' });
  }

  const allowedFields = ['medicine_name', 'dosage', 'route', 'frequency', 'end_time', 'notes', 'status'];
  const updates = {};
  for (const key of allowedFields) {
    if (fields[key] !== undefined) {
      updates[key] = fields[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: '没有可更新的字段' });
  }

  updates.id = id;
  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE medication_records SET ${setClauses} WHERE id = @id`).run(updates);

  auditLog(current.care_record_id, 'update_medication', current, updates, null, `更新用药记录: ${current.medicine_name}`, req);

  res.json({ message: '用药记录已更新' });
});

export default router;
