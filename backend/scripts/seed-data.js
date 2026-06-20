require('dotenv').config();
const db = require('../src/db');

const users = [
  { username: 'registrar01', password: '123456', name: '张伟', role: 'registrar', department: '授信登记部' },
  { username: 'registrar02', password: '123456', name: '李娜', role: 'registrar', department: '授信登记部' },
  { username: 'auditor01', password: '123456', name: '王强', role: 'auditor', department: '授信审核部' },
  { username: 'auditor02', password: '123456', name: '刘芳', role: 'auditor', department: '授信审核部' },
  { username: 'reviewer01', password: '123456', name: '陈明', role: 'reviewer', department: 'B2B复核部' },
  { username: 'reviewer02', password: '123456', name: '赵雪', role: 'reviewer', department: 'B2B复核部' },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, password, name, role, department)
  VALUES (@username, @password, @name, @role, @department)
`);
users.forEach(u => insertUser.run(u));

const registrarId = 1;
const auditorId = 3;
const reviewerId = 5;

const now = new Date();
const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

const applications = [
  {
    app_no: 'CR' + dateStr + '001',
    company_name: '北京华信电子科技有限公司',
    credit_line: 500000,
    applicant: '周经理',
    contact_phone: '13800138001',
    business_type: '电子产品批发',
    status: 'pending_audit',
    current_handler_role: 'auditor',
    current_handler_id: auditorId,
    prev_handler_id: registrarId,
    prev_handler_role: 'registrar',
    prev_opinion: '申请资料齐全，企业资质良好，申请额度合理，提交审核。',
    prev_result: 'submit',
    version: 1,
    evidence_status: 'complete',
    created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '002',
    company_name: '上海盛达贸易有限公司',
    credit_line: 800000,
    applicant: '孙总',
    contact_phone: '13800138002',
    business_type: '建材批发',
    status: 'reject_correction',
    current_handler_role: 'registrar',
    current_handler_id: registrarId,
    prev_handler_id: auditorId,
    prev_handler_role: 'auditor',
    prev_opinion: '财务报表数据异常，近3个月流水不足，需补充银行流水证明。',
    prev_result: 'correction',
    version: 2,
    evidence_status: 'incomplete',
    reject_reason: '缺少近3个月银行对账单',
    created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '003',
    company_name: '广州鸿源食品有限公司',
    credit_line: 1200000,
    applicant: '吴先生',
    contact_phone: '13800138003',
    business_type: '食品饮料批发',
    status: 'pending_review',
    current_handler_role: 'reviewer',
    current_handler_id: reviewerId,
    prev_handler_id: auditorId,
    prev_handler_role: 'auditor',
    prev_opinion: '企业资质审核通过，经营状况良好，风控评分85分，建议授予120万授信额度。',
    prev_result: 'pass',
    version: 1,
    evidence_status: 'complete',
    created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '004',
    company_name: '深圳创新科技有限公司',
    credit_line: 2000000,
    applicant: '林总监',
    contact_phone: '13800138004',
    business_type: '智能设备批发',
    status: 'overdue',
    current_handler_role: 'auditor',
    current_handler_id: auditorId,
    prev_handler_id: registrarId,
    prev_handler_role: 'registrar',
    prev_opinion: '申请已提交，等待审核。',
    prev_result: 'submit',
    version: 1,
    is_overdue: 1,
    evidence_status: 'partial',
    deadline: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 19).replace('T', ' '),
    created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '005',
    company_name: '成都锦绣服装有限公司',
    credit_line: 650000,
    applicant: '黄经理',
    contact_phone: '13800138005',
    business_type: '服装鞋帽批发',
    status: 'review_pass',
    current_handler_role: 'reviewer',
    current_handler_id: reviewerId,
    prev_handler_id: auditorId,
    prev_handler_role: 'auditor',
    prev_opinion: '资料完整，资质良好，复核通过，授信65万元。',
    prev_result: 'pass',
    version: 1,
    evidence_status: 'complete',
    created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '006',
    company_name: '杭州远见网络科技有限公司',
    credit_line: 3000000,
    applicant: '郑总',
    contact_phone: '13800138006',
    business_type: '网络设备批发',
    status: 'conflict',
    current_handler_role: 'reviewer',
    current_handler_id: reviewerId,
    prev_handler_id: auditorId,
    prev_handler_role: 'auditor',
    prev_opinion: '审核意见与历史记录冲突，该企业存在同一法人关联企业授信记录冲突，需复核负责人裁定。',
    prev_result: 'pass',
    version: 2,
    has_conflict: 1,
    evidence_status: 'complete',
    created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '007',
    company_name: '南京中泰化工有限公司',
    credit_line: 1500000,
    applicant: '许经理',
    contact_phone: '13800138007',
    business_type: '化工原料批发',
    status: 'appeal_reviewing',
    current_handler_role: 'reviewer',
    current_handler_id: reviewerId,
    prev_handler_id: registrarId,
    prev_handler_role: 'registrar',
    prev_opinion: '申诉理由：复核驳回理由不成立，补充新证据申诉提交。',
    prev_result: 'appeal',
    version: 3,
    evidence_status: 'complete',
    reject_reason: '复核阶段被驳回：关联企业风险过高',
    created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '008',
    company_name: '武汉鑫达物流有限公司',
    credit_line: 900000,
    applicant: '何总',
    contact_phone: '13800138008',
    business_type: '物流服务',
    status: 'archived',
    current_handler_role: 'reviewer',
    current_handler_id: reviewerId,
    prev_handler_id: auditorId,
    prev_handler_role: 'auditor',
    prev_opinion: '复核通过，已归档，授信90万元。',
    prev_result: 'archive',
    version: 1,
    evidence_status: 'complete',
    created_by: registrarId,
  },
];

const insertApp = db.prepare(`
  INSERT INTO credit_applications (
    app_no, company_name, credit_line, applicant, contact_phone,
    business_type, status, current_handler_role, current_handler_id,
    prev_handler_id, prev_handler_role, prev_opinion, prev_result,
    version, is_overdue, has_conflict, evidence_status,
    reject_reason, deadline, created_by
  ) VALUES (
    @app_no, @company_name, @credit_line, @applicant, @contact_phone,
    @business_type, @status, @current_handler_role, @current_handler_id,
    @prev_handler_id, @prev_handler_role, @prev_opinion, @prev_result,
    @version, @is_overdue, @has_conflict, @evidence_status,
    @reject_reason, @deadline, @created_by
  )
`);
applications.forEach(a => {
  const app = Object.assign({
    is_overdue: 0, has_conflict: 0, reject_reason: null, deadline: null,
    current_handler_role: null, current_handler_id: null, prev_handler_id: null,
    prev_handler_role: null, prev_opinion: null, prev_result: null,
    evidence_status: 'incomplete', applicant: null, contact_phone: null, business_type: null,
    created_by: null, remark: null
  }, a);
  try { insertApp.run(app); } catch (e) { console.log('skip:', a.app_no, e.message); }
});

const evidenceTemplates = [
  { evidence_type: 'business_license', evidence_name: '营业执照', is_required: 1 },
  { evidence_type: 'tax_cert', evidence_name: '税务登记证', is_required: 1 },
  { evidence_type: 'id_card', evidence_name: '法人身份证', is_required: 1 },
  { evidence_type: 'financial_report', evidence_name: '近一年财务报表', is_required: 1 },
  { evidence_type: 'bank_statement', evidence_name: '近3个月银行流水', is_required: 1 },
  { evidence_type: 'contract', evidence_name: '主要业务合同', is_required: 0 },
];

const allApps = db.prepare('SELECT id FROM credit_applications').all();
const insertEvidence = db.prepare(`
  INSERT INTO evidence_items (app_id, evidence_type, evidence_name, is_required, is_submitted, file_name, submit_time)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const submissionMap = {
  1: [1,1,1,1,1,1],
  2: [1,1,1,0,0,1],
  3: [1,1,1,1,1,1],
  4: [1,1,1,1,0,0],
  5: [1,1,1,1,1,1],
  6: [1,1,1,1,1,1],
  7: [1,1,1,1,1,1],
  8: [1,1,1,1,1,1],
};

allApps.forEach(app => {
  const map = submissionMap[app.id] || [1,1,1,1,1,1];
  evidenceTemplates.forEach((tpl, idx) => {
    const submitted = map[idx];
    insertEvidence.run(
      app.id, tpl.evidence_type, tpl.evidence_name, tpl.is_required, submitted,
      submitted ? (tpl.evidence_name + '_CR' + dateStr + app.id + '.pdf') : null,
      submitted ? new Date(Date.now() - 86400000 * (idx + 1)).toISOString().slice(0, 19).replace('T', ' ') : null
    );
  });
});

const nodesData = [
  { app_id: 1, node_type: 'register', node_order: 1, handler_id: 1, handler_role: 'registrar', handler_name: '张伟', opinion: '资料齐全提交审核', result: 'submit', status: 'completed', version: 1 },
  { app_id: 1, node_type: 'audit', node_order: 2, handler_id: null, handler_role: 'auditor', opinion: null, result: null, status: 'processing', version: 1 },
  { app_id: 1, node_type: 'review', node_order: 3, handler_id: null, handler_role: 'reviewer', opinion: null, result: null, status: 'pending', version: 1 },

  { app_id: 2, node_type: 'register', node_order: 1, handler_id: 1, handler_role: 'registrar', handler_name: '张伟', opinion: '初次提交', result: 'submit', status: 'completed', version: 1 },
  { app_id: 2, node_type: 'audit', node_order: 2, handler_id: 3, handler_role: 'auditor', handler_name: '王强', opinion: '财务报表异常，流水不足', result: 'correction', status: 'completed', version: 1 },
  { app_id: 2, node_type: 'correction', node_order: 3, handler_id: 1, handler_role: 'registrar', handler_name: '张伟', opinion: null, result: null, status: 'processing', version: 2 },

  { app_id: 3, node_type: 'register', node_order: 1, handler_id: 1, handler_role: 'registrar', handler_name: '张伟', opinion: '企业资质良好', result: 'submit', status: 'completed', version: 1 },
  { app_id: 3, node_type: 'audit', node_order: 2, handler_id: 3, handler_role: 'auditor', handler_name: '王强', opinion: '审核通过，建议授予120万', result: 'pass', status: 'completed', version: 1 },
  { app_id: 3, node_type: 'review', node_order: 3, handler_id: 5, handler_role: 'reviewer', handler_name: '陈明', opinion: null, result: null, status: 'processing', version: 1 },

  { app_id: 4, node_type: 'register', node_order: 1, handler_id: 1, handler_role: 'registrar', handler_name: '张伟', opinion: '资料部分提交', result: 'submit', status: 'completed', version: 1 },
  { app_id: 4, node_type: 'audit', node_order: 2, handler_id: 3, handler_role: 'auditor', handler_name: '王强', opinion: null, result: null, status: 'processing', version: 1 },

  { app_id: 5, node_type: 'register', node_order: 1, handler_id: 1, handler_role: 'registrar', handler_name: '张伟', opinion: '提交审核', result: 'submit', status: 'completed', version: 1 },
  { app_id: 5, node_type: 'audit', node_order: 2, handler_id: 3, handler_role: 'auditor', handler_name: '王强', opinion: '审核通过，65万额度合理', result: 'pass', status: 'completed', version: 1 },
  { app_id: 5, node_type: 'review', node_order: 3, handler_id: 5, handler_role: 'reviewer', handler_name: '陈明', opinion: '复核通过，授信65万', result: 'pass', status: 'completed', version: 1 },

  { app_id: 6, node_type: 'register', node_order: 1, handler_id: 1, handler_role: 'registrar', handler_name: '张伟', opinion: '提交审核', result: 'submit', status: 'completed', version: 1 },
  { app_id: 6, node_type: 'audit', node_order: 2, handler_id: 3, handler_role: 'auditor', handler_name: '王强', opinion: '关联企业冲突待裁定', result: 'pass', status: 'completed', version: 1 },
  { app_id: 6, node_type: 'review', node_order: 3, handler_id: 5, handler_role: 'reviewer', handler_name: '陈明', opinion: null, result: null, status: 'processing', version: 2 },

  { app_id: 7, node_type: 'register', node_order: 1, handler_id: 1, handler_role: 'registrar', handler_name: '张伟', opinion: '初次提交', result: 'submit', status: 'completed', version: 1 },
  { app_id: 7, node_type: 'audit', node_order: 2, handler_id: 3, handler_role: 'auditor', handler_name: '王强', opinion: '审核通过', result: 'pass', status: 'completed', version: 1 },
  { app_id: 7, node_type: 'review', node_order: 3, handler_id: 5, handler_role: 'reviewer', handler_name: '陈明', opinion: '关联企业风险过高，驳回', result: 'reject', status: 'completed', version: 1 },
  { app_id: 7, node_type: 'appeal', node_order: 4, handler_id: 1, handler_role: 'registrar', handler_name: '张伟', opinion: '补充新证据，不认可驳回理由，提起申诉', result: 'appeal', status: 'completed', version: 2 },
  { app_id: 7, node_type: 'review', node_order: 5, handler_id: 5, handler_role: 'reviewer', handler_name: '陈明', opinion: null, result: null, status: 'processing', version: 3 },

  { app_id: 8, node_type: 'register', node_order: 1, handler_id: 1, handler_role: 'registrar', handler_name: '张伟', opinion: '资料齐全提交', result: 'submit', status: 'completed', version: 1 },
  { app_id: 8, node_type: 'audit', node_order: 2, handler_id: 3, handler_role: 'auditor', handler_name: '王强', opinion: '审核通过，90万合理', result: 'pass', status: 'completed', version: 1 },
  { app_id: 8, node_type: 'review', node_order: 3, handler_id: 5, handler_role: 'reviewer', handler_name: '陈明', opinion: '复核通过，归档', result: 'archive', status: 'completed', version: 1 },
];

const insertNode = db.prepare(`
  INSERT INTO process_nodes (app_id, node_type, node_order, handler_id, handler_role, handler_name, opinion, result, status, start_time, end_time, version)
  VALUES (@app_id, @node_type, @node_order, @handler_id, @handler_role, @handler_name, @opinion, @result, @status, @start_time, @end_time, @version)
`);

nodesData.forEach(n => {
  const node = Object.assign({
    handler_id: null, handler_role: null, handler_name: null, opinion: null,
    result: null, start_time: null, end_time: null
  }, n);
  const start = new Date(Date.now() - 86400000 * (5 - node.node_order));
  node.start_time = node.status !== 'pending' ? start.toISOString().slice(0, 19).replace('T', ' ') : null;
  node.end_time = node.status === 'completed' ? new Date(start.getTime() + 3600000).toISOString().slice(0, 19).replace('T', ' ') : null;
  insertNode.run(node);
});

const logsData = [
  { app_id: 1, user_id: 1, user_name: '张伟', user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', opinion: '申请资料齐全，企业资质良好', evidence_check: 'complete' },
  { app_id: 2, user_id: 1, user_name: '张伟', user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', opinion: '初次提交申请', evidence_check: 'partial' },
  { app_id: 2, user_id: 3, user_name: '王强', user_role: 'auditor', action: 'audit_correction', old_status: 'pending_audit', new_status: 'reject_correction', opinion: '财务报表异常', reject_reason: '缺少近3个月银行流水和财务报表数据异常', evidence_check: 'incomplete' },
  { app_id: 3, user_id: 1, user_name: '张伟', user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', opinion: '提交审核', evidence_check: 'complete' },
  { app_id: 3, user_id: 3, user_name: '王强', user_role: 'auditor', action: 'audit_pass', old_status: 'pending_audit', new_status: 'pending_review', opinion: '企业资质审核通过，经营状况良好，风控评分85分，建议授予120万授信额度。', evidence_check: 'complete' },
  { app_id: 4, user_id: 1, user_name: '张伟', user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', opinion: '资料部分提交', evidence_check: 'partial' },
  { app_id: 4, user_id: null, user_name: '系统', user_role: 'system', action: 'system_overdue', old_status: 'pending_audit', new_status: 'overdue', opinion: '系统超时未处理自动标记逾期' },
  { app_id: 5, user_id: 1, user_name: '张伟', user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', evidence_check: 'complete' },
  { app_id: 5, user_id: 3, user_name: '王强', user_role: 'auditor', action: 'audit_pass', old_status: 'pending_audit', new_status: 'pending_review', opinion: '审核通过，65万额度合理', evidence_check: 'complete' },
  { app_id: 5, user_id: 5, user_name: '陈明', user_role: 'reviewer', action: 'review_pass', old_status: 'pending_review', new_status: 'review_pass', opinion: '复核通过，授信65万', evidence_check: 'complete' },
  { app_id: 6, user_id: 1, user_name: '张伟', user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', evidence_check: 'complete' },
  { app_id: 6, user_id: 3, user_name: '王强', user_role: 'auditor', action: 'audit_pass', old_status: 'pending_audit', new_status: 'pending_review', opinion: '关联企业有历史授信冲突待复核裁定', evidence_check: 'complete' },
  { app_id: 6, user_id: null, user_name: '系统', user_role: 'system', action: 'system_conflict', old_status: 'pending_review', new_status: 'conflict', opinion: '系统检测关联企业授信状态冲突' },
  { app_id: 7, user_id: 1, user_name: '张伟', user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', evidence_check: 'complete' },
  { app_id: 7, user_id: 3, user_name: '王强', user_role: 'auditor', action: 'audit_pass', old_status: 'pending_audit', new_status: 'pending_review', opinion: '审核通过', evidence_check: 'complete' },
  { app_id: 7, user_id: 5, user_name: '陈明', user_role: 'reviewer', action: 'review_reject', old_status: 'pending_review', new_status: 'reject_revision', opinion: '关联企业风险过高', reject_reason: '关联企业风险过高，建议驳回', evidence_check: 'complete' },
  { app_id: 7, user_id: 1, user_name: '张伟', user_role: 'registrar', action: 'appeal_submit', old_status: 'reject_revision', new_status: 'appeal_reviewing', opinion: '补充新证据，不认可驳回理由，申请复核申诉', evidence_check: 'complete' },
  { app_id: 8, user_id: 1, user_name: '张伟', user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', evidence_check: 'complete' },
  { app_id: 8, user_id: 3, user_name: '王强', user_role: 'auditor', action: 'audit_pass', old_status: 'pending_audit', new_status: 'pending_review', opinion: '审核通过，90万合理', evidence_check: 'complete' },
  { app_id: 8, user_id: 5, user_name: '陈明', user_role: 'reviewer', action: 'review_archive', old_status: 'pending_review', new_status: 'archived', opinion: '复核通过，归档完成', evidence_check: 'complete' },
];

const insertLog = db.prepare(`
  INSERT INTO operation_logs (app_id, user_id, user_name, user_role, action, old_status, new_status, opinion, reject_reason, evidence_check, version_from, version_to)
  VALUES (@app_id, @user_id, @user_name, @user_role, @action, @old_status, @new_status, @opinion, @reject_reason, @evidence_check, @version_from, @version_to)
`);
logsData.forEach((l) => {
  const app = db.prepare('SELECT version FROM credit_applications WHERE id=?').get(l.app_id);
  const v = app ? app.version : 1;
  const log = Object.assign({
    user_id: null, user_name: null, user_role: null, opinion: null,
    reject_reason: null, evidence_check: null,
    version_from: v, version_to: v
  }, l);
  log.version_from = (log.action && (log.action.startsWith('appeal') || log.action.includes('correction'))) ? v - 1 : v;
  log.version_to = v;
  insertLog.run(log);
});

console.log('样例数据插入完成');
db.close();
