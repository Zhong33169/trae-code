import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, '../../data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const patterns = ['policy.db', 'policy.db-wal', 'policy.db-shm', 'policy.db-journal']
patterns.forEach(name => {
  const fp = path.join(dataDir, name)
  if (fs.existsSync(fp)) {
    try { fs.unlinkSync(fp) } catch {}
  }
})

const { default: db } = await import('./index.js')
const { ROLES, STATUS, ABNORMAL_TYPES, ATTACHMENT_STATUS } = await import('./schema.js')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('REGISTRAR', 'REVIEWER', 'APPROVER')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS policy_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    applicant TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'PENDING_REVIEW', 'PENDING_CORRECTION', 'REVIEWED', 'APPROVED', 'ARCHIVED', 'REJECTED')),
    abnormal_type TEXT CHECK(abnormal_type IN ('MISSING_ATTACHMENT', 'TIMEOUT', 'REJECTED')),
    timeout_deadline DATETIME,
    reject_reason TEXT,
    audit_remark TEXT,
    result_content TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS required_attachment_defs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES policy_orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    required_def_id INTEGER,
    parent_id INTEGER,
    name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    att_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(att_status IN ('ACTIVE', 'REJECTED', 'SUPERSEDED')),
    required INTEGER NOT NULL DEFAULT 1,
    rejected INTEGER NOT NULL DEFAULT 0,
    reject_reason TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    uploaded_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES policy_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (required_def_id) REFERENCES required_attachment_defs(id),
    FOREIGN KEY (parent_id) REFERENCES attachments(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS review_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    operator_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    remark TEXT,
    from_status TEXT,
    to_status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES policy_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (operator_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    operator_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    failure_reason TEXT,
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES policy_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (operator_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status ON policy_orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_abnormal ON policy_orders(abnormal_type);
  CREATE INDEX IF NOT EXISTS idx_req_def_order ON required_attachment_defs(order_id);
  CREATE INDEX IF NOT EXISTS idx_attachments_order ON attachments(order_id);
  CREATE INDEX IF NOT EXISTS idx_attachments_def ON attachments(required_def_id);
  CREATE INDEX IF NOT EXISTS idx_review_order ON review_records(order_id);
  CREATE INDEX IF NOT EXISTS idx_audit_order ON audit_logs(order_id);
`)

console.log('数据库表结构创建完成')

const salt = bcrypt.genSaltSync(10)

const users = [
  { username: 'registrar', name: '张三', role: ROLES.REGISTRAR, password: bcrypt.hashSync('123456', salt) },
  { username: 'reviewer', name: '李四', role: ROLES.REVIEWER, password: bcrypt.hashSync('123456', salt) },
  { username: 'approver', name: '王五', role: ROLES.APPROVER, password: bcrypt.hashSync('123456', salt) }
]

const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password, name, role) VALUES (?, ?, ?, ?)')
users.forEach(u => {
  insertUser.run(u.username, u.password, u.name, u.role)
})
console.log('用户数据初始化完成')

const insertOrder = db.prepare(`
  INSERT INTO policy_orders (order_no, title, applicant, amount, status, abnormal_type, timeout_deadline, reject_reason, audit_remark, result_content, created_by, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertReqDef = db.prepare(`
  INSERT INTO required_attachment_defs (order_id, name, sort_order) VALUES (?, ?, ?)
`)

const insertAttachment = db.prepare(`
  INSERT INTO attachments (order_id, required_def_id, parent_id, name, file_type, file_size, att_status, required, rejected, reject_reason, version, uploaded_by, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertReview = db.prepare(`
  INSERT INTO review_records (order_id, operator_id, action, remark, from_status, to_status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const insertAudit = db.prepare(`
  INSERT INTO audit_logs (order_id, operator_id, action, failure_reason, detail, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const now = Date.now()
const dayMs = 24 * 60 * 60 * 1000

type DemoOrder = {
  order_no: string
  title: string
  applicant: string
  amount: number
  status: string
  abnormal_type: string | null
  timeout_deadline: string | null
  reject_reason: string | null
  audit_remark: string | null
  result_content: string | null
  created_by: number
  created_at: string
  updated_at: string
  requiredDefs: string[]
  attachments: Array<{
    defName?: string
    parent_id?: number | null
    name: string
    file_type: string
    file_size: number
    att_status: string
    required: number
    rejected: number
    reject_reason: string | null
    version: number
    uploaded_by: number
    created_at: string
  }>
  reviews: Array<{ operator_id: number; action: string; remark: string | null; from_status: string; to_status: string; created_at: string }>
  audits: Array<{ operator_id: number; action: string; failure_reason: string; detail: string; created_at: string }>
}

const orders: DemoOrder[] = [
  {
    order_no: 'ZC2024001',
    title: '高新技术企业认定奖励',
    applicant: '科技有限公司',
    amount: 500000,
    status: STATUS.PENDING_REVIEW,
    abnormal_type: null,
    timeout_deadline: null,
    reject_reason: null,
    audit_remark: null,
    result_content: null,
    created_by: 1,
    created_at: new Date(now - dayMs * 2).toISOString(),
    updated_at: new Date(now - dayMs * 2).toISOString(),
    requiredDefs: ['营业执照', '高新技术企业证书'],
    attachments: [
      { defName: '营业执照', name: '营业执照.pdf', file_type: 'pdf', file_size: 1024000, att_status: ATTACHMENT_STATUS.ACTIVE, required: 1, rejected: 0, reject_reason: null, version: 1, uploaded_by: 1, created_at: new Date(now - dayMs * 2).toISOString() },
      { defName: '高新技术企业证书', name: '高新技术企业证书.pdf', file_type: 'pdf', file_size: 2048000, att_status: ATTACHMENT_STATUS.ACTIVE, required: 1, rejected: 0, reject_reason: null, version: 1, uploaded_by: 1, created_at: new Date(now - dayMs * 2).toISOString() }
    ],
    reviews: [
      { operator_id: 1, action: '发起审核', remark: '材料齐全，申请审核', from_status: STATUS.DRAFT, to_status: STATUS.PENDING_REVIEW, created_at: new Date(now - dayMs * 2).toISOString() }
    ],
    audits: []
  },
  {
    order_no: 'ZC2024002',
    title: '研发费用加计扣除补贴',
    applicant: '创新科技有限公司',
    amount: 300000,
    status: STATUS.PENDING_CORRECTION,
    abnormal_type: ABNORMAL_TYPES.MISSING_ATTACHMENT,
    timeout_deadline: new Date(now + dayMs * 3).toISOString(),
    reject_reason: '缺少研发费用专项审计报告，研发费用台账数据与纳税申报表不符',
    audit_remark: null,
    result_content: null,
    created_by: 1,
    created_at: new Date(now - dayMs * 5).toISOString(),
    updated_at: new Date(now - dayMs * 1).toISOString(),
    requiredDefs: ['营业执照', '研发费用台账', '研发费用专项审计报告', '研发人员清单'],
    attachments: [
      { defName: '营业执照', name: '营业执照.pdf', file_type: 'pdf', file_size: 1024000, att_status: ATTACHMENT_STATUS.ACTIVE, required: 1, rejected: 0, reject_reason: null, version: 1, uploaded_by: 1, created_at: new Date(now - dayMs * 5).toISOString() },
      { defName: '研发费用台账', name: '研发费用台账.pdf', file_type: 'pdf', file_size: 1536000, att_status: ATTACHMENT_STATUS.REJECTED, required: 1, rejected: 1, reject_reason: '数据与纳税申报表不一致，2023年Q3研发费用台账金额为120万，纳税申报表金额为95万，请核对后重新上传', version: 1, uploaded_by: 1, created_at: new Date(now - dayMs * 5).toISOString() }
    ],
    reviews: [
      { operator_id: 1, action: '发起审核', remark: '初次提交', from_status: STATUS.DRAFT, to_status: STATUS.PENDING_REVIEW, created_at: new Date(now - dayMs * 5).toISOString() },
      { operator_id: 2, action: '驳回补正', remark: '缺少关键材料，研发台账数据有误', from_status: STATUS.PENDING_REVIEW, to_status: STATUS.PENDING_CORRECTION, created_at: new Date(now - dayMs * 1).toISOString() }
    ],
    audits: [
      { operator_id: 2, action: '审核驳回', failure_reason: '缺少研发费用专项审计报告和研发人员清单，研发费用台账与纳税申报表数据不符', detail: '需补充：1.研发费用专项审计报告；2.研发人员清单；3.更正研发费用台账数据后重新上传', created_at: new Date(now - dayMs * 1).toISOString() }
    ]
  },
  {
    order_no: 'ZC2024003',
    title: '稳岗返还补贴',
    applicant: '制造有限公司',
    amount: 80000,
    status: STATUS.PENDING_REVIEW,
    abnormal_type: ABNORMAL_TYPES.TIMEOUT,
    timeout_deadline: new Date(now - dayMs * 1).toISOString(),
    reject_reason: null,
    audit_remark: null,
    result_content: null,
    created_by: 1,
    created_at: new Date(now - dayMs * 10).toISOString(),
    updated_at: new Date(now - dayMs * 8).toISOString(),
    requiredDefs: ['营业执照', '社保缴纳证明'],
    attachments: [
      { defName: '营业执照', name: '营业执照.pdf', file_type: 'pdf', file_size: 1024000, att_status: ATTACHMENT_STATUS.ACTIVE, required: 1, rejected: 0, reject_reason: null, version: 1, uploaded_by: 1, created_at: new Date(now - dayMs * 10).toISOString() },
      { defName: '社保缴纳证明', name: '社保缴纳证明.pdf', file_type: 'pdf', file_size: 512000, att_status: ATTACHMENT_STATUS.ACTIVE, required: 1, rejected: 0, reject_reason: null, version: 1, uploaded_by: 1, created_at: new Date(now - dayMs * 10).toISOString() }
    ],
    reviews: [
      { operator_id: 1, action: '发起审核', remark: '稳岗补贴申请', from_status: STATUS.DRAFT, to_status: STATUS.PENDING_REVIEW, created_at: new Date(now - dayMs * 8).toISOString() }
    ],
    audits: []
  },
  {
    order_no: 'ZC2024004',
    title: '专精特新企业奖励',
    applicant: '精密仪器有限公司',
    amount: 200000,
    status: STATUS.REJECTED,
    abnormal_type: ABNORMAL_TYPES.REJECTED,
    timeout_deadline: null,
    reject_reason: '经核实，企业不符合专精特新认定标准，研发投入占比不足3%',
    audit_remark: null,
    result_content: null,
    created_by: 1,
    created_at: new Date(now - dayMs * 15).toISOString(),
    updated_at: new Date(now - dayMs * 7).toISOString(),
    requiredDefs: ['营业执照', '专精特新证书'],
    attachments: [
      { defName: '营业执照', name: '营业执照.pdf', file_type: 'pdf', file_size: 1024000, att_status: ATTACHMENT_STATUS.ACTIVE, required: 1, rejected: 0, reject_reason: null, version: 1, uploaded_by: 1, created_at: new Date(now - dayMs * 15).toISOString() },
      { defName: '专精特新证书', name: '专精特新证书.pdf', file_type: 'pdf', file_size: 2048000, att_status: ATTACHMENT_STATUS.REJECTED, required: 1, rejected: 1, reject_reason: '证书有效期至2023年12月，已过期，需重新认定', version: 1, uploaded_by: 1, created_at: new Date(now - dayMs * 15).toISOString() }
    ],
    reviews: [
      { operator_id: 1, action: '发起审核', remark: '专精特新奖励申请', from_status: STATUS.DRAFT, to_status: STATUS.PENDING_REVIEW, created_at: new Date(now - dayMs * 15).toISOString() },
      { operator_id: 2, action: '审核通过', remark: '材料齐全，符合条件', from_status: STATUS.PENDING_REVIEW, to_status: STATUS.REVIEWED, created_at: new Date(now - dayMs * 12).toISOString() },
      { operator_id: 3, action: '复核退回', remark: '证书过期，资质不符', from_status: STATUS.REVIEWED, to_status: STATUS.REJECTED, created_at: new Date(now - dayMs * 7).toISOString() }
    ],
    audits: [
      { operator_id: 3, action: '复核驳回', failure_reason: '专精特新证书已过期，且研发投入占比不足，不符合奖励条件', detail: '1.专精特新证书有效期至2023年12月，已过期；2.2023年研发投入占营业收入比例为2.5%，低于3%的要求', created_at: new Date(now - dayMs * 7).toISOString() }
    ]
  },
  {
    order_no: 'ZC2024005',
    title: '吸纳就业补贴',
    applicant: '服务有限公司',
    amount: 50000,
    status: STATUS.ARCHIVED,
    abnormal_type: null,
    timeout_deadline: null,
    reject_reason: null,
    audit_remark: '审核流程规范，材料齐全，符合补贴条件',
    result_content: '补贴5万元已于2024年10月15日拨付至企业对公账户',
    created_by: 1,
    created_at: new Date(now - dayMs * 30).toISOString(),
    updated_at: new Date(now - dayMs * 20).toISOString(),
    requiredDefs: ['营业执照', '新增人员社保清单', '劳动合同备案表'],
    attachments: [
      { defName: '营业执照', name: '营业执照.pdf', file_type: 'pdf', file_size: 1024000, att_status: ATTACHMENT_STATUS.ACTIVE, required: 1, rejected: 0, reject_reason: null, version: 1, uploaded_by: 1, created_at: new Date(now - dayMs * 30).toISOString() },
      { defName: '新增人员社保清单', name: '新增人员社保清单.pdf', file_type: 'pdf', file_size: 768000, att_status: ATTACHMENT_STATUS.ACTIVE, required: 1, rejected: 0, reject_reason: null, version: 1, uploaded_by: 1, created_at: new Date(now - dayMs * 30).toISOString() },
      { defName: '劳动合同备案表', name: '劳动合同备案表.pdf', file_type: 'pdf', file_size: 1024000, att_status: ATTACHMENT_STATUS.ACTIVE, required: 1, rejected: 0, reject_reason: null, version: 1, uploaded_by: 1, created_at: new Date(now - dayMs * 30).toISOString() }
    ],
    reviews: [
      { operator_id: 1, action: '发起审核', remark: '吸纳就业补贴申请', from_status: STATUS.DRAFT, to_status: STATUS.PENDING_REVIEW, created_at: new Date(now - dayMs * 30).toISOString() },
      { operator_id: 2, action: '审核通过', remark: '符合条件，材料齐全', from_status: STATUS.PENDING_REVIEW, to_status: STATUS.REVIEWED, created_at: new Date(now - dayMs * 25).toISOString() },
      { operator_id: 3, action: '复核通过', remark: '同意补贴', from_status: STATUS.REVIEWED, to_status: STATUS.APPROVED, created_at: new Date(now - dayMs * 22).toISOString() },
      { operator_id: 3, action: '归档', remark: '流程完成，已归档', from_status: STATUS.APPROVED, to_status: STATUS.ARCHIVED, created_at: new Date(now - dayMs * 20).toISOString() }
    ],
    audits: []
  },
  {
    order_no: 'ZC2024006',
    title: '科技型中小企业奖励',
    applicant: '软件科技有限公司',
    amount: 100000,
    status: STATUS.DRAFT,
    abnormal_type: null,
    timeout_deadline: null,
    reject_reason: null,
    audit_remark: null,
    result_content: null,
    created_by: 1,
    created_at: new Date(now - dayMs * 1).toISOString(),
    updated_at: new Date(now - dayMs * 1).toISOString(),
    requiredDefs: ['营业执照', '科技型中小企业证书', '近一年纳税证明'],
    attachments: [],
    reviews: [],
    audits: []
  },
  {
    order_no: 'ZC2024007',
    title: '一次性创业补贴',
    applicant: '创业有限公司',
    amount: 10000,
    status: STATUS.DRAFT,
    abnormal_type: null,
    timeout_deadline: null,
    reject_reason: null,
    audit_remark: null,
    result_content: null,
    created_by: 1,
    created_at: new Date(now - dayMs * 1).toISOString(),
    updated_at: new Date(now - dayMs * 1).toISOString(),
    requiredDefs: ['营业执照', '法人身份证', '银行开户证明'],
    attachments: [
      { defName: '营业执照', name: '营业执照.pdf', file_type: 'pdf', file_size: 1024000, att_status: ATTACHMENT_STATUS.ACTIVE, required: 1, rejected: 0, reject_reason: null, version: 1, uploaded_by: 1, created_at: new Date(now - dayMs * 1).toISOString() }
    ],
    reviews: [],
    audits: []
  }
]

orders.forEach((order, idx) => {
  const info = insertOrder.run(
    order.order_no, order.title, order.applicant, order.amount,
    order.status, order.abnormal_type, order.timeout_deadline,
    order.reject_reason, order.audit_remark, order.result_content,
    order.created_by, order.created_at, order.updated_at
  )
  const orderId = info.lastInsertRowid as number
  
  const defNameToId: Record<string, number> = {}
  order.requiredDefs.forEach((defName, sortIdx) => {
    const defInfo = insertReqDef.run(orderId, defName, sortIdx)
    defNameToId[defName] = defInfo.lastInsertRowid as number
  })
  
  order.attachments.forEach(att => {
    const requiredDefId = att.defName ? defNameToId[att.defName] || null : null
    insertAttachment.run(
      orderId, requiredDefId, att.parent_id || null, att.name, att.file_type, att.file_size,
      att.att_status, att.required, att.rejected, att.reject_reason,
      att.version, att.uploaded_by, att.created_at
    )
  })
  
  order.reviews.forEach(rv => {
    insertReview.run(orderId, rv.operator_id, rv.action, rv.remark, rv.from_status, rv.to_status, rv.created_at)
  })
  
  order.audits.forEach(au => {
    insertAudit.run(orderId, au.operator_id, au.action, au.failure_reason, au.detail, au.created_at)
  })
  
  console.log(`演示数据 ${idx + 1}/${orders.length} 已插入: ${order.order_no}`)
})

console.log('\n数据库初始化完成！')
console.log('\n用户账号：')
console.log('  政策兑现登记员: registrar / 123456')
console.log('  政策兑现审核主管: reviewer / 123456')
console.log('  园区招商中心复核负责人: approver / 123456')
console.log('\n演示数据说明：')
console.log('  ZC2024001 - 正常单（待审核，材料齐全）')
console.log('  ZC2024002 - 缺材料单（待补正：缺2个必备附件，研发台账被驳回；补齐后可回到待审核）')
console.log('  ZC2024003 - 超时单（待审核，已超过办理时限）')
console.log('  ZC2024004 - 退回单（已退回，证书过期资质不符）')
console.log('  ZC2024005 - 已归档单（正常流程完成）')
console.log('  ZC2024006 - 空白草稿（无附件，用于批量提交失败演示）')
console.log('  ZC2024007 - 部分附件草稿（仅1/3附件，用于批量提交失败演示）')
