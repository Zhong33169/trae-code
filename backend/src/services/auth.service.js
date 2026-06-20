const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');

function login(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return { ok: false, code: 401, message: '用户名或密码错误' };
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return { ok: false, code: 401, message: '用户名或密码错误' };
  }
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return {
    ok: true,
    token,
    user: { id: user.id, username: user.username, real_name: user.real_name, role: user.role }
  };
}

function listUsers() {
  return db.prepare('SELECT id, username, real_name, role FROM users ORDER BY id').all();
}

module.exports = { login, listUsers };
