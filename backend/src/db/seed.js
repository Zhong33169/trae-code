import db from './connection.js';
import initSchema from './init.js';
import { ROLES, STAGES, STATUSES, RISK_LEVELS } from '../constants.js';

function seedUsers() {
  const users = [
    { username: 'zhangsan', name: '张三', role: ROLES.REGISTER },
    { username: 'lisi', name: '李四', role: ROLES.AUDITOR },
    { username: 'wangwu', name: '王五', role: ROLES.REVIEWER }
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO users (username, name, role) VALUES (?, ?, ?)');
  for (const user of users) {
    stmt.run(user.username, user.name, user.role);
  }
  console.log('Users seeded.');
}

function seedContractForms() {
  const now = new Date();
  
  const sampleData = [
    {
      formNo: 'QY202606200001',
      residentName: '赵建国',
      idCard: '310101195501011234',
      phone: '13800138001',
      address: 'XX街道XX小区1号楼101室',
      doctorName: '刘医生',
      teamName: '第一家庭医生团队',
      riskLevel: RISK_LEVELS.HIGH,
      stage: STAGES.SIGN,
      status: STATUSES.PENDING,
      currentHandlerId: 2,
      currentRole: ROLES.AUDITOR,
      version: 2,
      deadline: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '高血压、糖尿病患者，需要重点管理。签约家庭医生服务包（高级）。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 2,
      lastOpinion: '已准备好签约相关材料，请审核。',
      lastResult: '提交审核',
      lastHandlerName: '张三',
      priorityScore: 180,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 }
      ]
    },
    {
      formNo: 'QY202606200002',
      residentName: '钱小美',
      idCard: '310101198805055678',
      phone: '13900139002',
      address: 'XX街道XX小区2号楼305室',
      doctorName: '陈医生',
      teamName: '第二家庭医生团队',
      riskLevel: RISK_LEVELS.MEDIUM,
      stage: STAGES.SIGN,
      status: STATUSES.NEEDS_CORRECTION,
      currentHandlerId: 1,
      currentRole: ROLES.REGISTER,
      version: 3,
      deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '普通居民签约，基础服务包。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 1,
      lastOpinion: '缺少身份证复印件，请补正后重新提交。',
      lastResult: '退回补正',
      lastHandlerName: '李四',
      priorityScore: 120,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 }
      ]
    },
    {
      formNo: 'QY202606200003',
      residentName: '孙国华',
      idCard: '310101194803039012',
      phone: '13700137003',
      address: 'XX街道XX小区3号楼502室',
      doctorName: '刘医生',
      teamName: '第一家庭医生团队',
      riskLevel: RISK_LEVELS.HIGH,
      stage: STAGES.PLAN,
      status: STATUSES.PENDING,
      currentHandlerId: 2,
      currentRole: ROLES.AUDITOR,
      version: 4,
      deadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '冠心病、高血压患者，签约高级服务包。',
      planContent: '每月随访4次，血压监测每周2次，季度健康评估。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 1,
      lastOpinion: '服务计划初稿已完成，请审核。',
      lastResult: '提交审核',
      lastHandlerName: '张三',
      priorityScore: 150,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 },
        { stage: STAGES.PLAN, name: '服务计划书', description: '个性化服务计划初稿', isRequired: 1 }
      ]
    },
    {
      formNo: 'QY202606180004',
      residentName: '周大宝',
      idCard: '310101196006063456',
      phone: '13600136004',
      address: 'XX街道XX小区4号楼201室',
      doctorName: '王医生',
      teamName: '第三家庭医生团队',
      riskLevel: RISK_LEVELS.HIGH,
      stage: STAGES.SIGN,
      status: STATUSES.OVERDUE,
      currentHandlerId: 2,
      currentRole: ROLES.AUDITOR,
      version: 2,
      deadline: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '糖尿病患者，血糖控制不佳，需要强化管理。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 2,
      lastOpinion: '材料已准备齐全，申请签约。',
      lastResult: '提交审核',
      lastHandlerName: '张三',
      priorityScore: 230,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 }
      ]
    },
    {
      formNo: 'QY202606190005',
      residentName: '吴秀兰',
      idCard: '310101195208087890',
      phone: '13500135005',
      address: 'XX街道XX小区5号楼403室',
      doctorName: '陈医生',
      teamName: '第二家庭医生团队',
      riskLevel: RISK_LEVELS.LOW,
      stage: STAGES.PLAN,
      status: STATUSES.DRAFT,
      currentHandlerId: 1,
      currentRole: ROLES.REGISTER,
      version: 2,
      deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '健康老人，签约基础服务包。',
      planContent: null,
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 0,
      lastOpinion: '签约审核已通过，请制定服务计划。',
      lastResult: '审核通过',
      lastHandlerName: '李四',
      priorityScore: 20,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 }
      ]
    },
    {
      formNo: 'QY202606150006',
      residentName: '郑建军',
      idCard: '310101197001012345',
      phone: '13400134006',
      address: 'XX街道XX小区6号楼102室',
      doctorName: '刘医生',
      teamName: '第一家庭医生团队',
      riskLevel: RISK_LEVELS.MEDIUM,
      stage: STAGES.PERFORM,
      status: STATUSES.PENDING,
      currentHandlerId: 3,
      currentRole: ROLES.REVIEWER,
      version: 6,
      deadline: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '高血压患者，签约标准服务包。',
      planContent: '每月随访2次，血压监测每周1次。',
      performContent: '本月已完成2次随访，血压控制良好。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 2,
      lastOpinion: '履约确认材料已准备，申请复核归档。',
      lastResult: '提交复核',
      lastHandlerName: '张三',
      priorityScore: 100,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 },
        { stage: STAGES.PLAN, name: '服务计划书', description: '个性化服务计划', isRequired: 1 },
        { stage: STAGES.PLAN, name: '健康评估报告', description: '首诊健康评估', isRequired: 1 },
        { stage: STAGES.PERFORM, name: '履约记录表', description: '本月随访记录', isRequired: 1 },
        { stage: STAGES.PERFORM, name: '服务确认单', description: '居民确认签字', isRequired: 1 }
      ]
    },
    {
      formNo: 'QY202606100007',
      residentName: '冯小玲',
      idCard: '310101199012124567',
      phone: '13300133007',
      address: 'XX街道XX小区7号楼601室',
      doctorName: '王医生',
      teamName: '第三家庭医生团队',
      riskLevel: RISK_LEVELS.LOW,
      stage: STAGES.SIGN,
      status: STATUSES.PENDING,
      currentHandlerId: 2,
      currentRole: ROLES.AUDITOR,
      version: 2,
      deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '年轻健康居民，签约基础服务包。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 2,
      lastOpinion: '已准备签约材料。',
      lastResult: '提交审核',
      lastHandlerName: '张三',
      priorityScore: 40,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 }
      ]
    },
    {
      formNo: 'QY202606050008',
      residentName: '陈志强',
      idCard: '310101195611116789',
      phone: '13200132008',
      address: 'XX街道XX小区8号楼304室',
      doctorName: '刘医生',
      teamName: '第一家庭医生团队',
      riskLevel: RISK_LEVELS.HIGH,
      stage: STAGES.PERFORM,
      status: STATUSES.NEEDS_CORRECTION,
      currentHandlerId: 1,
      currentRole: ROLES.REGISTER,
      version: 7,
      deadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '高血压、糖尿病、冠心病多种慢病，签约高级服务包。',
      planContent: '每周随访2次，血压血糖监测每日1次。',
      performContent: '本月随访记录部分完成。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 1,
      lastOpinion: '履约记录不完整，缺少服务确认单，请补正。',
      lastResult: '退回补正',
      lastHandlerName: '王五',
      priorityScore: 180,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 },
        { stage: STAGES.PLAN, name: '服务计划书', description: '个性化服务计划', isRequired: 1 },
        { stage: STAGES.PLAN, name: '健康评估报告', description: '首诊健康评估', isRequired: 1 },
        { stage: STAGES.PERFORM, name: '履约记录表', description: '本月随访记录', isRequired: 1 }
      ]
    },
    {
      formNo: 'QY202606010009',
      residentName: '林美玲',
      idCard: '310101198502020123',
      phone: '13100131009',
      address: 'XX街道XX小区9号楼205室',
      doctorName: '陈医生',
      teamName: '第二家庭医生团队',
      riskLevel: RISK_LEVELS.LOW,
      stage: STAGES.PLAN,
      status: STATUSES.PENDING,
      currentHandlerId: 2,
      currentRole: ROLES.AUDITOR,
      version: 3,
      deadline: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '健康孕妇，签约孕产妇服务包。',
      planContent: '孕期每月产检指导，产后访视。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 2,
      lastOpinion: '服务计划已制定，请审核。',
      lastResult: '提交审核',
      lastHandlerName: '张三',
      priorityScore: 50,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 },
        { stage: STAGES.PLAN, name: '服务计划书', description: '孕期服务计划', isRequired: 1 },
        { stage: STAGES.PLAN, name: '健康评估报告', description: '孕前评估报告', isRequired: 1 }
      ]
    },
    {
      formNo: 'QY202605280010',
      residentName: '黄富贵',
      idCard: '310101194505051234',
      phone: '13000130010',
      address: 'XX街道XX小区10号楼101室',
      doctorName: '王医生',
      teamName: '第三家庭医生团队',
      riskLevel: RISK_LEVELS.MEDIUM,
      stage: STAGES.PERFORM,
      status: STATUSES.ARCHIVED,
      currentHandlerId: null,
      currentRole: null,
      version: 8,
      deadline: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '高血压患者，签约标准服务包。',
      planContent: '每月随访2次，血压监测。',
      performContent: '本月履约完成，血压控制达标。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 2,
      lastOpinion: '履约确认材料齐全，同意归档。',
      lastResult: '复核归档',
      lastHandlerName: '王五',
      priorityScore: 0,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 },
        { stage: STAGES.PLAN, name: '服务计划书', description: '个性化服务计划', isRequired: 1 },
        { stage: STAGES.PLAN, name: '健康评估报告', description: '首诊健康评估', isRequired: 1 },
        { stage: STAGES.PERFORM, name: '履约记录表', description: '本月随访记录', isRequired: 1 },
        { stage: STAGES.PERFORM, name: '服务确认单', description: '居民确认签字', isRequired: 1 }
      ]
    },
    {
      formNo: 'QY202606120011',
      residentName: '杨振华',
      idCard: '310101196809095678',
      phone: '15800158011',
      address: 'XX街道XX小区11号楼402室',
      doctorName: '刘医生',
      teamName: '第一家庭医生团队',
      riskLevel: RISK_LEVELS.HIGH,
      stage: STAGES.PERFORM,
      status: STATUSES.OVERDUE,
      currentHandlerId: 3,
      currentRole: ROLES.REVIEWER,
      version: 6,
      deadline: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '脑梗死后遗症、高血压，签约高级服务包。',
      planContent: '每周随访1次，康复训练指导。',
      performContent: '履约情况待确认。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 2,
      lastOpinion: '履约材料已提交，请复核。',
      lastResult: '提交复核',
      lastHandlerName: '张三',
      priorityScore: 210,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 },
        { stage: STAGES.PLAN, name: '服务计划书', description: '个性化服务计划', isRequired: 1 },
        { stage: STAGES.PLAN, name: '健康评估报告', description: '首诊健康评估', isRequired: 1 },
        { stage: STAGES.PERFORM, name: '履约记录表', description: '本月随访记录', isRequired: 1 },
        { stage: STAGES.PERFORM, name: '服务确认单', description: '居民确认签字', isRequired: 1 }
      ]
    },
    {
      formNo: 'QY202606210012',
      residentName: '朱小红',
      idCard: '310101199310108901',
      phone: '15900159012',
      address: 'XX街道XX小区12号楼301室',
      doctorName: '陈医生',
      teamName: '第二家庭医生团队',
      riskLevel: RISK_LEVELS.LOW,
      stage: STAGES.SIGN,
      status: STATUSES.DRAFT,
      currentHandlerId: 1,
      currentRole: ROLES.REGISTER,
      version: 1,
      deadline: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: null,
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 0,
      lastOpinion: null,
      lastResult: null,
      lastHandlerName: null,
      priorityScore: 10,
      evidences: []
    },
    {
      formNo: 'QY202606210013',
      residentName: '马明宇',
      idCard: '310101197207073456',
      phone: '18600186013',
      address: 'XX街道XX小区13号楼203室',
      doctorName: '刘医生',
      teamName: '第一家庭医生团队',
      riskLevel: RISK_LEVELS.HIGH,
      stage: STAGES.SIGN,
      status: STATUSES.NEEDS_CORRECTION,
      currentHandlerId: 1,
      currentRole: ROLES.REGISTER,
      version: 5,
      deadline: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '高血压、糖尿病、冠心病多种慢病患者，高风险需重点管理。\n\n补正内容：已补充身份证复印件，修正联系电话。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 2,
      lastOpinion: '补正更新：风险等级: 中风险 → 高风险；⚠️ 升级为高风险，处理时限缩短；签约内容已更新；高风险自动缩短处理时限至3天',
      lastResult: '补正更新',
      lastHandlerName: '张三',
      priorityScore: 190,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '既往病史材料', description: '高血压、糖尿病确诊报告', isRequired: 0 }
      ]
    },
    {
      formNo: 'QY202606140014',
      residentName: '苗翠花',
      idCard: '310101196612127890',
      phone: '18700187014',
      address: 'XX街道XX小区14号楼501室',
      doctorName: '王医生',
      teamName: '第三家庭医生团队',
      riskLevel: RISK_LEVELS.MEDIUM,
      stage: STAGES.PLAN,
      status: STATUSES.NEEDS_CORRECTION,
      currentHandlerId: 1,
      currentRole: ROLES.REGISTER,
      version: 5,
      deadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '高血压患者，签约标准服务包。',
      planContent: '每月随访2次，血压监测每周1次，季度健康评估。\n\n补正内容：已补充健康评估报告，调整随访频率。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 2,
      lastOpinion: '补正更新：服务计划内容已更新',
      lastResult: '补正更新',
      lastHandlerName: '张三',
      priorityScore: 120,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 },
        { stage: STAGES.PLAN, name: '服务计划书', description: '个性化服务计划', isRequired: 1 },
        { stage: STAGES.PLAN, name: '健康评估报告', description: '首诊健康评估', isRequired: 1 }
      ]
    },
    {
      formNo: 'QY202606160015',
      residentName: '方大同',
      idCard: '310101198909091234',
      phone: '18800188015',
      address: 'XX街道XX小区15号楼404室',
      doctorName: '陈医生',
      teamName: '第二家庭医生团队',
      riskLevel: RISK_LEVELS.LOW,
      stage: STAGES.PERFORM,
      status: STATUSES.PENDING,
      currentHandlerId: 3,
      currentRole: ROLES.REVIEWER,
      version: 9,
      deadline: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '健康青年居民，签约基础服务包。',
      planContent: '年度健康体检，健康咨询。',
      performContent: '已完成年度健康体检，各项指标正常。\n\n补正内容：已补充服务确认单居民签字。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 2,
      lastOpinion: '补正材料已提交，请重新审核',
      lastResult: '补正材料已提交，请重新审核',
      lastHandlerName: '张三',
      priorityScore: 60,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 },
        { stage: STAGES.PLAN, name: '服务计划书', description: '年度服务计划', isRequired: 1 },
        { stage: STAGES.PLAN, name: '健康评估报告', description: '健康评估问卷', isRequired: 1 },
        { stage: STAGES.PERFORM, name: '履约记录表', description: '年度体检记录', isRequired: 1 },
        { stage: STAGES.PERFORM, name: '服务确认单', description: '居民确认签字', isRequired: 1 }
      ]
    },
    {
      formNo: 'QY202606220016',
      residentName: '冲突样例',
      idCard: '310101198001010016',
      phone: '19900199016',
      address: 'XX街道XX小区16号楼101室',
      doctorName: '刘医生',
      teamName: '第一家庭医生团队',
      riskLevel: RISK_LEVELS.MEDIUM,
      stage: STAGES.SIGN,
      status: STATUSES.PENDING,
      currentHandlerId: 2,
      currentRole: ROLES.AUDITOR,
      version: 3,
      deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      signContent: '版本冲突演示样例：模拟两个用户同时编辑同一份单据。',
      createdBy: 1,
      evidenceRequired: 2,
      evidenceSubmitted: 2,
      lastOpinion: '提交审核（演示版本号=3）',
      lastResult: '提交成功',
      lastHandlerName: '张三',
      priorityScore: 80,
      evidences: [
        { stage: STAGES.SIGN, name: '签约协议书', description: '居民签字版扫描件', isRequired: 1 },
        { stage: STAGES.SIGN, name: '身份证复印件', description: '正反面复印件', isRequired: 1 }
      ]
    }
  ];

  const insertForm = db.prepare(`
    INSERT INTO contract_forms
    (form_no, resident_name, id_card, phone, address, doctor_name, team_name,
     risk_level, stage, status, current_handler_id, current_role, version,
     deadline, sign_content, plan_content, perform_content,
     evidence_required, evidence_submitted,
     last_opinion, last_result, last_handler_name, priority_score, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvidence = db.prepare(`
    INSERT INTO evidences (contract_form_id, stage, name, description, is_required, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const data of sampleData) {
    const existing = db.prepare('SELECT id FROM contract_forms WHERE form_no = ?').get(data.formNo);
    if (existing) continue;

    const result = insertForm.run(
      data.formNo, data.residentName, data.idCard, data.phone, data.address,
      data.doctorName, data.teamName, data.riskLevel, data.stage, data.status,
      data.currentHandlerId, data.currentRole, data.version, data.deadline,
      data.signContent, data.planContent, data.performContent,
      data.evidenceRequired, data.evidenceSubmitted,
      data.lastOpinion, data.lastResult, data.lastHandlerName,
      data.priorityScore, data.createdBy
    );

    const formId = result.lastInsertRowid;
    for (const ev of data.evidences) {
      insertEvidence.run(formId, ev.stage, ev.name, ev.description, ev.isRequired, 1);
    }
  }

  console.log('Contract forms seeded.');
}

function seedOperationLogs() {
  const forms = db.prepare('SELECT id, form_no FROM contract_forms').all();
  
  const insertLog = db.prepare(`
    INSERT INTO operation_logs
    (contract_form_id, operator_id, operator_name, operator_role, action,
     from_stage, to_stage, from_status, to_status, opinion, result,
     version_before, version_after, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let logCount = 0;
  for (const form of forms) {
    const formDetail = db.prepare('SELECT * FROM contract_forms WHERE id = ?').get(form.id);
    const formNo = formDetail.form_no;

    if (formNo === 'QY202606210013') {
      seedMaMingyuLogs(form.id, insertLog);
      logCount += 10;
      continue;
    }

    if (formNo === 'QY202606140014') {
      seedMiaoCuihuaLogs(form.id, insertLog);
      logCount += 9;
      continue;
    }

    if (formNo === 'QY202606160015') {
      seedFangDatongLogs(form.id, insertLog);
      logCount += 14;
      continue;
    }

    if (formNo === 'QY202606220016') {
      seedConflictDemoLogs(form.id, insertLog);
      logCount += 5;
      continue;
    }

    if (formDetail.stage === 'SIGN' && formDetail.version >= 2) {
      insertLog.run(
        form.id, 1, '张三', 'REGISTER', 'CREATE',
        null, 'SIGN', null, 'DRAFT',
        '创建签约服务单', '创建成功',
        null, 1,
        new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      );
      logCount++;

      if (formDetail.status !== 'DRAFT') {
        insertLog.run(
          form.id, 1, '张三', 'REGISTER', 'SUBMIT',
          'SIGN', 'SIGN', 'DRAFT', 'PENDING',
          '提交审核', '提交成功',
          1, 2,
          new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
        );
        logCount++;
      }

      if (formDetail.status === 'NEEDS_CORRECTION') {
        insertLog.run(
          form.id, 2, '李四', 'AUDITOR', 'RETURN_CORRECTION',
          'SIGN', 'SIGN', 'PENDING', 'NEEDS_CORRECTION',
          '材料不齐全，请补正', '退回补正',
          2, 3,
          new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
        );
        logCount++;
      }
    }

    if (formDetail.stage === 'PLAN' || formDetail.stage === 'PERFORM') {
      insertLog.run(
        form.id, 2, '李四', 'AUDITOR', 'APPROVE',
        'SIGN', 'PLAN', 'PENDING', 'DRAFT',
        '签约材料齐全，审核通过', '审核通过',
        2, 3,
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      );
      logCount++;

      if (formDetail.version >= 5 || formDetail.stage === 'PERFORM') {
        insertLog.run(
          form.id, 1, '张三', 'REGISTER', 'SUBMIT',
          'PLAN', 'PLAN', 'DRAFT', 'PENDING',
          '服务计划已制定，请审核', '提交成功',
          3, 4,
          new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        );
        logCount++;
      }

      if (formDetail.stage === 'PERFORM') {
        insertLog.run(
          form.id, 2, '李四', 'AUDITOR', 'APPROVE',
          'PLAN', 'PERFORM', 'PENDING', 'DRAFT',
          '服务计划合理，审核通过', '审核通过',
          4, 5,
          new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
        );
        logCount++;

        if (formDetail.status !== 'DRAFT') {
          insertLog.run(
            form.id, 1, '张三', 'REGISTER', 'SUBMIT',
            'PERFORM', 'PERFORM', 'DRAFT', 'PENDING',
            '履约确认材料已准备，请复核归档', '提交成功',
            5, 6,
            new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
          );
          logCount++;
        }

        if (formDetail.status === 'NEEDS_CORRECTION') {
          insertLog.run(
            form.id, 3, '王五', 'REVIEWER', 'RETURN_CORRECTION',
            'PERFORM', 'PERFORM', 'PENDING', 'NEEDS_CORRECTION',
            '履约材料不完整', '退回补正',
            6, 7,
            new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
          );
          logCount++;
        }
      }
    }

    if (formDetail.status === 'ARCHIVED') {
      insertLog.run(
        form.id, 3, '王五', 'REVIEWER', 'ARCHIVE',
        'PERFORM', 'PERFORM', 'PENDING', 'ARCHIVED',
        '材料齐全，履约确认完成，同意归档', '复核归档',
        6, 7,
        new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
      );
      logCount++;
    }

    if (formDetail.status === 'OVERDUE') {
      insertLog.run(
        form.id, null, null, null, 'MARK_OVERDUE',
        formDetail.stage, formDetail.stage, 'PENDING', 'OVERDUE',
        null, '系统自动标记逾期',
        formDetail.version - 1, formDetail.version - 1,
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      );
      logCount++;
    }
  }

  console.log(`Operation logs seeded (${logCount} records).`);
}

function seedMaMingyuLogs(formId, insertLog) {
  const baseTime = Date.now() - 10 * 24 * 60 * 60 * 1000;

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'CREATE',
    null, 'SIGN', null, 'DRAFT',
    '创建签约服务单：高血压患者，初始风险中风险', '创建成功',
    null, 1,
    new Date(baseTime).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'ADD_EVIDENCE',
    'SIGN', 'SIGN', 'DRAFT', 'DRAFT',
    '添加证据：签约协议书', '证据添加成功',
    1, 2,
    new Date(baseTime + 1 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'SUBMIT',
    'SIGN', 'SIGN', 'DRAFT', 'PENDING',
    '提交审核（仅签约协议书，缺身份证复印件）', '提交成功',
    2, 3,
    new Date(baseTime + 2 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 2, '李四', 'AUDITOR', 'RETURN_CORRECTION',
    'SIGN', 'SIGN', 'PENDING', 'NEEDS_CORRECTION',
    '缺少身份证复印件，且发现患者有糖尿病、冠心病史，风险等级应升级为高风险', '退回补正',
    3, 4,
    new Date(baseTime + 24 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'UPDATE_CONTENT',
    'SIGN', 'SIGN', 'NEEDS_CORRECTION', 'NEEDS_CORRECTION',
    '补正更新：风险等级: 中风险 → 高风险；⚠️ 升级为高风险，处理时限缩短；签约内容已更新；高风险自动缩短处理时限至3天', '补正更新',
    4, 5,
    new Date(baseTime + 2 * 24 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'ADD_EVIDENCE',
    'SIGN', 'SIGN', 'NEEDS_CORRECTION', 'NEEDS_CORRECTION',
    '添加证据：身份证复印件（正反面）', '证据添加成功',
    5, 6,
    new Date(baseTime + 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'ADD_EVIDENCE',
    'SIGN', 'SIGN', 'NEEDS_CORRECTION', 'NEEDS_CORRECTION',
    '添加证据：既往病史材料（高血压、糖尿病确诊报告）', '证据添加成功',
    6, 7,
    new Date(baseTime + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString()
  );
}

function seedMiaoCuihuaLogs(formId, insertLog) {
  const baseTime = Date.now() - 12 * 24 * 60 * 60 * 1000;

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'CREATE',
    null, 'SIGN', null, 'DRAFT',
    '创建签约服务单：高血压患者，签约标准服务包', '创建成功',
    null, 1,
    new Date(baseTime).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'SUBMIT',
    'SIGN', 'SIGN', 'DRAFT', 'PENDING',
    '签约材料已准备，请审核', '提交成功',
    1, 2,
    new Date(baseTime + 2 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 2, '李四', 'AUDITOR', 'APPROVE',
    'SIGN', 'PLAN', 'PENDING', 'DRAFT',
    '签约材料齐全，审核通过，请制定服务计划', '审核通过',
    2, 3,
    new Date(baseTime + 24 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'SUBMIT',
    'PLAN', 'PLAN', 'DRAFT', 'PENDING',
    '服务计划已制定（仅服务计划书，缺健康评估报告）', '提交成功',
    3, 4,
    new Date(baseTime + 2 * 24 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 2, '李四', 'AUDITOR', 'RETURN_CORRECTION',
    'PLAN', 'PLAN', 'PENDING', 'NEEDS_CORRECTION',
    '缺少健康评估报告，且随访频率偏低，建议调整为每周1次', '退回补正',
    4, 5,
    new Date(baseTime + 3 * 24 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'UPDATE_CONTENT',
    'PLAN', 'PLAN', 'NEEDS_CORRECTION', 'NEEDS_CORRECTION',
    '补正更新：服务计划内容已更新，调整随访频率为每周1次', '补正更新',
    5, 6,
    new Date(baseTime + 4 * 24 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'ADD_EVIDENCE',
    'PLAN', 'PLAN', 'NEEDS_CORRECTION', 'NEEDS_CORRECTION',
    '添加证据：健康评估报告（首诊健康评估）', '证据添加成功',
    6, 7,
    new Date(baseTime + 4 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString()
  );
}

function seedFangDatongLogs(formId, insertLog) {
  const baseTime = Date.now() - 20 * 24 * 60 * 60 * 1000;

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'CREATE',
    null, 'SIGN', null, 'DRAFT',
    '创建签约服务单：健康青年，签约基础服务包', '创建成功',
    null, 1,
    new Date(baseTime).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'SUBMIT',
    'SIGN', 'SIGN', 'DRAFT', 'PENDING',
    '签约材料已准备，请审核', '提交成功',
    1, 2,
    new Date(baseTime + 2 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 2, '李四', 'AUDITOR', 'APPROVE',
    'SIGN', 'PLAN', 'PENDING', 'DRAFT',
    '签约材料齐全，审核通过', '审核通过',
    2, 3,
    new Date(baseTime + 24 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'SUBMIT',
    'PLAN', 'PLAN', 'DRAFT', 'PENDING',
    '服务计划已制定，请审核', '提交成功',
    3, 4,
    new Date(baseTime + 3 * 24 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 2, '李四', 'AUDITOR', 'APPROVE',
    'PLAN', 'PERFORM', 'PENDING', 'DRAFT',
    '服务计划合理，审核通过', '审核通过',
    4, 5,
    new Date(baseTime + 5 * 24 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'SUBMIT',
    'PERFORM', 'PERFORM', 'DRAFT', 'PENDING',
    '履约确认材料已准备（缺服务确认单居民签字）', '提交成功',
    5, 6,
    new Date(baseTime + 10 * 24 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 3, '王五', 'REVIEWER', 'RETURN_CORRECTION',
    'PERFORM', 'PERFORM', 'PENDING', 'NEEDS_CORRECTION',
    '缺少服务确认单居民签字，请补正', '退回补正',
    6, 7,
    new Date(baseTime + 12 * 24 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'UPDATE_CONTENT',
    'PERFORM', 'PERFORM', 'NEEDS_CORRECTION', 'NEEDS_CORRECTION',
    '补正更新：履约内容已更新，已完成年度健康体检', '补正更新',
    7, 8,
    new Date(baseTime + 14 * 24 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'ADD_EVIDENCE',
    'PERFORM', 'PERFORM', 'NEEDS_CORRECTION', 'NEEDS_CORRECTION',
    '添加证据：服务确认单（居民确认签字）', '证据添加成功',
    8, 9,
    new Date(baseTime + 14 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'SUBMIT',
    'PERFORM', 'PERFORM', 'NEEDS_CORRECTION', 'PENDING',
    '补正材料已提交，请重新审核', '补正提交成功',
    9, 10,
    new Date(baseTime + 15 * 24 * 60 * 60 * 1000).toISOString()
  );
}

function seedConflictDemoLogs(formId, insertLog) {
  const baseTime = Date.now() - 2 * 24 * 60 * 60 * 1000;

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'CREATE',
    null, 'SIGN', null, 'DRAFT',
    '创建版本冲突演示样例', '创建成功',
    null, 1,
    new Date(baseTime).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'SUBMIT',
    'SIGN', 'SIGN', 'DRAFT', 'PENDING',
    '提交审核（版本号=2）', '提交成功',
    1, 2,
    new Date(baseTime + 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'SUBMIT',
    'SIGN', 'SIGN', 'PENDING', 'PENDING',
    '提交失败：版本冲突，期望版本=1，实际版本=2', '版本冲突（STATUS_CONFLICT）',
    1, 2,
    new Date(baseTime + 2 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'ADD_EVIDENCE',
    'SIGN', 'SIGN', 'DRAFT', 'DRAFT',
    '添加证据：签约协议书', '证据添加成功',
    2, 3,
    new Date(baseTime + 3 * 60 * 60 * 1000).toISOString()
  );

  insertLog.run(
    formId, 1, '张三', 'REGISTER', 'ADD_EVIDENCE',
    'SIGN', 'SIGN', 'DRAFT', 'DRAFT',
    '添加证据：身份证复印件', '证据添加成功',
    3, 4,
    new Date(baseTime + 4 * 60 * 60 * 1000).toISOString()
  );
}

function runSeed() {
  console.log('Starting database seed...');
  initSchema();
  seedUsers();
  seedContractForms();
  seedOperationLogs();
  console.log('Database seed completed successfully!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed();
}

export default runSeed;
