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

  const insertCareRecord = db.prepare(`
    INSERT INTO care_records (pet_name, species, breed, owner_name, owner_phone, admission_date, diagnosis, treatment_plan, status, priority, ward, bed_number, doctor_id, nurse_id, reviewer_id, deadline, return_reason, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const daysAgo = (d) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date.toISOString().slice(0, 19).replace('T', ' ');
  };
  const futureDays = (d) => {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    return date.toISOString().slice(0, 19).replace('T', ' ');
  };

  insertCareRecord.run(
    '豆豆', '犬', '金毛', '王小明', '13800001111', daysAgo(5),
    '左前肢骨折', '手术内固定+术后护理', 'archived', 'normal', 'A区', 'A-01',
    1, 3, 5, daysAgo(-2), null, daysAgo(5), daysAgo(1)
  );

  insertCareRecord.run(
    '咪咪', '猫', '英短', '李小华', '13900002222', daysAgo(3),
    '上呼吸道感染', '抗生素治疗+雾化', 'reviewing', 'normal', 'B区', 'B-03',
    1, 3, 5, futureDays(3), null, daysAgo(3), daysAgo(1)
  );

  insertCareRecord.run(
    '旺财', '犬', '柯基', '张三', '13700003333', daysAgo(7),
    '细小病毒', '补液+抗病毒+营养支持', 'returned', 'urgent', '隔离区', 'I-02',
    2, 4, 6, daysAgo(2), '住院同意书缺失，治疗记录不完整', daysAgo(7), daysAgo(1)
  );

  insertCareRecord.run(
    '球球', '猫', '布偶', '赵四', '13600004444', daysAgo(10),
    '肾衰竭（急性）', '透析+药物治疗', 'overdue', 'critical', 'ICU', 'ICU-01',
    1, 3, null, daysAgo(3), null, daysAgo(10), daysAgo(5)
  );

  insertCareRecord.run(
    '皮皮', '犬', '泰迪', '孙五', '13500005555', daysAgo(2),
    '皮肤真菌感染', '抗真菌药+药浴', 'processing', 'normal', 'C区', 'C-05',
    2, 4, null, futureDays(5), null, daysAgo(2), daysAgo(1)
  );

  insertCareRecord.run(
    '小白', '兔', '荷兰侏儒兔', '周七', '13400006666', daysAgo(1),
    '消化道淤滞', '补液+促胃肠动力+止痛', 'initiated', 'urgent', 'D区', 'D-01',
    1, null, null, futureDays(2), null, daysAgo(1), daysAgo(1)
  );

  insertCareRecord.run(
    '大黄', '犬', '中华田园犬', '吴八', '13300007777', daysAgo(4),
    '产后低血钙', '静脉补钙+监护', 'processing', 'urgent', 'A区', 'A-04',
    2, 3, null, futureDays(1), null, daysAgo(4), daysAgo(2)
  );

  insertCareRecord.run(
    '花花', '猫', '美短', '郑九', '13200008888', daysAgo(6),
    '猫传腹（干性）', 'GS441524+保肝治疗', 'reviewing', 'critical', 'B区', 'B-01',
    1, 4, 5, futureDays(2), null, daysAgo(6), daysAgo(1)
  );

  const insertAttachment = db.prepare(`
    INSERT INTO attachments (care_record_id, file_name, file_type, file_size, category, is_required, upload_type, status, uploaded_by, reviewed_by, reviewed_at, reject_reason, supplement_reason, replaced_attachment_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAttachment.run(1, '入院登记表.pdf', '.pdf', 102400, 'admission_form', 1, 'initial', 'approved', 1, 5, daysAgo(4), null, null, null, daysAgo(5));
  insertAttachment.run(1, '住院同意书.pdf', '.pdf', 81920, 'consent_form', 1, 'initial', 'approved', 1, 5, daysAgo(4), null, null, null, daysAgo(5));
  insertAttachment.run(1, '血常规报告.pdf', '.pdf', 153600, 'lab_result', 0, 'initial', 'approved', 3, 5, daysAgo(3), null, null, null, daysAgo(4));
  insertAttachment.run(1, 'X光片.png', '.png', 2048000, 'imaging', 0, 'initial', 'approved', 3, 5, daysAgo(3), null, null, null, daysAgo(4));

  insertAttachment.run(2, '入院登记表.pdf', '.pdf', 98304, 'admission_form', 1, 'initial', 'approved', 1, 5, daysAgo(2), null, null, null, daysAgo(3));
  insertAttachment.run(2, '住院同意书.pdf', '.pdf', 77824, 'consent_form', 1, 'initial', 'pending', 1, null, null, null, null, null, daysAgo(3));

  insertAttachment.run(3, '入院登记表.pdf', '.pdf', 112640, 'admission_form', 1, 'initial', 'approved', 2, 6, daysAgo(6), null, null, null, daysAgo(7));
  insertAttachment.run(3, '住院同意书_缺失.jpg', '.jpg', 51200, 'consent_form', 1, 'initial', 'rejected', 4, 6, daysAgo(3), '文件模糊无法辨认，请重新上传清晰扫描件', null, null, daysAgo(6));
  insertAttachment.run(3, '住院同意书_补传.pdf', '.pdf', 90112, 'consent_form', 1, 'resubmit', 'pending', 4, null, null, null, '原文件被驳回，补传清晰版本', 8, daysAgo(2));
  insertAttachment.run(3, '血常规报告.pdf', '.pdf', 143360, 'lab_result', 0, 'initial', 'approved', 4, 6, daysAgo(5), null, null, null, daysAgo(6));
  insertAttachment.run(3, '治疗记录_不完整.pdf', '.pdf', 66560, 'treatment_record', 0, 'initial', 'rejected', 4, 6, daysAgo(3), '治疗记录缺少每日体温和用药时间', null, null, daysAgo(5));

  insertAttachment.run(4, '入院登记表.pdf', '.pdf', 105472, 'admission_form', 1, 'initial', 'approved', 1, null, null, null, null, null, daysAgo(10));
  insertAttachment.run(4, '住院同意书.pdf', '.pdf', 87040, 'consent_form', 1, 'initial', 'approved', 1, null, null, null, null, null, daysAgo(10));
  insertAttachment.run(4, '生化全套.pdf', '.pdf', 196608, 'lab_result', 0, 'initial', 'pending', 3, null, null, null, null, null, daysAgo(8));
  insertAttachment.run(4, 'B超报告.pdf', '.pdf', 172032, 'imaging', 0, 'supplement', 'pending', 3, null, null, '住院3天后补充B超结果', null, null, daysAgo(7));

  insertAttachment.run(5, '入院登记表.pdf', '.pdf', 94208, 'admission_form', 1, 'initial', 'approved', 2, null, null, null, null, null, daysAgo(2));
  insertAttachment.run(5, '住院同意书.pdf', '.pdf', 80896, 'consent_form', 1, 'initial', 'approved', 2, null, null, null, null, null, daysAgo(2));
  insertAttachment.run(5, '真菌培养报告.pdf', '.pdf', 128000, 'lab_result', 0, 'supplement', 'pending', 4, null, null, '住院2天后出培养结果', null, null, daysAgo(1));

  insertAttachment.run(6, '入院登记表.pdf', '.pdf', 99840, 'admission_form', 1, 'initial', 'pending', 1, null, null, null, null, null, daysAgo(1));
  insertAttachment.run(6, '住院同意书_待上传', '', 0, 'consent_form', 1, 'initial', 'pending', null, null, null, null, null, null, daysAgo(1));

  insertAttachment.run(7, '入院登记表.pdf', '.pdf', 107520, 'admission_form', 1, 'initial', 'approved', 2, null, null, null, null, null, daysAgo(4));
  insertAttachment.run(7, '住院同意书.pdf', '.pdf', 83968, 'consent_form', 1, 'initial', 'approved', 2, null, null, null, null, null, daysAgo(4));
  insertAttachment.run(7, '血钙检测报告.pdf', '.pdf', 115200, 'lab_result', 0, 'initial', 'approved', 3, null, null, null, null, null, daysAgo(3));

  insertAttachment.run(8, '入院登记表.pdf', '.pdf', 100352, 'admission_form', 1, 'initial', 'approved', 1, 5, daysAgo(5), null, null, null, daysAgo(6));
  insertAttachment.run(8, '住院同意书.pdf', '.pdf', 86016, 'consent_form', 1, 'initial', 'approved', 1, 5, daysAgo(5), null, null, null, daysAgo(6));
  insertAttachment.run(8, '生化报告.pdf', '.pdf', 180224, 'lab_result', 0, 'initial', 'approved', 4, 5, daysAgo(4), null, null, null, daysAgo(5));
  insertAttachment.run(8, '腹水分析报告.pdf', '.pdf', 145408, 'lab_result', 0, 'supplement', 'pending', 4, null, null, '入院后第2天采集腹水分析', null, null, daysAgo(4));

  const insertMedication = db.prepare(`
    INSERT INTO medication_records (care_record_id, medicine_name, dosage, route, frequency, start_time, end_time, administered_by, notes, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMedication.run(1, '美洛昔康', '0.1mg/kg', '皮下注射', '每日1次', daysAgo(5), daysAgo(3), 3, '术后镇痛', 'completed', daysAgo(5));
  insertMedication.run(1, '阿莫西林克拉维酸', '12.5mg/kg', '口服', '每日2次', daysAgo(5), daysAgo(1), 3, '预防术后感染', 'completed', daysAgo(5));
  insertMedication.run(2, '多西环素', '5mg/kg', '口服', '每日2次', daysAgo(3), null, 3, '抗支原体', 'active', daysAgo(3));
  insertMedication.run(2, '雾化生理盐水', '5ml', '雾化吸入', '每日2次', daysAgo(3), null, 3, '呼吸道湿化', 'active', daysAgo(3));
  insertMedication.run(3, '干扰素', '50万IU/kg', '皮下注射', '每日1次', daysAgo(7), daysAgo(2), 4, '抗病毒', 'discontinued', daysAgo(7));
  insertMedication.run(3, '乳酸林格液', '30ml/kg', '静脉滴注', '每日1次', daysAgo(7), daysAgo(2), 4, '补液', 'discontinued', daysAgo(7));
  insertMedication.run(4, 'GS441524', '2mg/kg', '皮下注射', '每日1次', daysAgo(10), null, 3, '抗传腹', 'active', daysAgo(10));
  insertMedication.run(4, '护肝片', '1片', '口服', '每日2次', daysAgo(10), null, 3, '保肝', 'active', daysAgo(10));
  insertMedication.run(5, '伊曲康唑', '5mg/kg', '口服', '每日1次', daysAgo(2), null, 4, '抗真菌', 'active', daysAgo(2));
  insertMedication.run(6, '西沙比利', '0.5mg/kg', '口服', '每日2次', daysAgo(1), null, null, '促胃肠动力', 'active', daysAgo(1));
  insertMedication.run(7, '葡萄糖酸钙', '1ml/kg', '静脉缓慢推注', '每日1次', daysAgo(4), daysAgo(2), 3, '补钙', 'completed', daysAgo(4));
  insertMedication.run(8, 'GS441524', '2mg/kg', '皮下注射', '每日1次', daysAgo(6), null, 4, '抗传腹', 'active', daysAgo(6));
  insertMedication.run(8, '水飞蓟素', '2mg/kg', '口服', '每日2次', daysAgo(6), null, 4, '保肝', 'active', daysAgo(6));

  const insertDischarge = db.prepare(`
    INSERT INTO discharge_confirmations (care_record_id, discharge_date, discharge_summary, follow_up, condition_at_discharge, discharged_by, confirmed_by, status, created_at, confirmed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertDischarge.run(1, daysAgo(1), '左前肢骨折术后恢复良好，伤口愈合，可出院', '术后2周复查X光，限制运动4周', '良好，可自主行走', 1, 5, 'confirmed', daysAgo(1), daysAgo(1));

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (care_record_id, action, actor_id, actor_name, actor_role, old_value, new_value, reason, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run(1, 'create', 1, '张医生', 'doctor', null, '{"pet_name":"豆豆","status":"initiated"}', null, '创建住院护理单', daysAgo(5));
  insertAudit.run(1, 'status_change', 1, '张医生', 'doctor', '{"status":"initiated"}', '{"status":"processing"}', null, '状态从 initiated 变更为 processing', daysAgo(5));
  insertAudit.run(1, 'upload_attachment', 1, '张医生', 'doctor', null, '{"file_name":"入院登记表.pdf","upload_type":"initial"}', null, '上传附件: 入院登记表.pdf (初始上传)', daysAgo(5));
  insertAudit.run(1, 'upload_attachment', 1, '张医生', 'doctor', null, '{"file_name":"住院同意书.pdf","upload_type":"initial"}', null, '上传附件: 住院同意书.pdf (初始上传)', daysAgo(5));
  insertAudit.run(1, 'approve_attachment', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '附件审核通过: 入院登记表.pdf', daysAgo(4));
  insertAudit.run(1, 'approve_attachment', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '附件审核通过: 住院同意书.pdf', daysAgo(4));
  insertAudit.run(1, 'status_change', 3, '王护士', 'nurse', '{"status":"processing"}', '{"status":"reviewing"}', null, '状态从 processing 变更为 reviewing', daysAgo(2));
  insertAudit.run(1, 'discharge_confirmed', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"confirmed"}', null, '出院确认已通过，护理单归档', daysAgo(1));

  insertAudit.run(3, 'create', 2, '李医生', 'doctor', null, '{"pet_name":"旺财","status":"initiated"}', null, '创建住院护理单', daysAgo(7));
  insertAudit.run(3, 'status_change', 2, '李医生', 'doctor', '{"status":"initiated"}', '{"status":"processing"}', null, '状态从 initiated 变更为 processing', daysAgo(7));
  insertAudit.run(3, 'upload_attachment', 4, '刘护士', 'nurse', null, '{"file_name":"住院同意书_缺失.jpg","upload_type":"initial"}', null, '上传附件: 住院同意书_缺失.jpg (初始上传)', daysAgo(6));
  insertAudit.run(3, 'reject_attachment', 6, '赵主任', 'reviewer', '{"status":"pending"}', '{"status":"rejected","reject_reason":"文件模糊无法辨认"}', '文件模糊无法辨认，请重新上传清晰扫描件', '附件被驳回: 住院同意书_缺失.jpg, 原因: 文件模糊无法辨认，请重新上传清晰扫描件', daysAgo(3));
  insertAudit.run(3, 'upload_attachment', 4, '刘护士', 'nurse', null, '{"file_name":"住院同意书_补传.pdf","upload_type":"resubmit"}', null, '上传附件: 住院同意书_补传.pdf (重新提交)', daysAgo(2));
  insertAudit.run(3, 'supplement_attachment', 4, '刘护士', 'nurse', '{"upload_type":"initial"}', '{"upload_type":"supplement"}', null, '附件补传标记: 住院同意书_补传.pdf, 原因: 原文件被驳回，补传清晰版本', daysAgo(2));
  insertAudit.run(3, 'reject_attachment', 6, '赵主任', 'reviewer', '{"status":"pending"}', '{"status":"rejected","reject_reason":"治疗记录缺少每日体温和用药时间"}', '治疗记录缺少每日体温和用药时间', '附件被驳回: 治疗记录_不完整.pdf, 原因: 治疗记录缺少每日体温和用药时间', daysAgo(3));
  insertAudit.run(3, 'status_change', 6, '赵主任', 'reviewer', '{"status":"reviewing"}', '{"status":"returned","return_reason":"住院同意书缺失，治疗记录不完整"}', null, '护理单被退回: 住院同意书缺失，治疗记录不完整', daysAgo(1));
  insertAudit.run(3, 'returned_recorded', 6, '赵主任', 'reviewer', null, null, '住院同意书缺失，治疗记录不完整', '护理单被退回: 住院同意书缺失，治疗记录不完整', daysAgo(1));

  insertAudit.run(4, 'create', 1, '张医生', 'doctor', null, '{"pet_name":"球球","status":"initiated"}', null, '创建住院护理单', daysAgo(10));
  insertAudit.run(4, 'status_change', 1, '张医生', 'doctor', '{"status":"initiated"}', '{"status":"processing"}', null, '状态从 initiated 变更为 processing', daysAgo(10));
  insertAudit.run(4, 'supplement_attachment', 3, '王护士', 'nurse', '{"upload_type":"initial"}', '{"upload_type":"supplement"}', null, '附件补传标记: B超报告.pdf, 原因: 住院3天后补充B超结果', daysAgo(7));
  insertAudit.run(4, 'overdue_recorded', 1, '系统', 'system', null, null, '超时未处理', '护理单超时未处理', daysAgo(3));

  insertAudit.run(5, 'create', 2, '李医生', 'doctor', null, '{"pet_name":"皮皮","status":"initiated"}', null, '创建住院护理单', daysAgo(2));
  insertAudit.run(5, 'status_change', 2, '李医生', 'doctor', '{"status":"initiated"}', '{"status":"processing"}', null, '状态从 initiated 变更为 processing', daysAgo(2));
  insertAudit.run(5, 'supplement_attachment', 4, '刘护士', 'nurse', null, '{"upload_type":"supplement"}', null, '附件补传标记: 真菌培养报告.pdf, 原因: 住院2天后出培养结果', daysAgo(1));

  insertAudit.run(6, 'create', 1, '张医生', 'doctor', null, '{"pet_name":"小白","status":"initiated"}', null, '创建住院护理单', daysAgo(1));

  insertAudit.run(7, 'create', 2, '李医生', 'doctor', null, '{"pet_name":"大黄","status":"initiated"}', null, '创建住院护理单', daysAgo(4));
  insertAudit.run(7, 'status_change', 2, '李医生', 'doctor', '{"status":"initiated"}', '{"status":"processing"}', null, '状态从 initiated 变更为 processing', daysAgo(4));

  insertAudit.run(8, 'create', 1, '张医生', 'doctor', null, '{"pet_name":"花花","status":"initiated"}', null, '创建住院护理单', daysAgo(6));
  insertAudit.run(8, 'status_change', 1, '张医生', 'doctor', '{"status":"initiated"}', '{"status":"processing"}', null, '状态从 initiated 变更为 processing', daysAgo(6));
  insertAudit.run(8, 'status_change', 4, '刘护士', 'nurse', '{"status":"processing"}', '{"status":"reviewing"}', null, '状态从 processing 变更为 reviewing', daysAgo(2));
  insertAudit.run(8, 'approve_attachment', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '附件审核通过: 入院登记表.pdf', daysAgo(5));
  insertAudit.run(8, 'approve_attachment', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '附件审核通过: 住院同意书.pdf', daysAgo(5));
  insertAudit.run(8, 'approve_attachment', 5, '陈主任', 'reviewer', '{"status":"pending"}', '{"status":"approved"}', null, '附件审核通过: 生化报告.pdf', daysAgo(4));

  console.log('演示数据初始化完成');
  console.log('用户列表:');
  const allUsers = db.prepare('SELECT id, username, name, role FROM users').all();
  allUsers.forEach(u => console.log(`  [${u.id}] ${u.username} - ${u.name} (${u.role})`));

  const allRecords = db.prepare('SELECT id, pet_name, status, priority FROM care_records').all();
  console.log('\n护理单列表:');
  allRecords.forEach(r => console.log(`  [${r.id}] ${r.pet_name} - 状态: ${r.status}, 优先级: ${r.priority}`));
}

seedData();
