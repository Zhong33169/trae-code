const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let dbInstance = null;
let initPromise = null;

const getDb = async () => {
  if (dbInstance) return dbInstance;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs();
    const dbPath = config.db.path;
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    let db;
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    const originalRun = db.run.bind(db);
    const originalPrepare = db.prepare.bind(db);

    db.saveToDisk = () => {
      const data = db.export();
      const buffer = Buffer.from(data);
      const tmpPath = dbPath + '.tmp';
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, dbPath);
    };

    db.prepare = (sql) => {
      const stmt = originalPrepare(sql);
      const nativeGet = stmt.get.bind(stmt);
      const nativeGetColumnNames = stmt.getColumnNames.bind(stmt);

      const rowToObject = (row) => {
        if (!row) return null;
        const columns = nativeGetColumnNames();
        const obj = {};
        for (let i = 0; i < columns.length; i++) {
          obj[columns[i]] = row[i];
        }
        return obj;
      };

      stmt.run = function(...params) {
        this.bind(params.flat());
        this.step();
        this.reset();
        return { changes: db.getRowsModified?.() || 0 };
      };

      stmt.get = function(...params) {
        this.bind(params.flat());
        let result = null;
        if (this.step()) {
          result = rowToObject(nativeGet());
        }
        this.reset();
        return result;
      };

      stmt.all = function(...params) {
        this.bind(params.flat());
        const rows = [];
        while (this.step()) {
          rows.push(rowToObject(nativeGet()));
        }
        this.reset();
        return rows;
      };

      return stmt;
    };

    db.exec = (sql) => {
      originalRun(sql);
    };

    db.pragma = (statement) => {
      db.run(`PRAGMA ${statement}`);
    };

    db.transaction = (fn) => {
      return function(...args) {
        db.run('BEGIN');
        try {
          const result = fn.apply(this, args);
          db.run('COMMIT');
          db.saveToDisk();
          return result;
        } catch (e) {
          db.run('ROLLBACK');
          throw e;
        }
      };
    };

    dbInstance = db;
    return db;
  })();

  return initPromise;
};

module.exports = { getDb };
