const bcrypt = require('bcryptjs');
const { initializeDatabase, getDb } = require('../src/db');
const { ROLES, RECORD_STATUSES, OPERATION_TYPES, EVIDENCE_TYPES } = require('../src/constants');

const hashPassword = (password) => bcrypt.hashSync(password, 10);

async function seed() {
  await initializeDatabase();
  const db = getDb();

  console.log('开始插入样例数据...');

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
    const today = now;
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
        current_handler_id: 5,
        created_by: 1,
        deadline: null,
        evidences: [
          { type: EVIDENCE_TYPES.PHOTO, name: '浇筑现场全景', desc: '梁板浇筑施工全景照片', url: '/images/pz001-1.jpg' },
          { type: EVIDENCE_TYPES.PHOTO, name: '漏振部位', desc: '局部漏振问题照片', url: '/images/pz001-2.jpg' },
          { type: EVIDENCE_TYPES.DOCUMENT, name: '整改报告', desc: '施工单位提交的整改完成报告扫描件', url: '/docs/pz001-rectification.pdf' },
        ],
        reviews: [
          { handler: 3, op: OPERATION_TYPES.START_REVIEW, opinion: '收到记录，开始审核', result: 'process', prev: RECORD_STATUSES.SUBMITTED, next: RECORD_STATUSES.IN_REVIEW, reason: null, version: 1 },
          { handler: 3, op: OPERATION_TYPES.REVIEW_PASS, opinion: '记录内容完整，问题描述清晰，整改要求明确，审核通过。', result: 'pass', prev: RECORD_STATUSES.IN_REVIEW, next: RECORD_STATUSES.REVIEW_PASSED, reason: null, version: 1 },
          { handler: 5, op: OPERATION_TYPES.START_FINAL_REVIEW, opinion: '开始复核', result: 'process', prev: RECORD_STATUSES.REVIEW_PASSED, next: RECORD_STATUSES.IN_FINAL_REVIEW, reason: null, version: 1 },
          { handler: 5, op: OPERATION_TYPES.FINAL_PASS, opinion: '符合旁站记录规范，复核通过。', result: 'pass', prev: RECORD_STATUSES.IN_FINAL_REVIEW, next: RECORD_STATUSES.FINAL_PASSED, reason: null, version: 1 },
        ],
      },
      {
        record_no: 'PZ-2024-002',
        project_name: '滨江住宅小区3号楼',
        construction_unit: '华建建筑工程有限公司',
        supervision_unit: '中正监理有限公司',
        location: '地下二层钢筋绑扎现场',
        record_date: formatDate(twoDaysAgo),
        weather: '多云',
        temperature: '22℃',
        content: '旁站监督地下二层剪力墙、柱钢筋绑扎施工，检查钢筋规格、数量、间距、搭接长度及锚固长度。',
        issues: '部分主筋间距偏差超出规范允许范围；个别箍筋弯钩角度不足135°。',
        requirement: '要求施工单位对间距超标的主筋进行调整；对弯钩角度不符合要求的箍筋进行更换。',
        status: RECORD_STATUSES.IN_FINAL_REVIEW,
        version: 1,
        current_handler_id: 6,
        created_by: 2,
        deadline: formatDateTime(tomorrow),
        evidences: [
          { type: EVIDENCE_TYPES.PHOTO, name: '钢筋绑扎全景', desc: '剪力墙钢筋绑扎现场', url: '/images/pz002-1.jpg' },
          { type: EVIDENCE_TYPES.PHOTO, name: '主筋间距测量', desc: '使用钢卷尺测量主筋间距', url: '/images/pz002-2.jpg' },
          { type: EVIDENCE_TYPES.VIDEO, name: '现场实测过程', desc: '钢筋间距实测视频记录', url: '/videos/pz002-1.mp4' },
        ],
        reviews: [
          { handler: 4, op: OPERATION_TYPES.START_REVIEW, opinion: '开始审核', result: 'process', prev: RECORD_STATUSES.SUBMITTED, next: RECORD_STATUSES.IN_REVIEW, reason: null, version: 1 },
          { handler: 4, op: OPERATION_TYPES.REVIEW_PASS, opinion: '问题描述清楚，要求合理，审核通过。', result: 'pass', prev: RECORD_STATUSES.IN_REVIEW, next: RECORD_STATUSES.REVIEW_PASSED, reason: null, version: 1 },
          { handler: 6, op: OPERATION_TYPES.START_FINAL_REVIEW, opinion: '已接收，复核中', result: 'process', prev: RECORD_STATUSES.REVIEW_PASSED, next: RECORD_STATUSES.IN_FINAL_REVIEW, reason: null, version: 1 },
        ],
      },
      {
        record_no: 'PZ-2024-003',
        project_name: '科技创新园A座',
        construction_unit: '省建集团有限公司',
        supervision_unit: '中正监理有限公司',
        location: '10层幕墙预埋件安装',
        record_date: formatDate(yesterday),
        weather: '阴',
        temperature: '20℃',
        content: '旁站监督10层幕墙预埋件安装施工，检查预埋件位置、标高、固定方式及焊接质量。',
        issues: '部分预埋件标高偏差超出±10mm允许范围；个别预埋件与结构钢筋焊接焊缝高度不足。',
        requirement: '要求施工单位对标高超标的预埋件进行调整；对焊缝高度不足部位进行补焊。',
        status: RECORD_STATUSES.NEEDS_CORRECTION,
        version: 2,
        current_handler_id: 1,
        created_by: 1,
        deadline: formatDateTime(tomorrow),
        evidences: [
          { type: EVIDENCE_TYPES.PHOTO, name: '预埋件安装', desc: '幕墙预埋件安装现场', url: '/images/pz003-1.jpg' },
        ],
        reviews: [
          { handler: 3, op: OPERATION_TYPES.START_REVIEW, opinion: '开始审核', result: 'process', prev: RECORD_STATUSES.SUBMITTED, next: RECORD_STATUSES.IN_REVIEW, reason: null, version: 1 },
          { handler: 3, op: OPERATION_TYPES.REQUEST_CORRECTION, opinion: '记录不完整，需要补正', result: 'correction', prev: RECORD_STATUSES.IN_REVIEW, next: RECORD_STATUSES.NEEDS_CORRECTION, reason: '缺少预埋件标高偏差的具体数值测量照片及焊缝质量检测报告；问题整改要求描述不够具体，需补充整改完成时限和复查要求。', version: 1 },
        ],
      },
      {
        record_no: 'PZ-2024-004',
        project_name: '地铁5号线XX站',
        construction_unit: '中铁建设集团',
        supervision_unit: '中正监理有限公司',
        location: 'B区地下二层SBS防水施工',
        record_date: formatDate(yesterday),
        weather: '晴',
        temperature: '23℃',
        content: '旁站监督B区地下二层SBS改性沥青防水卷材施工，检查基层处理、卷材搭接长度、热熔施工质量。',
        issues: '防水卷材搭接长度不足，设计要求100mm，实测仅70-80mm；部分部位基层潮湿不符合施工要求。',
        requirement: '对搭接长度不足部位进行补强处理；基层干燥度达标后方可继续施工。',
        status: RECORD_STATUSES.EVIDENCE_MISSING,
        version: 1,
        current_handler_id: 2,
        created_by: 2,
        deadline: formatDateTime(tomorrow),
        evidences: [
          { type: EVIDENCE_TYPES.PHOTO, name: '防水施工', desc: '防水卷材铺贴作业', url: '/images/pz004-1.jpg' },
        ],
        reviews: [
          { handler: 4, op: OPERATION_TYPES.MARK_EVIDENCE_MISSING, opinion: '证据材料不足，需补充', result: 'correction', prev: RECORD_STATUSES.SUBMITTED, next: RECORD_STATUSES.EVIDENCE_MISSING, reason: '缺少卷材搭接长度实测照片（需带刻度尺）、基层含水率检测报告、热熔施工火候控制记录。请登记员补充以上证据材料。', version: 1 },
        ],
      },
      {
        record_no: 'PZ-2024-005',
        project_name: '城市综合管廊工程',
        construction_unit: '市政建设集团',
        supervision_unit: '中正监理有限公司',
        location: 'K2+300-K2+500段管廊底板浇筑',
        record_date: formatDate(fiveDaysAgo),
        weather: '小雨',
        temperature: '18℃',
        content: '旁站监督城市综合管廊K2+300-K2+500段底板混凝土浇筑施工，检查混凝土配合比、浇筑连续性、后浇带处理。',
        issues: '混凝土入模温度偏高（实测35℃，规范要求不超过32℃）；部分施工缝处理不到位存在松散混凝土未清理。',
        requirement: '立即采取降温措施，入模温度控制在32℃以内；施工缝处松散混凝土彻底凿除清理干净并经监理验收后方可继续浇筑。',
        status: RECORD_STATUSES.OVERDUE,
        version: 1,
        current_handler_id: 4,
        created_by: 1,
        deadline: formatDateTime(threeDaysAgo),
        evidences: [
          { type: EVIDENCE_TYPES.PHOTO, name: '管廊底板浇筑', desc: '底板混凝土浇筑现场', url: '/images/pz005-1.jpg' },
          { type: EVIDENCE_TYPES.PHOTO, name: '温度测量', desc: '红外测温仪实测入模温度', url: '/images/pz005-2.jpg' },
        ],
        reviews: [
          { handler: 4, op: OPERATION_TYPES.START_REVIEW, opinion: '开始审核该记录', result: 'process', prev: RECORD_STATUSES.SUBMITTED, next: RECORD_STATUSES.IN_REVIEW, reason: null, version: 1 },
        ],
      },
      {
        record_no: 'PZ-2024-006',
        project_name: '会展中心项目',
        construction_unit: '华建建筑工程有限公司',
        supervision_unit: '中正监理有限公司',
        location: '主展厅大跨度钢结构焊接',
        record_date: formatDate(twoDaysAgo),
        weather: '晴',
        temperature: '26℃',
        content: '旁站监督主展厅大跨度钢结构现场焊接施工，检查焊接工艺参数、焊工持证情况、焊缝外观质量。',
        issues: '个别焊缝存在气孔、夹渣缺陷；部分焊工未能出示有效上岗证。',
        requirement: '对存在缺陷的焊缝按审批通过的返修工艺进行返修并重新检验；无有效上岗证焊工立即清退出场，后续作业人员必须持证上岗。',
        status: RECORD_STATUSES.IN_REVIEW,
        version: 1,
        current_handler_id: 3,
        created_by: 2,
        deadline: formatDateTime(today),
        evidences: [
          { type: EVIDENCE_TYPES.PHOTO, name: '钢结构焊接', desc: '大跨度钢结构焊接作业', url: '/images/pz006-1.jpg' },
          { type: EVIDENCE_TYPES.PHOTO, name: '焊缝缺陷', desc: '焊缝气孔缺陷特写', url: '/images/pz006-2.jpg' },
          { type: EVIDENCE_TYPES.DOCUMENT, name: '焊工证书清单', desc: '现场作业人员焊工证复印件汇总', url: '/docs/pz006-welders.pdf' },
        ],
        reviews: [
          { handler: 3, op: OPERATION_TYPES.START_REVIEW, opinion: '已接收，正在审核证据材料', result: 'process', prev: RECORD_STATUSES.SUBMITTED, next: RECORD_STATUSES.IN_REVIEW, reason: null, version: 1 },
        ],
      },
      {
        record_no: 'PZ-2024-007',
        project_name: '金融中心大厦',
        construction_unit: '省建集团有限公司',
        supervision_unit: '中正监理有限公司',
        location: '28层核心筒混凝土浇筑',
        record_date: formatDate(today),
        weather: '多云',
        temperature: '24℃',
        content: '旁站监督28层核心筒C60高强度混凝土浇筑施工，重点检查高抛免振捣自密实混凝土工作性、浇筑顺序控制。',
        issues: '暂无明显质量问题，混凝土扩展度符合技术要求。',
        requirement: '继续加强浇筑过程监控，每2车检测一次扩展度，确保混凝土工作性能稳定。',
        status: RECORD_STATUSES.SUBMITTED,
        version: 1,
        current_handler_id: 3,
        created_by: 2,
        deadline: formatDateTime(dayAfterTomorrow),
        evidences: [
          { type: EVIDENCE_TYPES.PHOTO, name: '核心筒浇筑', desc: '28层核心筒混凝土浇筑', url: '/images/pz007-1.jpg' },
          { type: EVIDENCE_TYPES.PHOTO, name: '扩展度检测', desc: '自密实混凝土扩展度检测', url: '/images/pz007-2.jpg' },
        ],
        reviews: [],
      },
      {
        record_no: 'PZ-2024-008',
        project_name: '市立医院新院区',
        construction_unit: '华建建筑工程有限公司',
        supervision_unit: '中正监理有限公司',
        location: '住院楼5层机电配管',
        record_date: formatDate(today),
        weather: '晴',
        temperature: '27℃',
        content: '旁站监督住院楼5层机电预埋配管施工，检查管线走向、管材规格、固定方式、接地连接。',
        issues: '部分强电与弱电管线间距不足，存在电磁干扰风险。',
        requirement: '对间距不足的管线进行调整，强电与弱电管线间距不小于300mm；如受条件限制需采取屏蔽措施。',
        status: RECORD_STATUSES.DRAFT,
        version: 1,
        current_handler_id: null,
        created_by: 1,
        deadline: null,
        evidences: [
          { type: EVIDENCE_TYPES.PHOTO, name: '机电配管', desc: '5层机电预埋配管现场', url: '/images/pz008-1.jpg' },
        ],
        reviews: [],
      },
      {
        record_no: 'PZ-2024-009',
        project_name: '城市高架桥工程',
        construction_unit: '市政建设集团',
        supervision_unit: '中正监理有限公司',
        location: '3#墩柱钢筋及模板安装',
        record_date: formatDate(threeDaysAgo),
        weather: '晴',
        temperature: '21℃',
        content: '旁站监督3#厂房机电管线预埋施工，检查管线走向、固定方式、接地处理。',
        issues: '部分电气管线与水暖管线间距不符合规范要求；个别接地端子焊接质量不良。',
        requirement: '调整管线布局确保间距符合要求；对不合格焊接点进行返工处理。',
        status: RECORD_STATUSES.STATUS_CONFLICT,
        version: 3,
        current_handler_id: 1,
        created_by: 1,
        deadline: formatDateTime(dayAfterTomorrow),
        evidences: [
          { type: EVIDENCE_TYPES.PHOTO, name: '管线预埋', desc: '机电管线预埋现场', url: '/images/pz009-1.jpg' },
          { type: EVIDENCE_TYPES.PHOTO, name: '接地焊接', desc: '接地端子焊接质量', url: '/images/pz009-2.jpg' },
        ],
        reviews: [
          { handler: 3, op: OPERATION_TYPES.START_REVIEW, opinion: '开始审核', result: 'process', prev: RECORD_STATUSES.SUBMITTED, next: RECORD_STATUSES.IN_REVIEW, reason: null, version: 1 },
          { handler: 3, op: OPERATION_TYPES.REVIEW_PASS, opinion: '记录完整审核通过', result: 'pass', prev: RECORD_STATUSES.IN_REVIEW, next: RECORD_STATUSES.REVIEW_PASSED, reason: null, version: 1 },
          { handler: 5, op: OPERATION_TYPES.START_FINAL_REVIEW, opinion: '开始复核', result: 'process', prev: RECORD_STATUSES.REVIEW_PASSED, next: RECORD_STATUSES.IN_FINAL_REVIEW, reason: null, version: 1 },
          { handler: 5, op: OPERATION_TYPES.MARK_STATUS_CONFLICT, opinion: '发现状态异常需核实', result: 'process', prev: RECORD_STATUSES.IN_FINAL_REVIEW, next: RECORD_STATUSES.STATUS_CONFLICT, reason: '发现该记录中工程名称为"城市高架桥工程"，但旁站部位描述为"3#厂房机电管线预埋施工"，存在明显不一致。请记录创建人重新核对工程名称与施工部位是否匹配，并补充该部位设计变更相关证明材料（如有）。', version: 1 },
        ],
      },
      {
        record_no: 'PZ-2024-010',
        project_name: '体育中心游泳馆',
        construction_unit: '中铁建设集团',
        supervision_unit: '中正监理有限公司',
        location: '跳水池池壁防水施工',
        record_date: formatDate(twoDaysAgo),
        weather: '多云',
        temperature: '22℃',
        content: '旁站监督跳水池池壁聚氨酯防水涂料施工，检查基层处理、涂料配比、涂刷厚度、分层施工间隔时间。',
        issues: '部分区域第二遍涂刷间隔时间不足（要求≥24h，实测仅12h）；局部涂料厚度实测不足1.5mm设计要求。',
        requirement: '对涂刷间隔不足及厚度不够部位进行返工，严格按工艺要求分层施工并确保涂层厚度达标。',
        status: RECORD_STATUSES.REVIEW_PASSED,
        version: 1,
        current_handler_id: 6,
        created_by: 2,
        deadline: formatDateTime(nextWeek),
        evidences: [
          { type: EVIDENCE_TYPES.PHOTO, name: '防水涂料施工', desc: '池壁聚氨酯防水涂料涂刷', url: '/images/pz010-1.jpg' },
          { type: EVIDENCE_TYPES.PHOTO, name: '厚度检测', desc: '涂层厚度实测点测', url: '/images/pz010-2.jpg' },
          { type: EVIDENCE_TYPES.DOCUMENT, name: '涂料检测报告', desc: '防水材料进场复检报告', url: '/docs/pz010-test-report.pdf' },
        ],
        reviews: [
          { handler: 4, op: OPERATION_TYPES.START_REVIEW, opinion: '开始审核', result: 'process', prev: RECORD_STATUSES.SUBMITTED, next: RECORD_STATUSES.IN_REVIEW, reason: null, version: 1 },
          { handler: 4, op: OPERATION_TYPES.REVIEW_PASS, opinion: '审核通过，材料齐全', result: 'pass', prev: RECORD_STATUSES.IN_REVIEW, next: RECORD_STATUSES.REVIEW_PASSED, reason: null, version: 1 },
        ],
      },
    ];

    records.forEach((r) => {
      const result = insertRecord.run(
        r.record_no, r.project_name, r.construction_unit, r.supervision_unit, r.location,
        r.record_date, r.weather, r.temperature, r.content, r.issues, r.requirement,
        r.status, r.version, r.current_handler_id, r.created_by, r.deadline
      );
      const recordId = result.lastInsertRowid;

      r.evidences.forEach(e => {
        insertEvidence.run(recordId, e.type, e.name, e.desc || '', e.url, r.created_by);
      });

      r.reviews.forEach(rv => {
        insertReview.run(recordId, rv.handler, rv.op, rv.opinion, rv.result, rv.prev, rv.next, rv.reason, rv.version);
        insertLog.run(recordId, rv.handler, rv.op, `${rv.opinion.substring(0, 50)}${rv.reason ? `(原因:${rv.reason.substring(0, 30)})` : ''}`, '127.0.0.1');
      });

      insertLog.run(recordId, r.created_by, OPERATION_TYPES.CREATE, `创建旁站记录单 ${r.record_no}`, '127.0.0.1');
      if (r.status !== RECORD_STATUSES.DRAFT && r.reviews.length === 0) {
        insertLog.run(recordId, r.created_by, OPERATION_TYPES.SUBMIT, `提交旁站记录单 ${r.record_no}`, '127.0.0.1');
      }
    });

    console.log('旁站记录单数据插入完成，共10条记录');

    db.exec('COMMIT');
    console.log('样例数据插入完成！');
    process.exit(0);
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('样例数据插入失败:', e);
    process.exit(1);
  }
}

seed().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
