const { getDb } = require('../db');

const getUserById = async (userId) => {
  const db = await getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
};

const getUsersByRole = async (role) => {
  const db = await getDb();
  return db.prepare('SELECT * FROM users WHERE role = ?').all(role);
};

const getAllUsers = async () => {
  const db = await getDb();
  return db.prepare('SELECT * FROM users').all();
};

module.exports = {
  getUserById,
  getUsersByRole,
  getAllUsers
};
