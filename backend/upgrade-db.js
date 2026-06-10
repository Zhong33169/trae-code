const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'morning_check.db');

if (!fs.existsSync(dbPath)) {
  console.log('数据库文件不存在，请先运行 npm run init-db 初始化数据库');
  process.exit(0);
}

const db = new sqlite3.Database(dbPath);

function columnExists(tableName, columnName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows.some(row => row.name === columnName));
    });
  });
}

function tableExists(tableName) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      tableName,
      (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      }
    );
  });
}

async function upgrade() {
  console.log('开始升级数据库...');

  const hasAbnormalBy = await columnExists('morning_check_records', 'abnormal_by');
  if (!hasAbnormalBy) {
    await new Promise((resolve, reject) => {
      db.run(`ALTER TABLE morning_check_records ADD COLUMN abnormal_by INTEGER`, err => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✓ 新增 morning_check_records.abnormal_by 字段');
  } else {
    console.log('○ morning_check_records.abnormal_by 已存在');
  }

  const hasBatchId = await columnExists('operation_logs', 'batch_id');
  if (!hasBatchId) {
    await new Promise((resolve, reject) => {
      db.run(`ALTER TABLE operation_logs ADD COLUMN batch_id INTEGER`, err => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✓ 新增 operation_logs.batch_id 字段');
  } else {
    console.log('○ operation_logs.batch_id 已存在');
  }

  const hasBatchBatches = await tableExists('batch_batches');
  if (!hasBatchBatches) {
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE batch_batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_no TEXT UNIQUE NOT NULL,
          batch_type TEXT NOT NULL,
          total_count INTEGER NOT NULL DEFAULT 0,
          success_count INTEGER NOT NULL DEFAULT 0,
          fail_count INTEGER NOT NULL DEFAULT 0,
          operator_id INTEGER NOT NULL,
          operator_name TEXT NOT NULL,
          operator_role TEXT NOT NULL,
          remark TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, err => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✓ 新增 batch_batches 表');
  } else {
    console.log('○ batch_batches 表已存在');
  }

  const hasBatchDetails = await tableExists('batch_details');
  if (!hasBatchDetails) {
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE batch_details (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id INTEGER NOT NULL,
          record_id INTEGER NOT NULL,
          child_id INTEGER,
          child_name TEXT,
          result TEXT NOT NULL,
          error_message TEXT,
          from_status TEXT,
          to_status TEXT,
          abnormal_reason TEXT,
          responsible_role TEXT,
          remark TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (batch_id) REFERENCES batch_batches(id),
          FOREIGN KEY (record_id) REFERENCES morning_check_records(id)
        )
      `, err => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✓ 新增 batch_details 表');
  } else {
    console.log('○ batch_details 表已存在');
  }

  const hasBatchNoIdx = await new Promise(resolve => {
    db.get(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_batch_no'`, (err, row) => {
      resolve(!!row);
    });
  });
  if (!hasBatchNoIdx) {
    await new Promise((resolve, reject) => {
      db.run(`CREATE INDEX IF NOT EXISTS idx_batch_no ON batch_batches(batch_no)`, err => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✓ 新增 idx_batch_no 索引');
  }

  const hasBatchTypeIdx = await new Promise(resolve => {
    db.get(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_batch_type'`, (err, row) => {
      resolve(!!row);
    });
  });
  if (!hasBatchTypeIdx) {
    await new Promise((resolve, reject) => {
      db.run(`CREATE INDEX IF NOT EXISTS idx_batch_type ON batch_batches(batch_type)`, err => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✓ 新增 idx_batch_type 索引');
  }

  const hasBatchDetailsBatchIdx = await new Promise(resolve => {
    db.get(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_batch_details_batch'`, (err, row) => {
      resolve(!!row);
    });
  });
  if (!hasBatchDetailsBatchIdx) {
    await new Promise((resolve, reject) => {
      db.run(`CREATE INDEX IF NOT EXISTS idx_batch_details_batch ON batch_details(batch_id)`, err => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✓ 新增 idx_batch_details_batch 索引');
  }

  const hasBatchDetailsRecordIdx = await new Promise(resolve => {
    db.get(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_batch_details_record'`, (err, row) => {
      resolve(!!row);
    });
  });
  if (!hasBatchDetailsRecordIdx) {
    await new Promise((resolve, reject) => {
      db.run(`CREATE INDEX IF NOT EXISTS idx_batch_details_record ON batch_details(record_id)`, err => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✓ 新增 idx_batch_details_record 索引');
  }

  const hasLogsBatchIdx = await new Promise(resolve => {
    db.get(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_logs_batch'`, (err, row) => {
      resolve(!!row);
    });
  });
  if (!hasLogsBatchIdx) {
    await new Promise((resolve, reject) => {
      db.run(`CREATE INDEX IF NOT EXISTS idx_logs_batch ON operation_logs(batch_id)`, err => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✓ 新增 idx_logs_batch 索引');
  }

  console.log('');
  console.log('✓ 数据库升级完成！');

  db.close();
}

upgrade().catch(err => {
  console.error('升级失败:', err.message);
  db.close();
  process.exit(1);
});
