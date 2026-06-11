const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/supervision.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let _db = null;

class SqlJsStatement {
  constructor(stmt, db) {
    this._stmt = stmt;
    this._db = db;
    this._pluck = false;
    this._asObject = true;
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
    this._stmt.reset();
    return { changes, lastInsertRowid: this._db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0] };
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
}

class SqlJsDb {
  constructor(db) {
    this._db = db;
  }

  exec(sql) {
    this._db.run(sql);
  }

  prepare(sql) {
    const stmt = this._db.prepare(sql);
    return new SqlJsStatement(stmt, this._db);
  }

  getRowsModified() {
    return this._db.getRowsModified();
  }

  pragma(statement) {
    this._db.run(`PRAGMA ${statement.replace(/^pragma\s*/i, '')}`);
  }

  close() {
    this._db.close();
  }

  export() {
    return this._db.export();
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
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  dbInstance.run('PRAGMA foreign_keys = ON');

  _db = new SqlJsDb(dbInstance);

  setInterval(() => {
    try {
      const data = dbInstance.export();
      const buffer = Buffer.from(data);
      const tmpPath = dbPath + '.tmp';
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, dbPath);
    } catch (e) {
      console.error('保存数据库失败:', e.message);
    }
  }, 2000);

  process.on('exit', () => {
    try {
      const data = dbInstance.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch (e) {}
  });

  return _db;
}

function getDb() {
  if (!_db) {
    throw new Error('数据库未初始化，请先调用 initializeDatabase()');
  }
  return _db;
}

function saveDatabase() {
  if (!_db) return;
  try {
    const data = _db.export();
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

const lazyDb = new Proxy({}, {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    }
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
