import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { initDatabase, prepare, exec, getDb, saveDb } from './db';
import { Role, FormStatus, ActionType, statusLabels } from './types';

async function runSeed() {
  await initDatabase();

  console.log('🧹 Clearing existing data...');
  await exec('DELETE FROM audit_logs');
  await exec('DELETE FROM attachments');
  await exec('DELETE FROM merchant_onboarding_forms');
  await exec('DELETE FROM users');

  console.log('👤 Seeding users...');
  const users = [
    { id: uuidv4(), username: 'clerk', name: '李登记', role: Role.CLERK },
    { id: uuidv4(), username: 'supervisor', name: '王审核', role: Role.SUPERVISOR },
    { id: uuidv4(), username: 'reviewer', name: '张复核', role: Role.REVIEWER },
  ];

  for (const user of users) {
    await prepare(`
      INSERT INTO users (id, username, name, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, user.username, user.name, user.role, dayjs().format());
  }

  const [clerk, supervisor, reviewer] = users;
  const now = dayjs();

  console.log('📋 Seeding merchant onboarding forms...');
  const forms = [
    {
      id: uuidv4(),
      batchNo: 'BATCH-2026-001',
      merchantName: '北京优品商贸有限公司',
      contact: '张三',
      phone: '13800138001',
      email: 'zhangsan@youpin.com',
      businessLicense: '91110101MA001A1B2C',
      taxCertificate: '京税字110101000000001',
      orgCode: '10000000-1',
      legalPerson: '张三',
      registeredCapital: '500万元',
      businessScope: '日用品、食品、电子产品批发',
      status: FormStatus.ARCHIVED,
      currentRole: Role.REVIEWER,
      createdBy: clerk.id,
      createdAt: now.subtract(30, 'day').format(),
      submittedBy: clerk.id,
      submittedAt: now.subtract(28, 'day').format(),
      reviewedBy: supervisor.id,
      reviewedAt: now.subtract(25, 'day').format(),
      archivedBy: reviewer.id,
      archivedAt: now.subtract(20, 'day').format(),
      isOverdue: 0,
      hasException: 0,
      deadline: now.subtract(20, 'day').add(10, 'day').format(),
    },
    {
      id: uuidv4(),
      batchNo: 'BATCH-2026-002',
      merchantName: '上海嘉联供应链管理有限公司',
      contact: '李四',
      phone: '13900139002',
      email: 'lisi@jialian.com',
      businessLicense: '91310101MA002A3B4C',
      taxCertificate: '沪税字310101000000002',
      orgCode: '20000000-2',
      legalPerson: '李四',
      registeredCapital: '1000万元',
      businessScope: '供应链管理、货物运输、仓储服务',
      status: FormStatus.STORE_OPENED,
      currentRole: Role.REVIEWER,
      createdBy: clerk.id,
      createdAt: now.subtract(15, 'day').format(),
      submittedBy: clerk.id,
      submittedAt: now.subtract(14, 'day').format(),
      reviewedBy: supervisor.id,
      reviewedAt: now.subtract(12, 'day').format(),
      archivedBy: null,
      archivedAt: null,
      isOverdue: 0,
      hasException: 0,
      deadline: now.subtract(15, 'day').add(10, 'day').format(),
    },
    {
      id: uuidv4(),
      batchNo: 'BATCH-2026-003',
      merchantName: '广州惠民食品有限公司',
      contact: '王五',
      phone: '13700137003',
      email: 'wangwu@huimin.com',
      businessLicense: '91440101MA003A5B6C',
      taxCertificate: '粤税字440101000000003',
      orgCode: '30000000-3',
      legalPerson: '王五',
      registeredCapital: '800万元',
      businessScope: '食品生产、加工、销售',
      status: FormStatus.QUALIFIED,
      currentRole: Role.REVIEWER,
      createdBy: clerk.id,
      createdAt: now.subtract(10, 'day').format(),
      submittedBy: clerk.id,
      submittedAt: now.subtract(9, 'day').format(),
      reviewedBy: supervisor.id,
      reviewedAt: now.subtract(7, 'day').format(),
      isOverdue: 0,
      hasException: 1,
      exceptionMessage: '批次号BATCH-2026-003重复，系统中已存在该批次的入驻单：广州惠民食品有限公司（另一份）',
      deadline: now.subtract(10, 'day').add(10, 'day').format(),
    },
    {
      id: uuidv4(),
      batchNo: 'BATCH-2026-003',
      merchantName: '广州惠民食品有限公司（另一份）',
      contact: '王五',
      phone: '13700137003',
      email: 'wangwu2@huimin.com',
      businessLicense: '91440101MA003A5B6C',
      taxCertificate: '粤税字440101000000003',
      orgCode: '30000000-3',
      legalPerson: '王五',
      registeredCapital: '800万元',
      businessScope: '食品生产、加工、销售',
      status: FormStatus.DRAFT,
      currentRole: Role.CLERK,
      createdBy: clerk.id,
      createdAt: now.subtract(5, 'day').format(),
      hasException: 1,
      exceptionMessage: '批次号BATCH-2026-003重复，系统中已存在该批次的入驻单：广州惠民食品有限公司',
      deadline: now.subtract(5, 'day').add(10, 'day').format(),
      isOverdue: 0,
    },
    {
      id: uuidv4(),
      batchNo: 'BATCH-2026-004',
      merchantName: '深圳科创电子有限公司',
      contact: '赵六',
      phone: '13600136004',
      email: 'zhaoliu@kechuang.com',
      businessLicense: '91440301MA004A7B8C',
      taxCertificate: '深税字440301000000004',
      orgCode: '40000000-4',
      legalPerson: '赵六',
      registeredCapital: '200万元',
      businessScope: '电子产品研发、生产、销售',
      status: FormStatus.UNDER_REVIEW,
      currentRole: Role.SUPERVISOR,
      createdBy: clerk.id,
      createdAt: now.subtract(12, 'day').format(),
      submittedBy: clerk.id,
      submittedAt: now.subtract(11, 'day').format(),
      reviewedBy: supervisor.id,
      reviewedAt: now.subtract(10, 'day').format(),
      isOverdue: 1,
      hasException: 0,
      deadline: now.subtract(12, 'day').add(10, 'day').format(),
    },
    {
      id: uuidv4(),
      batchNo: 'BATCH-2026-005',
      merchantName: '杭州美景服装有限公司',
      contact: '钱七',
      phone: '13500135005',
      email: 'qianqi@meijing.com',
      businessLicense: '91330101MA005A9B0C',
      taxCertificate: '浙税字330101000000005',
      orgCode: '50000000-5',
      legalPerson: '钱七',
      registeredCapital: '300万元',
      businessScope: '服装设计、生产、销售',
      status: FormStatus.MATERIALS_MISSING,
      currentRole: Role.CLERK,
      createdBy: clerk.id,
      createdAt: now.subtract(8, 'day').format(),
      submittedBy: clerk.id,
      submittedAt: now.subtract(7, 'day').format(),
      reviewedBy: supervisor.id,
      reviewedAt: now.subtract(5, 'day').format(),
      materialsMissingNote: '缺少组织机构代码证扫描件、法定代表人身份证明',
      isOverdue: 0,
      hasException: 0,
      deadline: now.subtract(8, 'day').add(10, 'day').format(),
    },
    {
      id: uuidv4(),
      batchNo: 'BATCH-2026-006',
      merchantName: '成都川味食品有限公司',
      contact: '孙八',
      phone: '13400134006',
      email: 'sunba@chuanwei.com',
      businessLicense: '91510101MA006AB12C',
      taxCertificate: '川税字510101000000006',
      orgCode: '60000000-6',
      legalPerson: '孙八',
      registeredCapital: '600万元',
      businessScope: '调味品生产、销售',
      status: FormStatus.REJECTED,
      currentRole: Role.CLERK,
      createdBy: clerk.id,
      createdAt: now.subtract(6, 'day').format(),
      submittedBy: clerk.id,
      submittedAt: now.subtract(5, 'day').format(),
      reviewedBy: supervisor.id,
      reviewedAt: now.subtract(3, 'day').format(),
      rejectReason: '食品生产许可证已过期，需重新办理后提交',
      isOverdue: 0,
      hasException: 0,
      deadline: now.subtract(6, 'day').add(10, 'day').format(),
    },
    {
      id: uuidv4(),
      batchNo: 'BATCH-2026-007',
      merchantName: '武汉汉正街小商品批发中心',
      contact: '周九',
      phone: '13300133007',
      email: 'zhoujiu@hanzhengjie.com',
      businessLicense: '91420101MA007AC34C',
      taxCertificate: '鄂税字420101000000007',
      orgCode: '70000000-7',
      legalPerson: '周九',
      registeredCapital: '1500万元',
      businessScope: '小商品批发市场经营管理',
      status: FormStatus.SUBMITTED,
      currentRole: Role.SUPERVISOR,
      createdBy: clerk.id,
      createdAt: now.subtract(3, 'day').format(),
      submittedBy: clerk.id,
      submittedAt: now.subtract(2, 'day').format(),
      isOverdue: 0,
      hasException: 0,
      deadline: now.subtract(3, 'day').add(10, 'day').format(),
    },
    {
      id: uuidv4(),
      batchNo: 'BATCH-2026-008',
      merchantName: '南京金陵医药有限公司',
      contact: '吴十',
      phone: '13200132008',
      email: 'wushi@jinling.com',
      businessLicense: '91320101MA008AD56C',
      taxCertificate: '苏税字320101000000008',
      orgCode: '80000000-8',
      legalPerson: '吴十',
      registeredCapital: '2000万元',
      businessScope: '药品批发、医疗器械销售',
      status: FormStatus.DRAFT,
      currentRole: Role.CLERK,
      createdBy: clerk.id,
      createdAt: now.subtract(1, 'day').format(),
      isOverdue: 0,
      hasException: 0,
      deadline: now.subtract(1, 'day').add(10, 'day').format(),
    },
    {
      id: uuidv4(),
      batchNo: 'BATCH-2026-009',
      merchantName: '西安古都文化产业有限公司',
      contact: '郑十一',
      phone: '13100131009',
      email: 'zheng11@gudu.com',
      businessLicense: '91610101MA009AE78C',
      taxCertificate: '陕税字610101000000009',
      orgCode: '90000000-9',
      legalPerson: '郑十一',
      registeredCapital: '1200万元',
      businessScope: '文化艺术品经营、会展服务',
      status: FormStatus.UNDER_REVIEW,
      currentRole: Role.SUPERVISOR,
      createdBy: clerk.id,
      createdAt: now.subtract(9, 'day').format(),
      submittedBy: clerk.id,
      submittedAt: now.subtract(8, 'day').format(),
      reviewedBy: supervisor.id,
      reviewedAt: now.subtract(6, 'day').format(),
      offlineStatus: '已通过',
      isOverdue: 0,
      hasException: 1,
      exceptionMessage: '状态不一致：线上状态为【审核中】，离线台账状态为【已通过】',
      deadline: now.subtract(9, 'day').add(10, 'day').format(),
    },
    {
      id: uuidv4(),
      batchNo: 'BATCH-2026-010',
      merchantName: '重庆山城火锅食材供应有限公司',
      contact: '冯十二',
      phone: '13000130010',
      email: 'feng12@shancheng.com',
      businessLicense: '91500101MA010AF90C',
      taxCertificate: null,
      orgCode: null,
      legalPerson: '冯十二',
      registeredCapital: '400万元',
      businessScope: '火锅食材加工、配送',
      status: FormStatus.DRAFT,
      currentRole: Role.CLERK,
      createdBy: clerk.id,
      createdAt: now.subtract(15, 'day').format(),
      isOverdue: 1,
      hasException: 0,
      deadline: now.subtract(15, 'day').add(10, 'day').format(),
    },
  ];

  for (const f of forms) {
    await prepare(`
      INSERT INTO merchant_onboarding_forms (
        id, batch_no, merchant_name, contact, phone, email, business_license,
        tax_certificate, org_code, legal_person, registered_capital, business_scope,
        status, current_role, created_by, created_at, submitted_by, submitted_at,
        reviewed_by, reviewed_at, archived_by, archived_at, reject_reason,
        materials_missing_note, is_overdue, has_exception, exception_message,
        offline_status, deadline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      f.id, f.batchNo, f.merchantName, f.contact, f.phone, f.email || null,
      f.businessLicense || null, f.taxCertificate || null, f.orgCode || null,
      f.legalPerson || null, f.registeredCapital || null, f.businessScope || null,
      f.status, f.currentRole, f.createdBy, f.createdAt, f.submittedBy || null,
      f.submittedAt || null, f.reviewedBy || null, f.reviewedAt || null,
      f.archivedBy || null, f.archivedAt || null, f.rejectReason || null,
      f.materialsMissingNote || null, f.isOverdue, f.hasException,
      f.exceptionMessage || null, f.offlineStatus || null, f.deadline
    );
  }

  console.log('📎 Seeding attachments...');
  const formIds = forms.map((f) => f.id);
  const attachments = [
    {
      id: uuidv4(),
      formId: formIds[0],
      fileName: '营业执照.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
      uploadedBy: clerk.id,
      uploadedAt: now.subtract(29, 'day').format(),
      remark: '营业执照正本扫描件',
    },
    {
      id: uuidv4(),
      formId: formIds[0],
      fileName: '税务登记证.pdf',
      fileType: 'application/pdf',
      fileSize: 856000,
      uploadedBy: clerk.id,
      uploadedAt: now.subtract(29, 'day').format(),
      remark: '国税登记证',
    },
    {
      id: uuidv4(),
      formId: formIds[0],
      fileName: '组织机构代码证.pdf',
      fileType: 'application/pdf',
      fileSize: 768000,
      uploadedBy: clerk.id,
      uploadedAt: now.subtract(29, 'day').format(),
      remark: '组织机构代码证正本',
    },
    {
      id: uuidv4(),
      formId: formIds[5],
      fileName: '营业执照.pdf',
      fileType: 'application/pdf',
      fileSize: 920000,
      uploadedBy: clerk.id,
      uploadedAt: now.subtract(7, 'day').format(),
      remark: '营业执照正本',
    },
    {
      id: uuidv4(),
      formId: formIds[5],
      fileName: '税务登记证.pdf',
      fileType: 'application/pdf',
      fileSize: 780000,
      uploadedBy: clerk.id,
      uploadedAt: now.subtract(7, 'day').format(),
      remark: '税务登记证',
    },
    {
      id: uuidv4(),
      formId: formIds[7],
      fileName: '营业执照.pdf',
      fileType: 'application/pdf',
      fileSize: 1050000,
      uploadedBy: clerk.id,
      uploadedAt: now.subtract(2, 'day').format(),
      remark: '营业执照正本扫描件',
    },
  ];

  for (const a of attachments) {
    await prepare(`
      INSERT INTO attachments (id, form_id, file_name, file_type, file_size, uploaded_by, uploaded_at, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(a.id, a.formId, a.fileName, a.fileType, a.fileSize, a.uploadedBy, a.uploadedAt, a.remark || null);
  }

  console.log('📝 Seeding audit logs...');
  const auditLogs = [
    { formId: formIds[0], operator: clerk.id, operatorRole: Role.CLERK, action: ActionType.CREATE, oldStatus: null, newStatus: FormStatus.DRAFT, reason: null, remark: '创建商家入驻单' },
    { formId: formIds[0], operator: clerk.id, operatorRole: Role.CLERK, action: ActionType.SUBMIT, oldStatus: FormStatus.DRAFT, newStatus: FormStatus.SUBMITTED, reason: null, remark: '提交审核' },
    { formId: formIds[0], operator: supervisor.id, operatorRole: Role.SUPERVISOR, action: ActionType.START_REVIEW, oldStatus: FormStatus.SUBMITTED, newStatus: FormStatus.UNDER_REVIEW, reason: null, remark: '开始审核' },
    { formId: formIds[0], operator: supervisor.id, operatorRole: Role.SUPERVISOR, action: ActionType.APPROVE_QUALIFICATION, oldStatus: FormStatus.UNDER_REVIEW, newStatus: FormStatus.QUALIFIED, reason: null, remark: '资质审核通过' },
    { formId: formIds[0], operator: reviewer.id, operatorRole: Role.REVIEWER, action: ActionType.OPEN_STORE, oldStatus: FormStatus.QUALIFIED, newStatus: FormStatus.STORE_OPENED, reason: null, remark: '店铺开通完成' },
    { formId: formIds[0], operator: reviewer.id, operatorRole: Role.REVIEWER, action: ActionType.ARCHIVE, oldStatus: FormStatus.STORE_OPENED, newStatus: FormStatus.ARCHIVED, reason: null, remark: '档案归档' },
    { formId: formIds[5], operator: clerk.id, operatorRole: Role.CLERK, action: ActionType.CREATE, oldStatus: null, newStatus: FormStatus.DRAFT, reason: null, remark: '创建商家入驻单' },
    { formId: formIds[5], operator: clerk.id, operatorRole: Role.CLERK, action: ActionType.SUBMIT, oldStatus: FormStatus.DRAFT, newStatus: FormStatus.SUBMITTED, reason: null, remark: '提交审核' },
    { formId: formIds[5], operator: supervisor.id, operatorRole: Role.SUPERVISOR, action: ActionType.START_REVIEW, oldStatus: FormStatus.SUBMITTED, newStatus: FormStatus.UNDER_REVIEW, reason: null, remark: '开始审核' },
    { formId: formIds[5], operator: supervisor.id, operatorRole: Role.SUPERVISOR, action: ActionType.REQUEST_MATERIALS, oldStatus: FormStatus.UNDER_REVIEW, newStatus: FormStatus.MATERIALS_MISSING, reason: '缺少组织机构代码证扫描件、法定代表人身份证明', remark: '需要补充材料' },
    { formId: formIds[6], operator: supervisor.id, operatorRole: Role.SUPERVISOR, action: ActionType.REJECT, oldStatus: FormStatus.UNDER_REVIEW, newStatus: FormStatus.REJECTED, reason: '食品生产许可证已过期，需重新办理后提交', remark: '审核不通过' },
    { formId: formIds[9], operator: supervisor.id, operatorRole: Role.SUPERVISOR, action: ActionType.ADD_AUDIT_NOTE, oldStatus: null, newStatus: null, reason: null, remark: '注意：离线台账显示已通过，但线上仍在审核中，需要核实状态' },
    { formId: formIds[2], operator: 'system', operatorRole: Role.SUPERVISOR, action: ActionType.DETECT_EXCEPTION, oldStatus: null, newStatus: null, reason: '批次号BATCH-2026-003重复', remark: '系统检测到异常：批次号重复，系统中已存在该批次的入驻单：广州惠民食品有限公司（另一份）' },
    { formId: formIds[3], operator: 'system', operatorRole: Role.SUPERVISOR, action: ActionType.DETECT_EXCEPTION, oldStatus: null, newStatus: null, reason: '批次号BATCH-2026-003重复', remark: '系统检测到异常：批次号重复，系统中已存在该批次的入驻单：广州惠民食品有限公司' },
    { formId: formIds[9], operator: 'system', operatorRole: Role.SUPERVISOR, action: ActionType.DETECT_EXCEPTION, oldStatus: null, newStatus: null, reason: '状态不一致', remark: '系统检测到异常：线上状态为【审核中】，离线台账状态为【已通过】' },
  ];

  for (const log of auditLogs) {
    const user = [clerk, supervisor, reviewer].find((u) => u.id === log.operator);
    const operatorName = log.operator === 'system' ? '系统' : user?.name || '未知';
    const logId = uuidv4();
    await prepare(`
      INSERT INTO audit_logs (
        id, form_id, operator, operator_role, operator_name, action,
        old_status, new_status, reason, remark, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId, log.formId, log.operator, log.operatorRole, operatorName,
      log.action, log.oldStatus, log.newStatus, log.reason, log.remark,
      now.subtract(Math.floor(Math.random() * 30), 'day').format()
    );
  }

  saveDb();

  console.log('');
  console.log('✅ Seed data inserted successfully!');
  console.log('');
  console.log('📊 Test Data Summary:');
  console.log('   Users: 3 (CLERK, SUPERVISOR, REVIEWER)');
  console.log('   Forms: 11 total');
  console.log('     ✅ Normal (正常): 5');
  console.log('     ⚠️  Duplicate Batch (重复批次): 1 (BATCH-2026-003 x2)');
  console.log('     ⚠️  Status Mismatch (状态不一致): 1 (BATCH-2026-009)');
  console.log('     📭 Missing Materials (缺材料): 1 (BATCH-2026-005)');
  console.log('     ⏰ Overdue (超时): 2 (BATCH-2026-004, BATCH-2026-010)');
  console.log('     ❌ Rejected (退回): 1 (BATCH-2026-006)');
  console.log('   Attachments: 6');
  console.log('   Audit Logs: 15');
  console.log('');
  console.log('👤 Test Users:');
  console.log(`   ${clerk.name} (${clerk.username}) - ${Role.CLERK} - ID: ${clerk.id}`);
  console.log(`   ${supervisor.name} (${supervisor.username}) - ${Role.SUPERVISOR} - ID: ${supervisor.id}`);
  console.log(`   ${reviewer.name} (${reviewer.username}) - ${Role.REVIEWER} - ID: ${reviewer.id}`);
  console.log('');
  console.log('🔍 Sample Forms for Testing:');
  console.log('   BATCH-2026-001: 已归档正常单（完整流程）');
  console.log('   BATCH-2026-003: 重复批次异常单（两份，店铺开通页签）');
  console.log('   BATCH-2026-004: 超时单（资质审核页签，审核中超时）');
  console.log('   BATCH-2026-005: 缺材料单（商家入驻页签，需补充后重提）');
  console.log('   BATCH-2026-006: 退回单（商家入驻页签，审核不通过）');
  console.log('   BATCH-2026-009: 状态不一致异常单（资质审核页签，线上审核中/离线已通过）');
  console.log('   BATCH-2026-010: 超时草稿单（商家入驻页签，材料不全）');
  console.log('');
}

runSeed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
