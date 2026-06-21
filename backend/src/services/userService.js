import db from '../db/connection.js';

export function getAllUsers() {
  return db.prepare('SELECT * FROM users ORDER BY id').all();
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function createUser(data) {
  const stmt = db.prepare(`
    INSERT INTO users (username, name, role)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(data.username, data.name, data.role);
  return getUserById(result.lastInsertRowid);
}
