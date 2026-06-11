const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(process.env.DB_PATH || './data/supervision.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let _db = null;
let _rawDb = null;
let _lastInsertRowId = 0;
let _saveTimer = null;

class SqlJsStatement {
  constructor(stmt, db) {
    this._stmt = stmt;
    this._db = db;
    this._pluck = false;
  }

  pluck(enable = true) {
    this._pluck = enable;
    return this;
  }

  run(...params) {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    this._stmt.bind(flatParams);
    this._stmt.step();
    const changes = this._db.getRowsModified();
    _lastInsertRowId = this._db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] || 0;
    this._stmt.reset();
    return { changes, lastInsertRowid: _lastInsertRowId };
  }

  get(...params) {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    this._stmt.bind(flatParams);
    let result = undefined;
    if (this._stmt.step()) {
      if (this._pluck) {
        result = this._stmt.get()[0];
      } else {
        const names = this._stmt.getColumnNames();
        const values = this._stmt.get();
        result = {};
        names.forEach((name, i) => {
          result[name] = values[i];
        });
      }
    }
    this._stmt.reset();
    return result;
  }

  all(...params) {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    this._stmt.bind(flatParams);
    const results = [];
    const names = this._stmt.getColumnNames();
    while (this._stmt.step()) {
      if (this._pluck) {
        results.push(this._stmt.get()[0]);
      } else {
        const values = this._stmt.get();
        const row = {};
        names.forEach((name, i) => {
          row[name] = values[i];
        });
        results.push(row);
      }
    }
    this._stmt.reset();
    return results;
  }

  finalize() {
    if (this._stmt) {
      try { this._stmt.free(); } catch (e) {}
      this._stmt = null;
    }
  }
}

class SqlJsDb {
  constructor(db) {
    this._db = db;
    this._stmtCache = new Map();
  }

  exec(sql) {
    this._db.run(sql);
  }

  prepare(sql) {
    let cached = this._stmtCache.get(sql);
    if (cached) {
      return cached;
    }
    const stmt = this._db.prepare(sql);
    const wrapper = new SqlJsStatement(stmt, this._db);
    this._stmtCache.set(sql, wrapper);
    return wrapper;
  }

  getRowsModified() {
    return this._db.getRowsModified();
  }

  pragma(statement) {
    this._db.run(`PRAGMA ${statement.replace(/^pragma\s*/i, '')}`);
  }

  close() {
    for (const [, stmt] of this._stmtCache) {
      stmt.finalize();
    }
    this._stmtCache.clear();
    this._db.close();
  }

  export() {
    return this._db.export();
  }
}

function saveDatabase() {
  if (!_db || !_rawDb) return false;
  try {
    const data = _rawDb.export();
    const buffer = Buffer.from(data);
    const tmpPath = dbPath + '.tmp';
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, dbPath);
    return true;
  } catch (e) {
    console.error('保存数据库失败:', e.message);
    return false;
  }
}

async function initializeDatabase() {
  if (_db) return _db;

  const sqlJsMain = require.resolve('sql.js');
  const sqlJsRoot = path.resolve(path.dirname(sqlJsMain), '..');
  const SQL = await initSqlJs({
    locateFile: file => path.join(sqlJsRoot, 'dist', file)
  });

  let dbInstance;
  if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
    const fileBuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  dbInstance.run('PRAGMA foreign_keys = ON');

  _rawDb = dbInstance;
  _db = new SqlJsDb(dbInstance);

  if (_saveTimer) clearInterval(_saveTimer);
  _saveTimer = setInterval(() => {
    saveDatabase();
  }, 3000);

  const originalExit = process.emit;
  process.emit = function(event, ...args) {
    if (event === 'exit' || event === 'SIGINT' || event === 'SIGTERM') {
      saveDatabase();
    }
    return originalExit.apply(process, [event, ...args]);
  };
  process.on('exit', () => { saveDatabase(); });

  return _db;
}

function getDb() {
  if (!_db) {
    throw new Error('数据库未初始化，请先调用 initializeDatabase()');
  }
  return _db;
}

const lazyDb = new Proxy({}, {
  get(target, prop) {
    if (prop === 'initializeDatabase') return initializeDatabase;
    if (prop === 'getDb') return getDb;
    if (prop === 'saveDatabase') return saveDatabase;
    if (prop === '__esModule') return false;
    if (prop === 'default') return lazyDb;
    const db = getDb();
    if (typeof db[prop] === 'function') {
      return db[prop].bind(db);
    }
    return db[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  }
});

module.exports = lazyDb;
module.exports.initializeDatabase = initializeDatabase;
module.exports.getDb = getDb;
module.exports.saveDatabase = saveDatabase;
module.exports.default = lazyDb;
