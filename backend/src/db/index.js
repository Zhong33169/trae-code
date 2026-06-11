const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const config = require('../config');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;
let SQL = null;

function save() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.dbPath, buffer);
}

async function initDB() {
  if (db) return db;
  SQL = await initSqlJs();
  if (fs.existsSync(config.dbPath)) {
    const fileBuffer = fs.readFileSync(config.dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    save();
  }
  return db;
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let result;
  try {
    result = stmt.step();
    stmt.free();
  } catch (e) {
    stmt.free();
    throw e;
  }
  save();
  return { changes: db.getRowsModified() };
}

function execScript(sql) {
  db.run(sql);
  save();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row || null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function lastInsertRowid() {
  const row = get('SELECT last_insert_rowid() as id');
  return row?.id;
}

module.exports = {
  initDB,
  save,
  run,
  get,
  all,
  execScript,
  lastInsertRowid
};
