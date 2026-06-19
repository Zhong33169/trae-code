import { initSchema } from './schema';
import { db } from './db';
import { v4 as uuid } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

initSchema();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function clearTables() {
  db.exec(`
    DELETE FROM temperature_records;
    DELETE FROM sample_operation_logs;
    DELETE FROM sample_appeals;
    DELETE FROM sample_evidences;
    DELETE FROM sample_records;
    DELETE FROM users;
  `);
}
clearTables();

const now = new Date();
const fmt = (d: Date) => d.toISOString();
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const addHours = (d: Date, n: number) => {
  const r = new Date(d);
  r.setHours(r.getHours() + n);
  return r;
};

const insertUser = db.prepare(
  'INSERT INTO users (id, name, role, username) VALUES (?, ?, ?, ?)'
);
const users = [
  { id: 'u1', name: '张三(登记员)', role: 'clerk', username: 'zhangsan' },
  { id: 'u2', name: '李主管', role: 'qc_supervisor', username: 'lisupervisor' },
  { id: 'u3', name: '王经理', role: 'production_manager', username: 'wangmanager' },
];
for (const u of users) insertUser.run(u.id, u.name, u.role, u.username);

const insertSample = db.prepare(
  `INSERT INTO sample_records (
    id, record_no, batch_no, product_name, production_line, sample_time,
    sample_temperature, storage_location, operator, evidence_count, status,
    current_handler, current_role, version, deadline, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const insertEvidence = db.prepare(
  'INSERT INTO sample_evidences (id, sample_id, type, name, url, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)'
);

const insertAppeal = db.prepare(
  `INSERT INTO sample_appeals (id, sample_id, version, submitter, submitter_role,
   reason, status, review_opinion, reject_reason, previous_status, submitted_at, reviewed_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const insertLog = db.prepare(
  `INSERT INTO sample_operation_logs (id, sample_id, operator, operator_role, action,
   from_status, to_status, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const insertTemp = db.prepare(
  `INSERT INTO temperature_records (id, sample_id, measure_time, temperature, location, recorder, is_abnormal, remark)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

interface ScenarioInput {
  id: string;
  record_no: string;
  batch_no: string;
  product_name: string;
  production_line: string;
  sample_time: string;
  sample_temperature: number;
  storage_location: string;
  operator: string;
  evidence_count: number;
  status: string;
  current_handler: string;
  current_role: string;
  version: number;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

const scenarios: ScenarioInput[] = [
  {
    id: 's1',
    record_no: 'YL20240601',
    batch_no: 'PC2024060101',
    product_name: '红烧排骨套餐',
    production_line: 'A线-热厨',
    sample_time: fmt(addDays(now, -2)).slice(0, 19).replace('T', ' '),
    sample_temperature: 4.2,
    storage_location: '冷藏库A-03柜',
    operator: '张三(登记员)',
    evidence_count: 3,
    status: 'manager_approved',
    current_handler: '王经理',
    current_role: 'production_manager',
    version: 4,
    deadline: fmt(addDays(now, 5)).slice(0, 19).replace('T', ' '),
    created_at: fmt(addDays(now, -2)),
    updated_at: fmt(addHours(now, -2)),
  },
  {
    id: 's2',
    record_no: 'YL20240602',
    batch_no: 'PC2024060102',
    product_name: '清炒时蔬',
    production_line: 'B线-素炒',
    sample_time: fmt(addDays(now, -1)).slice(0, 19).replace('T', ' '),
    sample_temperature: 3.8,
    storage_location: '冷藏库A-01柜',
    operator: '张三(登记员)',
    evidence_count: 1,
    status: 'evidence_missing',
    current_handler: '张三(登记员)',
    current_role: 'clerk',
    version: 3,
    deadline: fmt(addHours(now, 6)).slice(0, 19).replace('T', ' '),
    created_at: fmt(addDays(now, -1)),
    updated_at: fmt(addHours(now, -10)),
  },
  {
    id: 's3',
    record_no: 'YL20240603',
    batch_no: 'PC2024060103',
    product_name: '黑椒牛柳',
    production_line: 'A线-热厨',
    sample_time: fmt(addDays(now, -3)).slice(0, 19).replace('T', ' '),
    sample_temperature: 5.1,
    storage_location: '冷藏库B-02柜',
    operator: '张三(登记员)',
    evidence_count: 2,
    status: 'overdue',
    current_handler: '张三(登记员)',
    current_role: 'clerk',
    version: 2,
    deadline: fmt(addDays(now, -1)).slice(0, 19).replace('T', ' '),
    created_at: fmt(addDays(now, -3)),
    updated_at: fmt(addDays(now, -2)),
  },
  {
    id: 's4',
    record_no: 'YL20240604',
    batch_no: 'PC2024060104',
    product_name: '番茄鸡蛋汤',
    production_line: 'C线-汤品',
    sample_time: fmt(addDays(now, -1)).slice(0, 19).replace('T', ' '),
    sample_temperature: 4.5,
    storage_location: '冷藏库A-02柜',
    operator: '张三(登记员)',
    evidence_count: 2,
    status: 'qc_rejected',
    current_handler: '张三(登记员)',
    current_role: 'clerk',
    version: 3,
    deadline: fmt(addDays(now, 3)).slice(0, 19).replace('T', ' '),
    created_at: fmt(addDays(now, -1)),
    updated_at: fmt(addHours(now, -5)),
  },
  {
    id: 's5',
    record_no: 'YL20240605',
    batch_no: 'PC2024060105',
    product_name: '鱼香肉丝',
    production_line: 'A线-热厨',
    sample_time: fmt(addHours(now, -26)).slice(0, 19).replace('T', ' '),
    sample_temperature: 4.0,
    storage_location: '冷藏库B-01柜',
    operator: '张三(登记员)',
    evidence_count: 2,
    status: 'appeal_rejected',
    current_handler: '张三(登记员)',
    current_role: 'clerk',
    version: 5,
    deadline: fmt(addDays(now, 4)).slice(0, 19).replace('T', ' '),
    created_at: fmt(addHours(now, -26)),
    updated_at: fmt(addHours(now, -3)),
  },
  {
    id: 's6',
    record_no: 'YL20240606',
    batch_no: 'PC2024060106',
    product_name: '宫保鸡丁',
    production_line: 'A线-热厨',
    sample_time: fmt(addHours(now, -8)).slice(0, 19).replace('T', ' '),
    sample_temperature: 4.8,
    storage_location: '冷藏库A-04柜',
    operator: '张三(登记员)',
    evidence_count: 2,
    status: 'pending_review',
    current_handler: '李主管',
    current_role: 'qc_supervisor',
    version: 2,
    deadline: fmt(addDays(now, 6)).slice(0, 19).replace('T', ' '),
    created_at: fmt(addHours(now, -8)),
    updated_at: fmt(addHours(now, -7)),
  },
  {
    id: 's7',
    record_no: 'YL20240607',
    batch_no: 'PC2024060107',
    product_name: '蒜蓉西兰花',
    production_line: 'B线-素炒',
    sample_time: fmt(addHours(now, -4)).slice(0, 19).replace('T', ' '),
    sample_temperature: 3.9,
    storage_location: '冷藏库A-05柜',
    operator: '张三(登记员)',
    evidence_count: 3,
    status: 'qc_approved',
    current_handler: '王经理',
    current_role: 'production_manager',
    version: 3,
    deadline: fmt(addDays(now, 6)).slice(0, 19).replace('T', ' '),
    created_at: fmt(addHours(now, -4)),
    updated_at: fmt(addHours(now, -1)),
  },
  {
    id: 's8',
    record_no: 'YL20240608',
    batch_no: 'PC2024060108',
    product_name: '麻婆豆腐',
    production_line: 'A线-热厨',
    sample_time: fmt(addHours(now, -20)).slice(0, 19).replace('T', ' '),
    sample_temperature: 4.3,
    storage_location: '冷藏库B-03柜',
    operator: '张三(登记员)',
    evidence_count: 2,
    status: 'appeal_submitted',
    current_handler: '李主管',
    current_role: 'qc_supervisor',
    version: 4,
    deadline: fmt(addDays(now, 5)).slice(0, 19).replace('T', ' '),
    created_at: fmt(addHours(now, -20)),
    updated_at: fmt(addHours(now, -2)),
  },
  {
    id: 's9',
    record_no: 'YL20240609',
    batch_no: 'PC2024060109',
    product_name: '白切鸡',
    production_line: 'D线-冷荤',
    sample_time: fmt(addHours(now, -30)).slice(0, 19).replace('T', ' '),
    sample_temperature: 2.8,
    storage_location: '冷藏库C-01柜',
    operator: '张三(登记员)',
    evidence_count: 0,
    status: 'draft',
    current_handler: '张三(登记员)',
    current_role: 'clerk',
    version: 1,
    deadline: null,
    created_at: fmt(addHours(now, -30)),
    updated_at: fmt(addHours(now, -30)),
  },
  {
    id: 's10',
    record_no: 'YL20240610',
    batch_no: 'PC2024060110',
    product_name: '酸辣土豆丝',
    production_line: 'B线-素炒',
    sample_time: fmt(addHours(now, -12)).slice(0, 19).replace('T', ' '),
    sample_temperature: 4.1,
    storage_location: '冷藏库A-06柜',
    operator: '张三(登记员)',
    evidence_count: 2,
    status: 'manager_rejected',
    current_handler: '张三(登记员)',
    current_role: 'clerk',
    version: 5,
    deadline: fmt(addDays(now, 2)).slice(0, 19).replace('T', ' '),
    created_at: fmt(addHours(now, -12)),
    updated_at: fmt(addHours(now, -1)),
  },
];

for (const s of scenarios) {
  insertSample.run(
    s.id, s.record_no, s.batch_no, s.product_name, s.production_line, s.sample_time,
    s.sample_temperature, s.storage_location, s.operator, s.evidence_count, s.status,
    s.current_handler, s.current_role, s.version, s.deadline, s.created_at, s.updated_at
  );
}

const evidences: any[] = [
  { id: uuid(), sample_id: 's1', type: 'photo', name: '留样照片-红烧排骨.jpg', url: '/mock/ev/s1-1.jpg', uploaded_at: fmt(addDays(now, -2)) },
  { id: uuid(), sample_id: 's1', type: 'temperature', name: '温度记录表.pdf', url: '/mock/ev/s1-2.pdf', uploaded_at: fmt(addDays(now, -2)) },
  { id: uuid(), sample_id: 's1', type: 'photo', name: '入库确认照.jpg', url: '/mock/ev/s1-3.jpg', uploaded_at: fmt(addDays(now, -2)) },

  { id: uuid(), sample_id: 's2', type: 'photo', name: '留样照片-清炒时蔬.jpg', url: '/mock/ev/s2-1.jpg', uploaded_at: fmt(addDays(now, -1)) },

  { id: uuid(), sample_id: 's3', type: 'photo', name: '留样照片-黑椒牛柳.jpg', url: '/mock/ev/s3-1.jpg', uploaded_at: fmt(addDays(now, -3)) },
  { id: uuid(), sample_id: 's3', type: 'temperature', name: '温度记录.xlsx', url: '/mock/ev/s3-2.xlsx', uploaded_at: fmt(addDays(now, -3)) },

  { id: uuid(), sample_id: 's4', type: 'photo', name: '留样照片-番茄蛋汤.jpg', url: '/mock/ev/s4-1.jpg', uploaded_at: fmt(addDays(now, -1)) },
  { id: uuid(), sample_id: 's4', type: 'temperature', name: '温度记录.pdf', url: '/mock/ev/s4-2.pdf', uploaded_at: fmt(addDays(now, -1)) },

  { id: uuid(), sample_id: 's5', type: 'photo', name: '留样照片-鱼香肉丝.jpg', url: '/mock/ev/s5-1.jpg', uploaded_at: fmt(addHours(now, -26)) },
  { id: uuid(), sample_id: 's5', type: 'temperature', name: '温度记录表.pdf', url: '/mock/ev/s5-2.pdf', uploaded_at: fmt(addHours(now, -26)) },

  { id: uuid(), sample_id: 's6', type: 'photo', name: '留样照片-宫保鸡丁.jpg', url: '/mock/ev/s6-1.jpg', uploaded_at: fmt(addHours(now, -8)) },
  { id: uuid(), sample_id: 's6', type: 'temperature', name: '温度记录.pdf', url: '/mock/ev/s6-2.pdf', uploaded_at: fmt(addHours(now, -8)) },

  { id: uuid(), sample_id: 's7', type: 'photo', name: '留样照片-蒜蓉西兰花.jpg', url: '/mock/ev/s7-1.jpg', uploaded_at: fmt(addHours(now, -4)) },
  { id: uuid(), sample_id: 's7', type: 'temperature', name: '温度记录.pdf', url: '/mock/ev/s7-2.pdf', uploaded_at: fmt(addHours(now, -4)) },
  { id: uuid(), sample_id: 's7', type: 'photo', name: '品控确认照.jpg', url: '/mock/ev/s7-3.jpg', uploaded_at: fmt(addHours(now, -3)) },

  { id: uuid(), sample_id: 's8', type: 'photo', name: '留样照片-麻婆豆腐.jpg', url: '/mock/ev/s8-1.jpg', uploaded_at: fmt(addHours(now, -20)) },
  { id: uuid(), sample_id: 's8', type: 'temperature', name: '温度记录.pdf', url: '/mock/ev/s8-2.pdf', uploaded_at: fmt(addHours(now, -20)) },

  { id: uuid(), sample_id: 's10', type: 'photo', name: '留样照片-酸辣土豆丝.jpg', url: '/mock/ev/s10-1.jpg', uploaded_at: fmt(addHours(now, -12)) },
  { id: uuid(), sample_id: 's10', type: 'temperature', name: '温度记录.pdf', url: '/mock/ev/s10-2.pdf', uploaded_at: fmt(addHours(now, -12)) },
];

for (const e of evidences) {
  insertEvidence.run(e.id, e.sample_id, e.type, e.name, e.url, e.uploaded_at);
}

const appeals: any[] = [
  {
    id: 'a1', sample_id: 's4', version: 2, submitter: '张三(登记员)', submitter_role: 'clerk',
    reason: '温度数据录入笔误，实际温度符合要求，已重新核验现场冷藏柜温度日志', status: 'submitted',
    review_opinion: null, reject_reason: null, previous_status: 'qc_rejected',
    submitted_at: fmt(addHours(now, -4)), reviewed_at: null,
  },
  {
    id: 'a2', sample_id: 's5', version: 3, submitter: '张三(登记员)', submitter_role: 'clerk',
    reason: '现场温度监测设备偶发故障，已提供设备校准报告及人工复测记录', status: 'rejected',
    review_opinion: '证据链不完整，缺少设备故障时段的第三方见证记录',
    reject_reason: '需补充现场见证人员签字确认的纸质记录扫描件',
    previous_status: 'qc_rejected', submitted_at: fmt(addHours(now, -10)),
    reviewed_at: fmt(addHours(now, -3)),
  },
  {
    id: 'a3', sample_id: 's8', version: 3, submitter: '张三(登记员)', submitter_role: 'clerk',
    reason: '留样时间标注错误，实际留样在规定时限内完成，有监控录像为证', status: 'submitted',
    review_opinion: null, reject_reason: null, previous_status: 'qc_rejected',
    submitted_at: fmt(addHours(now, -2)), reviewed_at: null,
  },
  {
    id: 'a4', sample_id: 's10', version: 4, submitter: '张三(登记员)', submitter_role: 'clerk',
    reason: '生产批次关联记录混淆，已梳理清楚各批次流向', status: 'submitted',
    review_opinion: '品控已复核，材料完整，建议经理复核', reject_reason: null,
    previous_status: 'qc_rejected', submitted_at: fmt(addHours(now, -6)),
    reviewed_at: fmt(addHours(now, -4)),
  },
];

for (const a of appeals) {
  insertAppeal.run(
    a.id, a.sample_id, a.version, a.submitter, a.submitter_role, a.reason,
    a.status, a.review_opinion, a.reject_reason, a.previous_status, a.submitted_at, a.reviewed_at
  );
}

const logs: any[] = [
  { id: uuid(), sample_id: 's1', operator: '张三(登记员)', operator_role: 'clerk', action: '建单', from_status: null, to_status: 'draft', remark: '排产文员创建留样记录', created_at: fmt(addDays(now, -2)) },
  { id: uuid(), sample_id: 's1', operator: '张三(登记员)', operator_role: 'clerk', action: '提交审核', from_status: 'draft', to_status: 'pending_review', remark: '证据共 3 项', created_at: fmt(addDays(now, -2)) },
  { id: uuid(), sample_id: 's1', operator: '李主管', operator_role: 'qc_supervisor', action: '品控审核通过', from_status: 'pending_review', to_status: 'qc_approved', remark: '温度、照片、入库记录完整', created_at: fmt(addDays(now, -1)) },
  { id: uuid(), sample_id: 's1', operator: '王经理', operator_role: 'production_manager', action: '生产经理复核通过', from_status: 'qc_approved', to_status: 'manager_approved', remark: '材料齐全，流程合规，同意归档', created_at: fmt(addHours(now, -2)) },

  { id: uuid(), sample_id: 's2', operator: '张三(登记员)', operator_role: 'clerk', action: '建单', from_status: null, to_status: 'draft', remark: '排产文员创建留样记录', created_at: fmt(addDays(now, -1)) },
  { id: uuid(), sample_id: 's2', operator: '张三(登记员)', operator_role: 'clerk', action: '提交审核', from_status: 'draft', to_status: 'pending_review', remark: '证据共 1 项', created_at: fmt(addDays(now, -1)) },
  { id: uuid(), sample_id: 's2', operator: '李主管', operator_role: 'qc_supervisor', action: '要求补正证据', from_status: 'pending_review', to_status: 'evidence_missing', remark: '缺少温度记录文件，补充后再次提交', created_at: fmt(addHours(now, -10)) },

  { id: uuid(), sample_id: 's3', operator: '张三(登记员)', operator_role: 'clerk', action: '建单', from_status: null, to_status: 'draft', remark: '排产文员创建留样记录', created_at: fmt(addDays(now, -3)) },
  { id: uuid(), sample_id: 's3', operator: '张三(登记员)', operator_role: 'clerk', action: '提交审核', from_status: 'draft', to_status: 'pending_review', remark: '证据共 2 项', created_at: fmt(addDays(now, -3)) },
  { id: uuid(), sample_id: 's3', operator: '系统', operator_role: 'clerk', action: '超时标记', from_status: 'pending_review', to_status: 'overdue', remark: '品控审核超过时限 24 小时', created_at: fmt(addDays(now, -2)) },

  { id: uuid(), sample_id: 's4', operator: '张三(登记员)', operator_role: 'clerk', action: '建单', from_status: null, to_status: 'draft', remark: '排产文员创建留样记录', created_at: fmt(addDays(now, -1)) },
  { id: uuid(), sample_id: 's4', operator: '张三(登记员)', operator_role: 'clerk', action: '提交审核', from_status: 'draft', to_status: 'pending_review', remark: '证据共 2 项', created_at: fmt(addDays(now, -1)) },
  { id: uuid(), sample_id: 's4', operator: '李主管', operator_role: 'qc_supervisor', action: '品控驳回', from_status: 'pending_review', to_status: 'qc_rejected', remark: '温度记录与留样照片时间戳不匹配', created_at: fmt(addHours(now, -5)) },
  { id: uuid(), sample_id: 's4', operator: '张三(登记员)', operator_role: 'clerk', action: '提交异常申诉', from_status: 'qc_rejected', to_status: 'appeal_submitted', remark: '温度数据录入笔误，实际温度符合要求，已重新核验现场冷藏柜温度日志', created_at: fmt(addHours(now, -4)) },

  { id: uuid(), sample_id: 's5', operator: '张三(登记员)', operator_role: 'clerk', action: '建单', from_status: null, to_status: 'draft', remark: '排产文员创建留样记录', created_at: fmt(addHours(now, -26)) },
  { id: uuid(), sample_id: 's5', operator: '张三(登记员)', operator_role: 'clerk', action: '提交审核', from_status: 'draft', to_status: 'pending_review', remark: '证据共 2 项', created_at: fmt(addHours(now, -24)) },
  { id: uuid(), sample_id: 's5', operator: '李主管', operator_role: 'qc_supervisor', action: '品控驳回', from_status: 'pending_review', to_status: 'qc_rejected', remark: '测温设备读数异常偏高，需校准', created_at: fmt(addHours(now, -18)) },
  { id: uuid(), sample_id: 's5', operator: '张三(登记员)', operator_role: 'clerk', action: '提交异常申诉', from_status: 'qc_rejected', to_status: 'appeal_submitted', remark: '现场温度监测设备偶发故障，已提供设备校准报告及人工复测记录', created_at: fmt(addHours(now, -10)) },
  { id: uuid(), sample_id: 's5', operator: '李主管', operator_role: 'qc_supervisor', action: '申诉驳回', from_status: 'appeal_submitted', to_status: 'appeal_rejected', remark: '驳回原因: 需补充现场见证人员签字确认的纸质记录扫描件; 意见: 证据链不完整，缺少设备故障时段的第三方见证记录', created_at: fmt(addHours(now, -3)) },

  { id: uuid(), sample_id: 's6', operator: '张三(登记员)', operator_role: 'clerk', action: '建单', from_status: null, to_status: 'draft', remark: '排产文员创建留样记录', created_at: fmt(addHours(now, -8)) },
  { id: uuid(), sample_id: 's6', operator: '张三(登记员)', operator_role: 'clerk', action: '提交审核', from_status: 'draft', to_status: 'pending_review', remark: '证据共 2 项', created_at: fmt(addHours(now, -7)) },

  { id: uuid(), sample_id: 's7', operator: '张三(登记员)', operator_role: 'clerk', action: '建单', from_status: null, to_status: 'draft', remark: '排产文员创建留样记录', created_at: fmt(addHours(now, -4)) },
  { id: uuid(), sample_id: 's7', operator: '张三(登记员)', operator_role: 'clerk', action: '提交审核', from_status: 'draft', to_status: 'pending_review', remark: '证据共 2 项', created_at: fmt(addHours(now, -4)) },
  { id: uuid(), sample_id: 's7', operator: '李主管', operator_role: 'qc_supervisor', action: '品控审核通过', from_status: 'pending_review', to_status: 'qc_approved', remark: '证据齐全，温度正常', created_at: fmt(addHours(now, -1)) },

  { id: uuid(), sample_id: 's8', operator: '张三(登记员)', operator_role: 'clerk', action: '建单', from_status: null, to_status: 'draft', remark: '排产文员创建留样记录', created_at: fmt(addHours(now, -20)) },
  { id: uuid(), sample_id: 's8', operator: '张三(登记员)', operator_role: 'clerk', action: '提交审核', from_status: 'draft', to_status: 'pending_review', remark: '证据共 2 项', created_at: fmt(addHours(now, -18)) },
  { id: uuid(), sample_id: 's8', operator: '李主管', operator_role: 'qc_supervisor', action: '品控驳回', from_status: 'pending_review', to_status: 'qc_rejected', remark: '留样时间超出规定 30 分钟', created_at: fmt(addHours(now, -12)) },
  { id: uuid(), sample_id: 's8', operator: '张三(登记员)', operator_role: 'clerk', action: '提交异常申诉', from_status: 'qc_rejected', to_status: 'appeal_submitted', remark: '留样时间标注错误，实际留样在规定时限内完成，有监控录像为证', created_at: fmt(addHours(now, -2)) },

  { id: uuid(), sample_id: 's9', operator: '张三(登记员)', operator_role: 'clerk', action: '建单', from_status: null, to_status: 'draft', remark: '排产文员创建留样记录', created_at: fmt(addHours(now, -30)) },

  { id: uuid(), sample_id: 's10', operator: '张三(登记员)', operator_role: 'clerk', action: '建单', from_status: null, to_status: 'draft', remark: '排产文员创建留样记录', created_at: fmt(addHours(now, -12)) },
  { id: uuid(), sample_id: 's10', operator: '张三(登记员)', operator_role: 'clerk', action: '提交审核', from_status: 'draft', to_status: 'pending_review', remark: '证据共 2 项', created_at: fmt(addHours(now, -11)) },
  { id: uuid(), sample_id: 's10', operator: '李主管', operator_role: 'qc_supervisor', action: '品控驳回', from_status: 'pending_review', to_status: 'qc_rejected', remark: '批次号与生产计划不一致', created_at: fmt(addHours(now, -9)) },
  { id: uuid(), sample_id: 's10', operator: '张三(登记员)', operator_role: 'clerk', action: '提交异常申诉', from_status: 'qc_rejected', to_status: 'appeal_submitted', remark: '生产批次关联记录混淆，已梳理清楚各批次流向', created_at: fmt(addHours(now, -6)) },
  { id: uuid(), sample_id: 's10', operator: '李主管', operator_role: 'qc_supervisor', action: '申诉受理通过', from_status: 'appeal_submitted', to_status: 'qc_approved', remark: '品控已复核，材料完整，建议经理复核', created_at: fmt(addHours(now, -4)) },
  { id: uuid(), sample_id: 's10', operator: '王经理', operator_role: 'production_manager', action: '生产经理复核驳回', from_status: 'qc_approved', to_status: 'manager_rejected', remark: '仍需补充配送单原始单据作为佐证', created_at: fmt(addHours(now, -1)) },
];

for (const l of logs) {
  insertLog.run(l.id, l.sample_id, l.operator, l.operator_role, l.action, l.from_status, l.to_status, l.remark, l.created_at);
}

const temps: any[] = [
  { id: uuid(), sample_id: 's1', measure_time: fmt(addDays(now, -2)).slice(0, 19).replace('T', ' '), temperature: 4.2, location: '冷藏库A-03', recorder: '张三(登记员)', is_abnormal: 0, remark: null },
  { id: uuid(), sample_id: 's1', measure_time: fmt(addDays(now, -1)).slice(0, 19).replace('T', ' '), temperature: 4.0, location: '冷藏库A-03', recorder: '李主管', is_abnormal: 0, remark: null },
  { id: uuid(), sample_id: 's1', measure_time: fmt(addHours(now, -4)).slice(0, 19).replace('T', ' '), temperature: 4.1, location: '冷藏库A-03', recorder: '李主管', is_abnormal: 0, remark: null },

  { id: uuid(), sample_id: 's2', measure_time: fmt(addDays(now, -1)).slice(0, 19).replace('T', ' '), temperature: 3.8, location: '冷藏库A-01', recorder: '张三(登记员)', is_abnormal: 0, remark: null },

  { id: uuid(), sample_id: 's3', measure_time: fmt(addDays(now, -3)).slice(0, 19).replace('T', ' '), temperature: 5.1, location: '冷藏库B-02', recorder: '张三(登记员)', is_abnormal: 1, remark: '温度略高于阈值 5.0℃' },
  { id: uuid(), sample_id: 's3', measure_time: fmt(addDays(now, -2)).slice(0, 19).replace('T', ' '), temperature: 5.3, location: '冷藏库B-02', recorder: '张三(登记员)', is_abnormal: 1, remark: '温度持续偏高' },

  { id: uuid(), sample_id: 's4', measure_time: fmt(addDays(now, -1)).slice(0, 19).replace('T', ' '), temperature: 4.5, location: '冷藏库A-02', recorder: '张三(登记员)', is_abnormal: 0, remark: null },

  { id: uuid(), sample_id: 's5', measure_time: fmt(addHours(now, -26)).slice(0, 19).replace('T', ' '), temperature: 8.5, location: '冷藏库B-01', recorder: '张三(登记员)', is_abnormal: 1, remark: '测温设备疑似故障，读数偏高' },
  { id: uuid(), sample_id: 's5', measure_time: fmt(addHours(now, -22)).slice(0, 19).replace('T', ' '), temperature: 4.0, location: '冷藏库B-01', recorder: '李主管', is_abnormal: 0, remark: '人工复测温度正常' },

  { id: uuid(), sample_id: 's6', measure_time: fmt(addHours(now, -8)).slice(0, 19).replace('T', ' '), temperature: 4.8, location: '冷藏库A-04', recorder: '张三(登记员)', is_abnormal: 0, remark: null },

  { id: uuid(), sample_id: 's7', measure_time: fmt(addHours(now, -4)).slice(0, 19).replace('T', ' '), temperature: 3.9, location: '冷藏库A-05', recorder: '张三(登记员)', is_abnormal: 0, remark: null },

  { id: uuid(), sample_id: 's8', measure_time: fmt(addHours(now, -20)).slice(0, 19).replace('T', ' '), temperature: 4.3, location: '冷藏库B-03', recorder: '张三(登记员)', is_abnormal: 0, remark: null },

  { id: uuid(), sample_id: 's10', measure_time: fmt(addHours(now, -12)).slice(0, 19).replace('T', ' '), temperature: 4.1, location: '冷藏库A-06', recorder: '张三(登记员)', is_abnormal: 0, remark: null },
];

for (const t of temps) {
  insertTemp.run(t.id, t.sample_id, t.measure_time, t.temperature, t.location, t.recorder, t.is_abnormal, t.remark);
}

console.log('Seed data inserted successfully.');
console.log('Scenarios:', scenarios.length, 'samples with various statuses.');
console.log('  - 正常通过 (manager_approved):', scenarios.filter(s => s.status === 'manager_approved').length);
console.log('  - 缺证据 (evidence_missing):', scenarios.filter(s => s.status === 'evidence_missing').length);
console.log('  - 逾期 (overdue):', scenarios.filter(s => s.status === 'overdue').length);
console.log('  - 退回补正 (qc_rejected + evidence_missing):', scenarios.filter(s => ['qc_rejected', 'evidence_missing'].includes(s.status)).length);
console.log('  - 状态冲突/申诉链路:', scenarios.filter(s => s.status.startsWith('appeal') || s.status === 'manager_rejected').length);
