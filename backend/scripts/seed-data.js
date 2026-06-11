const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { ROLES, RECORD_STATUSES, OPERATION_TYPES, EVIDENCE_TYPES } = require('../src/constants');

console.log('开始插入样例数据...');

const hashPassword = (password) => bcrypt.hashSync(password, 10);

db.exec('BEGIN TRANSACTION');

try {
  const insertUser = db.prepare(`
    INSERT INTO users (username, password, name, role, phone, department)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const users = [
    { username: 'registrar1', password: hashPassword('123456'), name: '张登记', role: ROLES.REGISTRAR, phone: '13800138001', department: '旁站记录组' },
    { username: 'registrar2', password: hashPassword('123456'), name: '李登记', role: ROLES.REGISTRAR, phone: '13800138002', department: '旁站记录组' },
    { username: 'supervisor1', password: hashPassword('123456'), name: '王审核', role: ROLES.SUPERVISOR, phone: '13800138003', department: '质量审核部' },
    { username: 'supervisor2', password: hashPassword('123456'), name: '赵审核', role: ROLES.SUPERVISOR, phone: '13800138004', department: '质量审核部' },
    { username: 'reviewer1', password: hashPassword('123456'), name: '刘复核', role: ROLES.REVIEWER, phone: '13800138005', department: '监理公司复核组' },
    { username: 'reviewer2', password: hashPassword('123456'), name: '陈复核', role: ROLES.REVIEWER, phone: '13800138006', department: '监理公司复核组' },
  ];

  users.forEach(u => insertUser.run(u.username, u.password, u.name, u.role, u.phone, u.department));
  console.log('用户数据插入完成');

  const insertRecord = db.prepare(`
    INSERT INTO supervision_records (
      record_no, project_name, construction_unit, supervision_unit, location,
      record_date, weather, temperature, content, issues, requirement,
      status, version, current_handler_id, created_by, deadline
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvidence = db.prepare(`
    INSERT INTO evidences (record_id, type, name, description, file_url, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertReview = db.prepare(`
    INSERT INTO review_records (
      record_id, handler_id, operation_type, opinion, result,
      previous_status, new_status, reject_reason, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLog = db.prepare(`
    INSERT INTO operation_logs (record_id, user_id, operation_type, description, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 120 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const formatDate = (d) => d.toISOString().split('T')[0];
  const formatDateTime = (d) => d.toISOString().replace('T', ' ').substring(0, 19);

  const records = [
    {
      record_no: 'PZ-2024-001',
      project_name: '市民中心二期工程',
      construction_unit: '省建集团有限公司',
      supervision_unit: '中正监理有限公司',
      location: 'A区3层梁板浇筑现场',
      record_date: formatDate(threeDaysAgo),
      weather: '晴',
      temperature: '25℃',
      content: '旁站监督A区3层梁板混凝土浇筑施工，检查浇筑顺序、振捣工艺、模板支撑体系稳定性。',
      issues: '发现局部振捣不充分，存在漏振现象；部分模板接缝处有轻微漏浆。',
      requirement: '要求施工单位立即对漏振部位进行整改，加强振捣工艺控制；对漏浆部位采取封堵措施。',
      status: RECORD_STATUSES.FINAL_PASSED,
      version: 1,
      current_handler_id: null,
      created_by: 1,
      deadline: null,
      evidences: [
        { type: EVIDENCE_TYPES.PHOTO, name: '浇筑现场全景', desc: '梁板浇筑施工全景照片', url: '/images/pz001-1.jpg' },
        { type: EVIDENCE_TYPES.PHOTO, name: '漏振部位', desc: '局部漏振问题照片', url: '/images/pz001-2.jpg' },
        { type: EVIDENCE_TYPES.DOCUMENT, name: '混凝土配合比单', desc: 'C30混凝土配合比报告', url: '/docs/pz001-3.pdf' },
      ],
      reviews: [
        { handler_id: 3, op: OPERATION_TYPES.REVIEW_PASS, opinion: '记录详实，问题描述清晰，整改要求明确，同意通过。', result: 'pass', prev: RECORD_STATUSES.IN_REVIEW, new: RECORD_STATUSES.REVIEW_PASSED, reason: null, ver: 1 },
        { handler_id: 5, op: OPERATION_TYPES.FINAL_PASS, opinion: '审核流程规范，证据充分，同意归档。', result: 'pass', prev: RECORD_STATUSES.IN_FINAL_REVIEW, new: RECORD_STATUSES.FINAL_PASSED, reason: null, ver: 1 },
      ],
    },
    {
      record_no: 'PZ-2024-002',
      project_name: '滨江路地下综合管廊工程',
      construction_unit: '市政建设工程公司',
      supervision_unit: '中正监理有限公司',
      location: 'K2+350段基坑开挖面',
      record_date: formatDate(twoDaysAgo),
      weather: '多云',
      temperature: '22℃',
      content: '旁站监督管廊基坑开挖支护施工，监控基坑变形监测数据，检查锚杆锚索施工质量。',
      issues: '监测数据显示基坑东侧位移速率超过预警值0.5mm/天；个别锚杆注浆不饱满。',
      requirement: '立即启动应急预案，暂停东侧开挖作业；对注浆不饱满锚杆进行补浆处理；加密监测频率。',
      status: RECORD_STATUSES.IN_FINAL_REVIEW,
      version: 1,
      current_handler_id: 5,
      created_by: 1,
      deadline: formatDateTime(dayAfterTomorrow),
      evidences: [
        { type: EVIDENCE_TYPES.PHOTO, name: '基坑全景', desc: 'K2+350段基坑全景', url: '/images/pz002-1.jpg' },
        { type: EVIDENCE_TYPES.PHOTO, name: '锚杆施工', desc: '锚杆注浆施工', url: '/images/pz002-2.jpg' },
        { type: EVIDENCE_TYPES.DOCUMENT, name: '监测日报', desc: '6月9日基坑监测日报', url: '/docs/pz002-3.pdf' },
      ],
      reviews: [
        { handler_id: 3, op: OPERATION_TYPES.REVIEW_PASS, opinion: '情况紧急，处理措施得当，同意提交监理公司复核。', result: 'pass', prev: RECORD_STATUSES.IN_REVIEW, new: RECORD_STATUSES.REVIEW_PASSED, reason: null, ver: 1 },
      ],
    },
    {
      record_no: 'PZ-2024-003',
      project_name: '高新区标准厂房建设项目',
      construction_unit: '华宇建筑工程有限公司',
      supervision_unit: '中正监理有限公司',
      location: '1#厂房桩基施工现场',
      record_date: formatDate(yesterday),
      weather: '小雨',
      temperature: '20℃',
      content: '旁站监督1#厂房桩基钻孔灌注桩钢筋笼吊装及混凝土浇筑施工。',
      issues: '钢筋笼吊装过程中出现轻微变形；混凝土浇筑记录缺少施工单位技术负责人签字。',
      requirement: '对变形钢筋笼进行校正或更换；完善浇筑记录并补签相关责任人签字。',
      status: RECORD_STATUSES.NEEDS_CORRECTION,
      version: 2,
      current_handler_id: 1,
      created_by: 1,
      deadline: formatDateTime(tomorrow),
      evidences: [
        { type: EVIDENCE_TYPES.PHOTO, name: '钢筋笼吊装', desc: '钢筋笼吊装作业', url: '/images/pz003-1.jpg' },
        { type: EVIDENCE_TYPES.PHOTO, name: '变形部位', desc: '钢筋笼变形部位照片', url: '/images/pz003-2.jpg' },
      ],
      reviews: [
        { handler_id: 4, op: OPERATION_TYPES.REQUEST_CORRECTION, opinion: '钢筋笼变形可能影响结构受力，浇筑记录签字不齐全，需补正后重新提交。', result: 'correction', prev: RECORD_STATUSES.IN_REVIEW, new: RECORD_STATUSES.NEEDS_CORRECTION, reason: '关键证据缺失，质量证明文件不完整', ver: 1 },
      ],
    },
    {
      record_no: 'PZ-2024-004',
      project_name: '市民中心二期工程',
      construction_unit: '省建集团有限公司',
      supervision_unit: '中正监理有限公司',
      location: 'B区地下二层防水施工',
      record_date: formatDate(twoDaysAgo),
      weather: '阴',
      temperature: '23℃',
      content: '旁站监督B区地下二层SBS改性沥青防水卷材施工，检查基层处理、卷材搭接长度、热熔施工质量。',
      issues: '防水卷材搭接长度不足，设计要求100mm，实测仅70-80mm；部分部位基层潮湿不符合施工要求。',
      requirement: '对搭接长度不足部位进行补强处理；基层干燥度达标后方可继续施工。',
      status: RECORD_STATUSES.EVIDENCE_MISSING,
      version: 1,
      current_handler_id: 1,
      created_by: 2,
      deadline: formatDateTime(tomorrow),
      evidences: [
        { type: EVIDENCE_TYPES.PHOTO, name: '防水施工', desc: '防水卷材铺贴作业', url: '/images/pz004-1.jpg' },
      ],
      reviews: [
        { handler_id: 3, op: OPERATION_TYPES.MARK_EVIDENCE_MISSING, opinion: '缺少搭接长度测量的具体数据照片和基层含水率测试报告。', result: 'reject', prev: RECORD_STATUSES.IN_REVIEW, new: RECORD_STATUSES.EVIDENCE_MISSING, reason: '关键验收证据缺失，需补充测量照片和检测报告', ver: 1 },
      ],
    },
    {
      record_no: 'PZ-2024-005',
      project_name: '滨江路地下综合管廊工程',
      construction_unit: '市政建设工程公司',
      supervision_unit: '中正监理有限公司',
      location: 'K1+800段混凝土浇筑',
      record_date: formatDate(fiveDaysAgo),
      weather: '晴',
      temperature: '28℃',
      content: '旁站监督管廊主体结构混凝土浇筑施工。',
      issues: '高温天气下未采取有效降温措施，混凝土入模温度偏高。',
      requirement: '立即采取降温措施，加强养护工作。',
      status: RECORD_STATUSES.OVERDUE,
      version: 1,
      current_handler_id: 4,
      created_by: 2,
      deadline: formatDateTime(threeDaysAgo),
      evidences: [
        { type: EVIDENCE_TYPES.PHOTO, name: '浇筑现场', desc: '高温下混凝土浇筑', url: '/images/pz005-1.jpg' },
        { type: EVIDENCE_TYPES.DOCUMENT, name: '测温记录', desc: '混凝土入模温度记录', url: '/docs/pz005-2.pdf' },
      ],
      reviews: [],
    },
    {
      record_no: 'PZ-2024-006',
      project_name: '高新区标准厂房建设项目',
      construction_unit: '华宇建筑工程有限公司',
      supervision_unit: '中正监理有限公司',
      location: '2#厂房钢结构安装',
      record_date: formatDate(yesterday),
      weather: '晴',
      temperature: '26℃',
      content: '旁站监督2#厂房主体钢结构吊装作业，检查吊装方案执行情况、高强螺栓紧固质量。',
      issues: '部分高强螺栓终拧扭矩未达到设计要求；吊装作业区域未设置有效警示标识。',
      requirement: '对扭矩不合格螺栓进行重新紧固；完善吊装作业区域安全警示标识。',
      status: RECORD_STATUSES.IN_REVIEW,
      version: 1,
      current_handler_id: 3,
      created_by: 2,
      deadline: formatDateTime(dayAfterTomorrow),
      evidences: [
        { type: EVIDENCE_TYPES.PHOTO, name: '钢结构吊装', desc: '钢梁吊装作业', url: '/images/pz006-1.jpg' },
        { type: EVIDENCE_TYPES.PHOTO, name: '螺栓扭矩检测', desc: '高强螺栓扭矩检测', url: '/images/pz006-2.jpg' },
        { type: EVIDENCE_TYPES.VIDEO, name: '吊装过程视频', desc: '关键节点吊装录像', url: '/videos/pz006-3.mp4' },
        { type: EVIDENCE_TYPES.DOCUMENT, name: '扭矩检测报告', desc: '高强螺栓扭矩检测记录', url: '/docs/pz006-4.pdf' },
      ],
      reviews: [],
    },
    {
      record_no: 'PZ-2024-007',
      project_name: '市民中心二期工程',
      construction_unit: '省建集团有限公司',
      supervision_unit: '中正监理有限公司',
      location: 'C区4层模板安装',
      record_date: formatDate(today),
      weather: '多云',
      temperature: '24℃',
      content: '旁站监督C区4层高支模体系搭设及模板安装施工。',
      issues: '高支模体系部分立杆间距超标；剪刀撑设置不连续。',
      requirement: '立即调整立杆间距，补设连续剪刀撑，经验收合格后方可进入下道工序。',
      status: RECORD_STATUSES.SUBMITTED,
      version: 1,
      current_handler_id: 3,
      created_by: 1,
      deadline: formatDateTime(nextWeek),
      evidences: [
        { type: EVIDENCE_TYPES.PHOTO, name: '高支模全景', desc: 'C区4层高支模体系', url: '/images/pz007-1.jpg' },
        { type: EVIDENCE_TYPES.PHOTO, name: '立杆间距', desc: '立杆间距测量', url: '/images/pz007-2.jpg' },
      ],
      reviews: [],
    },
    {
      record_no: 'PZ-2024-008',
      project_name: '滨江路地下综合管廊工程',
      construction_unit: '市政建设工程公司',
      supervision_unit: '中正监理有限公司',
      location: 'K3+100段防水施工',
      record_date: formatDate(today),
      weather: '晴',
      temperature: '27℃',
      content: '旁站监督管廊外墙防水保护层施工。',
      issues: '防水保护层厚度不均匀，部分区域未达到设计要求的50mm。',
      requirement: '对厚度不足区域进行补强处理，确保保护层厚度符合设计要求。',
      status: RECORD_STATUSES.DRAFT,
      version: 1,
      current_handler_id: null,
      created_by: 2,
      deadline: null,
      evidences: [
        { type: EVIDENCE_TYPES.PHOTO, name: '保护层施工', desc: '防水保护层浇筑', url: '/images/pz008-1.jpg' },
      ],
      reviews: [],
    },
    {
      record_no: 'PZ-2024-009',
      project_name: '高新区标准厂房建设项目',
      construction_unit: '华宇建筑工程有限公司',
      supervision_unit: '中正监理有限公司',
      location: '3#厂房机电预埋',
      record_date: formatDate(twoDaysAgo),
      weather: '阴',
      temperature: '21℃',
      content: '旁站监督3#厂房机电管线预埋施工，检查管线走向、固定方式、接地处理。',
      issues: '部分电气管线与水暖管线间距不符合规范要求；个别接地端子焊接质量不良。',
      requirement: '调整管线布局确保间距符合要求；对不合格焊接点进行返工处理。',
      status: RECORD_STATUSES.STATUS_CONFLICT,
      version: 3,
      current_handler_id: 4,
      created_by: 1,
      deadline: formatDateTime(dayAfterTomorrow),
      evidences: [
        { type: EVIDENCE_TYPES.PHOTO, name: '管线预埋', desc: '机电管线预埋现场', url: '/images/pz009-1.jpg' },
        { type: EVIDENCE_TYPES.PHOTO, name: '接地焊接', desc: '接地端子焊接质量', url: '/images/pz009-2.jpg' },
      ],
      reviews: [
        { handler_id: 3, op: OPERATION_TYPES.REVIEW_PASS, opinion: '问题已整改，同意通过。', result: 'pass', prev: RECORD_STATUSES.IN_REVIEW, new: RECORD_STATUSES.REVIEW_PASSED, reason: null, ver: 1 },
        { handler_id: 5, op: OPERATION_TYPES.FINAL_REJECT, opinion: '整改证据不充分，焊接质量仍存疑，退回重新审核。', result: 'reject', prev: RECORD_STATUSES.IN_FINAL_REVIEW, new: RECORD_STATUSES.REVIEW_REJECTED, reason: '焊接质量检测报告缺失，整改前后对比照片不足', ver: 2 },
        { handler_id: 4, op: OPERATION_TYPES.MARK_STATUS_CONFLICT, opinion: '与施工单位反馈的整改完成状态存在冲突，需进一步核实。', result: 'conflict', prev: RECORD_STATUSES.REVIEW_REJECTED, new: RECORD_STATUSES.STATUS_CONFLICT, reason: '多方反馈状态不一致，需现场复核确认', ver: 2 },
      ],
    },
    {
      record_no: 'PZ-2024-010',
      project_name: '市民中心二期工程',
      construction_unit: '省建集团有限公司',
      supervision_unit: '中正监理有限公司',
      location: 'D区幕墙施工',
      record_date: formatDate(threeDaysAgo),
      weather: '晴',
      temperature: '25℃',
      content: '旁站监督D区玻璃幕墙安装施工，检查龙骨安装精度、密封胶施工质量。',
      issues: '部分竖龙骨垂直度偏差超标；密封胶表面不平整，存在气泡。',
      requirement: '调整垂直度超标的龙骨；对不合格密封胶进行割除重打。',
      status: RECORD_STATUSES.REVIEW_PASSED,
      version: 2,
      current_handler_id: 6,
      created_by: 2,
      deadline: formatDateTime(dayAfterTomorrow),
      evidences: [
        { type: EVIDENCE_TYPES.PHOTO, name: '幕墙安装', desc: '玻璃幕墙安装作业', url: '/images/pz010-1.jpg' },
        { type: EVIDENCE_TYPES.PHOTO, name: '龙骨测量', desc: '龙骨垂直度测量', url: '/images/pz010-2.jpg' },
        { type: EVIDENCE_TYPES.DOCUMENT, name: '幕墙检测报告', desc: '三性检测报告', url: '/docs/pz010-3.pdf' },
        { type: EVIDENCE_TYPES.SIGNATURE, name: '施工确认单', desc: '整改完成确认签字', url: '/docs/pz010-4.jpg' },
      ],
      reviews: [
        { handler_id: 4, op: OPERATION_TYPES.REQUEST_CORRECTION, opinion: '垂直度偏差超标需整改，整改完成后重新提交。', result: 'correction', prev: RECORD_STATUSES.IN_REVIEW, new: RECORD_STATUSES.NEEDS_CORRECTION, reason: '龙骨安装精度不达标', ver: 1 },
        { handler_id: 2, op: OPERATION_TYPES.CORRECT, opinion: '已对超标龙骨进行调整，密封胶已重新打胶，附整改后照片及检测报告。', result: 'corrected', prev: RECORD_STATUSES.NEEDS_CORRECTION, new: RECORD_STATUSES.CORRECTED, reason: null, ver: 1 },
        { handler_id: 4, op: OPERATION_TYPES.REVIEW_PASS, opinion: '整改到位，证据充分，同意通过。', result: 'pass', prev: RECORD_STATUSES.IN_REVIEW, new: RECORD_STATUSES.REVIEW_PASSED, reason: null, ver: 2 },
      ],
    },
  ];

  records.forEach((r, idx) => {
    const info = insertRecord.run(
      r.record_no, r.project_name, r.construction_unit, r.supervision_unit, r.location,
      r.record_date, r.weather, r.temperature, r.content, r.issues, r.requirement,
      r.status, r.version, r.current_handler_id, r.created_by, r.deadline
    );
    const recordId = info.lastInsertRowid;

    r.evidences.forEach(e => {
      insertEvidence.run(recordId, e.type, e.name, e.desc, e.url, r.created_by);
    });

    r.reviews.forEach(rv => {
      insertReview.run(
        recordId, rv.handler_id, rv.op, rv.opinion, rv.result,
        rv.prev, rv.new, rv.reason, rv.ver
      );
      insertLog.run(recordId, rv.handler_id, rv.op, rv.opinion, '127.0.0.1');
    });

    insertLog.run(recordId, r.created_by, OPERATION_TYPES.CREATE, `创建旁站记录单 ${r.record_no}`, '127.0.0.1');
    if (r.status !== RECORD_STATUSES.DRAFT) {
      insertLog.run(recordId, r.created_by, OPERATION_TYPES.SUBMIT, `提交旁站记录单 ${r.record_no} 审核`, '127.0.0.1');
    }
  });

  console.log('旁站记录数据插入完成，共10条记录');

  db.exec('COMMIT');
  console.log('样例数据插入完成！');
  console.log('\n测试账号：');
  console.log('  旁站记录登记员: registrar1 / 123456 (张登记)');
  console.log('  旁站记录登记员: registrar2 / 123456 (李登记)');
  console.log('  旁站记录审核主管: supervisor1 / 123456 (王审核)');
  console.log('  旁站记录审核主管: supervisor2 / 123456 (赵审核)');
  console.log('  工程监理公司复核负责人: reviewer1 / 123456 (刘复核)');
  console.log('  工程监理公司复核负责人: reviewer2 / 123456 (陈复核)');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('数据插入失败:', e);
  throw e;
}
