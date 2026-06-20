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
const registrarName = '张伟';
const auditorId = 3;
const auditorName = '王强';
const reviewerId = 5;
const reviewerName = '陈明';

const now = new Date();
const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

const applications = [
  {
    app_no: 'CR' + dateStr + '001', company_name: '北京华信电子科技有限公司',
    credit_line: 500000, applicant: '周经理', contact_phone: '13800138001', business_type: '电子产品批发',
    status: 'pending_audit',
    current_handler_role: 'auditor', current_handler_id: auditorId,
    prev_handler_id: registrarId, prev_handler_role: 'registrar',
    prev_opinion: '申请资料齐全，企业资质良好，申请额度合理，提交审核。', prev_result: 'submit',
    version: 1, evidence_status: 'complete', created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '002', company_name: '上海盛达贸易有限公司',
    credit_line: 800000, applicant: '孙总', contact_phone: '13800138002', business_type: '建材批发',
    status: 'reject_correction',
    current_handler_role: 'registrar', current_handler_id: registrarId,
    prev_handler_id: auditorId, prev_handler_role: 'auditor',
    prev_opinion: '财务报表数据异常，近3个月流水不足，需补充银行流水证明。', prev_result: 'correction',
    version: 2, evidence_status: 'incomplete',
    reject_reason: '缺少近一年财务报表和近3个月银行流水', created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '003', company_name: '广州鸿源食品有限公司',
    credit_line: 1200000, applicant: '吴先生', contact_phone: '13800138003', business_type: '食品饮料批发',
    status: 'pending_review',
    current_handler_role: 'reviewer', current_handler_id: reviewerId,
    prev_handler_id: auditorId, prev_handler_role: 'auditor',
    prev_opinion: '企业资质审核通过，经营状况良好，风控评分85分，建议授予120万授信额度。', prev_result: 'pass',
    version: 1, evidence_status: 'complete', created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '004', company_name: '深圳创新科技有限公司',
    credit_line: 2000000, applicant: '林总监', contact_phone: '13800138004', business_type: '智能设备批发',
    status: 'overdue',
    current_handler_role: 'auditor', current_handler_id: auditorId,
    prev_handler_id: registrarId, prev_handler_role: 'registrar',
    prev_opinion: '申请已提交，等待审核。', prev_result: 'submit',
    version: 1, is_overdue: 1, evidence_status: 'partial',
    deadline: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 19).replace('T', ' '),
    created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '005', company_name: '成都锦绣服装有限公司',
    credit_line: 650000, applicant: '黄经理', contact_phone: '13800138005', business_type: '服装鞋帽批发',
    status: 'review_pass',
    current_handler_role: 'reviewer', current_handler_id: reviewerId,
    prev_handler_id: auditorId, prev_handler_role: 'auditor',
    prev_opinion: '资料完整，资质良好，复核通过，授信65万元。', prev_result: 'pass',
    version: 1, evidence_status: 'complete', created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '006', company_name: '杭州远见网络科技有限公司',
    credit_line: 3000000, applicant: '郑总', contact_phone: '13800138006', business_type: '网络设备批发',
    status: 'conflict',
    current_handler_role: 'reviewer', current_handler_id: reviewerId,
    prev_handler_id: auditorId, prev_handler_role: 'auditor',
    prev_opinion: '审核意见与历史记录冲突，该企业存在同一法人关联企业授信记录冲突，需复核负责人裁定。', prev_result: 'pass',
    version: 2, has_conflict: 1, evidence_status: 'complete', created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '007', company_name: '南京中泰化工有限公司',
    credit_line: 1500000, applicant: '许经理', contact_phone: '13800138007', business_type: '化工原料批发',
    status: 'appeal_reviewing',
    current_handler_role: 'reviewer', current_handler_id: reviewerId,
    prev_handler_id: registrarId, prev_handler_role: 'registrar',
    prev_opinion: '申诉理由：复核驳回理由不成立，已补充新的供应链业务合同和近3个月大额银行流水证据，提交申诉。', prev_result: 'appeal',
    version: 3, evidence_status: 'complete',
    reject_reason: '复核驳回：关联企业化工行业风险评级下调，综合评估风险过高。',
    created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '008', company_name: '武汉鑫达物流有限公司',
    credit_line: 900000, applicant: '何总', contact_phone: '13800138008', business_type: '物流服务',
    status: 'archived',
    current_handler_role: 'reviewer', current_handler_id: reviewerId,
    prev_handler_id: reviewerId, prev_handler_role: 'reviewer',
    prev_opinion: '复核通过，资料完备，风控评分良好，已归档，授信额度90万元。', prev_result: 'archive',
    version: 1, evidence_status: 'complete', created_by: registrarId,
  },
  {
    app_no: 'CR' + dateStr + '009', company_name: '重庆星锐实业有限公司',
    credit_line: 1600000, applicant: '徐总', contact_phone: '13800138009', business_type: '五金机电批发',
    status: 'archived',
    current_handler_role: 'reviewer', current_handler_id: reviewerId,
    prev_handler_id: reviewerId, prev_handler_role: 'reviewer',
    prev_opinion: '完整流程闭环验证：申诉后复核通过，全部资料齐全，授信160万元已归档。', prev_result: 'archive',
    version: 3, evidence_status: 'complete',
    reject_reason: '首次复核驳回：经营流水连续性不足，需补充第3季度完整业务凭证。',
    created_by: registrarId,
  },
];

const insertApp = db.prepare(`
  INSERT INTO credit_applications (
    app_no, company_name, credit_line, currency, applicant, contact_phone,
    business_type, status, current_handler_role, current_handler_id,
    prev_handler_id, prev_handler_role, prev_opinion, prev_result,
    version, is_overdue, has_conflict, evidence_status,
    reject_reason, deadline, created_by
  ) VALUES (
    @app_no, @company_name, @credit_line, 'CNY', @applicant, @contact_phone,
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
    created_by: null, remark: null, currency: 'CNY'
  }, a);
  try { insertApp.run(app); } catch (e) { console.log('skip app:', a.app_no, e.message); }
});

const evidenceTemplates = [
  { evidence_type: 'business_license', evidence_name: '营业执照', is_required: 1 },
  { evidence_type: 'tax_cert', evidence_name: '税务登记证', is_required: 1 },
  { evidence_type: 'id_card', evidence_name: '法人身份证', is_required: 1 },
  { evidence_type: 'financial_report', evidence_name: '近一年财务报表', is_required: 1 },
  { evidence_type: 'bank_statement', evidence_name: '近3个月银行流水', is_required: 1 },
  { evidence_type: 'contract', evidence_name: '主要业务合同', is_required: 0 },
];
const allApps = db.prepare('SELECT id FROM credit_applications ORDER BY id').all();
const insertEvidence = db.prepare(`
  INSERT INTO evidence_items (app_id, evidence_type, evidence_name, is_required, is_submitted, file_name, submit_time, remark)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
  9: [1,1,1,1,1,1],
};
allApps.forEach(app => {
  const map = submissionMap[app.id] || [1,1,1,1,1,1];
  evidenceTemplates.forEach((tpl, idx) => {
    const submitted = map[idx];
    insertEvidence.run(
      app.id, tpl.evidence_type, tpl.evidence_name, tpl.is_required, submitted,
      submitted ? (tpl.evidence_name + '_CR' + dateStr + String(app.id).padStart(3,'0') + '.pdf') : null,
      submitted ? new Date(Date.now() - 86400000 * (idx + 1) - 3600000 * app.id).toISOString().slice(0, 19).replace('T', ' ') : null,
      submitted ? (tpl.evidence_name + '扫描件，原件已核验一致') : null
    );
  });
});

const fmtTime = (offsetDays, offsetHours = 0) =>
  new Date(Date.now() - 86400000 * offsetDays + 3600000 * offsetHours).toISOString().slice(0, 19).replace('T', ' ');

const nodesData = [
  // 001 北京华信：待审核
  { app_id: 1, node_type: 'register', node_order: 1, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '资料齐全，提交审核', result: 'submit', status: 'completed', start: 4, end: 4, ver: 1 },
  { app_id: 1, node_type: 'audit', node_order: 2, handler_id: auditorId, handler_role: 'auditor', handler_name: auditorName, opinion: null, result: null, status: 'processing', start: 3, ver: 1 },

  // 002 上海盛达：退回补正（V2 correction 处理中）
  { app_id: 2, node_type: 'register', node_order: 1, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '初次提交审核', result: 'submit', status: 'completed', start: 6, end: 6, ver: 1 },
  { app_id: 2, node_type: 'audit', node_order: 2, handler_id: auditorId, handler_role: 'auditor', handler_name: auditorName, opinion: '财务报表未提供，银行流水金额不足审批要求', result: 'correction', status: 'completed', start: 5, end: 5, ver: 1 },
  { app_id: 2, node_type: 'correction', node_order: 3, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: null, result: null, status: 'processing', start: 4, ver: 2 },

  // 003 广州鸿源：待复核
  { app_id: 3, node_type: 'register', node_order: 1, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '企业资质良好，提交审核', result: 'submit', status: 'completed', start: 5, end: 5, ver: 1 },
  { app_id: 3, node_type: 'audit', node_order: 2, handler_id: auditorId, handler_role: 'auditor', handler_name: auditorName, opinion: '审核通过，建议授予120万授信额度', result: 'pass', status: 'completed', start: 4, end: 4, ver: 1 },
  { app_id: 3, node_type: 'review', node_order: 3, handler_id: reviewerId, handler_role: 'reviewer', handler_name: reviewerName, opinion: null, result: null, status: 'processing', start: 3, ver: 1 },

  // 004 深圳创新：逾期（audit 处理中）
  { app_id: 4, node_type: 'register', node_order: 1, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '部分资料先提交，其余后续补', result: 'submit', status: 'completed', start: 6, end: 6, ver: 1 },
  { app_id: 4, node_type: 'audit', node_order: 2, handler_id: auditorId, handler_role: 'auditor', handler_name: auditorName, opinion: null, result: null, status: 'processing', start: 5, ver: 1 },

  // 005 成都锦绣：复核通过（等归档）
  { app_id: 5, node_type: 'register', node_order: 1, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '提交审核', result: 'submit', status: 'completed', start: 7, end: 7, ver: 1 },
  { app_id: 5, node_type: 'audit', node_order: 2, handler_id: auditorId, handler_role: 'auditor', handler_name: auditorName, opinion: '审核通过，65万额度合理', result: 'pass', status: 'completed', start: 5, end: 5, ver: 1 },
  { app_id: 5, node_type: 'review', node_order: 3, handler_id: reviewerId, handler_role: 'reviewer', handler_name: reviewerName, opinion: '复核通过，65万授信', result: 'pass', status: 'completed', start: 3, end: 3, ver: 1 },

  // 006 杭州远见：状态冲突
  { app_id: 6, node_type: 'register', node_order: 1, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '提交审核', result: 'submit', status: 'completed', start: 8, end: 8, ver: 1 },
  { app_id: 6, node_type: 'audit', node_order: 2, handler_id: auditorId, handler_role: 'auditor', handler_name: auditorName, opinion: '审核通过，存在关联企业冲突需复核裁定', result: 'pass', status: 'completed', start: 6, end: 6, ver: 1 },
  { app_id: 6, node_type: 'review', node_order: 3, handler_id: reviewerId, handler_role: 'reviewer', handler_name: reviewerName, opinion: null, result: null, status: 'processing', start: 4, ver: 2 },

  // 007 南京中泰：申诉复核中 V3
  { app_id: 7, node_type: 'register', node_order: 1, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '初次提交审核', result: 'submit', status: 'completed', start: 10, end: 10, ver: 1 },
  { app_id: 7, node_type: 'audit', node_order: 2, handler_id: auditorId, handler_role: 'auditor', handler_name: auditorName, opinion: '审核通过，150万化工行业授信', result: 'pass', status: 'completed', start: 8, end: 8, ver: 1 },
  { app_id: 7, node_type: 'review', node_order: 3, handler_id: reviewerId, handler_role: 'reviewer', handler_name: reviewerName, opinion: '关联企业化工行业风险评级下调，综合评估风险过高，驳回', result: 'reject', status: 'completed', start: 6, end: 6, ver: 1 },
  { app_id: 7, node_type: 'correction', node_order: 4, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '补充银行流水和业务合同，准备申诉', result: null, status: 'completed', start: 4, end: 4, ver: 2 },
  { app_id: 7, node_type: 'appeal', node_order: 5, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '不认可驳回理由，补充新的供应链合同和大额银行流水，提交申诉', result: 'appeal', status: 'completed', start: 3, end: 3, ver: 2 },
  { app_id: 7, node_type: 'review', node_order: 6, handler_id: reviewerId, handler_role: 'reviewer', handler_name: reviewerName, opinion: null, result: null, status: 'processing', start: 2, ver: 3 },

  // 008 武汉鑫达：归档（简单通过）
  { app_id: 8, node_type: 'register', node_order: 1, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '资料齐全提交审核', result: 'submit', status: 'completed', start: 9, end: 9, ver: 1 },
  { app_id: 8, node_type: 'audit', node_order: 2, handler_id: auditorId, handler_role: 'auditor', handler_name: auditorName, opinion: '审核通过，90万额度合理', result: 'pass', status: 'completed', start: 7, end: 7, ver: 1 },
  { app_id: 8, node_type: 'review', node_order: 3, handler_id: reviewerId, handler_role: 'reviewer', handler_name: reviewerName, opinion: '复核通过，归档完成', result: 'archive', status: 'completed', start: 5, end: 5, ver: 1 },

  // 009 重庆星锐：⭐ 完整闭环样例（退回补正→重提→审核通过→复核驳回→申诉→再复核→归档）
  { app_id: 9, node_type: 'register', node_order: 1, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '首次提交，5项必填证据齐全', result: 'submit', status: 'completed', start: 15, end: 15, ver: 1 },
  { app_id: 9, node_type: 'audit', node_order: 2, handler_id: auditorId, handler_role: 'auditor', handler_name: auditorName, opinion: '退回补正：近3个月银行流水金额不足月均120万审批阈值，需补充Q3凭证', result: 'correction', status: 'completed', start: 13, end: 13, ver: 1 },
  { app_id: 9, node_type: 'correction', node_order: 3, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '已补充Q3季度9、10、11月银行流水和4份大额订单合同', result: 'submit', status: 'completed', start: 11, end: 11, ver: 2 },
  { app_id: 9, node_type: 'audit', node_order: 4, handler_id: auditorId, handler_role: 'auditor', handler_name: auditorName, opinion: '补正资料有效，月均流水达标，审核通过', result: 'pass', status: 'completed', start: 9, end: 9, ver: 2 },
  { app_id: 9, node_type: 'review', node_order: 5, handler_id: reviewerId, handler_role: 'reviewer', handler_name: reviewerName, opinion: '首次复核驳回：经营流水连续性不足，需补充第3季度完整业务凭证', result: 'reject', status: 'completed', start: 7, end: 7, ver: 2 },
  { app_id: 9, node_type: 'correction', node_order: 6, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '收集了3季度12份完整业务凭证和供应商对账函', result: null, status: 'completed', start: 5, end: 5, ver: 3 },
  { app_id: 9, node_type: 'appeal', node_order: 7, handler_id: registrarId, handler_role: 'registrar', handler_name: registrarName, opinion: '已补充Q3完整业务凭证12份+供应商对账函3份，认为原驳回理由不成立，申诉提交', result: 'appeal', status: 'completed', start: 4, end: 4, ver: 3 },
  { app_id: 9, node_type: 'review', node_order: 8, handler_id: reviewerId, handler_role: 'reviewer', handler_name: reviewerName, opinion: '申诉资料核查通过，月均流水+业务凭证完整，复核通过', result: 'pass', status: 'completed', start: 2, end: 2, ver: 3 },
  { app_id: 9, node_type: 'review', node_order: 9, handler_id: reviewerId, handler_role: 'reviewer', handler_name: reviewerName, opinion: '完整流程闭环验证通过：申请→退回补正→重提→复核驳回→申诉→再复核→归档，授信160万', result: 'archive', status: 'completed', start: 1, end: 1, ver: 3 },
];

const insertNode = db.prepare(`
  INSERT INTO process_nodes (app_id, node_type, node_order, handler_id, handler_role, handler_name, opinion, result, status, start_time, end_time, version, duration_seconds)
  VALUES (@app_id, @node_type, @node_order, @handler_id, @handler_role, @handler_name, @opinion, @result, @status, @start_time, @end_time, @version, @duration_seconds)
`);
nodesData.forEach(n => {
  const startS = n.start !== undefined ? fmtTime(n.start, 0) : null;
  const endS = n.end !== undefined ? fmtTime(n.end, 2) : null;
  let dur = null;
  if (startS && endS) dur = Math.round(((new Date(endS.replace(' ', 'T'))).getTime() - (new Date(startS.replace(' ', 'T'))).getTime()) / 1000);
  insertNode.run(Object.assign({
    handler_id: null, handler_role: null, handler_name: null, opinion: null,
    result: null, start_time: startS, end_time: endS, version: n.ver || 1, duration_seconds: dur
  }, n));
});

const logsData = [
  // 001
  { app_id: 1, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'create', old_status: null, new_status: 'draft', version_from: 1, version_to: 1 },
  { app_id: 1, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', opinion: '申请资料齐全，企业资质良好，申请额度合理，提交审核。', evidence_check: 'complete', version_from: 1, version_to: 1 },
  // 002
  { app_id: 2, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'create', old_status: null, new_status: 'draft', version_from: 1, version_to: 1 },
  { app_id: 2, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', opinion: '初次提交审核，后续补全流水', evidence_check: 'partial', version_from: 1, version_to: 1 },
  { app_id: 2, user_id: auditorId, user_name: auditorName, user_role: 'auditor', action: 'audit_correction', old_status: 'pending_audit', new_status: 'reject_correction', opinion: '财务报表数据异常', reject_reason: '缺少近一年财务报表和近3个月银行流水，达不到审批基本要求', evidence_check: 'incomplete', version_from: 1, version_to: 1 },
  { app_id: 2, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'evidence_update', old_status: 'reject_correction', new_status: 'reject_correction', opinion: '尝试切换证据', evidence_check: 'incomplete', version_from: 1, version_to: 1, extra: JSON.stringify({evidence_id:1, evidence_name:'营业执照', is_submitted:1}) },
  // 003
  { app_id: 3, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'create', old_status: null, new_status: 'draft', version_from: 1, version_to: 1 },
  { app_id: 3, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', opinion: '企业资质良好，提交审核', evidence_check: 'complete', version_from: 1, version_to: 1 },
  { app_id: 3, user_id: auditorId, user_name: auditorName, user_role: 'auditor', action: 'audit_pass', old_status: 'pending_audit', new_status: 'pending_review', opinion: '企业资质审核通过，经营状况良好，风控评分85分，建议授予120万授信额度。', evidence_check: 'complete', version_from: 1, version_to: 1 },
  // 004
  { app_id: 4, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'create', old_status: null, new_status: 'draft', version_from: 1, version_to: 1 },
  { app_id: 4, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', opinion: '先提交部分资料，合同随后补', evidence_check: 'partial', version_from: 1, version_to: 1 },
  { app_id: 4, user_id: null, user_name: '系统', user_role: 'system', action: 'system_overdue', old_status: 'pending_audit', new_status: 'overdue', opinion: '系统自动标记逾期：超过审核办理期限3个工作日未处理', version_from: 1, version_to: 1 },
  // 005
  { app_id: 5, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'create', old_status: null, new_status: 'draft', version_from: 1, version_to: 1 },
  { app_id: 5, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', opinion: '资料完整提交审核', evidence_check: 'complete', version_from: 1, version_to: 1 },
  { app_id: 5, user_id: auditorId, user_name: auditorName, user_role: 'auditor', action: 'audit_pass', old_status: 'pending_audit', new_status: 'pending_review', opinion: '审核通过，65万额度合理', evidence_check: 'complete', version_from: 1, version_to: 1 },
  { app_id: 5, user_id: reviewerId, user_name: reviewerName, user_role: 'reviewer', action: 'review_pass', old_status: 'pending_review', new_status: 'review_pass', opinion: '资料完整，资质良好，复核通过，授信65万元。', evidence_check: 'complete', version_from: 1, version_to: 1 },
  // 006
  { app_id: 6, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'create', old_status: null, new_status: 'draft', version_from: 1, version_to: 1 },
  { app_id: 6, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', opinion: '资料齐全提交审核', evidence_check: 'complete', version_from: 1, version_to: 1 },
  { app_id: 6, user_id: auditorId, user_name: auditorName, user_role: 'auditor', action: 'audit_pass', old_status: 'pending_audit', new_status: 'pending_review', opinion: '关联企业存在同一法人历史授信冲突，提交复核裁定', evidence_check: 'complete', version_from: 1, version_to: 1 },
  { app_id: 6, user_id: null, user_name: '系统', user_role: 'system', action: 'system_conflict', old_status: 'pending_review', new_status: 'conflict', opinion: '系统检测：该企业法人同时为信用状态异常企业的股东，存在关联状态冲突', version_from: 1, version_to: 2 },
  // 007
  { app_id: 7, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'create', old_status: null, new_status: 'draft', version_from: 1, version_to: 1 },
  { app_id: 7, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', opinion: '初次提交审核，资料齐全', evidence_check: 'complete', version_from: 1, version_to: 1 },
  { app_id: 7, user_id: auditorId, user_name: auditorName, user_role: 'auditor', action: 'audit_pass', old_status: 'pending_audit', new_status: 'pending_review', opinion: '审核通过', evidence_check: 'complete', version_from: 1, version_to: 1 },
  { app_id: 7, user_id: reviewerId, user_name: reviewerName, user_role: 'reviewer', action: 'review_reject', old_status: 'pending_review', new_status: 'reject_revision', opinion: '复核评估：化工行业风险偏高', reject_reason: '复核驳回：关联企业化工行业风险评级下调，综合评估风险过高。', evidence_check: 'complete', version_from: 1, version_to: 1 },
  { app_id: 7, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'evidence_update', old_status: 'reject_revision', new_status: 'reject_revision', evidence_check: 'complete', version_from: 1, version_to: 1, extra: JSON.stringify({evidence_id:6, evidence_name:'主要业务合同', is_submitted:1}) },
  { app_id: 7, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'appeal_submit', old_status: 'reject_revision', new_status: 'appeal_reviewing', opinion: '补充新的供应链合同和大额银行流水，不认可驳回理由，提交申诉', evidence_check: 'complete', version_from: 2, version_to: 3 },
  // 008
  { app_id: 8, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'create', old_status: null, new_status: 'draft', version_from: 1, version_to: 1 },
  { app_id: 8, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', opinion: '资料齐全提交审核', evidence_check: 'complete', version_from: 1, version_to: 1 },
  { app_id: 8, user_id: auditorId, user_name: auditorName, user_role: 'auditor', action: 'audit_pass', old_status: 'pending_audit', new_status: 'pending_review', opinion: '审核通过，90万额度合理', evidence_check: 'complete', version_from: 1, version_to: 1 },
  { app_id: 8, user_id: reviewerId, user_name: reviewerName, user_role: 'reviewer', action: 'review_archive', old_status: 'pending_review', new_status: 'archived', opinion: '复核通过，归档完成，授信90万元。', evidence_check: 'complete', version_from: 1, version_to: 1 },
  // 009 ⭐ 完整闭环样例
  { app_id: 9, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'create', old_status: null, new_status: 'draft', version_from: 1, version_to: 1, extra: JSON.stringify({note:'完整闭环样例创建'}) },
  { app_id: 9, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'register_submit', old_status: 'draft', new_status: 'pending_audit', opinion: '首次提交，5项必填证据齐全（营业执照/税务/身份证/财务报表/银行流水）', evidence_check: 'complete', version_from: 1, version_to: 1 },
  { app_id: 9, user_id: auditorId, user_name: auditorName, user_role: 'auditor', action: 'audit_correction', old_status: 'pending_audit', new_status: 'reject_correction', opinion: '退回补正：月均流水不达标', reject_reason: '近3个月银行流水月均仅80万，低于审批阈值120万，需补充Q3业务凭证', evidence_check: 'complete', version_from: 1, version_to: 1 },
  { app_id: 9, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'evidence_update', old_status: 'reject_correction', new_status: 'reject_correction', opinion: '重新上传近3个月流水扫描件', evidence_check: 'complete', version_from: 1, version_to: 1, extra: JSON.stringify({evidence_id:5, evidence_name:'近3个月银行流水', is_submitted:1}) },
  { app_id: 9, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'evidence_update', old_status: 'reject_correction', new_status: 'reject_correction', opinion: '补充Q3季度合同', evidence_check: 'complete', version_from: 1, version_to: 1, extra: JSON.stringify({evidence_id:6, evidence_name:'主要业务合同', is_submitted:1}) },
  { app_id: 9, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'correction_resubmit', old_status: 'reject_correction', new_status: 'pending_audit', opinion: '已补充Q3季度9、10、11月银行流水和4份大额订单合同，补正后重提', evidence_check: 'complete', version_from: 1, version_to: 2 },
  { app_id: 9, user_id: auditorId, user_name: auditorName, user_role: 'auditor', action: 'audit_pass', old_status: 'pending_audit', new_status: 'pending_review', opinion: '补正资料有效，月均流水提升至180万，风控评分达标，审核通过', evidence_check: 'complete', version_from: 2, version_to: 2 },
  { app_id: 9, user_id: reviewerId, user_name: reviewerName, user_role: 'reviewer', action: 'review_reject', old_status: 'pending_review', new_status: 'reject_revision', opinion: '首次复核驳回：流水连续性评估不足', reject_reason: '首次复核驳回：经营流水连续性不足，需补充第3季度完整业务凭证与供应商对账函', evidence_check: 'complete', version_from: 2, version_to: 2 },
  { app_id: 9, user_id: registrarId, user_name: registrarName, user_role: 'registrar', action: 'appeal_submit', old_status: 'reject_revision', new_status: 'appeal_reviewing', opinion: '收集了3季度12份完整业务凭证+3份供应商对账函，原驳回理由不成立，申诉提交', evidence_check: 'complete', version_from: 2, version_to: 3 },
  { app_id: 9, user_id: reviewerId, user_name: reviewerName, user_role: 'reviewer', action: 'review_pass', old_status: 'appeal_reviewing', new_status: 'review_pass', opinion: '申诉资料核查通过：12份业务凭证与银行流水一一对应，连续3个季度经营稳定，复核通过', evidence_check: 'complete', version_from: 3, version_to: 3 },
  { app_id: 9, user_id: reviewerId, user_name: reviewerName, user_role: 'reviewer', action: 'review_archive', old_status: 'review_pass', new_status: 'archived', opinion: '完整流程闭环验证通过：申请→退回补正→重提→复核驳回→申诉→再复核→归档，授信160万元。', evidence_check: 'complete', version_from: 3, version_to: 3 },
];

const insertLog = db.prepare(`
  INSERT INTO operation_logs (app_id, user_id, user_name, user_role, action, old_status, new_status, opinion, reject_reason, evidence_check, version_from, version_to, ip, extra, created_at)
  VALUES (@app_id, @user_id, @user_name, @user_role, @action, @old_status, @new_status, @opinion, @reject_reason, @evidence_check, @version_from, @version_to, @ip, @extra, @created_at)
`);
logsData.forEach((l, idx) => {
  const log = Object.assign({
    user_id: null, user_name: null, user_role: null, opinion: null,
    reject_reason: null, evidence_check: null,
    version_from: 1, version_to: 1, ip: '127.0.0.1', extra: null,
    created_at: fmtTime(Math.min(15, 15 - idx), idx % 8)
  }, l);
  try { insertLog.run(log); } catch (e) { console.log('skip log:', l.app_id, l.action, e.message); }
});

console.log('\n✅ 样例数据插入完成');
console.log('   用户: 6 个（registrar01-02 / auditor01-02 / reviewer01-02，密码 123456）');
console.log('   授信申请: ' + applications.length + ' 条（含完整闭环样例 009 重庆星锐）');
console.log('   证据记录: ' + (applications.length * 6) + ' 条');
console.log('   流程节点: ' + nodesData.length + ' 条');
console.log('   操作记录: ' + logsData.length + ' 条\n');
db.close();
