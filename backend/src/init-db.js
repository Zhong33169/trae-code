import { initDB, getDB } from './models/database.js';

function seedData() {
  const db = initDB();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) {
    console.log('数据已存在，跳过初始化');
    return;
  }

  const insertUser = db.prepare(`
    INSERT INTO users (username, name, role) VALUES (?, ?, ?)
  `);

  const users = [
    { username: 'dr_zhang', name: '张医生', role: 'doctor' },
    { username: 'dr_li', name: '李医生', role: 'doctor' },
    { username: 'nurse_wang', name: '王护士', role: 'nurse' },
    { username: 'nurse_liu', name: '刘护士', role: 'nurse' },
    { username: 'reviewer_chen', name: '陈主任', role: 'reviewer' },
    { username: 'reviewer_zhao', name: '赵主任', role: 'reviewer' },
    { username: 'admin', name: '管理员', role: 'admin' }
  ];

  for (const u of users) {
    insertUser.run(u.username, u.name, u.role);
  }

  const now = new Date();
  const daysAgo = (d, h = 10, m = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    date.setHours(h, m, 0, 0);
    return date.toISOString().slice(0, 19).replace('T', ' ');
  };
  const futureDays = (d, h = 10, m = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    date.setHours(h, m, 0, 0);
    return date.toISOString().slice(0, 19).replace('T', ' ');
  };

  const insertCareRecord = db.prepare(`
    INSERT INTO care_records (pet_name, species, breed, owner_name, owner_phone, admission_date, diagnosis, treatment_plan, status, priority, ward, bed_number, doctor_id, nurse_id, reviewer_id, deadline, return_reason, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // #1 豆豆 - 已归档（完整正常流程）
  insertCareRecord.run(
    '豆豆', '犬', '金毛', '王小明', '13800001111', daysAgo(7),
    '左前肢骨折', '手术内固定+术后护理', 'archived', 'normal', 'A区', 'A-01',
    1, 3, 5, futureDays(-2), null,
    daysAgo(7), daysAgo(1)
  );

  // #2 咪咪 - 复核中（正常办理完成，待复核）
  insertCareRecord.run(
    '咪咪', '猫', '英短', '李小华', '13900002222', daysAgo(5),
    '上呼吸道感染', '抗生素治疗+雾化', 'reviewing', 'normal', 'B区', 'B-03',
    1, 3, 5, futureDays(2), null,
    daysAgo(5), daysAgo(2)
  );

  // #3 旺财 - 已退回（附件缺失+驳回，完整补正痕迹）
  insertCareRecord.run(
    '旺财', '犬', '柯基', '张三', '13700003333', daysAgo(10),
    '细小病毒', '补液+抗病毒+营养支持', 'returned', 'urgent', '隔离区', 'I-02',
    2, 4, 6, daysAgo(3), '住院同意书被驳回，治疗记录不完整，需补正后重新提交',
    daysAgo(10), daysAgo(2)
  );

  // #4 球球 - 超时（危重，超时未处理）
  insertCareRecord.run(
    '球球', '猫', '布偶', '赵四', '13600004444', daysAgo(14),
    '急性肾衰竭', '透析+药物治疗', 'overdue', 'critical', 'ICU', 'ICU-01',
    1, 3, 5, daysAgo(4), null,
    daysAgo(14), daysAgo(8)
  );

  // #5 皮皮 - 办理中（正常办理中）
  insertCareRecord.run(
    '皮皮', '犬', '泰迪', '孙五', '13500005555', daysAgo(3),
    '皮肤真菌感染', '抗真菌药+药浴', 'processing', 'normal', 'C区', 'C-05',
    2, 4, null, futureDays(4), null,
    daysAgo(3), daysAgo(1)
  );

  // #6 小白 - 已发起（待办理）
  insertCareRecord.run(
    '小白', '兔', '荷兰侏儒兔', '周七', '13400006666', daysAgo(1),
    '消化道淤滞', '补液+促胃肠动力+止痛', 'initiated', 'urgent', 'D区', 'D-01',
    1, null, null, futureDays(2), null,
    daysAgo(1), daysAgo(1)
  );

  // #7 大黄 - 办理中（紧急，补钙治疗）
  insertCareRecord.run(
    '大黄', '犬', '中华田园犬', '吴八', '13300007777', daysAgo(5),
    '产后低血钙', '静脉补钙+监护', 'processing', 'urgent', 'A区', 'A-04',
    2, 3, null, futureDays(1), null,
    daysAgo(5), daysAgo(3)
  );

  // #8 花花 - 复核中（危重，猫传腹，待复核归档）
  insertCareRecord.run(
    '花花', '猫', '美短', '郑九', '13200008888', daysAgo(8),
    '猫传腹（干性）', 'GS441524+保肝治疗', 'reviewing', 'critical', 'B区', 'B-01',
    1, 4, 6, futureDays(1), null,
    daysAgo(8), daysAgo(2)
  );

  const insertAttachment = db.prepare(`
    INSERT INTO attachments (care_record_id, file_name, file_type, file_size, category, is_required, upload_type, status, uploaded_by, reviewed_by, reviewed_at, reject_reason, supplement_reason, replaced_attachment_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // #1 豆豆 - 全部附件
  insertAttachment.run(1, '入院登记表.pdf', '.pdf', 102400, 'admission_form', 1, 'initial', 'approved', 1, 5, daysAgo(6), null, null, null, daysAgo(7));
  insertAttachment.run(1, '住院同意书.pdf', '.pdf', 81920, 'consent_form', 1, 'initial', 'approved', 1, 5, daysAgo(6), null, null, null, daysAgo(7));
  insertAttachment.run(1, '血常规报告.pdf', '.pdf', 153600, 'lab_result', 0, 'initial', 'approved', 3, 5, daysAgo(5), null, null, null, daysAgo(6));
  insertAttachment.run(1, 'X光片.png', '.png', 2048000, 'imaging', 0, 'initial', 'approved', 3, 5, daysAgo(5), null, null, null, daysAgo(6));
  insertAttachment.run(1, '术后护理记录.pdf', '.pdf', 204800, 'treatment_record', 0, 'initial', 'approved', 3, 5, daysAgo(2), null, null, null, daysAgo(3));

  // #2 咪咪 - 复核中
  insertAttachment.run(2, '入院登记表.pdf', '.pdf', 98304, 'admission_form', 1, 'initial', 'approved', 1, 5, daysAgo(4), null, null, null, daysAgo(5));
  insertAttachment.run(2, '住院同意书.pdf', '.pdf', 77824, 'consent_form', 1, 'initial', 'approved', 1, 5, daysAgo(4), null, null, null, daysAgo(5));
  insertAttachment.run(2, '血常规报告.pdf', '.pdf', 122880, 'lab_result', 0, 'initial', 'approved', 3, 5, daysAgo(3), null, null, null, daysAgo(4));

  // #3 旺财 - 已退回（完整补正痕迹）
  insertAttachment.run(3, '入院登记表.pdf', '.pdf', 112640, 'admission_form', 1, 'initial', 'approved', 2, 6, daysAgo(8), null, null, null, daysAgo(9));
  // 住院同意书 - 初始版（被驳回）
  insertAttachment.run(3, '住院同意书_初版.jpg', '.jpg', 51200, 'consent_form', 1, 'initial', 'rejected', 4, 6, daysAgo(6), '文件模糊无法辨认，签字位置错误，请重新上传清晰扫描件', null, null, daysAgo(8));
  // 住院同意书 - 补传版（替换初版，待审核）
  insertAttachment.run(3, '住院同意书_补传版.pdf', '.pdf', 90112, 'consent_form', 1, 'resubmit', 'pending', 4, null, null, null, '原文件被驳回，重新上传清晰扫描件', 10, daysAgo(5));
  // 血常规
  insertAttachment.run(3, '血常规报告.pdf', '.pdf', 143360, 'lab_result', 0, 'initial', 'approved', 4, 6, daysAgo(7), null, null, null, daysAgo(8));
  // 治疗记录 - 初始版（被驳回）
  insertAttachment.run(3, '治疗记录_第1版.pdf', '.pdf', 66560, 'treatment_record', 0, 'initial', 'rejected', 4, 6, daysAgo(6), '治疗记录缺少每日体温记录、用药时间和护理人员签字', null, null, daysAgo(7));
  insertAttachment.run(3, '生化报告.pdf', '.pdf', 133120, 'lab_result', 0, 'initial', 'approved', 4, 6, daysAgo(7), null, null, null, daysAgo(8));

  // #4 球球 - 超时
  insertAttachment.run(4, '入院登记表.pdf', '.pdf', 105472, 'admission_form', 1, 'initial', 'approved', 1, null, null, null, null, null, daysAgo(14));
  insertAttachment.run(4, '住院同意书.pdf', '.pdf', 87040, 'consent_form', 1, 'initial', 'approved', 1, null, null, null, null, null, daysAgo(14));
  insertAttachment.run(4, '生化全套_第1版.pdf', '.pdf', 196608, 'lab_result', 0, 'initial', 'approved', 3, null, null, null, null, null, daysAgo(12));
  insertAttachment.run(4, 'B超报告_补传.pdf', '.pdf', 172032, 'imaging', 0, 'supplement', 'pending', 3, null, null, null, '住院3天后补充腹部B超检查', null, daysAgo(11));
  insertAttachment.run(4, '生化复查_第2版.pdf', '.pdf', 188416, 'lab_result', 0, 'supplement', 'pending', 3, null, null, null, '住院第7天复查生化指标', null, daysAgo(7));

  // #5 皮皮 - 办理中
  insertAttachment.run(5, '入院登记表.pdf', '.pdf', 94208, 'admission_form', 1, 'initial', 'approved', 2, null, null, null, null, null, daysAgo(3));
  insertAttachment.run(5, '住院同意书.pdf', '.pdf', 80896, 'consent_form', 1, 'initial', 'approved', 2, null, null, null, null, null, daysAgo(3));
  insertAttachment.run(5, '真菌培养报告_补传.pdf', '.pdf', 128000, 'lab_result', 0, 'supplement', 'pending', 4, null, null, null, '住院2天后出真菌培养结果', null, daysAgo(1));

  // #6 小白 - 已发起
  insertAttachment.run(6, '入院登记表.pdf', '.pdf', 99840, 'admission_form', 1, 'initial', 'pending', 1, null, null, null, null, null, daysAgo(1));
  insertAttachment.run(6, '[待上传]住院同意书', '', 0, 'consent_form', 1, 'initial', 'pending', null, null, null, null, null, null, daysAgo(1));

  // #7 大黄 - 办理中
  insertAttachment.run(7, '入院登记表.pdf', '.pdf', 107520, 'admission_form', 1, 'initial', 'approved', 2, null, null, null, null, null, daysAgo(5));
  insertAttachment.run(7, '住院同意书.pdf', '.pdf', 83968, 'consent_form', 1, 'initial', 'approved', 2, null, null, null, null, null, daysAgo(5));
  insertAttachment.run(7, '血钙检测报告.pdf', '.pdf', 115200, 'lab_result', 0, 'initial', 'approved', 3, null, null, null, null, null, daysAgo(4));

  // #8 花花 - 复核中
  insertAttachment.run(8, '入院登记表.pdf', '.pdf', 100352, 'admission_form', 1, 'initial', 'approved', 1, 6, daysAgo(7), null, null, null, daysAgo(8));
  insertAttachment.run(8, '住院同意书.pdf', '.pdf', 86016, 'consent_form', 1, 'initial', 'approved', 1, 6, daysAgo(7), null, null, null, daysAgo(8));
  insertAttachment.run(8, '生化报告.pdf', '.pdf', 180224, 'lab_result', 0, 'initial', 'approved', 4, 6, daysAgo(6), null, null, null, daysAgo(7));
  insertAttachment.run(8, '腹水分析报告_补传.pdf', '.pdf', 145408, 'lab_result', 0, 'supplement', 'pending', 4, null, null, null, '入院后第2天采集腹水送检', null, daysAgo(6));
  insertAttachment.run(8, '治疗记录.pdf', '.pdf', 155648, 'treatment_record', 0, 'initial', 'approved', 4, 6, daysAgo(5), null, null, null, daysAgo(6));

  const insertMedication = db.prepare(`
    INSERT INTO medication_records (care_record_id, medicine_name, dosage, route, frequency, start_time, end_time, administered_by, notes, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // #1 豆豆
  insertMedication.run(1, '美洛昔康', '0.1mg/kg', '皮下注射', '每日1次', daysAgo(7), daysAgo(3), 3, '术后镇痛', 'completed', daysAgo(7));
  insertMedication.run(1, '阿莫西林克拉维酸', '12.5mg/kg', '口服', '每日2次', daysAgo(7), daysAgo(1), 3, '预防术后感染', 'completed', daysAgo(7));

  // #2 咪咪
  insertMedication.run(2, '多西环素', '5mg/kg', '口服', '每日2次', daysAgo(5), null, 3, '抗支原体', 'active', daysAgo(5));
  insertMedication.run(2, '雾化生理盐水', '5ml', '雾化吸入', '每日2次', daysAgo(5), null, 3, '呼吸道湿化', 'active', daysAgo(5));

  // #3 旺财
  insertMedication.run(3, '干扰素', '50万IU/kg', '皮下注射', '每日1次', daysAgo(10), daysAgo(4), 4, '抗病毒', 'discontinued', daysAgo(10));
  insertMedication.run(3, '乳酸林格液', '30ml/kg', '静脉滴注', '每日1次', daysAgo(10), daysAgo(4), 4, '补液', 'discontinued', daysAgo(10));
  insertMedication.run(3, '头孢噻呋', '5mg/kg', '皮下注射', '每日1次', daysAgo(10), daysAgo(4), 4, '抗感染', 'discontinued', daysAgo(10));

  // #4 球球
  insertMedication.run(4, '腹膜透析液', '20ml/kg', '腹腔注射', '每日2次', daysAgo(14), null, 3, '透析治疗', 'active', daysAgo(14));
  insertMedication.run(4, '肾康注射液', '0.2ml/kg', '静脉滴注', '每日1次', daysAgo(14), null, 3, '护肾', 'active', daysAgo(14));
  insertMedication.run(4, '速尿', '2mg/kg', '静脉推注', '每日2次', daysAgo(14), null, 3, '利尿', 'active', daysAgo(14));

  // #5 皮皮
  insertMedication.run(5, '伊曲康唑', '5mg/kg', '口服', '每日1次', daysAgo(3), null, 4, '抗真菌', 'active', daysAgo(3));
  insertMedication.run(5, '药浴', '每周2次', null, '每周2次', daysAgo(3), null, 4, '抗真菌药浴', 'active', daysAgo(3));

  // #6 小白
  insertMedication.run(6, '西沙比利', '0.5mg/kg', '口服', '每日2次', daysAgo(1), null, null, '促胃肠动力', 'active', daysAgo(1));
  insertMedication.run(6, '美洛昔康', '0.2mg/kg', '皮下注射', '每日1次', daysAgo(1), null, null, '止痛', 'active', daysAgo(1));

  // #7 大黄
  insertMedication.run(7, '10%葡萄糖酸钙', '1ml/kg', '静脉缓慢推注', '每日1次', daysAgo(5), daysAgo(3), 3, '补钙', 'completed', daysAgo(5));
  insertMedication.run(7, 'VD3', '0.1ml/kg', '肌内注射', '每日1次', daysAgo(5), daysAgo(3), 3, '促进钙吸收', 'completed', daysAgo(5));

  // #8 花花
  insertMedication.run(8, 'GS441524', '2mg/kg', '皮下注射', '每日1次', daysAgo(8), null, 4, '抗传腹', 'active', daysAgo(8));
  insertMedication.run(8, '水飞蓟素', '2mg/kg', '口服', '每日2次', daysAgo(8), null, 4, '保肝', 'active', daysAgo(8));
  insertMedication.run(8, '丹诺士', '10mg/kg', '口服', '每日2次', daysAgo(8), null, 4, '护肝', 'active', daysAgo(8));

  const insertDischarge = db.prepare(`
    INSERT INTO discharge_confirmations (care_record_id, discharge_date, discharge_summary, follow_up, condition_at_discharge, discharged_by, confirmed_by, status, created_at, confirmed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertDischarge.run(1, daysAgo(1), '左前肢骨折术后恢复良好，伤口愈合良好，患肢可自主行走，饮食二便正常', '术后2周复查X光片，限制剧烈运动4周', '良好', 1, 5, 'confirmed', daysAgo(2), daysAgo(1));

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (care_record_id, action, actor_id, actor_name, actor_role, old_value, new_value, reason, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // ===== #1 豆豆 - 完整流程
  insertAudit.run(1, 'create', 1, '张医生', 'doctor', null, '{"pet_name":"豆豆","status":"initiated"}', null, '张医生创建住院护理单', daysAgo(7, 10));
  insertAudit.run(1, 'status_change', 1, '张医生', 'doctor', '{"status":"initiated","nurse_id":null,"nurse_name":null}', '{"status":"processing","nurse_id":3,"nurse_name":"王护士"}', null, '张医生将护理单分配给王护士开始办理，经办护士: 王护士', daysAgo(7, 11));
  insertAudit.run(1, 'upload_attachment', 1, '张医生', 'doctor', null, '{"file_name":"入院登记表.pdf","upload_type":"initial"}', null, '张医生上传附件: 入院登记表.pdf (初始上传)', daysAgo(7, 11));
  insertAudit.run(1, 'upload_attachment', 1, '张医生', 'doctor', null, '{"file_name":"住院同意书.pdf","upload_type":"initial"}', null, '张医生上传附件: 住院同意书.pdf (初始上传)', daysAgo(7, 11));
  insertAudit.run(1, 'approve_attachment', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '陈主任审核通过附件: 入院登记表.pdf', daysAgo(6, 9));
  insertAudit.run(1, 'approve_attachment', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '陈主任审核通过附件: 住院同意书.pdf', daysAgo(6, 9));
  insertAudit.run(1, 'upload_attachment', 3, '王护士', 'nurse', null, '{"file_name":"血常规报告.pdf","upload_type":"initial"}', null, '王护士上传附件: 血常规报告.pdf (初始上传)', daysAgo(6, 14));
  insertAudit.run(1, 'upload_attachment', 3, '王护士', 'nurse', null, '{"file_name":"X光片.png","upload_type":"initial"}', null, '王护士上传附件: X光片.png (初始上传)', daysAgo(6, 14));
  insertAudit.run(1, 'approve_attachment', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '陈主任审核通过附件: 血常规报告.pdf', daysAgo(5, 10));
  insertAudit.run(1, 'approve_attachment', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '陈主任审核通过附件: X光片.png', daysAgo(5, 10));
  insertAudit.run(1, 'upload_attachment', 3, '王护士', 'nurse', null, '{"file_name":"术后护理记录.pdf","upload_type":"initial"}', null, '王护士上传附件: 术后护理记录.pdf (初始上传)', daysAgo(3, 16));
  insertAudit.run(1, 'approve_attachment', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '陈主任审核通过附件: 术后护理记录.pdf', daysAgo(2, 10));
  insertAudit.run(1, 'status_change', 3, '王护士', 'nurse', '{"status":"processing","reviewer_id":null,"reviewer_name":null}', '{"status":"reviewing","reviewer_id":5,"reviewer_name":"陈主任"}', null, '王护士提交护理单进入复核，复核人: 陈主任', daysAgo(2, 15));
  insertAudit.run(1, 'create_discharge', 1, '张医生', 'doctor', null, '{"discharge_date":"2026-06-20"}', null, '张医生创建出院确认', daysAgo(2, 16));
  insertAudit.run(1, 'discharge_confirmed', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"confirmed"}', null, '陈主任确认出院，护理单归档', daysAgo(1, 10));

  // ===== #2 咪咪 - 复核中
  insertAudit.run(2, 'create', 1, '张医生', 'doctor', null, '{"pet_name":"咪咪","status":"initiated"}', null, '张医生创建住院护理单', daysAgo(5, 8));
  insertAudit.run(2, 'status_change', 1, '张医生', 'doctor', '{"status":"initiated","nurse_id":null,"nurse_name":null}', '{"status":"processing","nurse_id":3,"nurse_name":"王护士"}', null, '张医生将护理单分配给王护士开始办理，经办护士: 王护士', daysAgo(5, 9));
  insertAudit.run(2, 'upload_attachment', 1, '张医生', 'doctor', null, '{"file_name":"入院登记表.pdf","upload_type":"initial"}', null, '张医生上传附件: 入院登记表.pdf (初始上传)', daysAgo(5, 9));
  insertAudit.run(2, 'upload_attachment', 1, '张医生', 'doctor', null, '{"file_name":"住院同意书.pdf","upload_type":"initial"}', null, '张医生上传附件: 住院同意书.pdf (初始上传)', daysAgo(5, 9));
  insertAudit.run(2, 'upload_attachment', 3, '王护士', 'nurse', null, '{"file_name":"血常规报告.pdf","upload_type":"initial"}', null, '王护士上传附件: 血常规报告.pdf (初始上传)', daysAgo(4, 10));
  insertAudit.run(2, 'approve_attachment', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '陈主任审核通过附件: 入院登记表.pdf', daysAgo(4, 14));
  insertAudit.run(2, 'approve_attachment', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '陈主任审核通过附件: 住院同意书.pdf', daysAgo(4, 14));
  insertAudit.run(2, 'approve_attachment', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '陈主任审核通过附件: 血常规报告.pdf', daysAgo(3, 10));
  insertAudit.run(2, 'status_change', 3, '王护士', 'nurse', '{"status":"processing","reviewer_id":null,"reviewer_name":null}', '{"status":"reviewing","reviewer_id":5,"reviewer_name":"陈主任"}', null, '王护士提交护理单进入复核，复核人: 陈主任', daysAgo(2, 10));

  // ===== #3 旺财 - 退回样例（完整补正痕迹）
  insertAudit.run(3, 'create', 2, '李医生', 'doctor', null, '{"pet_name":"旺财","status":"initiated"}', null, '李医生创建住院护理单', daysAgo(10, 9));
  insertAudit.run(3, 'status_change', 2, '李医生', 'doctor', '{"status":"initiated","nurse_id":null,"nurse_name":null}', '{"status":"processing","nurse_id":4,"nurse_name":"刘护士"}', null, '李医生将护理单分配给刘护士开始办理，经办护士: 刘护士', daysAgo(10, 10));
  insertAudit.run(3, 'upload_attachment', 2, '李医生', 'doctor', null, '{"file_name":"入院登记表.pdf","upload_type":"initial"}', null, '李医生上传附件: 入院登记表.pdf (初始上传)', daysAgo(9, 10));
  insertAudit.run(3, 'upload_attachment', 4, '刘护士', 'nurse', null, '{"file_name":"住院同意书_初版.jpg","upload_type":"initial"}', null, '刘护士上传附件: 住院同意书_初版.jpg (初始上传)', daysAgo(8, 14));
  insertAudit.run(3, 'upload_attachment', 4, '刘护士', 'nurse', null, '{"file_name":"血常规报告.pdf","upload_type":"initial"}', null, '刘护士上传附件: 血常规报告.pdf (初始上传)', daysAgo(8, 15));
  insertAudit.run(3, 'upload_attachment', 4, '刘护士', 'nurse', null, '{"file_name":"生化报告.pdf","upload_type":"initial"}', null, '刘护士上传附件: 生化报告.pdf (初始上传)', daysAgo(8, 15));
  insertAudit.run(3, 'approve_attachment', 6, '赵主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '赵主任审核通过附件: 入院登记表.pdf', daysAgo(8, 17));
  insertAudit.run(3, 'approve_attachment', 6, '赵主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '赵主任审核通过附件: 血常规报告.pdf', daysAgo(7, 9));
  insertAudit.run(3, 'approve_attachment', 6, '赵主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '赵主任审核通过附件: 生化报告.pdf', daysAgo(7, 9));
  insertAudit.run(3, 'reject_attachment', 6, '赵主任', 'reviewer', '{"status":"pending"}', '{"status":"rejected"}', '文件模糊无法辨认，签字位置错误，请重新上传清晰扫描件', '赵主任驳回附件: 住院同意书_初版.jpg，原因: 文件模糊无法辨认，签字位置错误，请重新上传清晰扫描件', daysAgo(6, 11));
  insertAudit.run(3, 'upload_attachment', 4, '刘护士', 'nurse', '{"replaced_id":10,"replaced_file_name":"住院同意书_初版.jpg"}', '{"file_name":"住院同意书_补传版.pdf","upload_type":"resubmit","replaced_attachment_id":10}', '原文件被驳回，重新上传清晰扫描件', '刘护士重新提交补传附件: 住院同意书_补传版.pdf (重新提交)，替换原附件 #10 (住院同意书_初版.jpg)，原附件驳回原因: 文件模糊无法辨认，签字位置错误，请重新上传清晰扫描件', daysAgo(5, 10));
  insertAudit.run(3, 'upload_attachment', 4, '刘护士', 'nurse', null, '{"file_name":"治疗记录_第1版.pdf","upload_type":"initial"}', null, '刘护士上传附件: 治疗记录_第1版.pdf (初始上传)', daysAgo(7, 16));
  insertAudit.run(3, 'reject_attachment', 6, '赵主任', 'reviewer', '{"status":"pending"}', '{"status":"rejected"}', '治疗记录缺少每日体温记录、用药时间和护理人员签字', '赵主任驳回附件: 治疗记录_第1版.pdf，原因: 治疗记录缺少每日体温记录、用药时间和护理人员签字', daysAgo(6, 15));
  insertAudit.run(3, 'status_change', 4, '刘护士', 'nurse', '{"status":"processing","reviewer_id":null,"reviewer_name":null}', '{"status":"reviewing","reviewer_id":6,"reviewer_name":"赵主任"}', null, '刘护士提交护理单进入复核，复核人: 赵主任', daysAgo(4, 10));
  insertAudit.run(3, 'status_change', 6, '赵主任', 'reviewer', '{"status":"reviewing"}', '{"status":"returned","return_reason":"住院同意书被驳回，治疗记录不完整，需补正后重新提交"}', '住院同意书被驳回，治疗记录不完整，需补正后重新提交', '赵主任将护理单退回办理护士刘护士，退回原因: 住院同意书被驳回，治疗记录不完整，需补正后重新提交', daysAgo(2, 14));
  insertAudit.run(3, 'returned_recorded', 6, '赵主任', 'reviewer', null, null, '住院同意书被驳回，治疗记录不完整，需补正后重新提交', '护理单被退回，责任人: 经办护士刘护士、复核人赵主任，退回原因: 住院同意书被驳回，治疗记录不完整，需补正后重新提交', daysAgo(2, 14));

  // ===== #4 球球 - 超时样例
  insertAudit.run(4, 'create', 1, '张医生', 'doctor', null, '{"pet_name":"球球","status":"initiated"}', null, '张医生创建住院护理单', daysAgo(14, 8));
  insertAudit.run(4, 'status_change', 1, '张医生', 'doctor', '{"status":"initiated","nurse_id":null,"nurse_name":null}', '{"status":"processing","nurse_id":3,"nurse_name":"王护士"}', null, '张医生将护理单分配给王护士开始办理，经办护士: 王护士', daysAgo(14, 9));
  insertAudit.run(4, 'upload_attachment', 1, '张医生', 'doctor', null, '{"file_name":"入院登记表.pdf","upload_type":"initial"}', null, '张医生上传附件: 入院登记表.pdf (初始上传)', daysAgo(14, 9));
  insertAudit.run(4, 'upload_attachment', 1, '张医生', 'doctor', null, '{"file_name":"住院同意书.pdf","upload_type":"initial"}', null, '张医生上传附件: 住院同意书.pdf (初始上传)', daysAgo(14, 9));
  insertAudit.run(4, 'upload_attachment', 3, '王护士', 'nurse', null, '{"file_name":"生化全套_第1版.pdf","upload_type":"initial"}', null, '王护士上传附件: 生化全套_第1版.pdf (初始上传)', daysAgo(12, 10));
  insertAudit.run(4, 'upload_attachment', 3, '王护士', 'nurse', null, '{"file_name":"B超报告_补传.pdf","upload_type":"supplement"}', '住院3天后补充腹部B超检查', '王护士补传附件: B超报告_补传.pdf (补传)', daysAgo(11, 14));
  insertAudit.run(4, 'supplement_attachment', 3, '王护士', 'nurse', '{"upload_type":"initial"}', '{"upload_type":"supplement"}', '住院3天后补充腹部B超检查', '附件补传标记: B超报告_补传.pdf, 原因: 住院3天后补充腹部B超检查', daysAgo(11, 14));
  insertAudit.run(4, 'upload_attachment', 3, '王护士', 'nurse', null, '{"file_name":"生化复查_第2版.pdf","upload_type":"supplement"}', '住院第7天复查生化指标', '王护士补传附件: 生化复查_第2版.pdf (补传)', daysAgo(7, 10));
  insertAudit.run(4, 'overdue_recorded', 7, '系统', 'system', null, null, '截止日期已过，护理单超时未处理', '护理单超时未处理，责任人: 王护士（经办护士）、陈主任（复核员）', daysAgo(4, 0));

  // ===== #5 皮皮 - 办理中
  insertAudit.run(5, 'create', 2, '李医生', 'doctor', null, '{"pet_name":"皮皮","status":"initiated"}', null, '李医生创建住院护理单', daysAgo(3, 10));
  insertAudit.run(5, 'status_change', 2, '李医生', 'doctor', '{"status":"initiated","nurse_id":null,"nurse_name":null}', '{"status":"processing","nurse_id":4,"nurse_name":"刘护士"}', null, '李医生将护理单分配给刘护士开始办理，经办护士: 刘护士', daysAgo(3, 11));
  insertAudit.run(5, 'upload_attachment', 2, '李医生', 'doctor', null, '{"file_name":"入院登记表.pdf","upload_type":"initial"}', null, '李医生上传附件: 入院登记表.pdf (初始上传)', daysAgo(3, 11));
  insertAudit.run(5, 'upload_attachment', 2, '李医生', 'doctor', null, '{"file_name":"住院同意书.pdf","upload_type":"initial"}', null, '李医生上传附件: 住院同意书.pdf (初始上传)', daysAgo(3, 11));
  insertAudit.run(5, 'supplement_attachment', 4, '刘护士', 'nurse', null, '{"upload_type":"supplement"}', '住院2天后出真菌培养结果', '附件补传标记: 真菌培养报告_补传.pdf, 原因: 住院2天后出真菌培养结果', daysAgo(1, 14));
  insertAudit.run(5, 'upload_attachment', 4, '刘护士', 'nurse', null, '{"file_name":"真菌培养报告_补传.pdf","upload_type":"supplement"}', '住院2天后出真菌培养结果', '刘护士补传附件: 真菌培养报告_补传.pdf (补传)', daysAgo(1, 14));

  // ===== #6 小白 - 已发起
  insertAudit.run(6, 'create', 1, '张医生', 'doctor', null, '{"pet_name":"小白","status":"initiated"}', null, '张医生创建住院护理单', daysAgo(1, 11));
  insertAudit.run(6, 'upload_attachment', 1, '张医生', 'doctor', null, '{"file_name":"入院登记表.pdf","upload_type":"initial"}', null, '张医生上传附件: 入院登记表.pdf (初始上传)', daysAgo(1, 11));

  // ===== #7 大黄 - 办理中
  insertAudit.run(7, 'create', 2, '李医生', 'doctor', null, '{"pet_name":"大黄","status":"initiated"}', null, '李医生创建住院护理单', daysAgo(5, 9));
  insertAudit.run(7, 'status_change', 2, '李医生', 'doctor', '{"status":"initiated","nurse_id":null,"nurse_name":null}', '{"status":"processing","nurse_id":3,"nurse_name":"王护士"}', null, '李医生将护理单分配给王护士开始办理，经办护士: 王护士', daysAgo(5, 10));
  insertAudit.run(7, 'upload_attachment', 2, '李医生', 'doctor', null, '{"file_name":"入院登记表.pdf","upload_type":"initial"}', null, '李医生上传附件: 入院登记表.pdf (初始上传)', daysAgo(5, 10));
  insertAudit.run(7, 'upload_attachment', 2, '李医生', 'doctor', null, '{"file_name":"住院同意书.pdf","upload_type":"initial"}', null, '李医生上传附件: 住院同意书.pdf (初始上传)', daysAgo(5, 10));
  insertAudit.run(7, 'upload_attachment', 3, '王护士', 'nurse', null, '{"file_name":"血钙检测报告.pdf","upload_type":"initial"}', null, '王护士上传附件: 血钙检测报告.pdf (初始上传)', daysAgo(4, 14));

  // ===== #8 花花 - 复核中
  insertAudit.run(8, 'create', 1, '张医生', 'doctor', null, '{"pet_name":"花花","status":"initiated"}', null, '张医生创建住院护理单', daysAgo(8, 9));
  insertAudit.run(8, 'status_change', 1, '张医生', 'doctor', '{"status":"initiated","nurse_id":null,"nurse_name":null}', '{"status":"processing","nurse_id":4,"nurse_name":"刘护士"}', null, '张医生将护理单分配给刘护士开始办理，经办护士: 刘护士', daysAgo(8, 10));
  insertAudit.run(8, 'upload_attachment', 1, '张医生', 'doctor', null, '{"file_name":"入院登记表.pdf","upload_type":"initial"}', null, '张医生上传附件: 入院登记表.pdf (初始上传)', daysAgo(8, 10));
  insertAudit.run(8, 'upload_attachment', 1, '张医生', 'doctor', null, '{"file_name":"住院同意书.pdf","upload_type":"initial"}', null, '张医生上传附件: 住院同意书.pdf (初始上传)', daysAgo(8, 10));
  insertAudit.run(8, 'approve_attachment', 6, '赵主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '赵主任审核通过附件: 入院登记表.pdf', daysAgo(7, 9));
  insertAudit.run(8, 'approve_attachment', 6, '赵主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '赵主任审核通过附件: 住院同意书.pdf', daysAgo(7, 9));
  insertAudit.run(8, 'upload_attachment', 4, '刘护士', 'nurse', null, '{"file_name":"生化报告.pdf","upload_type":"initial"}', null, '刘护士上传附件: 生化报告.pdf (初始上传)', daysAgo(7, 14));
  insertAudit.run(8, 'approve_attachment', 6, '赵主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '赵主任审核通过附件: 生化报告.pdf', daysAgo(6, 10));
  insertAudit.run(8, 'supplement_attachment', 4, '刘护士', 'nurse', null, '{"upload_type":"supplement"}', '入院后第2天采集腹水送检', '附件补传标记: 腹水分析报告_补传.pdf, 原因: 入院后第2天采集腹水送检', daysAgo(6, 15));
  insertAudit.run(8, 'upload_attachment', 4, '刘护士', 'nurse', null, '{"file_name":"腹水分析报告_补传.pdf","upload_type":"supplement"}', '入院后第2天采集腹水送检', '刘护士补传附件: 腹水分析报告_补传.pdf (补传)', daysAgo(6, 15));
  insertAudit.run(8, 'upload_attachment', 4, '刘护士', 'nurse', null, '{"file_name":"治疗记录.pdf","upload_type":"initial"}', null, '刘护士上传附件: 治疗记录.pdf (初始上传)', daysAgo(6, 16));
  insertAudit.run(8, 'approve_attachment', 6, '赵主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '赵主任审核通过附件: 治疗记录.pdf', daysAgo(5, 11));
  insertAudit.run(8, 'status_change', 4, '刘护士', 'nurse', '{"status":"processing","reviewer_id":null,"reviewer_name":null}', '{"status":"reviewing","reviewer_id":6,"reviewer_name":"赵主任"}', null, '刘护士提交护理单进入复核，复核人: 赵主任', daysAgo(2, 10));

  console.log('演示数据初始化完成');
  console.log('\n用户列表:');
  const allUsers = db.prepare('SELECT id, username, name, role FROM users').all();
  allUsers.forEach(u => console.log('  [' + u.id + '] ' + u.username + ' - ' + u.name + ' (' + u.role + ')'));

  const allRecords = db.prepare('SELECT cr.id, cr.pet_name, cr.status, cr.priority, d.name as doctor_name, n.name as nurse_name, r.name as reviewer_name FROM care_records cr LEFT JOIN users d ON cr.doctor_id = d.id LEFT JOIN users n ON cr.nurse_id = n.id LEFT JOIN users r ON cr.reviewer_id = r.id ORDER BY cr.id').all();
  console.log('\n护理单列表:');
  allRecords.forEach(r => {
    const info = [];
    if (r.doctor_name) info.push('医生:' + r.doctor_name);
    if (r.nurse_name) info.push('护士:' + r.nurse_name);
    if (r.reviewer_name) info.push('复核:' + r.reviewer_name);
    console.log('  [' + r.id + '] ' + r.pet_name + ' - 状态:' + r.status + ', 优先级:' + r.priority + ' [' + info.join(' / ') + ']');
  });

  console.log('\n附件统计:');
  const attStats = db.prepare(`
    SELECT cr.id, cr.pet_name,
      COUNT(a.id) as total,
      SUM(CASE WHEN a.is_required = 1 THEN 1 ELSE 0 END) as required_count,
      SUM(CASE WHEN a.upload_type = 'supplement' THEN 1 ELSE 0 END) as supplement_count,
      SUM(CASE WHEN a.upload_type = 'resubmit' THEN 1 ELSE 0 END) as resubmit_count,
      SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
      SUM(CASE WHEN a.replaced_attachment_id IS NOT NULL THEN 1 ELSE 0 END) as replaced_count
    FROM care_records cr
    LEFT JOIN attachments a ON cr.id = a.care_record_id
    GROUP BY cr.id
    ORDER BY cr.id
  `).all();
  attStats.forEach(s => {
    console.log('  [#' + s.id + '] ' + s.pet_name + ': ' + s.total + '个附件 (必传:' + s.required_count + ', 补传:' + s.supplement_count + ', 重提:' + s.resubmit_count + ', 驳回:' + s.rejected_count + ', 替换:' + s.replaced_count + ')');
  });
}

seedData();
