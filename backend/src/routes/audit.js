import { Router } from 'express';
import { getDB } from '../models/database.js';

const router = Router();

router.get('/care-record/:careRecordId', (req, res) => {
  const db = getDB();
  const logs = db.prepare(`
    SELECT * FROM audit_logs WHERE care_record_id = ? ORDER BY created_at DESC
  `).all(req.params.careRecordId);
  res.json(logs);
});

router.get('/', (req, res) => {
  const db = getDB();
  const { action, actor_role, start_date, end_date, keyword } = req.query;

  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }
  if (actor_role) {
    sql += ' AND actor_role = ?';
    params.push(actor_role);
  }
  if (start_date) {
    sql += ' AND created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND created_at <= ?';
    params.push(end_date);
  }
  if (keyword) {
    sql += ' AND (detail LIKE ? OR reason LIKE ? OR actor_name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  sql += ' ORDER BY created_at DESC LIMIT 200';

  const logs = db.prepare(sql).all(...params);
  res.json(logs);
});

export default router;
