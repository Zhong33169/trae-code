import { db } from './schema.js';

export const ROLES = {
  CSM: 'CSM',
  DELIVERY: 'DELIVERY',
  DIRECTOR: 'DIRECTOR'
};

export const STATUS = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  PENDING_CONFIRM: 'PENDING_CONFIRM',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED'
};

export const STATUS_LABEL = {
  DRAFT: '草稿',
  PENDING_REVIEW: '待交付核验',
  PENDING_CONFIRM: '待负责人确认',
  COMPLETED: '已完成',
  REJECTED: '已驳回'
};

export const EVIDENCE_TYPE = {
  REGISTRATION: 'REGISTRATION',
  VERIFICATION: 'VERIFICATION',
  ARCHIVAL: 'ARCHIVAL'
};

export const ROLE_LABEL = {
  CSM: '客户成功经理',
  DELIVERY: '交付顾问',
  DIRECTOR: '客户成功负责人'
};

function hash(pwd) {
  let h = 0;
  for (let i = 0; i < pwd.length; i++) {
    h = ((h << 5) - h) + pwd.charCodeAt(i);
    h |= 0;
  }
  return 'HASH_' + Math.abs(h).toString(36);
}

export function seedData() {
  const d = db();
  try {
    const userCount = d.prepare('SELECT COUNT(*) AS c FROM users').get()?.c || 0;
    const planCount = d.prepare('SELECT COUNT(*) AS c FROM launch_plans').get()?.c || 0;
    if (userCount >= 5 && planCount >= 10) return;
    if (userCount > 0 && planCount === 0) {
      console.warn('⚠️ 检测到部分种子数据（有用户无计划单），清空重建...');
      d.exec('DELETE FROM plan_evidences; DELETE FROM plan_transitions; DELETE FROM batch_items; DELETE FROM batches; DELETE FROM audit_logs; DELETE FROM launch_plans; DELETE FROM users;');
    } else if (userCount > 0) {
      console.log(`ℹ️ 已存在用户${userCount}条/计划${planCount}条，跳过种子注入`);
      return;
    }
  } catch (e) {
    // 表不存在则继续
  }

  const insertUser = d.prepare(`
    INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)
  `);

  const users = [
    { u: 'csm_wang', p: '123456', n: '王晓敏', r: ROLES.CSM },
    { u: 'csm_li', p: '123456', n: '李伟强', r: ROLES.CSM },
    { u: 'delivery_zhang', p: '123456', n: '张明远', r: ROLES.DELIVERY },
    { u: 'delivery_chen', p: '123456', n: '陈思雨', r: ROLES.DELIVERY },
    { u: 'director_zhao', p: '123456', n: '赵国栋', r: ROLES.DIRECTOR }
  ];

  const userIds = {};
  for (const u of users) {
    const info = insertUser.run(u.u, hash(u.p), u.n, u.r);
    userIds[u.u] = info.lastInsertRowid;
  }

  const insertPlan = d.prepare(`
    INSERT INTO launch_plans (plan_no, title, customer_name, change_type,
      plan_date, risk_level, description, status, version, created_by,
      created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
  `);

  const insertEvidence = d.prepare(`
    INSERT INTO plan_evidences (plan_id, evidence_type, name, url, uploaded_by)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertTransition = d.prepare(`
    INSERT INTO plan_transitions (plan_id, from_status, to_status, operated_by, comment)
    VALUES (?, ?, ?, ?, ?)
  `);

  const plans = [
    {
      no: 'LP-2026-0001', title: '客户A - 权限体系批量变更',
      customer: '蓝海科技有限公司', type: '权限调整', date: '2026-06-10',
      risk: 'HIGH', desc: '调整3个事业部共120个账号的角色归属',
      status: STATUS.PENDING_REVIEW, ver: 1, by: 'csm_wang',
      evidences: [
        { t: 'REGISTRATION', n: '变更申请单.pdf', url: '/ev/001_申请单.pdf', by: 'csm_wang' }
      ],
      transitions: [
        { f: STATUS.DRAFT, t: STATUS.PENDING_REVIEW, by: 'csm_wang', c: '已完成变更登记，提交核验' }
      ]
    },
    {
      no: 'LP-2026-0002', title: '客户B - 工作流引擎版本升级',
      customer: '智联数据集团', type: '系统升级', date: '2026-06-09',
      risk: 'MEDIUM', desc: '工作流引擎v2.1.0升级至v2.3.0',
      status: STATUS.PENDING_CONFIRM, ver: 2, by: 'csm_li',
      evidences: [
        { t: 'REGISTRATION', n: '升级申请表.docx', url: '/ev/002_升级表.docx', by: 'csm_li' },
        { t: 'VERIFICATION', n: '测试环境核验报告.pdf', url: '/ev/002_核验报告.pdf', by: 'delivery_zhang' },
        { t: 'ARCHIVAL', n: '上线前复核清单.xlsx', url: '/ev/002_复核清单.xlsx', by: 'director_zhao' }
      ],
      transitions: [
        { f: STATUS.DRAFT, t: STATUS.PENDING_REVIEW, by: 'csm_li', c: '提交升级申请' },
        { f: STATUS.PENDING_REVIEW, t: STATUS.PENDING_CONFIRM, by: 'delivery_zhang', c: '测试环境已验证通过' }
      ]
    },
    {
      no: 'LP-2026-0003', title: '客户C - 报表模板批量替换',
      customer: '星辰金融服务', type: '配置变更', date: '2026-06-12',
      risk: 'LOW', desc: '替换15份标准报表的页眉页脚及Logo',
      status: STATUS.DRAFT, ver: 1, by: 'csm_wang',
      evidences: [],
      transitions: []
    },
    {
      no: 'LP-2026-0004', title: '客户D - SSO集成（缺核验证据）',
      customer: '恒远制造业', type: '集成对接', date: '2026-06-11',
      risk: 'HIGH', desc: '对接企业微信SSO单点登录，【已登记但未核验】',
      status: STATUS.PENDING_REVIEW, ver: 1, by: 'csm_li',
      evidences: [
        { t: 'REGISTRATION', n: 'SSO对接需求书.pdf', url: '/ev/004_需求书.pdf', by: 'csm_li' }
      ],
      transitions: [
        { f: STATUS.DRAFT, t: STATUS.PENDING_REVIEW, by: 'csm_li', c: '提交SSO对接申请（待交付核验）' }
      ]
    },
    {
      no: 'LP-2026-0005', title: '客户E - 数据字典批量修改',
      customer: '盛世物流集团', type: '数据变更', date: '2026-06-08',
      risk: 'MEDIUM', desc: '5个数据字典共120项修改',
      status: STATUS.COMPLETED, ver: 3, by: 'csm_wang',
      evidences: [
        { t: 'REGISTRATION', n: '字典变更申请.pdf', url: '/ev/005_申请.pdf', by: 'csm_wang' },
        { t: 'VERIFICATION', n: '变更核验记录.xlsx', url: '/ev/005_核验.xlsx', by: 'delivery_chen' },
        { t: 'ARCHIVAL', n: '复核归档单.pdf', url: '/ev/005_归档.pdf', by: 'director_zhao' }
      ],
      transitions: [
        { f: STATUS.DRAFT, t: STATUS.PENDING_REVIEW, by: 'csm_wang', c: '提交申请' },
        { f: STATUS.PENDING_REVIEW, t: STATUS.PENDING_CONFIRM, by: 'delivery_chen', c: '核验通过' },
        { f: STATUS.PENDING_CONFIRM, t: STATUS.COMPLETED, by: 'director_zhao', c: '确认归档' }
      ]
    },
    {
      no: 'LP-2026-0006', title: '客户F - API配额调整（被驳回）',
      customer: '阳光教育平台', type: '参数调整', date: '2026-06-07',
      risk: 'LOW', desc: 'API调用限额从1万/日调至5万/日',
      status: STATUS.REJECTED, ver: 2, by: 'csm_li',
      reject_reason: '缺少业务量增长佐证材料，请补充登记证据后重新提交',
      evidences: [
        { t: 'REGISTRATION', n: '配额调整申请.pdf', url: '/ev/006_申请.pdf', by: 'csm_li' }
      ],
      transitions: [
        { f: STATUS.DRAFT, t: STATUS.PENDING_REVIEW, by: 'csm_li', c: '提交' },
        { f: STATUS.PENDING_REVIEW, t: STATUS.REJECTED, by: 'delivery_zhang', c: '缺少业务量佐证' }
      ]
    },
    {
      no: 'LP-2026-0007', title: '客户G - 多租户配置批量下发',
      customer: '优品连锁零售', type: '配置下发', date: '2026-06-12',
      risk: 'MEDIUM', desc: '28个门店租户的主题色和支付配置统一变更',
      status: STATUS.PENDING_REVIEW, ver: 1, by: 'csm_wang',
      evidences: [
        { t: 'REGISTRATION', n: '租户配置清单.xlsx', url: '/ev/007_清单.xlsx', by: 'csm_wang' },
        { t: 'REGISTRATION', n: '配置变更审批单.pdf', url: '/ev/007_审批单.pdf', by: 'csm_wang' },
        { t: 'VERIFICATION', n: '灰度环境核验截图.zip', url: '/ev/007_截图.zip', by: 'delivery_chen' }
      ],
      transitions: [
        { f: STATUS.DRAFT, t: STATUS.PENDING_REVIEW, by: 'csm_wang', c: '提交批量配置变更' }
      ]
    },
    {
      no: 'LP-2026-0008', title: '客户H - 消息网关切换（待核验）',
      customer: '广达医疗信息', type: '系统切换', date: '2026-06-11',
      risk: 'HIGH', desc: '短信通道从供应商A切换至供应商B',
      status: STATUS.PENDING_REVIEW, ver: 1, by: 'csm_li',
      evidences: [
        { t: 'REGISTRATION', n: '网关切换方案.pdf', url: '/ev/008_方案.pdf', by: 'csm_li' }
      ],
      transitions: [
        { f: STATUS.DRAFT, t: STATUS.PENDING_REVIEW, by: 'csm_li', c: '提交切换方案' }
      ]
    },
    {
      no: 'LP-2026-0009', title: '客户I - 自定义字段扩展',
      customer: '金诚律师事务所', type: '模型扩展', date: '2026-06-10',
      risk: 'LOW', desc: '案例对象新增8个自定义字段',
      status: STATUS.PENDING_CONFIRM, ver: 1, by: 'csm_wang',
      evidences: [
        { t: 'REGISTRATION', n: '字段需求表.xlsx', url: '/ev/009_需求.xlsx', by: 'csm_wang' },
        { t: 'VERIFICATION', n: '字段核验截图.zip', url: '/ev/009_截图.zip', by: 'delivery_chen' }
      ],
      transitions: [
        { f: STATUS.DRAFT, t: STATUS.PENDING_REVIEW, by: 'csm_wang', c: '提交' },
        { f: STATUS.PENDING_REVIEW, t: STATUS.PENDING_CONFIRM, by: 'delivery_chen', c: '核验通过' }
      ]
    },
    {
      no: 'LP-2026-0010', title: '客户J - 工作流审批节点调整',
      customer: '信达资产管理', type: '流程调整', date: '2026-06-09',
      risk: 'MEDIUM', desc: '采购审批流新增财务总监会签节点',
      status: STATUS.PENDING_CONFIRM, ver: 1, by: 'csm_li',
      evidences: [
        { t: 'REGISTRATION', n: '流程调整申请.pdf', url: '/ev/010_申请.pdf', by: 'csm_li' },
        { t: 'VERIFICATION', n: '模拟走测报告.pdf', url: '/ev/010_走测.pdf', by: 'delivery_zhang' }
      ],
      transitions: [
        { f: STATUS.DRAFT, t: STATUS.PENDING_REVIEW, by: 'csm_li', c: '提交' },
        { f: STATUS.PENDING_REVIEW, t: STATUS.PENDING_CONFIRM, by: 'delivery_zhang', c: '走测通过' }
      ]
    }
  ];

  for (const p of plans) {
    const info = insertPlan.run(
      p.no, p.title, p.customer, p.type, p.date, p.risk,
      p.desc, p.status, p.ver, userIds[p.by]
    );
    const planId = info.lastInsertRowid;

    if (p.reject_reason) {
      d.prepare('UPDATE launch_plans SET reject_reason=? WHERE id=?')
        .run(p.reject_reason, planId);
    }

    for (const e of p.evidences) {
      insertEvidence.run(planId, e.t, e.n, e.url, userIds[e.by]);
    }

    for (const tr of p.transitions) {
      insertTransition.run(planId, tr.f, tr.t, userIds[tr.by], tr.c);
    }
  }
}

export function verifyPassword(raw, stored) {
  return hash(raw) === stored;
}
