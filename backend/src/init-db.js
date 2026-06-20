const db = require('./db');
const bcrypt = require('bcryptjs');
const { ORDER_STATUS, EVIDENCE_TYPES, ROLES } = require('./config');

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      real_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('registrar', 'auditor', 'reviewer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS equipment_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      applicant TEXT NOT NULL,
      department TEXT NOT NULL,
      equipment_name TEXT NOT NULL,
      equipment_model TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      borrow_reason TEXT NOT NULL,
      expected_return_date DATE NOT NULL,
      actual_return_date DATE,
      status TEXT NOT NULL CHECK (status IN (
        'draft', 'pending_audit', 'audit_rejected',
        'pending_review', 'review_rejected', 'archived'
      )),
      version INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL,
      auditor_id INTEGER,
      reviewer_id INTEGER,
      audit_comment TEXT,
      review_comment TEXT,
      last_failure_reason TEXT,
      loss_remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (auditor_id) REFERENCES users(id),
      FOREIGN KEY (reviewer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS evidences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('borrow', 'return', 'loss')),
      description TEXT NOT NULL,
      file_name TEXT,
      uploaded_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES equipment_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES equipment_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status ON equipment_orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_by ON equipment_orders(created_by);
    CREATE INDEX IF NOT EXISTS idx_evidences_order_id ON evidences(order_id);
    CREATE INDEX IF NOT EXISTS idx_logs_order_id ON operation_logs(order_id);
  `);
}

function seedData() {
  const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
  if (userCount > 0) return;

  const hashPwd = (pwd) => bcrypt.hashSync(pwd, 10);

  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, real_name, role) VALUES (?, ?, ?, ?)
  `);

  const userId = {};
  userId.registrar = insertUser.run(
    'registrar01', hashPwd('123456'), '李登记员', ROLES.REGISTRAR
  ).lastInsertRowid;
  userId.auditor = insertUser.run(
    'auditor01', hashPwd('123456'), '王审核主管', ROLES.AUDITOR
  ).lastInsertRowid;
  userId.reviewer = insertUser.run(
    'reviewer01', hashPwd('123456'), '张复核负责人', ROLES.REVIEWER
  ).lastInsertRowid;

  const orders = [
    {
      order_no: 'EB-2024-0001', applicant: '陈同学', department: '篮球社',
      equipment_name: '篮球', equipment_model: '斯伯丁7号', quantity: 5,
      borrow_reason: '周末训练赛使用', expected_return_date: '2024-06-24',
      status: ORDER_STATUS.PENDING_REVIEW, created_by: userId.registrar,
      auditor_id: userId.auditor, hasBorrow: true, hasReturn: true, hasLoss: false
    },
    {
      order_no: 'EB-2024-0002', applicant: '刘同学', department: '羽毛球协会',
      equipment_name: '羽毛球拍', equipment_model: '尤尼克斯', quantity: 4,
      borrow_reason: '新生杯比赛', expected_return_date: '2024-06-25',
      status: ORDER_STATUS.PENDING_REVIEW, created_by: userId.registrar,
      auditor_id: userId.auditor, hasBorrow: true, hasReturn: false, hasLoss: false,
      failureHint: '缺少归还验收证据'
    },
    {
      order_no: 'EB-2024-0003', applicant: '赵同学', department: '足球俱乐部',
      equipment_name: '足球', equipment_model: '世达5号', quantity: 3,
      borrow_reason: '友谊赛使用', expected_return_date: '2024-06-22',
      status: ORDER_STATUS.PENDING_REVIEW, created_by: userId.registrar,
      auditor_id: userId.auditor, hasBorrow: true, hasReturn: true, hasLoss: true,
      lossRemark: '1个足球表皮破损'
    },
    {
      order_no: 'EB-2024-0004', applicant: '孙同学', department: '乒乓球队',
      equipment_name: '乒乓球桌', equipment_model: '红双喜T2023', quantity: 1,
      borrow_reason: '学院比赛', expected_return_date: '2024-06-21',
      status: ORDER_STATUS.PENDING_AUDIT, created_by: userId.registrar,
      hasBorrow: false, hasReturn: false, hasLoss: false
    },
    {
      order_no: 'EB-2024-0005', applicant: '周同学', department: '田径队',
      equipment_name: '跨栏架', equipment_model: '标准可调式', quantity: 10,
      borrow_reason: '运动会训练', expected_return_date: '2024-06-20',
      status: ORDER_STATUS.AUDIT_REJECTED, created_by: userId.registrar,
      auditor_id: userId.auditor, audit_comment: '借用理由描述不够清晰，请补正说明用途与具体时段',
      hasBorrow: false, hasReturn: false, hasLoss: false
    },
    {
      order_no: 'EB-2024-0006', applicant: '吴同学', department: '排球社',
      equipment_name: '排球', equipment_model: 'MIKASA MVA200', quantity: 6,
      borrow_reason: '日常训练', expected_return_date: '2024-06-23',
      status: ORDER_STATUS.REVIEW_REJECTED, created_by: userId.registrar,
      auditor_id: userId.auditor, reviewer_id: userId.reviewer,
      review_comment: '归还验收记录不完整，请重新确认归还数量并补充损耗说明',
      last_failure_reason: '归还数量不匹配：借出6个，验收清单仅5个；需重新上传归还验收单',
      hasBorrow: true, hasReturn: true, hasLoss: false
    },
    {
      order_no: 'EB-2024-0007', applicant: '郑同学', department: '体操队',
      equipment_name: '瑜伽垫', equipment_model: 'TPE加厚', quantity: 20,
      borrow_reason: '健美操比赛彩排', expected_return_date: '2024-06-19',
      status: ORDER_STATUS.ARCHIVED, created_by: userId.registrar,
      auditor_id: userId.auditor, reviewer_id: userId.reviewer,
      actual_return_date: '2024-06-19', hasBorrow: true, hasReturn: true, hasLoss: false
    },
    {
      order_no: 'EB-2024-0008', applicant: '黄同学', department: '网球俱乐部',
      equipment_name: '网球拍', equipment_model: 'Wilson Pro Staff', quantity: 8,
      borrow_reason: '校际交流赛', expected_return_date: '2024-06-26',
      status: ORDER_STATUS.PENDING_REVIEW, created_by: userId.registrar,
      auditor_id: userId.auditor, hasBorrow: true, hasReturn: true, hasLoss: true,
      lossRemark: '2个球拍网线断裂', failureHint: '损耗确认描述不完整'
    }
  ];

  const insertOrder = db.prepare(`
    INSERT INTO equipment_orders (
      order_no, applicant, department, equipment_name, equipment_model,
      quantity, borrow_reason, expected_return_date, actual_return_date,
      status, version, created_by, auditor_id, reviewer_id,
      audit_comment, review_comment, last_failure_reason, loss_remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvidence = db.prepare(`
    INSERT INTO evidences (order_id, type, description, file_name, uploaded_by)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertLog = db.prepare(`
    INSERT INTO operation_logs (order_id, user_id, action, from_status, to_status, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  orders.forEach((o, idx) => {
    const info = insertOrder.run(
      o.order_no, o.applicant, o.department, o.equipment_name, o.equipment_model,
      o.quantity, o.borrow_reason, o.expected_return_date, o.actual_return_date || null,
      o.status, o.status === ORDER_STATUS.ARCHIVED ? 3 : 1,
      o.created_by, o.auditor_id || null, o.reviewer_id || null,
      o.audit_comment || null, o.review_comment || null,
      o.last_failure_reason || null, o.lossRemark || null
    );
    const orderId = info.lastInsertRowid;

    insertLog.run(orderId, o.created_by, '创建', null, ORDER_STATUS.DRAFT, '登记员创建借用单');
    insertLog.run(orderId, o.created_by, '提交', ORDER_STATUS.DRAFT, ORDER_STATUS.PENDING_AUDIT, '提交审核');

    if (o.auditor_id) {
      const auditTo = o.status === ORDER_STATUS.AUDIT_REJECTED
        ? ORDER_STATUS.AUDIT_REJECTED
        : ORDER_STATUS.PENDING_REVIEW;
      insertLog.run(
        orderId, o.auditor_id, '审核',
        ORDER_STATUS.PENDING_AUDIT, auditTo,
        o.audit_comment || '审核通过'
      );
    }

    if (o.reviewer_id && o.status === ORDER_STATUS.ARCHIVED) {
      insertLog.run(
        orderId, o.reviewer_id, '复核归档',
        ORDER_STATUS.PENDING_REVIEW, ORDER_STATUS.ARCHIVED,
        '复核通过，已归档'
      );
    }
    if (o.reviewer_id && o.status === ORDER_STATUS.REVIEW_REJECTED) {
      insertLog.run(
        orderId, o.reviewer_id, '复核驳回',
        ORDER_STATUS.PENDING_REVIEW, ORDER_STATUS.REVIEW_REJECTED,
        o.review_comment
      );
    }

    if (o.hasBorrow) {
      insertEvidence.run(
        orderId, EVIDENCE_TYPES.BORROW,
        `${o.applicant} 签署的《器材借用签收单》，签收日期 ${o.expected_return_date.slice(0,7)}-15`,
        `EB-${String(idx+1).padStart(4,'0')}-borrow.pdf`,
        o.created_by
      );
    }
    if (o.hasReturn) {
      insertEvidence.run(
        orderId, EVIDENCE_TYPES.RETURN,
        `${o.quantity} 件 ${o.equipment_name} 归还验收清单`,
        `EB-${String(idx+1).padStart(4,'0')}-return.pdf`,
        o.created_by
      );
    }
    if (o.hasLoss) {
      insertEvidence.run(
        orderId, EVIDENCE_TYPES.LOSS,
        o.lossRemark || '损耗情况说明',
        `EB-${String(idx+1).padStart(4,'0')}-loss.pdf`,
        o.created_by
      );
    }
  });
}

function init() {
  createSchema();
  seedData();
  console.log('数据库初始化完成');
  const counts = {
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    orders: db.prepare('SELECT COUNT(*) c FROM equipment_orders').get().c,
    evidences: db.prepare('SELECT COUNT(*) c FROM evidences').get().c
  };
  console.log('数据统计:', counts);
}

if (require.main === module) {
  init();
}

module.exports = { createSchema, seedData, init };
