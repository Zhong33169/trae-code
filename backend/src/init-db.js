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

    CREATE TABLE IF NOT EXISTS idempotent_requests (
      request_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      order_id INTEGER,
      action TEXT NOT NULL,
      version INTEGER,
      request_payload TEXT,
      response_code INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotent_unique
      ON idempotent_requests(user_id, COALESCE(order_id, -1), action, COALESCE(version, -1));

    CREATE INDEX IF NOT EXISTS idx_orders_status ON equipment_orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_by ON equipment_orders(created_by);
    CREATE INDEX IF NOT EXISTS idx_evidences_order_id ON evidences(order_id);
    CREATE INDEX IF NOT EXISTS idx_logs_order_id ON operation_logs(order_id);
    CREATE INDEX IF NOT EXISTS idx_idempotent_created ON idempotent_requests(created_at DESC);
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
  userId.registrar = insertUser.run('registrar01', hashPwd('123456'), '李登记员', ROLES.REGISTRAR).lastInsertRowid;
  userId.auditor   = insertUser.run('auditor01',   hashPwd('123456'), '王审核主管', ROLES.AUDITOR).lastInsertRowid;
  userId.reviewer  = insertUser.run('reviewer01',  hashPwd('123456'), '张复核负责人', ROLES.REVIEWER).lastInsertRowid;

  const insertOrderStmt = db.prepare(`
    INSERT INTO equipment_orders (
      order_no, applicant, department, equipment_name, equipment_model,
      quantity, borrow_reason, expected_return_date, actual_return_date,
      status, version, created_by, auditor_id, reviewer_id,
      audit_comment, review_comment, last_failure_reason, loss_remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEvStmt = db.prepare(`
    INSERT INTO evidences (order_id, type, description, file_name, uploaded_by)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertLogStmt = db.prepare(`
    INSERT INTO operation_logs (order_id, user_id, action, from_status, to_status, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const logCreate = (oid, by) =>
    insertLogStmt.run(oid, by, '创建', null, ORDER_STATUS.DRAFT, '登记员创建借用单并填写信息');
  const logSubmit = (oid, by, fromS, comment) =>
    insertLogStmt.run(oid, by, '提交审核', fromS, ORDER_STATUS.PENDING_AUDIT, comment || '提交审核');
  const logAuditPass = (oid, by, comment) =>
    insertLogStmt.run(oid, by, '审核通过', ORDER_STATUS.PENDING_AUDIT, ORDER_STATUS.PENDING_REVIEW, comment || '审核通过，信息完整');
  const logAuditReject = (oid, by, comment) =>
    insertLogStmt.run(oid, by, '审核驳回', ORDER_STATUS.PENDING_AUDIT, ORDER_STATUS.AUDIT_REJECTED, comment);
  const logReviewPass = (oid, by, comment) =>
    insertLogStmt.run(oid, by, '复核归档通过', ORDER_STATUS.PENDING_REVIEW, ORDER_STATUS.ARCHIVED, comment || '复核通过，证据完整');
  const logReviewReject = (oid, by, comment) =>
    insertLogStmt.run(oid, by, '复核驳回', ORDER_STATUS.PENDING_REVIEW, ORDER_STATUS.REVIEW_REJECTED, comment);
  const logReviewFail  = (oid, by, reason) =>
    insertLogStmt.run(oid, by, '复核校验未通过', ORDER_STATUS.PENDING_REVIEW, ORDER_STATUS.PENDING_REVIEW,
      `复核检查未通过，未归档，原因：${reason}`);

  /* ------------------------------------------------------------------
     EB-2024-0001：✅ 正常样例（篮球社）— 三类证据齐全、描述规范
     ------------------------------------------------------------------ */
  {
    const info = insertOrderStmt.run(
      'EB-2024-0001', '陈同学', '篮球社', '篮球', '斯伯丁7号',
      5, '周末训练赛使用', '2024-06-24', null,
      ORDER_STATUS.PENDING_REVIEW, 1,
      userId.registrar, userId.auditor, null,
      null, null, null, null
    );
    const oid = info.lastInsertRowid;
    logCreate(oid, userId.registrar);
    logSubmit(oid, userId.registrar, ORDER_STATUS.DRAFT, '借用信息完整，提交审核');
    logAuditPass(oid, userId.auditor, '器材信息与理由清晰，审核通过');
    insertEvStmt.run(oid, EVIDENCE_TYPES.BORROW,
      '陈同学签署的《器材借用签收单》，签收日期 2024-06-21，领取篮球5个',
      'EB-0001-borrow.pdf', userId.registrar);
    insertEvStmt.run(oid, EVIDENCE_TYPES.RETURN,
      '5件斯伯丁7号篮球归还验收清单，外观完整气压正常，清点无误',
      'EB-0001-return.pdf', userId.registrar);
  }

  /* ------------------------------------------------------------------
     EB-2024-0002：❌ 异常样例 — 缺少归还验收证据
     ------------------------------------------------------------------ */
  {
    const info = insertOrderStmt.run(
      'EB-2024-0002', '刘同学', '羽毛球协会', '羽毛球拍', '尤尼克斯',
      4, '新生杯比赛用拍', '2024-06-25', null,
      ORDER_STATUS.PENDING_REVIEW, 1,
      userId.registrar, userId.auditor, null,
      null, null, null, null
    );
    const oid = info.lastInsertRowid;
    logCreate(oid, userId.registrar);
    logSubmit(oid, userId.registrar, ORDER_STATUS.DRAFT, '提交审核');
    logAuditPass(oid, userId.auditor, '审核通过，待归还后补验收单');
    insertEvStmt.run(oid, EVIDENCE_TYPES.BORROW,
      '刘同学签署的《器材借用签收单》，签收日期 2024-06-21，领取球拍4支',
      'EB-0002-borrow.pdf', userId.registrar);
  }

  /* ------------------------------------------------------------------
     EB-2024-0003：✅ 正常样例（带损耗）— 足球：损耗描述完整且>=10字，含数字
     ------------------------------------------------------------------ */
  {
    const info = insertOrderStmt.run(
      'EB-2024-0003', '赵同学', '足球俱乐部', '足球', '世达5号',
      3, '校际友谊赛使用', '2024-06-22', null,
      ORDER_STATUS.PENDING_REVIEW, 1,
      userId.registrar, userId.auditor, null,
      null, null, null,
      '1个足球表皮破损，缝线开裂约5cm，需专业修补后再入库'
    );
    const oid = info.lastInsertRowid;
    logCreate(oid, userId.registrar);
    logSubmit(oid, userId.registrar, ORDER_STATUS.DRAFT, '提交审核');
    logAuditPass(oid, userId.auditor, '审核通过');
    insertEvStmt.run(oid, EVIDENCE_TYPES.BORROW,
      '赵同学签署的《器材借用签收单》，签收日期 2024-06-20，领取足球3个',
      'EB-0003-borrow.pdf', userId.registrar);
    insertEvStmt.run(oid, EVIDENCE_TYPES.RETURN,
      '3件世达5号足球归还验收清单，2个完好，1个表皮磨损，清点无误',
      'EB-0003-return.pdf', userId.registrar);
    insertEvStmt.run(oid, EVIDENCE_TYPES.LOSS,
      '损耗确认：归还时1个足球表皮破损缝线开裂，双方已签字确认，责任人无需赔偿',
      'EB-0003-loss.pdf', userId.registrar);
  }

  /* ------------------------------------------------------------------
     EB-2024-0004：📋 待审核 — 刚提交，无证据，仅登记员创建后提交
     ------------------------------------------------------------------ */
  {
    const info = insertOrderStmt.run(
      'EB-2024-0004', '孙同学', '乒乓球队', '乒乓球桌', '红双喜T2023',
      1, '院内乒乓球锦标赛正赛使用', '2024-06-21', null,
      ORDER_STATUS.PENDING_AUDIT, 1,
      userId.registrar, null, null,
      null, null, null, null
    );
    const oid = info.lastInsertRowid;
    logCreate(oid, userId.registrar);
    logSubmit(oid, userId.registrar, ORDER_STATUS.DRAFT, '比赛借用，后续补借用单');
  }

  /* ------------------------------------------------------------------
     EB-2024-0005：🚫 审核驳回（待补正）— 审核主管写了修改意见
     ------------------------------------------------------------------ */
  {
    const info = insertOrderStmt.run(
      'EB-2024-0005', '周同学', '田径队', '跨栏架', '标准可调式',
      10, '运动会训练', '2024-06-20', null,
      ORDER_STATUS.AUDIT_REJECTED, 1,
      userId.registrar, userId.auditor, null,
      '借用理由描述过于简略，未说明具体训练时段、使用场地与归还安排；同时需填写负责教师签字',
      null, null, null
    );
    const oid = info.lastInsertRowid;
    logCreate(oid, userId.registrar);
    logSubmit(oid, userId.registrar, ORDER_STATUS.DRAFT, '提交审核');
    logAuditReject(oid, userId.auditor,
      '借用理由描述过于简略，未说明具体训练时段、使用场地与归还安排；同时需填写负责教师签字');
  }

  /* ------------------------------------------------------------------
     EB-2024-0006：⚠️ 复核驳回（待补正）— 已写入失败原因，登记员需重提
     ------------------------------------------------------------------ */
  {
    const failReason =
      '归还验收证据未提及借出数量6个，无法核对；清单上仅显示5个；请重新确认归还数量并补充损耗说明（如有）';
    const info = insertOrderStmt.run(
      'EB-2024-0006', '吴同学', '排球社', '排球', 'MIKASA MVA200',
      6, '排球社日常训练', '2024-06-23', null,
      ORDER_STATUS.REVIEW_REJECTED, 2,
      userId.registrar, userId.auditor, userId.reviewer,
      null,
      '归还验收记录不完整，请重新确认归还数量并补充损耗说明；确认后需重新提交审核',
      failReason,
      null
    );
    const oid = info.lastInsertRowid;
    logCreate(oid, userId.registrar);
    logSubmit(oid, userId.registrar, ORDER_STATUS.DRAFT, '提交审核');
    logAuditPass(oid, userId.auditor, '审核通过');
    logReviewReject(oid, userId.reviewer,
      '归还验收记录不完整，请重新确认归还数量并补充损耗说明');
    insertEvStmt.run(oid, EVIDENCE_TYPES.BORROW,
      '吴同学签署的《器材借用签收单》，签收日期 2024-06-19，领取排球6个',
      'EB-0006-borrow.pdf', userId.registrar);
    insertEvStmt.run(oid, EVIDENCE_TYPES.RETURN,
      '归还验收清单（待修正）',
      'EB-0006-return.pdf', userId.registrar);
  }

  /* ------------------------------------------------------------------
     EB-2024-0007：✅ 已归档完整流程样例
     ------------------------------------------------------------------ */
  {
    const info = insertOrderStmt.run(
      'EB-2024-0007', '郑同学', '体操队', '瑜伽垫', 'TPE加厚',
      20, '健美操比赛彩排及正式演出借用', '2024-06-19', '2024-06-19',
      ORDER_STATUS.ARCHIVED, 3,
      userId.registrar, userId.auditor, userId.reviewer,
      null, null, null, null
    );
    const oid = info.lastInsertRowid;
    logCreate(oid, userId.registrar);
    logSubmit(oid, userId.registrar, ORDER_STATUS.DRAFT, '提交审核');
    logAuditPass(oid, userId.auditor, '审核通过');
    logReviewPass(oid, userId.reviewer, '全部20个瑜伽垫完好归还，归档');
    insertEvStmt.run(oid, EVIDENCE_TYPES.BORROW,
      '郑同学签署的《器材借用签收单》，签收日期 2024-06-16，领取瑜伽垫20张',
      'EB-0007-borrow.pdf', userId.registrar);
    insertEvStmt.run(oid, EVIDENCE_TYPES.RETURN,
      '20张TPE加厚瑜伽垫归还验收清单，外观完好无污渍，清点无误，当日归还',
      'EB-0007-return.pdf', userId.registrar);
  }

  /* ------------------------------------------------------------------
     EB-2024-0008：❌ 异常样例 — 损耗描述不完整 + 归还未提数量
     （模拟上次复核已失败一次，version=2，已写入 last_failure_reason）
     ------------------------------------------------------------------ */
  {
    const failReason =
      '归还验收证据未提及借出数量8支（共借出8支网球拍）；损耗说明描述不完整（需>=10字，当前5字）："2个坏了"；损耗确认证据描述不完整（需>=10字）："2支损坏"';
    const info = insertOrderStmt.run(
      'EB-2024-0008', '黄同学', '网球俱乐部', '网球拍', 'Wilson Pro Staff 97',
      8, '校际网球交流赛使用', '2024-06-26', null,
      ORDER_STATUS.PENDING_REVIEW, 2,
      userId.registrar, userId.auditor, userId.reviewer,
      null, null, failReason,
      '2个坏了'
    );
    const oid = info.lastInsertRowid;
    logCreate(oid, userId.registrar);
    logSubmit(oid, userId.registrar, ORDER_STATUS.DRAFT, '提交审核');
    logAuditPass(oid, userId.auditor, '审核通过，归还后请补完整损耗说明');
    logReviewFail(oid, userId.reviewer, failReason);
    insertEvStmt.run(oid, EVIDENCE_TYPES.BORROW,
      '黄同学签署的《器材借用签收单》，签收日期 2024-06-22，领取网球拍8支',
      'EB-0008-borrow.pdf', userId.registrar);
    insertEvStmt.run(oid, EVIDENCE_TYPES.RETURN,
      '球拍归还（请重新上传清单）',
      'EB-0008-return.pdf', userId.registrar);
    insertEvStmt.run(oid, EVIDENCE_TYPES.LOSS,
      '2支损坏',
      'EB-0008-loss.pdf', userId.registrar);
  }
}

function init() {
  createSchema();
  seedData();
  console.log('✅ 数据库初始化完成');
  const counts = {
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    orders: db.prepare('SELECT COUNT(*) c FROM equipment_orders').get().c,
    evidences: db.prepare('SELECT COUNT(*) c FROM evidences').get().c,
    logs: db.prepare('SELECT COUNT(*) c FROM operation_logs').get().c
  };
  console.log('📊 数据统计:', counts);
  const byStatus = db.prepare(
    "SELECT status, COUNT(*) c FROM equipment_orders GROUP BY status"
  ).all();
  console.log('📋 按状态分布:', byStatus.map(r => `${r.status}=${r.c}`).join(', '));
}

if (require.main === module) {
  init();
}

module.exports = { createSchema, seedData, init };
