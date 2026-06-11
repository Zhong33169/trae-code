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
  let lastId = null;
  try {
    if (params.length > 0) {
      const stmt = db.prepare(sql);
      stmt.run(params);
      stmt.free();
    } else {
      db.run(sql);
    }
    const rid = db.exec('SELECT last_insert_rowid() as id');
    if (rid.length > 0 && rid[0].values.length > 0) {
      lastId = rid[0].values[0][0];
    }
  } catch (e) {
    throw e;
  }
  save();
  return { changes: db.getRowsModified(), lastInsertRowid: lastId };
}

function execScript(sql) {
  db.run(sql);
  save();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    const obj = stmt.getAsObject();
    row = obj;
  }
  stmt.free();
  return row || null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function lastInsertRowid() {
  const rid = db.exec('SELECT last_insert_rowid() as id');
  if (rid.length > 0 && rid[0].values.length > 0) {
    return rid[0].values[0][0];
  }
  return null;
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
