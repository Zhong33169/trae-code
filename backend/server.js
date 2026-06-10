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

async function addOperationLog(recordId, userId, userName, userRole, action, fromStatus, toStatus, note) {
  await db.run(
    `INSERT INTO operation_logs (record_id, user_id, user_name, user_role, action, from_status, to_status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    recordId, userId, userName, userRole, action, fromStatus, toStatus, note || ''
  );
}

function nowIso() {
  return new Date().toISOString();
}

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

    res.json({ list: recordsWithTimeout, total: totalRow.count, page: parseInt(page), pageSize: parseInt(pageSize) });
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

    const timeout = calculateTimeout(record);
    const logs = await db.all(
      `SELECT * FROM operation_logs WHERE record_id = ? ORDER BY created_at DESC`,
      req.params.id
    );

    res.json({
      ...record,
      status_name: STATUS_NAMES[record.status] || record.status,
      current_node_name: NODE_NAMES[record.current_node] || record.current_node,
      timeout,
      operation_logs: logs,
    });
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

    if (record.status !== 'pending_registration' && record.status !== 'pending_correction') {
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

    if (record.status !== 'pending_audit') {
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

    if (record.status !== 'pending_audit') {
      return res.status(400).json({ error: `当前状态为「${STATUS_NAMES[record.status]}」，不能执行退回补正` });
    }

    const { audit_note, abnormal_reason } = req.body;
    if (!abnormal_reason) {
      return res.status(400).json({ error: '退回补正必须填写异常原因' });
    }

    const now = nowIso();

    await db.run(
      `UPDATE morning_check_records
       SET status = 'pending_correction', current_node = 'registration', audit_note = ?, abnormal_reason = ?, audited_by = ?, audit_completed_at = ?, updated_at = ?
       WHERE id = ?`,
      audit_note || null, abnormal_reason, req.user.id, now, now, req.params.id
    );

    await addOperationLog(req.params.id, req.user.id, req.user.name, req.user.role, '退回补正', 'pending_audit', 'pending_correction', `异常原因：${abnormal_reason}`);

    res.json({ message: '已退回补正，请登记员处理' });
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

    if (record.status !== 'pending_review') {
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

    if (record.status !== 'pending_review') {
      return res.status(400).json({ error: `当前状态为「${STATUS_NAMES[record.status]}」，不能执行退回重审` });
    }

    const { review_note, abnormal_reason } = req.body;
    if (!abnormal_reason) {
      return res.status(400).json({ error: '退回重审必须填写异常原因' });
    }

    const now = nowIso();

    await db.run(
      `UPDATE morning_check_records
       SET status = 'pending_audit', current_node = 'audit', review_note = ?, abnormal_reason = ?, reviewed_by = ?, review_submitted_at = NULL, updated_at = ?
       WHERE id = ?`,
      review_note || null, abnormal_reason, req.user.id, now, req.params.id
    );

    await addOperationLog(req.params.id, req.user.id, req.user.name, req.user.role, '退回重审', 'pending_review', 'pending_audit', `异常原因：${abnormal_reason}`);

    res.json({ message: '已退回重审，请审核主管重新处理' });
  } catch (err) {
    res.status(500).json({ error: '退回重审失败：' + err.message });
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '晨检记录系统后端运行正常' });
});

app.listen(PORT, () => {
  console.log(`晨检记录系统后端运行在 http://localhost:${PORT}`);
  if (!dbExists) {
    console.log('提示：数据库文件不存在，请先运行 npm run init-db 初始化数据库');
  }
});
