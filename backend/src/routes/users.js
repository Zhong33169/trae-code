import { Router } from 'express';
import { getDB } from '../models/database.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDB();
  const users = db.prepare('SELECT id, username, name, role, created_at FROM users').all();
  res.json(users);
});

router.post('/login', (req, res) => {
  const db = getDB();
  const { username } = req.body;
  const user = db.prepare('SELECT id, username, name, role FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json(user);
});

export default router;
