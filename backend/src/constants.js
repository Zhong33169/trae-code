const { v4: uuidv4 } = require('uuid');

const ROLES = {
  REGISTRAR: 'registrar',
  SUPERVISOR: 'supervisor',
  REVIEWER: 'reviewer',
};

const ROLE_NAMES = {
  [ROLES.REGISTRAR]: '门店订货登记员',
  [ROLES.SUPERVISOR]: '门店订货审核主管',
  [ROLES.REVIEWER]: '餐饮连锁总部复核负责人',
};

const ORDER_STATUS = {
  DRAFT: 'draft',
  PENDING_VERIFICATION: 'pending_verification',
  VERIFICATION_REJECTED: 'verification_rejected',
  PENDING_REVIEW: 'pending_review',
  REVIEW_REJECTED: 'review_rejected',
  ARCHIVED: 'archived',
  CANCELLED: 'cancelled',
};

const STATUS_NAMES = {
  [ORDER_STATUS.DRAFT]: '草稿',
  [ORDER_STATUS.PENDING_VERIFICATION]: '待核验',
  [ORDER_STATUS.VERIFICATION_REJECTED]: '核验退回',
  [ORDER_STATUS.PENDING_REVIEW]: '待复核',
  [ORDER_STATUS.REVIEW_REJECTED]: '复核退回',
  [ORDER_STATUS.ARCHIVED]: '已归档',
  [ORDER_STATUS.CANCELLED]: '已取消',
};

const STATUS_COLORS = {
  [ORDER_STATUS.DRAFT]: 'gray',
  [ORDER_STATUS.PENDING_VERIFICATION]: 'blue',
  [ORDER_STATUS.VERIFICATION_REJECTED]: 'orange',
  [ORDER_STATUS.PENDING_REVIEW]: 'purple',
  [ORDER_STATUS.REVIEW_REJECTED]: 'red',
  [ORDER_STATUS.ARCHIVED]: 'green',
  [ORDER_STATUS.CANCELLED]: 'darkgray',
};

const STAGE_TIMEOUT_HOURS = {
  [ORDER_STATUS.PENDING_VERIFICATION]: 12,
  [ORDER_STATUS.PENDING_REVIEW]: 12,
  [ORDER_STATUS.VERIFICATION_REJECTED]: 24,
  [ORDER_STATUS.REVIEW_REJECTED]: 24,
  [ORDER_STATUS.DRAFT]: 48,
};

const STAGE_NAMES = {
  REGISTRATION: '门店订货单登记',
  VERIFICATION: '过程核验',
  REVIEW: '复核归档',
};

const ACTIONS = {
  SUBMIT: 'submit',
  CORRECT_SUBMIT: 'correct_submit',
  APPROVE_VERIFY: 'approve_verify',
  REJECT_VERIFY: 'reject_verify',
  APPROVE_REVIEW: 'approve_review',
  REJECT_REVIEW: 'reject_review',
  OVERDUE_EXTEND: 'overdue_extend',
  CANCEL: 'cancel',
};

const ACTION_NAMES = {
  [ACTIONS.SUBMIT]: '提交订货单',
  [ACTIONS.CORRECT_SUBMIT]: '补正后重新提交',
  [ACTIONS.APPROVE_VERIFY]: '核验通过',
  [ACTIONS.REJECT_VERIFY]: '核验退回',
  [ACTIONS.APPROVE_REVIEW]: '复核通过归档',
  [ACTIONS.REJECT_REVIEW]: '复核退回',
  [ACTIONS.OVERDUE_EXTEND]: '逾期申请延期',
  [ACTIONS.CANCEL]: '作废订货单',
};

const REQUIRED_MATERIALS = {
  [STAGE_NAMES.REGISTRATION]: ['订货清单', '门店库存快照', '历史订货参考数据'],
  [STAGE_NAMES.VERIFICATION]: ['库存核验报告', '价格核对记录', '供应商确认回执'],
  [STAGE_NAMES.REVIEW]: ['财务预算核对单', '总部库存调配意见', '合规检查记录'],
};

const ACTION_ALLOWED_MAP = {
  [ORDER_STATUS.DRAFT]: {
    [ROLES.REGISTRAR]: [ACTIONS.SUBMIT, ACTIONS.CANCEL],
  },
  [ORDER_STATUS.PENDING_VERIFICATION]: {
    [ROLES.SUPERVISOR]: [ACTIONS.APPROVE_VERIFY, ACTIONS.REJECT_VERIFY],
  },
  [ORDER_STATUS.VERIFICATION_REJECTED]: {
    [ROLES.REGISTRAR]: [ACTIONS.CORRECT_SUBMIT, ACTIONS.CANCEL],
  },
  [ORDER_STATUS.PENDING_REVIEW]: {
    [ROLES.REVIEWER]: [ACTIONS.APPROVE_REVIEW, ACTIONS.REJECT_REVIEW],
  },
  [ORDER_STATUS.REVIEW_REJECTED]: {
    [ROLES.SUPERVISOR]: [ACTIONS.APPROVE_VERIFY, ACTIONS.REJECT_VERIFY],
  },
};

const NEXT_STATUS_MAP = {
  [ACTIONS.SUBMIT]: ORDER_STATUS.PENDING_VERIFICATION,
  [ACTIONS.CORRECT_SUBMIT]: ORDER_STATUS.PENDING_VERIFICATION,
  [ACTIONS.APPROVE_VERIFY]: ORDER_STATUS.PENDING_REVIEW,
  [ACTIONS.REJECT_VERIFY]: ORDER_STATUS.VERIFICATION_REJECTED,
  [ACTIONS.APPROVE_REVIEW]: ORDER_STATUS.ARCHIVED,
  [ACTIONS.REJECT_REVIEW]: ORDER_STATUS.REVIEW_REJECTED,
  [ACTIONS.CANCEL]: ORDER_STATUS.CANCELLED,
};

const STAGE_ORDER = [
  STAGE_NAMES.REGISTRATION,
  STAGE_NAMES.VERIFICATION,
  STAGE_NAMES.REVIEW,
];

const STATUS_TO_STAGE = {
  [ORDER_STATUS.DRAFT]: STAGE_NAMES.REGISTRATION,
  [ORDER_STATUS.PENDING_VERIFICATION]: STAGE_NAMES.VERIFICATION,
  [ORDER_STATUS.VERIFICATION_REJECTED]: STAGE_NAMES.REGISTRATION,
  [ORDER_STATUS.PENDING_REVIEW]: STAGE_NAMES.REVIEW,
  [ORDER_STATUS.REVIEW_REJECTED]: STAGE_NAMES.VERIFICATION,
  [ORDER_STATUS.ARCHIVED]: STAGE_NAMES.REVIEW,
  [ORDER_STATUS.CANCELLED]: STAGE_NAMES.REGISTRATION,
};

const STORES = [
  '北京朝阳望京店',
  '上海浦东陆家嘴店',
  '广州天河城店',
  '深圳南山科技园店',
  '成都春熙路店',
  '杭州西湖店',
];

const SUPPLIERS = [
  '中粮集团食品配送中心',
  '益海嘉里餐饮供应链',
  '双汇发展生鲜事业部',
  '伊利集团冷饮事业部',
  '正大食品餐饮渠道部',
];

const CATEGORIES = ['生鲜类', '干货类', '饮品类', '包材类', '设备类'];

function generateSeedOrders() {
  const now = new Date();
  const orders = [];

  orders.push({
    id: uuidv4(),
    orderNo: `DD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}0001`,
    title: '望京店6月第二周生鲜补给单',
    store: '北京朝阳望京店',
    category: '生鲜类',
    supplier: '双汇发展生鲜事业部',
    totalAmount: 48650.00,
    items: [
      { name: '冷鲜猪五花肉', spec: '10kg/箱', qty: 20, unit: '箱', price: 1280 },
      { name: '冰鲜鸡胸肉', spec: '20kg/箱', qty: 15, unit: '箱', price: 950 },
      { name: '新鲜鸡蛋', spec: '360枚/箱', qty: 5, unit: '箱', price: 340 },
    ],
    status: ORDER_STATUS.DRAFT,
    currentStage: STAGE_NAMES.REGISTRATION,
    createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    stageEnteredAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    createdBy: 'registrar_wang',
    materials: {
      [STAGE_NAMES.REGISTRATION]: {
        items: ['订货清单', '门店库存快照', '历史订货参考数据'],
        uploadedAt: new Date(now - 1.5 * 60 * 60 * 1000).toISOString(),
      },
    },
    stageOpinions: {},
    overdue: false,
    overdueReason: null,
    version: 1,
  });

  orders.push({
    id: uuidv4(),
    orderNo: `DD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}0002`,
    title: '陆家嘴店夏季饮品批量订货',
    store: '上海浦东陆家嘴店',
    category: '饮品类',
    supplier: '伊利集团冷饮事业部',
    totalAmount: 72300.00,
    items: [
      { name: '原味冰淇淋', spec: '6L/桶', qty: 50, unit: '桶', price: 880 },
      { name: '原味酸奶', spec: '1.5kg*6/箱', qty: 30, unit: '箱', price: 610 },
    ],
    status: ORDER_STATUS.PENDING_VERIFICATION,
    currentStage: STAGE_NAMES.VERIFICATION,
    createdAt: new Date(now - 20 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 18 * 60 * 60 * 1000).toISOString(),
    stageEnteredAt: new Date(now - 18 * 60 * 60 * 1000).toISOString(),
    createdBy: 'registrar_li',
    materials: {
      [STAGE_NAMES.REGISTRATION]: {
        items: ['订货清单', '门店库存快照', '历史订货参考数据'],
        uploadedAt: new Date(now - 19 * 60 * 60 * 1000).toISOString(),
      },
      [STAGE_NAMES.VERIFICATION]: {
        items: ['库存核验报告'],
        uploadedAt: new Date(now - 18.5 * 60 * 60 * 1000).toISOString(),
      },
    },
    stageOpinions: {
      [STAGE_NAMES.REGISTRATION]: {
        action: ACTIONS.SUBMIT,
        operator: 'registrar_li',
        operatorName: '李登记',
        operatorRole: ROLES.REGISTRAR,
        opinion: '上周销量环比上涨23%，本周按1.2倍系数补货，材料齐全已核对',
        materialsVerified: true,
        timelineVerified: true,
        createdAt: new Date(now - 18 * 60 * 60 * 1000).toISOString(),
      },
    },
    overdue: false,
    overdueReason: null,
    version: 2,
  });

  orders.push({
    id: uuidv4(),
    orderNo: `DD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}0003`,
    title: '天河城店端午促销干货备货',
    store: '广州天河城店',
    category: '干货类',
    supplier: '益海嘉里餐饮供应链',
    totalAmount: 125800.00,
    items: [
      { name: '五常大米', spec: '25kg/袋', qty: 80, unit: '袋', price: 520 },
      { name: '金龙鱼调和油', spec: '5L*4/箱', qty: 60, unit: '箱', price: 860 },
      { name: '东北黑木耳', spec: '5kg/箱', qty: 15, unit: '箱', price: 1580 },
    ],
    status: ORDER_STATUS.PENDING_VERIFICATION,
    currentStage: STAGE_NAMES.VERIFICATION,
    createdAt: new Date(now - 40 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 36 * 60 * 60 * 1000).toISOString(),
    stageEnteredAt: new Date(now - 36 * 60 * 60 * 1000).toISOString(),
    createdBy: 'registrar_chen',
    materials: {
      [STAGE_NAMES.REGISTRATION]: {
        items: ['订货清单', '门店库存快照', '历史订货参考数据'],
        uploadedAt: new Date(now - 38 * 60 * 60 * 1000).toISOString(),
      },
      [STAGE_NAMES.VERIFICATION]: {
        items: ['库存核验报告', '价格核对记录'],
        uploadedAt: new Date(now - 37 * 60 * 60 * 1000).toISOString(),
      },
    },
    stageOpinions: {
      [STAGE_NAMES.REGISTRATION]: {
        action: ACTIONS.SUBMIT,
        operator: 'registrar_chen',
        operatorName: '陈登记',
        operatorRole: ROLES.REGISTRAR,
        opinion: '端午促销预计客流翻倍，按营销部门备货申请提报，历史同比参考完整',
        materialsVerified: true,
        timelineVerified: true,
        createdAt: new Date(now - 36 * 60 * 60 * 1000).toISOString(),
      },
    },
    overdue: true,
    overdueReason: `核验时限为${STAGE_TIMEOUT_HOURS[ORDER_STATUS.PENDING_VERIFICATION]}小时，当前已逾期${(40 - 12).toFixed(0)}小时，需立即处理或申请延期`,
    version: 2,
  });

  orders.push({
    id: uuidv4(),
    orderNo: `DD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}0004`,
    title: '南山科技园店包材常规补货',
    store: '深圳南山科技园店',
    category: '包材类',
    supplier: '中粮集团食品配送中心',
    totalAmount: 18650.00,
    items: [
      { name: '牛皮纸打包袋', spec: '500只/捆', qty: 40, unit: '捆', price: 230 },
      { name: '一次性餐盒', spec: '1000套/箱', qty: 25, unit: '箱', price: 420 },
      { name: '吸管套装', spec: '2000支/箱', qty: 10, unit: '箱', price: 180 },
    ],
    status: ORDER_STATUS.VERIFICATION_REJECTED,
    currentStage: STAGE_NAMES.REGISTRATION,
    createdAt: new Date(now - 30 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
    stageEnteredAt: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
    createdBy: 'registrar_zhao',
    materials: {
      [STAGE_NAMES.REGISTRATION]: {
        items: ['订货清单', '门店库存快照'],
        uploadedAt: new Date(now - 28 * 60 * 60 * 1000).toISOString(),
      },
    },
    stageOpinions: {
      [STAGE_NAMES.REGISTRATION]: {
        action: ACTIONS.SUBMIT,
        operator: 'registrar_zhao',
        operatorName: '赵登记',
        operatorRole: ROLES.REGISTRAR,
        opinion: '月度包材按常规量补货',
        materialsVerified: true,
        timelineVerified: true,
        createdAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
      },
      [STAGE_NAMES.VERIFICATION]: {
        action: ACTIONS.REJECT_VERIFY,
        operator: 'supervisor_zhou',
        operatorName: '周主管',
        operatorRole: ROLES.SUPERVISOR,
        opinion: '退回原因：1.缺少「历史订货参考数据」；2.一次性餐盒数量异常，上月同类报货仅10箱；3.需补充上月库存消耗明细并说明增量原因',
        materialsVerified: false,
        timelineVerified: true,
        rejectReasons: [
          '缺少「历史订货参考数据」',
          '一次性餐盒数量异常（上月仅10箱本月25箱）',
          '缺少上月库存消耗明细',
        ],
        createdAt: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
      },
    },
    overdue: false,
    overdueReason: null,
    version: 3,
  });

  orders.push({
    id: uuidv4(),
    orderNo: `DD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}0005`,
    title: '春熙路店设备更新采购',
    store: '成都春熙路店',
    category: '设备类',
    supplier: '正大食品餐饮渠道部',
    totalAmount: 236000.00,
    items: [
      { name: '商用四门冷藏柜', spec: '1200L', qty: 3, unit: '台', price: 28000 },
      { name: '高速饮料机', spec: '8口', qty: 2, unit: '台', price: 35000 },
      { name: '新型收银POS系统', spec: '双屏', qty: 4, unit: '套', price: 23500 },
    ],
    status: ORDER_STATUS.PENDING_REVIEW,
    currentStage: STAGE_NAMES.REVIEW,
    createdAt: new Date(now - 60 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
    stageEnteredAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
    createdBy: 'registrar_sun',
    materials: {
      [STAGE_NAMES.REGISTRATION]: {
        items: ['订货清单', '门店库存快照', '历史订货参考数据'],
        uploadedAt: new Date(now - 58 * 60 * 60 * 1000).toISOString(),
      },
      [STAGE_NAMES.VERIFICATION]: {
        items: ['库存核验报告', '价格核对记录', '供应商确认回执'],
        uploadedAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
      },
    },
    stageOpinions: {
      [STAGE_NAMES.REGISTRATION]: {
        action: ACTIONS.SUBMIT,
        operator: 'registrar_sun',
        operatorName: '孙登记',
        operatorRole: ROLES.REGISTRAR,
        opinion: '原设备使用年限超5年故障频发，配合总部设备更新计划统一采购，已附总部审批编号',
        materialsVerified: true,
        timelineVerified: true,
        createdAt: new Date(now - 50 * 60 * 60 * 1000).toISOString(),
      },
      [STAGE_NAMES.VERIFICATION]: {
        action: ACTIONS.APPROVE_VERIFY,
        operator: 'supervisor_wu',
        operatorName: '吴主管',
        operatorRole: ROLES.SUPERVISOR,
        opinion: '核验通过：1.采购属于总部年度设备更新清单；2.比对三家供应商报价，正大食品渠道价格合理；3.供应商承诺7日内送达并上门安装；4.所有核验材料完整',
        materialsVerified: true,
        timelineVerified: true,
        createdAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      },
    },
    overdue: false,
    overdueReason: null,
    version: 3,
  });

  orders.push({
    id: uuidv4(),
    orderNo: `DD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}0006`,
    title: '西湖店新品配套原材料订货',
    store: '杭州西湖店',
    category: '生鲜类',
    supplier: '中粮集团食品配送中心',
    totalAmount: 56200.00,
    items: [
      { name: '优质三文鱼', spec: '整条约5kg', qty: 12, unit: '条', price: 2800 },
      { name: '澳洲安格斯牛排', spec: '200g*30片/箱', qty: 8, unit: '箱', price: 2650 },
      { name: '有机蔬菜礼盒', spec: '10种/箱', qty: 20, unit: '箱', price: 180 },
    ],
    status: ORDER_STATUS.ARCHIVED,
    currentStage: STAGE_NAMES.REVIEW,
    createdAt: new Date(now - 80 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 50 * 60 * 60 * 1000).toISOString(),
    stageEnteredAt: new Date(now - 50 * 60 * 60 * 1000).toISOString(),
    createdBy: 'registrar_qian',
    materials: {
      [STAGE_NAMES.REGISTRATION]: {
        items: ['订货清单', '门店库存快照', '历史订货参考数据'],
        uploadedAt: new Date(now - 78 * 60 * 60 * 1000).toISOString(),
      },
      [STAGE_NAMES.VERIFICATION]: {
        items: ['库存核验报告', '价格核对记录', '供应商确认回执'],
        uploadedAt: new Date(now - 70 * 60 * 60 * 1000).toISOString(),
      },
      [STAGE_NAMES.REVIEW]: {
        items: ['财务预算核对单', '总部库存调配意见', '合规检查记录'],
        uploadedAt: new Date(now - 55 * 60 * 60 * 1000).toISOString(),
      },
    },
    stageOpinions: {
      [STAGE_NAMES.REGISTRATION]: {
        action: ACTIONS.SUBMIT,
        operator: 'registrar_qian',
        operatorName: '钱登记',
        operatorRole: ROLES.REGISTRAR,
        opinion: '6月15日新品「仲夏海鲜套餐」上市配套原料，按总部新品试销计划量的1.5倍备货',
        materialsVerified: true,
        timelineVerified: true,
        createdAt: new Date(now - 75 * 60 * 60 * 1000).toISOString(),
      },
      [STAGE_NAMES.VERIFICATION]: {
        action: ACTIONS.APPROVE_VERIFY,
        operator: 'supervisor_zhou',
        operatorName: '周主管',
        operatorRole: ROLES.SUPERVISOR,
        opinion: '核验通过：新品首月订货额度在预算内；供应商资质和冷链运输确认；三文鱼原产地检疫证明齐全',
        materialsVerified: true,
        timelineVerified: true,
        createdAt: new Date(now - 65 * 60 * 60 * 1000).toISOString(),
      },
      [STAGE_NAMES.REVIEW]: {
        action: ACTIONS.APPROVE_REVIEW,
        operator: 'reviewer_huang',
        operatorName: '黄复核',
        operatorRole: ROLES.REVIEWER,
        opinion: '复核通过归档：新品试销已纳入总部618营销专案；采购金额在门店月度预算剩余额度内；冷链配送时间匹配上市节点，材料全部合规',
        materialsVerified: true,
        timelineVerified: true,
        createdAt: new Date(now - 50 * 60 * 60 * 1000).toISOString(),
      },
    },
    archivedAt: new Date(now - 50 * 60 * 60 * 1000).toISOString(),
    overdue: false,
    overdueReason: null,
    version: 4,
  });

  orders.push({
    id: uuidv4(),
    orderNo: `DD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}0007`,
    title: '望京店冷饮急补（缺材料草稿-样例）',
    store: '北京朝阳望京店',
    category: '饮品类',
    supplier: '伊利集团冷饮事业部',
    totalAmount: 12800.00,
    items: [
      { name: '巧克力冰淇淋', spec: '6L/桶', qty: 10, unit: '桶', price: 880 },
      { name: '草莓酸奶', spec: '1.5kg*6/箱', qty: 6, unit: '箱', price: 660 },
    ],
    status: ORDER_STATUS.DRAFT,
    currentStage: STAGE_NAMES.REGISTRATION,
    createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    stageEnteredAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    createdBy: 'registrar_wang',
    materials: {
      [STAGE_NAMES.REGISTRATION]: {
        items: ['订货清单'],
        uploadedAt: new Date(now - 4.5 * 60 * 60 * 1000).toISOString(),
      },
    },
    stageOpinions: {},
    overdue: false,
    overdueReason: null,
    version: 1,
  });

  orders.push({
    id: uuidv4(),
    orderNo: `DD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}0008`,
    title: '陆家嘴店干货常规补货（材料齐全草稿-样例）',
    store: '上海浦东陆家嘴店',
    category: '干货类',
    supplier: '益海嘉里餐饮供应链',
    totalAmount: 28600.00,
    items: [
      { name: '金龙鱼大豆油', spec: '5L*4/箱', qty: 20, unit: '箱', price: 680 },
      { name: '五常大米', spec: '25kg/袋', qty: 30, unit: '袋', price: 500 },
    ],
    status: ORDER_STATUS.DRAFT,
    currentStage: STAGE_NAMES.REGISTRATION,
    createdAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    stageEnteredAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
    createdBy: 'registrar_li',
    materials: {
      [STAGE_NAMES.REGISTRATION]: {
        items: ['订货清单', '门店库存快照', '历史订货参考数据'],
        uploadedAt: new Date(now - 5.5 * 60 * 60 * 1000).toISOString(),
      },
    },
    stageOpinions: {},
    overdue: false,
    overdueReason: null,
    version: 1,
  });

  orders.push({
    id: uuidv4(),
    orderNo: `DD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}0009`,
    title: '天河城店生鲜补货（核验退回待补正-样例）',
    store: '广州天河城店',
    category: '生鲜类',
    supplier: '双汇发展生鲜事业部',
    totalAmount: 33200.00,
    items: [
      { name: '冷鲜牛肉', spec: '20kg/箱', qty: 10, unit: '箱', price: 2200 },
      { name: '冰鲜鸡腿', spec: '10kg/箱', qty: 12, unit: '箱', price: 930 },
    ],
    status: ORDER_STATUS.VERIFICATION_REJECTED,
    currentStage: STAGE_NAMES.REGISTRATION,
    createdAt: new Date(now - 36 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
    stageEnteredAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
    createdBy: 'registrar_chen',
    materials: {
      [STAGE_NAMES.REGISTRATION]: {
        items: ['订货清单', '门店库存快照'],
        uploadedAt: new Date(now - 35 * 60 * 60 * 1000).toISOString(),
      },
    },
    stageOpinions: {
      [STAGE_NAMES.REGISTRATION]: {
        action: ACTIONS.SUBMIT,
        operator: 'registrar_chen',
        operatorName: '陈登记',
        operatorRole: ROLES.REGISTRAR,
        opinion: '端午后补货，按常规月度量提交',
        materialsVerified: true,
        timelineVerified: true,
        createdAt: new Date(now - 32 * 60 * 60 * 1000).toISOString(),
      },
      [STAGE_NAMES.VERIFICATION]: {
        action: ACTIONS.REJECT_VERIFY,
        operator: 'supervisor_zhou',
        operatorName: '周主管',
        operatorRole: ROLES.SUPERVISOR,
        opinion: '退回原因：1.缺少「历史订货参考数据」；2.冰鲜鸡腿价格高于上月8%，需附价格异常说明；3.牛肉订货量超出近三月均值40%，需补充营销依据',
        materialsVerified: false,
        timelineVerified: true,
        rejectReasons: [
          '缺少「历史订货参考数据」',
          '冰鲜鸡腿价格异常（高于上月8%）需附说明',
          '牛肉订货量超出近三月均值40%，需补充营销依据',
        ],
        createdAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      },
    },
    overdue: false,
    overdueReason: null,
    version: 3,
  });

  orders.push({
    id: uuidv4(),
    orderNo: `DD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}0010`,
    title: '科技园店设备耗材（逾期已延期后待核验-样例）',
    store: '深圳南山科技园店',
    category: '设备类',
    supplier: '正大食品餐饮渠道部',
    totalAmount: 8600.00,
    items: [
      { name: '商用微波炉', spec: '2100W', qty: 2, unit: '台', price: 2600 },
      { name: 'POS打印纸', spec: '80mm*50卷/箱', qty: 4, unit: '箱', price: 850 },
    ],
    status: ORDER_STATUS.PENDING_VERIFICATION,
    currentStage: STAGE_NAMES.VERIFICATION,
    createdAt: new Date(now - 60 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    stageEnteredAt: new Date(now - (STAGE_TIMEOUT_HOURS[ORDER_STATUS.PENDING_VERIFICATION] / 2) * 60 * 60 * 1000).toISOString(),
    createdBy: 'registrar_zhao',
    materials: {
      [STAGE_NAMES.REGISTRATION]: {
        items: ['订货清单', '门店库存快照', '历史订货参考数据'],
        uploadedAt: new Date(now - 58 * 60 * 60 * 1000).toISOString(),
      },
      [STAGE_NAMES.VERIFICATION]: {
        items: ['库存核验报告', '价格核对记录', '供应商确认回执'],
        uploadedAt: new Date(now - 55 * 60 * 60 * 1000).toISOString(),
      },
    },
    stageOpinions: {
      [STAGE_NAMES.REGISTRATION]: {
        action: ACTIONS.SUBMIT,
        operator: 'registrar_zhao',
        operatorName: '赵登记',
        operatorRole: ROLES.REGISTRAR,
        opinion: '科技园店设备老化需更新，打印纸按季度常规量补货',
        materialsVerified: true,
        timelineVerified: true,
        createdAt: new Date(now - 50 * 60 * 60 * 1000).toISOString(),
      },
      [STAGE_NAMES.VERIFICATION]: {
        action: ACTIONS.OVERDUE_EXTEND,
        operator: 'supervisor_wu',
        operatorName: '吴主管',
        operatorRole: ROLES.SUPERVISOR,
        opinion: '核验人出差刚回，申请延期12小时处理，材料已提前预审无异常',
        materialsVerified: true,
        timelineVerified: false,
        createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      },
    },
    overdue: false,
    overdueReason: null,
    version: 3,
  });

  return orders;
}

function generateSeedAuditLogs(orders) {
  const logs = [];
  for (const order of orders) {
    logs.push({
      id: uuidv4(),
      orderId: order.id,
      orderNo: order.orderNo,
      action: 'create',
      actionName: '创建订货单',
      operator: order.createdBy,
      operatorRole: ROLES.REGISTRAR,
      details: `创建订货单「${order.title}」`,
      createdAt: order.createdAt,
    });

    if (order.stageOpinions) {
      for (const stage of STAGE_ORDER) {
        const op = order.stageOpinions[stage];
        if (op) {
          logs.push({
            id: uuidv4(),
            orderId: order.id,
            orderNo: order.orderNo,
            action: op.action,
            actionName: ACTION_NAMES[op.action] || op.action,
            operator: op.operator,
            operatorRole: op.operatorRole,
            details: `[${stage}] ${op.opinion}`,
            createdAt: op.createdAt,
          });
        }
      }
    }
  }
  return logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  ROLES,
  ROLE_NAMES,
  ORDER_STATUS,
  STATUS_NAMES,
  STATUS_COLORS,
  STAGE_TIMEOUT_HOURS,
  STAGE_NAMES,
  ACTIONS,
  ACTION_NAMES,
  REQUIRED_MATERIALS,
  ACTION_ALLOWED_MAP,
  NEXT_STATUS_MAP,
  STAGE_ORDER,
  STATUS_TO_STAGE,
  STORES,
  SUPPLIERS,
  CATEGORIES,
  generateSeedOrders,
  generateSeedAuditLogs,
};
