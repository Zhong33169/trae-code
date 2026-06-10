const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const JWT_SECRET = 'morning_check_secret_key_2024';
const PORT = process.env.PORT || 3001;

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'morning_check.db');
const dbExists = fs.existsSync(dbPath);
const db = new sqlite3.Database(dbPath);

const originalRun = db.run.bind(db);

function dbRun(sql, ...params) {
  return new Promise((resolve, reject) => {
    originalRun(sql, ...params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

db.run = dbRun;
db.get = promisify(db.get.bind(db));
db.all = promisify(db.all.bind(db));
db.exec = promisify(db.exec.bind(db));

async function columnExists(tableName, columnName) {
  const rows = await db.all(`PRAGMA table_info(${tableName})`);
  return rows.some(row => row.name === columnName);
}

async function tableExists(tableName) {
  const row = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, tableName);
  return !!row;
}

async function upgradeDatabase() {
  console.log('检查数据库结构...');

  const hasAbnormalBy = await columnExists('morning_check_records', 'abnormal_by');
  if (!hasAbnormalBy) {
    await db.run(`ALTER TABLE morning_check_records ADD COLUMN abnormal_by INTEGER`);
    console.log('  ✓ 新增 morning_check_records.abnormal_by');
  }

  const hasBatchId = await columnExists('operation_logs', 'batch_id');
  if (!hasBatchId) {
    await db.run(`ALTER TABLE operation_logs ADD COLUMN batch_id INTEGER`);
    console.log('  ✓ 新增 operation_logs.batch_id');
  }

  const hasBatchBatches = await tableExists('batch_batches');
  if (!hasBatchBatches) {
    await db.run(`
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
    `);
    console.log('  ✓ 新增 batch_batches 表');
  }

  const hasBatchDetails = await tableExists('batch_details');
  if (!hasBatchDetails) {
    await db.run(`
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ 新增 batch_details 表');
  }

  const hasBatchNoIdx = await db.get(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_batch_no'`);
  if (!hasBatchNoIdx) {
    await db.run(`CREATE INDEX IF NOT EXISTS idx_batch_no ON batch_batches(batch_no)`);
    console.log('  ✓ 新增 idx_batch_no 索引');
  }

  const hasLogsBatchIdx = await db.get(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_logs_batch'`);
  if (!hasLogsBatchIdx) {
    await db.run(`CREATE INDEX IF NOT EXISTS idx_logs_batch ON operation_logs(batch_id)`);
    console.log('  ✓ 新增 idx_logs_batch 索引');
  }

  console.log('数据库结构检查完成。');
}

const app = express();
app.use(cors());
app.use(express.json());

const NODE_TIMEOUTS = {
  registration: 30 * 60 * 1000,
  audit: 60 * 60 * 1000,
  review: 120 * 60 * 1000,
};

const NODE_NAMES = {
  registration: '登记节点',
  audit: '审核节点',
  review: '复核节点',
  completed: '已完成',
};

const STATUS_NAMES = {
  pending_registration: '待登记',
  pending_audit: '待审核',
  pending_correction: '待补正',
  pending_review: '待复核',
  archived: '已归档',
};

const ROLE_NAMES = {
  registrar: '晨检登记员',
  auditor: '晨检审核主管',
  reviewer: '幼儿园复核负责人',
};

const RECORD_FIELDS_WHITELIST = {
  base: ['id', 'child_id', 'child_name', 'child_gender', 'birth_date', 'class_name', 'guardian_name', 'guardian_phone', 'child_health_status', 'check_date', 'status', 'status_name', 'current_node', 'current_node_name', 'timeout', 'abnormal_reason', 'abnormal_by_name', 'available_actions', 'operation_logs', 'responsible_role', 'responsible_role_name', 'responsible_user_name', 'responsible_action_tip', 'created_at', 'updated_at'],
  registrar: ['temperature', 'mental_status', 'skin_condition', 'throat_condition', 'hand_foot_condition', 'other_symptoms', 'registration_note', 'registered_by', 'registered_at'],
  auditor: ['temperature', 'mental_status', 'skin_condition', 'throat_condition', 'hand_foot_condition', 'other_symptoms', 'registration_note', 'audit_note', 'registered_by', 'audited_by', 'registered_at', 'audit_submitted_at', 'audit_completed_at'],
  reviewer: ['temperature', 'mental_status', 'skin_condition', 'throat_condition', 'hand_foot_condition', 'other_symptoms', 'registration_note', 'audit_note', 'review_note', 'registered_by', 'audited_by', 'reviewed_by', 'registered_at', 'audit_submitted_at', 'audit_completed_at', 'review_submitted_at', 'review_completed_at'],
};

function filterRecordFields(record, role) {
  const allowedFields = [
    ...RECORD_FIELDS_WHITELIST.base,
    ...RECORD_FIELDS_WHITELIST[role] || [],
  ];
  const filtered = {};
  allowedFields.forEach(field => {
    if (record.hasOwnProperty(field)) {
      filtered[field] = record[field];
    }
  });
  return filtered;
}

function filterRecordList(list, role) {
  return list.map(record => filterRecordFields(record, role));
}

const VALID_ACTIONS = {
  registrar: {
    pending_registration: ['submit_audit'],
    pending_correction: ['submit_audit'],
  },
  auditor: {
    pending_audit: ['audit_pass', 'audit_reject'],
  },
  reviewer: {
    pending_review: ['review_pass', 'review_reject'],
  },
};

function canPerformAction(role, status, action) {
  return VALID_ACTIONS[role]?.[status]?.includes(action) || false;
}

const ACTION_NAMES = {
  submit_audit: '提交审核',
  audit_pass: '审核通过',
  audit_reject: '退回补正',
  review_pass: '复核归档',
  review_reject: '退回重审',
};

function calculateTimeout(record) {
  const now = Date.now();
  const { current_node } = record;
  const timeoutMs = NODE_TIMEOUTS[current_node];
  if (!timeoutMs) return { isTimeout: false, remainingMs: 0, overdueMs: 0, nodeName: NODE_NAMES[current_node] || current_node };

  let nodeStartTime = null;
  if (current_node === 'registration') {
    nodeStartTime = record.registered_at || record.created_at;
  } else if (current_node === 'audit') {
    nodeStartTime = record.audit_submitted_at;
  } else if (current_node === 'review') {
    nodeStartTime = record.review_submitted_at;
  }

  if (!nodeStartTime) return { isTimeout: false, remainingMs: timeoutMs, overdueMs: 0, nodeName: NODE_NAMES[current_node] || current_node };

  const startTimeMs = new Date(nodeStartTime).getTime();
  const deadlineMs = startTimeMs + timeoutMs;
  const remainingMs = deadlineMs - now;

  return {
    isTimeout: remainingMs < 0,
    remainingMs: Math.max(0, remainingMs),
    overdueMs: Math.max(0, -remainingMs),
    deadline: new Date(deadlineMs).toISOString(),
    nodeName: NODE_NAMES[current_node] || current_node,
  };
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: '无权限执行此操作' });
    }
    next();
  };
}

async function addOperationLog(recordId, userId, userName, userRole, action, fromStatus, toStatus, note, batchId = null) {
  await db.run(
    `INSERT INTO operation_logs (record_id, batch_id, user_id, user_name, user_role, action, from_status, to_status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    recordId, batchId, userId, userName, userRole, action, fromStatus, toStatus, note || ''
  );
}

function nowIso() {
  return new Date().toISOString();
}

function generateBatchNo(type) {
  const prefix = type === 'audit' ? 'BATCH-AUD' : 'BATCH-REV';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${dateStr}-${random}`;
}

async function createBatch(batchNo, batchType, totalCount, operatorId, operatorName, operatorRole, remark = '') {
  const result = await db.run(
    `INSERT INTO batch_batches (batch_no, batch_type, total_count, success_count, fail_count, operator_id, operator_name, operator_role, remark)
     VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)`,
    batchNo, batchType, totalCount, operatorId, operatorName, operatorRole, remark || ''
  );
  return result.lastID;
}

async function addBatchDetail(batchId, recordId, childId, childName, result, errorMessage, fromStatus, toStatus, abnormalReason, responsibleRole, remark) {
  await db.run(
    `INSERT INTO batch_details (batch_id, record_id, child_id, child_name, result, error_message, from_status, to_status, abnormal_reason, responsible_role, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    batchId, recordId, childId, childName, result, errorMessage || null, fromStatus || null, toStatus || null, abnormalReason || null, responsibleRole || null, remark || ''
  );
}

async function updateBatchCounts(batchId, successCount, failCount) {
  await db.run(
    `UPDATE batch_batches SET success_count = ?, fail_count = ? WHERE id = ?`,
    successCount, failCount, batchId
  );
}

function getResponsibleRole(currentNode, status) {
  if (status === 'pending_correction') return 'registrar';
  if (currentNode === 'registration') return 'registrar';
  if (currentNode === 'audit') return 'auditor';
  if (currentNode === 'review') return 'reviewer';
  return null;
}

const RESPONSIBLE_ACTION_TIPS = {
  registrar: '请及时完成晨检登记或补正',
  auditor: '请及时完成审核',
  reviewer: '请及时完成复核归档',
};

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const user = await db.get('SELECT * FROM users WHERE username = ?', username);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        roleName: ROLE_NAMES[user.role],
      },
    });
  } catch (err) {
    res.status(500).json({ error: '登录失败：' + err.message });
  }
});

app.get('/api/children', authenticate, async (req, res) => {
  try {
    const { keyword, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    let where = '';
    let params = [];
    if (keyword) {
      where = 'WHERE name LIKE ? OR class_name LIKE ? OR guardian_name LIKE ?';
      params = [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`];
    }

    const totalRow = await db.get(`SELECT COUNT(*) as count FROM children ${where}`, ...params);
    const list = await db.all(
      `SELECT * FROM children ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      ...params, parseInt(pageSize), offset
    );

    res.json({ list, total: totalRow.count, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    res.status(500).json({ error: '获取幼儿档案失败：' + err.message });
  }
});

app.get('/api/children/:id', authenticate, async (req, res) => {
  try {
    const child = await db.get('SELECT * FROM children WHERE id = ?', req.params.id);
    if (!child) {
      return res.status(404).json({ error: '幼儿档案不存在' });
    }
    res.json(child);
  } catch (err) {
    res.status(500).json({ error: '获取幼儿档案失败：' + err.message });
  }
});

app.post('/api/children', authenticate, requireRole('registrar', 'reviewer'), async (req, res) => {
  try {
    const { name, gender, birth_date, class_name, guardian_name, guardian_phone, health_status } = req.body;
    if (!name || !class_name) {
      return res.status(400).json({ error: '幼儿姓名和班级为必填项' });
    }

    const result = await db.run(
      `INSERT INTO children (name, gender, birth_date, class_name, guardian_name, guardian_phone, health_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      name, gender || null, birth_date || null, class_name, guardian_name || null, guardian_phone || null, health_status || '正常'
    );

    res.json({ id: result.lastID, message: '幼儿档案创建成功' });
  } catch (err) {
    res.status(500).json({ error: '创建幼儿档案失败：' + err.message });
  }
});

app.put('/api/children/:id', authenticate, requireRole('registrar', 'reviewer'), async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM children WHERE id = ?', req.params.id);
    if (!existing) {
      return res.status(404).json({ error: '幼儿档案不存在' });
    }

    const { name, gender, birth_date, class_name, guardian_name, guardian_phone, health_status } = req.body;

    await db.run(
      `UPDATE children SET name = ?, gender = ?, birth_date = ?, class_name = ?, guardian_name = ?, guardian_phone = ?, health_status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      name || existing.name,
      gender !== undefined ? gender : existing.gender,
      birth_date !== undefined ? birth_date : existing.birth_date,
      class_name || existing.class_name,
      guardian_name !== undefined ? guardian_name : existing.guardian_name,
      guardian_phone !== undefined ? guardian_phone : existing.guardian_phone,
      health_status !== undefined ? health_status : existing.health_status,
      req.params.id
    );

    res.json({ message: '幼儿档案更新成功' });
  } catch (err) {
    res.status(500).json({ error: '更新幼儿档案失败：' + err.message });
  }
});

app.get('/api/records', authenticate, async (req, res) => {
  try {
    const { status, child_name, check_date, page = 1, pageSize = 20, queue = '0' } = req.query;
    const offset = (page - 1) * pageSize;
    const userRole = req.user.role;

    let whereClauses = [];
    let params = [];

    if (queue === '1') {
      if (userRole === 'registrar') {
        whereClauses.push('r.status IN (?, ?)');
        params.push('pending_registration', 'pending_correction');
      } else if (userRole === 'auditor') {
        whereClauses.push('r.status = ?');
        params.push('pending_audit');
      } else if (userRole === 'reviewer') {
        whereClauses.push('r.status = ?');
        params.push('pending_review');
      }
    }

    if (status) {
      whereClauses.push('r.status = ?');
      params.push(status);
    }

    if (check_date) {
      whereClauses.push('r.check_date = ?');
      params.push(check_date);
    }

    if (child_name) {
      whereClauses.push('c.name LIKE ?');
      params.push(`%${child_name}%`);
    }

    const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const totalRow = await db.get(
      `SELECT COUNT(*) as count
       FROM morning_check_records r
       JOIN children c ON r.child_id = c.id
       ${where}`,
      ...params
    );

    const list = await db.all(
      `SELECT r.*, c.name as child_name, c.class_name, c.health_status as child_health_status
       FROM morning_check_records r
       JOIN children c ON r.child_id = c.id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      ...params, parseInt(pageSize), offset
    );

    const recordsWithTimeout = list.map(record => {
      const timeout = calculateTimeout(record);
      return {
        ...record,
        status_name: STATUS_NAMES[record.status] || record.status,
        current_node_name: NODE_NAMES[record.current_node] || record.current_node,
        timeout,
      };
    });

    const filteredList = filterRecordList(recordsWithTimeout, userRole);

    res.json({ list: filteredList, total: totalRow.count, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    res.status(500).json({ error: '获取晨检记录失败：' + err.message });
  }
});

app.get('/api/records/:id', authenticate, async (req, res) => {
  try {
    const record = await db.get(
      `SELECT r.*, c.name as child_name, c.gender as child_gender, c.birth_date, c.class_name,
              c.guardian_name, c.guardian_phone, c.health_status as child_health_status
       FROM morning_check_records r
       JOIN children c ON r.child_id = c.id
       WHERE r.id = ?`,
      req.params.id
    );

    if (!record) {
      return res.status(404).json({ error: '晨检记录不存在' });
    }

    const userRole = req.user.role;
    const timeout = calculateTimeout(record);
    const logs = await db.all(
      `SELECT * FROM operation_logs WHERE record_id = ? ORDER BY created_at DESC`,
      req.params.id
    );

    let availableActions = [];
    if (VALID_ACTIONS[userRole]?.[record.status]) {
      availableActions = VALID_ACTIONS[userRole][record.status].map(action => ({
        action,
        name: ACTION_NAMES[action] || action,
      }));
    }

    let abnormalByName = null;
    if (record.abnormal_by) {
      const abUser = await db.get('SELECT name FROM users WHERE id = ?', record.abnormal_by);
      if (abUser) abnormalByName = abUser.name;
    }

    const responsibleRole = getResponsibleRole(record.current_node, record.status);
    let responsibleUserName = null;
    if (responsibleRole === 'registrar' && record.registered_by) {
      const u = await db.get('SELECT name FROM users WHERE id = ?', record.registered_by);
      if (u) responsibleUserName = u.name;
    } else if (responsibleRole === 'auditor' && record.audited_by) {
      const u = await db.get('SELECT name FROM users WHERE id = ?', record.audited_by);
      if (u) responsibleUserName = u.name;
    } else if (responsibleRole === 'reviewer' && record.reviewed_by) {
      const u = await db.get('SELECT name FROM users WHERE id = ?', record.reviewed_by);
      if (u) responsibleUserName = u.name;
    }

    const fullRecord = {
      ...record,
      status_name: STATUS_NAMES[record.status] || record.status,
      current_node_name: NODE_NAMES[record.current_node] || record.current_node,
      timeout,
      operation_logs: logs,
      available_actions: availableActions,
      abnormal_by_name: abnormalByName,
      responsible_role: responsibleRole,
      responsible_role_name: ROLE_NAMES[responsibleRole] || responsibleRole,
      responsible_user_name: responsibleUserName,
      responsible_action_tip: RESPONSIBLE_ACTION_TIPS[responsibleRole] || '',
    };

    const filteredRecord = filterRecordFields(fullRecord, userRole);

    res.json(filteredRecord);
  } catch (err) {
    res.status(500).json({ error: '获取晨检记录详情失败：' + err.message });
  }
});

app.post('/api/records', authenticate, requireRole('registrar'), async (req, res) => {
  try {
    const { child_id, check_date, temperature, mental_status, skin_condition, throat_condition, hand_foot_condition, other_symptoms, registration_note } = req.body;

    if (!child_id || !check_date) {
      return res.status(400).json({ error: '幼儿和检查日期为必填项' });
    }

    const child = await db.get('SELECT * FROM children WHERE id = ?', child_id);
    if (!child) {
      return res.status(404).json({ error: '幼儿档案不存在' });
    }

    const existing = await db.get(
      `SELECT * FROM morning_check_records WHERE child_id = ? AND check_date = ?`,
      child_id, check_date
    );
    if (existing) {
      return res.status(400).json({ error: '该幼儿今日已存在晨检记录' });
    }

    const now = nowIso();
    const result = await db.run(
      `INSERT INTO morning_check_records (child_id, check_date, status, current_node, temperature, mental_status, skin_condition, throat_condition, hand_foot_condition, other_symptoms, registration_note, registered_by, registered_at)
       VALUES (?, ?, 'pending_registration', 'registration', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      child_id, check_date, temperature || null, mental_status || null, skin_condition || null, throat_condition || null, hand_foot_condition || null, other_symptoms || null, registration_note || null, req.user.id, now
    );

    const recordId = result.lastID;
    await addOperationLog(recordId, req.user.id, req.user.name, req.user.role, '创建晨检记录', null, 'pending_registration', registration_note || '');

    res.json({ id: recordId, message: '晨检记录创建成功' });
  } catch (err) {
    res.status(500).json({ error: '创建晨检记录失败：' + err.message });
  }
});

app.put('/api/records/:id/submit-audit', authenticate, requireRole('registrar'), async (req, res) => {
  try {
    const record = await db.get('SELECT * FROM morning_check_records WHERE id = ?', req.params.id);
    if (!record) {
      return res.status(404).json({ error: '晨检记录不存在' });
    }

    if (!canPerformAction(req.user.role, record.status, 'submit_audit')) {
      return res.status(400).json({ error: `当前状态为「${STATUS_NAMES[record.status]}」，不能提交审核` });
    }

    const { temperature, mental_status, skin_condition, throat_condition, hand_foot_condition, other_symptoms, registration_note } = req.body;
    const now = nowIso();

    await db.run(
      `UPDATE morning_check_records
       SET status = 'pending_audit', current_node = 'audit', temperature = ?, mental_status = ?, skin_condition = ?, throat_condition = ?, hand_foot_condition = ?, other_symptoms = ?, registration_note = ?, audit_submitted_at = ?, updated_at = ?
       WHERE id = ?`,
      temperature !== undefined ? temperature : record.temperature,
      mental_status !== undefined ? mental_status : record.mental_status,
      skin_condition !== undefined ? skin_condition : record.skin_condition,
      throat_condition !== undefined ? throat_condition : record.throat_condition,
      hand_foot_condition !== undefined ? hand_foot_condition : record.hand_foot_condition,
      other_symptoms !== undefined ? other_symptoms : record.other_symptoms,
      registration_note !== undefined ? registration_note : record.registration_note,
      now, now, req.params.id
    );

    const fromStatus = record.status;
    await addOperationLog(req.params.id, req.user.id, req.user.name, req.user.role, '提交审核', fromStatus, 'pending_audit', '');

    res.json({ message: '已提交审核，等待审核主管处理' });
  } catch (err) {
    res.status(500).json({ error: '提交审核失败：' + err.message });
  }
});

app.put('/api/records/:id/audit-pass', authenticate, requireRole('auditor'), async (req, res) => {
  try {
    const record = await db.get('SELECT * FROM morning_check_records WHERE id = ?', req.params.id);
    if (!record) {
      return res.status(404).json({ error: '晨检记录不存在' });
    }

    if (!canPerformAction(req.user.role, record.status, 'audit_pass')) {
      return res.status(400).json({ error: `当前状态为「${STATUS_NAMES[record.status]}」，不能执行审核通过` });
    }

    const { audit_note } = req.body;
    const now = nowIso();

    await db.run(
      `UPDATE morning_check_records
       SET status = 'pending_review', current_node = 'review', audit_note = ?, audited_by = ?, audit_completed_at = ?, review_submitted_at = ?, updated_at = ?
       WHERE id = ?`,
      audit_note || null, req.user.id, now, now, now, req.params.id
    );

    await addOperationLog(req.params.id, req.user.id, req.user.name, req.user.role, '审核通过', 'pending_audit', 'pending_review', audit_note || '');

    res.json({ message: '审核通过，已提交复核' });
  } catch (err) {
    res.status(500).json({ error: '审核失败：' + err.message });
  }
});

app.put('/api/records/:id/audit-reject', authenticate, requireRole('auditor'), async (req, res) => {
  try {
    const record = await db.get('SELECT * FROM morning_check_records WHERE id = ?', req.params.id);
    if (!record) {
      return res.status(404).json({ error: '晨检记录不存在' });
    }

    if (!canPerformAction(req.user.role, record.status, 'audit_reject')) {
      return res.status(400).json({ error: `当前状态为「${STATUS_NAMES[record.status]}」，不能执行退回补正` });
    }

    const { audit_note, abnormal_reason } = req.body;
    if (!abnormal_reason || !abnormal_reason.trim()) {
      return res.status(400).json({ error: '退回补正必须填写异常原因' });
    }

    const now = nowIso();

    await db.run(
      `UPDATE morning_check_records
       SET status = 'pending_correction', current_node = 'registration', audit_note = ?, abnormal_reason = ?, abnormal_by = ?, audited_by = ?, audit_completed_at = ?, updated_at = ?
       WHERE id = ?`,
      audit_note || null, abnormal_reason.trim(), req.user.id, req.user.id, now, now, req.params.id
    );

    await addOperationLog(req.params.id, req.user.id, req.user.name, req.user.role, '退回补正', record.status, 'pending_correction', `异常原因：${abnormal_reason.trim()}`);

    res.json({ message: '已退回补正，请登记员尽快处理' });
  } catch (err) {
    res.status(500).json({ error: '退回补正失败：' + err.message });
  }
});

app.put('/api/records/:id/review-pass', authenticate, requireRole('reviewer'), async (req, res) => {
  try {
    const record = await db.get('SELECT * FROM morning_check_records WHERE id = ?', req.params.id);
    if (!record) {
      return res.status(404).json({ error: '晨检记录不存在' });
    }

    if (!canPerformAction(req.user.role, record.status, 'review_pass')) {
      return res.status(400).json({ error: `当前状态为「${STATUS_NAMES[record.status]}」，不能执行复核归档` });
    }

    const { review_note } = req.body;
    const now = nowIso();

    await db.run(
      `UPDATE morning_check_records
       SET status = 'archived', current_node = 'completed', review_note = ?, reviewed_by = ?, review_completed_at = ?, updated_at = ?
       WHERE id = ?`,
      review_note || null, req.user.id, now, now, req.params.id
    );

    await addOperationLog(req.params.id, req.user.id, req.user.name, req.user.role, '复核归档', 'pending_review', 'archived', review_note || '');

    res.json({ message: '复核通过，记录已归档' });
  } catch (err) {
    res.status(500).json({ error: '复核归档失败：' + err.message });
  }
});

app.put('/api/records/:id/review-reject', authenticate, requireRole('reviewer'), async (req, res) => {
  try {
    const record = await db.get('SELECT * FROM morning_check_records WHERE id = ?', req.params.id);
    if (!record) {
      return res.status(404).json({ error: '晨检记录不存在' });
    }

    if (!canPerformAction(req.user.role, record.status, 'review_reject')) {
      return res.status(400).json({ error: `当前状态为「${STATUS_NAMES[record.status]}」，不能执行退回重审` });
    }

    const { review_note, abnormal_reason } = req.body;
    if (!abnormal_reason || !abnormal_reason.trim()) {
      return res.status(400).json({ error: '退回重审必须填写异常原因' });
    }

    const now = nowIso();

    await db.run(
      `UPDATE morning_check_records
       SET status = 'pending_audit', current_node = 'audit', review_note = ?, abnormal_reason = ?, abnormal_by = ?, reviewed_by = ?, review_submitted_at = NULL, updated_at = ?
       WHERE id = ?`,
      review_note || null, abnormal_reason.trim(), req.user.id, req.user.id, now, req.params.id
    );

    await addOperationLog(req.params.id, req.user.id, req.user.name, req.user.role, '退回重审', record.status, 'pending_audit', `异常原因：${abnormal_reason.trim()}`);

    res.json({ message: '已退回重审，请审核主管重新处理' });
  } catch (err) {
    res.status(500).json({ error: '退回重审失败：' + err.message });
  }
});

app.put('/api/records/batch/audit-pass', authenticate, requireRole('auditor'), async (req, res) => {
  try {
    const { ids, audit_note, remark } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请选择要审核的记录' });
    }
    if (ids.length > 100) {
      return res.status(400).json({ error: '批量审核最多处理 100 条记录' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const records = await db.all(
      `SELECT r.*, c.name as child_name FROM morning_check_records r
       JOIN children c ON r.child_id = c.id
       WHERE r.id IN (${placeholders})`,
      ...ids
    );

    if (records.length === 0) {
      return res.status(404).json({ error: '未找到选中的记录' });
    }

    const batchNo = generateBatchNo('audit');
    const batchId = await createBatch(batchNo, 'audit', records.length, req.user.id, req.user.name, req.user.role, remark || '');

    const now = nowIso();
    let successCount = 0;
    let failCount = 0;
    const details = [];

    for (const record of records) {
      const detail = {
        id: record.id,
        record_id: record.id,
        child_id: record.child_id,
        child_name: record.child_name,
        result: 'fail',
        from_status: record.status,
        from_status_name: STATUS_NAMES[record.status] || record.status,
        to_status: null,
        to_status_name: null,
        error: null,
        abnormal_reason: null,
        responsible_role: 'auditor',
        responsible_role_name: ROLE_NAMES['auditor'],
        remark: audit_note || '',
      };

      try {
        if (!canPerformAction(req.user.role, record.status, 'audit_pass')) {
          detail.error = `当前状态为「${STATUS_NAMES[record.status]}」，不能审核通过`;
          detail.remark = '状态校验失败：' + detail.error;
          failCount++;
          details.push(detail);
          await addBatchDetail(batchId, record.id, record.child_id, record.child_name, 'fail', detail.error, record.status, null, null, 'auditor', audit_note || '');
          continue;
        }

        await db.exec('BEGIN');

        await db.run(
          `UPDATE morning_check_records
           SET status = 'pending_review', current_node = 'review', audit_note = ?, audited_by = ?, audit_completed_at = ?, review_submitted_at = ?, updated_at = ?
           WHERE id = ?`,
          audit_note || null, req.user.id, now, now, now, record.id
        );

        await addOperationLog(record.id, req.user.id, req.user.name, req.user.role, '批量审核通过', record.status, 'pending_review', audit_note || '', batchId);

        await addBatchDetail(batchId, record.id, record.child_id, record.child_name, 'success', null, record.status, 'pending_review', null, 'auditor', audit_note || '');

        await db.exec('COMMIT');

        detail.result = 'success';
        detail.to_status = 'pending_review';
        detail.to_status_name = STATUS_NAMES['pending_review'];
        detail.error = null;
        successCount++;
        details.push(detail);
      } catch (err) {
        try { await db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
        detail.result = 'fail';
        detail.error = err.message;
        detail.remark = '处理异常：' + err.message;
        failCount++;
        details.push(detail);
        try {
          await addBatchDetail(batchId, record.id, record.child_id, record.child_name, 'fail', err.message, record.status, null, null, 'auditor', audit_note || '');
        } catch (e) { /* ignore */ }
      }
    }

    await updateBatchCounts(batchId, successCount, failCount);

    res.json({
      batch_no: batchNo,
      batch_id: batchId,
      batch_type: 'audit',
      batch_type_name: '批量审核',
      operator_name: req.user.name,
      operator_role: req.user.role,
      message: `批量审核完成：成功 ${successCount} 条，失败 ${failCount} 条`,
      total_count: records.length,
      success_count: successCount,
      fail_count: failCount,
      details,
      success_records: details.filter(d => d.result === 'success'),
      failed_items: details.filter(d => d.result === 'fail'),
    });
  } catch (err) {
    res.status(500).json({ error: '批量审核失败：' + err.message });
  }
});

app.put('/api/records/batch/review-pass', authenticate, requireRole('reviewer'), async (req, res) => {
  try {
    const { ids, review_note, remark } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请选择要复核的记录' });
    }
    if (ids.length > 100) {
      return res.status(400).json({ error: '批量复核最多处理 100 条记录' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const records = await db.all(
      `SELECT r.*, c.name as child_name FROM morning_check_records r
       JOIN children c ON r.child_id = c.id
       WHERE r.id IN (${placeholders})`,
      ...ids
    );

    if (records.length === 0) {
      return res.status(404).json({ error: '未找到选中的记录' });
    }

    const batchNo = generateBatchNo('review');
    const batchId = await createBatch(batchNo, 'review', records.length, req.user.id, req.user.name, req.user.role, remark || '');

    const now = nowIso();
    let successCount = 0;
    let failCount = 0;
    const successRecords = [];
    const failedItems = [];

    for (const record of records) {
      try {
        if (!canPerformAction(req.user.role, record.status, 'review_pass')) {
          const errorMsg = `当前状态为「${STATUS_NAMES[record.status]}」，不能复核归档`;
          failedItems.push({
            id: record.id,
            child_id: record.child_id,
            child_name: record.child_name,
            error: errorMsg,
          });
          failCount++;
          await addBatchDetail(batchId, record.id, record.child_id, record.child_name, 'fail', errorMsg, record.status, null, null, 'reviewer', review_note || '');
          continue;
        }

        await db.run(
          `UPDATE morning_check_records
           SET status = 'archived', current_node = 'completed', review_note = ?, reviewed_by = ?, review_completed_at = ?, updated_at = ?
           WHERE id = ?`,
          review_note || null, req.user.id, now, now, record.id
        );

        await addOperationLog(record.id, req.user.id, req.user.name, req.user.role, '批量复核归档', record.status, 'archived', review_note || '', batchId);
        await addBatchDetail(batchId, record.id, record.child_id, record.child_name, 'success', null, record.status, 'archived', null, 'reviewer', review_note || '');

        successCount++;
        successRecords.push({
          id: record.id,
          child_id: record.child_id,
          child_name: record.child_name,
          status: 'archived',
          status_name: STATUS_NAMES['archived'],
        });
      } catch (err) {
        failCount++;
        failedItems.push({
          id: record.id,
          child_id: record.child_id,
          child_name: record.child_name,
          error: err.message,
        });
        await addBatchDetail(batchId, record.id, record.child_id, record.child_name, 'fail', err.message, record.status, null, null, 'reviewer', review_note || '');
      }
    }

    await updateBatchCounts(batchId, successCount, failCount);

    res.json({
      batch_no: batchNo,
      batch_id: batchId,
      message: `批量复核完成：成功 ${successCount} 条，失败 ${failCount} 条`,
      success_count: successCount,
      fail_count: failCount,
      success_records: successRecords,
      failed_items: failedItems,
    });
  } catch (err) {
    res.status(500).json({ error: '批量复核失败：' + err.message });
  }
});

app.get('/api/stats/dashboard', authenticate, async (req, res) => {
  try {
    const { check_date } = req.query;

    let dateFilter = '';
    let params = [];
    if (check_date) {
      dateFilter = 'WHERE check_date = ?';
      params.push(check_date);
    }

    const totalRow = await db.get(`SELECT COUNT(*) as count FROM morning_check_records ${dateFilter}`, ...params);

    const statusCounts = await db.all(
      `SELECT status, COUNT(*) as count
       FROM morning_check_records
       ${dateFilter}
       GROUP BY status`,
      ...params
    );

    const allRecords = await db.all(`SELECT * FROM morning_check_records ${dateFilter}`, ...params);

    let timeoutCount = 0;
    allRecords.forEach(record => {
      if (record.status !== 'archived') {
        const t = calculateTimeout(record);
        if (t.isTimeout) timeoutCount++;
      }
    });

    const userRole = req.user.role;
    let myQueueCount = 0;
    if (userRole === 'registrar') {
      const row = await db.get(
        `SELECT COUNT(*) as count FROM morning_check_records WHERE status IN (?, ?) ${check_date ? 'AND check_date = ?' : ''}`,
        'pending_registration', 'pending_correction', ...(check_date ? [check_date] : [])
      );
      myQueueCount = row.count;
    } else if (userRole === 'auditor') {
      const row = await db.get(
        `SELECT COUNT(*) as count FROM morning_check_records WHERE status = ? ${check_date ? 'AND check_date = ?' : ''}`,
        'pending_audit', ...(check_date ? [check_date] : [])
      );
      myQueueCount = row.count;
    } else if (userRole === 'reviewer') {
      const row = await db.get(
        `SELECT COUNT(*) as count FROM morning_check_records WHERE status = ? ${check_date ? 'AND check_date = ?' : ''}`,
        'pending_review', ...(check_date ? [check_date] : [])
      );
      myQueueCount = row.count;
    }

    const statusMap = {};
    statusCounts.forEach(s => {
      statusMap[s.status] = s.count;
    });

    res.json({
      total: totalRow.count,
      my_queue_count: myQueueCount,
      timeout_count: timeoutCount,
      by_status: {
        pending_registration: statusMap.pending_registration || 0,
        pending_correction: statusMap.pending_correction || 0,
        pending_audit: statusMap.pending_audit || 0,
        pending_review: statusMap.pending_review || 0,
        archived: statusMap.archived || 0,
      },
      by_status_names: {
        '待登记': statusMap.pending_registration || 0,
        '待补正': statusMap.pending_correction || 0,
        '待审核': statusMap.pending_audit || 0,
        '待复核': statusMap.pending_review || 0,
        '已归档': statusMap.archived || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: '获取统计数据失败：' + err.message });
  }
});

app.get('/api/logs', authenticate, async (req, res) => {
  try {
    const { record_id, page = 1, pageSize = 50 } = req.query;
    const offset = (page - 1) * pageSize;

    let where = '';
    let params = [];
    if (record_id) {
      where = 'WHERE record_id = ?';
      params.push(record_id);
    }

    const totalRow = await db.get(`SELECT COUNT(*) as count FROM operation_logs ${where}`, ...params);
    const list = await db.all(
      `SELECT * FROM operation_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      ...params, parseInt(pageSize), offset
    );

    res.json({ list, total: totalRow.count, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    res.status(500).json({ error: '获取操作记录失败：' + err.message });
  }
});

app.get('/api/batches', authenticate, async (req, res) => {
  try {
    const { batch_type, page = 1, pageSize = 10 } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClauses = [];
    let params = [];

    if (batch_type) {
      whereClauses.push('batch_type = ?');
      params.push(batch_type);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const totalRow = await db.get(`SELECT COUNT(*) as count FROM batch_batches ${whereSql}`, ...params);
    const list = await db.all(
      `SELECT * FROM batch_batches ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      ...params, parseInt(pageSize), offset
    );

    const listWithNames = list.map(b => ({
      ...b,
      batch_type_name: b.batch_type === 'audit' ? '批量审核' : '批量复核',
      operator_role_name: ROLE_NAMES[b.operator_role] || b.operator_role,
    }));

    res.json({ list: listWithNames, total: totalRow.count, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    res.status(500).json({ error: '获取批量处理列表失败：' + err.message });
  }
});

app.get('/api/batches/:id', authenticate, async (req, res) => {
  try {
    const batch = await db.get('SELECT * FROM batch_batches WHERE id = ?', req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const details = await db.all(
      'SELECT * FROM batch_details WHERE batch_id = ? ORDER BY id ASC',
      req.params.id
    );

    const detailsWithNames = details.map(d => ({
      ...d,
      from_status_name: STATUS_NAMES[d.from_status] || d.from_status,
      to_status_name: STATUS_NAMES[d.to_status] || d.to_status,
      result_name: d.result === 'success' ? '成功' : '失败',
      responsible_role_name: ROLE_NAMES[d.responsible_role] || d.responsible_role,
    }));

    res.json({
      ...batch,
      batch_type_name: batch.batch_type === 'audit' ? '批量审核' : '批量复核',
      operator_role_name: ROLE_NAMES[batch.operator_role] || batch.operator_role,
      details: detailsWithNames,
    });
  } catch (err) {
    res.status(500).json({ error: '获取批次详情失败：' + err.message });
  }
});

app.get('/api/records/:id/batches', authenticate, async (req, res) => {
  try {
    const details = await db.all(
      `SELECT bd.*, bb.batch_no, bb.batch_type, bb.operator_name, bb.operator_role, bb.created_at as batch_created_at
       FROM batch_details bd
       JOIN batch_batches bb ON bd.batch_id = bb.id
       WHERE bd.record_id = ?
       ORDER BY bb.created_at DESC`,
      req.params.id
    );

    const list = details.map(d => ({
      ...d,
      batch_type_name: d.batch_type === 'audit' ? '批量审核' : '批量复核',
      result_name: d.result === 'success' ? '成功' : '失败',
      from_status_name: STATUS_NAMES[d.from_status] || d.from_status,
      to_status_name: STATUS_NAMES[d.to_status] || d.to_status,
      operator_role_name: ROLE_NAMES[d.operator_role] || d.operator_role,
      responsible_role_name: ROLE_NAMES[d.responsible_role] || d.responsible_role,
    }));

    res.json({ list });
  } catch (err) {
    res.status(500).json({ error: '获取记录批次历史失败：' + err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '晨检记录系统后端运行正常' });
});

async function startServer() {
  try {
    if (dbExists) {
      await upgradeDatabase();
    }
    app.listen(PORT, () => {
      console.log(`晨检记录系统后端运行在 http://localhost:${PORT}`);
      if (!dbExists) {
        console.log('提示：数据库文件不存在，请先运行 npm run init-db 初始化数据库');
      }
    });
  } catch (err) {
    console.error('启动失败:', err.message);
    process.exit(1);
  }
}

startServer();
