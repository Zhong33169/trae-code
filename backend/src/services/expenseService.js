import {
  expenses,
  users,
  expenseStatuses,
  statusLabels,
  expenseTypeLabels,
  requiredMaterialsByType,
  requiredMaterialLabels,
  materialTypes,
} from '../data/database.js';
import { v4 as uuidv4 } from 'uuid';

const WARN_THRESHOLD = 24 * 60 * 60 * 1000;

const getUserById = (id) => users.find(u => u.id === id);

const calcDeadlineInfo = (deadline) => {
  const now = Date.now();
  const diff = deadline - now;
  const isOverdue = diff < 0;
  const isWarning = !isOverdue && diff <= WARN_THRESHOLD;
  const absHours = Math.abs(Math.floor(diff / (60 * 60 * 1000)));
  const absDays = Math.floor(absHours / 24);
  const remainHours = absHours % 24;

  let text;
  if (isOverdue) {
    if (absDays > 0) {
      text = `已逾期 ${absDays}天${remainHours}小时`;
    } else {
      text = `已逾期 ${absHours}小时`;
    }
  } else {
    if (absDays > 0) {
      text = `剩余 ${absDays}天${remainHours}小时`;
    } else if (remainHours > 0) {
      text = `剩余 ${remainHours}小时`;
    } else {
      const mins = Math.abs(Math.floor(diff / (60 * 1000)));
      text = `剩余 ${mins}分钟`;
    }
  }

  return {
    isOverdue,
    isWarning,
    text,
    diff,
    deadline,
  };
};

const calcMaterialInfo = (exp) => {
  const required = requiredMaterialsByType[exp.expenseType] || [];
  const requiredLabels = requiredMaterialLabels[exp.expenseType] || [];
  const uploaded = exp.materials || [];

  const missing = [];
  const missingLabels = [];
  required.forEach((m, idx) => {
    if (!uploaded.includes(m)) {
      missing.push(m);
      missingLabels.push(requiredLabels[idx]);
    }
  });

  const isComplete = missing.length === 0;

  return {
    required,
    requiredLabels,
    uploaded,
    uploadedLabels: uploaded.map(m => materialTypes[m] || m),
    missing,
    missingLabels,
    isComplete,
  };
};

const enrichExpense = (exp) => {
  const handler = exp.currentHandler ? getUserById(exp.currentHandler) : null;
  const lastHandler = exp.lastHandler ? getUserById(exp.lastHandler) : null;
  const creator = exp.creator ? getUserById(exp.creator) : null;
  const deadlineInfo = calcDeadlineInfo(exp.deadline);
  const materialInfo = calcMaterialInfo(exp);
  return {
    ...exp,
    currentHandlerName: handler ? handler.name : null,
    currentHandlerRole: handler ? handler.role : null,
    currentHandlerDept: handler ? handler.dept : null,
    lastHandlerName: lastHandler ? lastHandler.name : null,
    creatorName: creator ? creator.name : null,
    creatorDept: creator ? creator.dept : null,
    lastResult: exp.lastResult || null,
    statusLabel: statusLabels[exp.status] || exp.status,
    expenseTypeLabel: expenseTypeLabels[exp.expenseType] || exp.expenseType,
    deadlineInfo,
    materialInfo,
  };
};

export const getExpenseList = ({ userId, role, status, warningLevel, keyword } = {}) => {
  let list = [...expenses];

  if (status) {
    list = list.filter(e => e.status === status);
  }

  if (warningLevel === 'overdue') {
    list = list.filter(e => e.deadline < Date.now());
  } else if (warningLevel === 'warning') {
    const now = Date.now();
    list = list.filter(e => e.deadline >= now && e.deadline <= now + WARN_THRESHOLD);
  } else if (warningLevel === 'normal') {
    list = list.filter(e => e.deadline > Date.now() + WARN_THRESHOLD);
  }

  if (role && role !== 'manager') {
    list = list.filter(e => {
      if (e.currentHandler === userId) return true;
      if (role === 'clerk' && e.creator === userId) return true;
      if (e.lastHandler === userId && e.status === expenseStatuses.DRAFT) return true;
      return false;
    });
  }

  if (keyword) {
    const kw = keyword.toLowerCase();
    list = list.filter(e =>
      e.title.toLowerCase().includes(kw) ||
      e.applicant.toLowerCase().includes(kw) ||
      e.id.toLowerCase().includes(kw)
    );
  }

  list.sort((a, b) => {
    const aOverdue = a.deadline < Date.now();
    const bOverdue = b.deadline < Date.now();
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    return a.deadline - b.deadline;
  });

  return list.map(enrichExpense);
};

export const getExpenseDetail = (id) => {
  const exp = expenses.find(e => e.id === id);
  if (!exp) return null;
  return enrichExpense(exp);
};

const addAuditLog = (exp, action, userId, remark) => {
  const user = getUserById(userId);
  exp.auditLogs.push({
    id: uuidv4(),
    action,
    userId,
    userName: user ? user.name : '未知',
    time: Date.now(),
    remark,
  });
};

const updateLastInfo = (exp, result, userId) => {
  exp.lastResult = result;
  exp.lastHandler = userId;
  exp.lastHandleTime = Date.now();
};

const checkVersion = (exp, version) => {
  if (version !== undefined && exp.version !== version) {
    throw new Error('数据已被他人修改，请刷新后重试');
  }
  exp.version += 1;
  exp.updatedAt = Date.now();
};

const checkPermission = (role, allowedRoles) => {
  if (!allowedRoles.includes(role)) {
    throw new Error('权限不足，无法执行此操作');
  }
};

const checkMaterials = (exp, strict = true) => {
  const info = calcMaterialInfo(exp);
  if (!info.isComplete && strict) {
    throw new Error(`材料不全，缺少：${info.missingLabels.join('、')}`);
  }
  return info;
};

export const getMaterialConfig = () => {
  return {
    materialTypes,
    requiredMaterialsByType,
    requiredMaterialLabels,
  };
};

export const createExpense = (data, userId) => {
  const user = getUserById(userId);
  if (!user) throw new Error('用户不存在');
  if (user.role !== 'clerk') throw new Error('只有报销专员可以创建报销申请');

  const day = 24 * 60 * 60 * 1000;
  const materials = data.materials || [];

  const exp = {
    id: uuidv4(),
    title: data.title || '报销申请',
    applicant: data.applicant || '',
    applicantDept: data.applicantDept || '',
    amount: data.amount || 0,
    expenseType: data.expenseType || 'other',
    creator: userId,
    currentHandler: userId,
    status: expenseStatuses.DRAFT,
    materials,
    deadline: data.deadline ? new Date(data.deadline).getTime() : Date.now() + 3 * day,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    lastResult: '已创建草稿',
    lastHandler: userId,
    lastHandleTime: Date.now(),
    exceptionReason: null,
    auditLogs: [],
    verifyOpinion: null,
    reviewOpinion: null,
  };

  const materialInfo = calcMaterialInfo(exp);
  const materialRemark = materials.length > 0
    ? `添加材料：${materials.map(m => materialTypes[m] || m).join('、')}`
    : '待补充材料';

  if (!materialInfo.isComplete) {
    exp.exceptionReason = `材料不全，缺少：${materialInfo.missingLabels.join('、')}`;
    exp.lastResult = '草稿，材料待补充';
  }

  addAuditLog(exp, 'create', userId, `创建报销单，${materialRemark}`);
  expenses.unshift(exp);
  return enrichExpense(exp);
};

export const updateMaterials = (id, data, userId, version) => {
  const exp = expenses.find(e => e.id === id);
  if (!exp) throw new Error('报销申请不存在');
  const user = getUserById(userId);
  if (!user) throw new Error('用户不存在');

  if (exp.status !== expenseStatuses.DRAFT) {
    throw new Error('只有草稿状态可以修改材料');
  }
  if (exp.creator !== userId) {
    throw new Error('只能修改自己创建的报销单材料');
  }

  checkVersion(exp, version);

  const oldMaterials = [...exp.materials];
  exp.materials = data.materials || [];

  const materialInfo = calcMaterialInfo(exp);

  const added = exp.materials.filter(m => !oldMaterials.includes(m));
  const removed = oldMaterials.filter(m => !exp.materials.includes(m));

  let remark = '更新材料';
  if (added.length > 0) remark += `，新增：${added.map(m => materialTypes[m] || m).join('、')}`;
  if (removed.length > 0) remark += `，移除：${removed.map(m => materialTypes[m] || m).join('、')}`;

  if (!materialInfo.isComplete) {
    exp.exceptionReason = `材料不全，缺少：${materialInfo.missingLabels.join('、')}`;
    exp.lastResult = '草稿，材料待补充';
  } else {
    exp.exceptionReason = null;
    exp.lastResult = '草稿，材料已齐全';
  }

  addAuditLog(exp, 'update_materials', userId, remark);
  updateLastInfo(exp, exp.lastResult, userId);

  return enrichExpense(exp);
};

export const submitExpense = (id, userId, version) => {
  const exp = expenses.find(e => e.id === id);
  if (!exp) throw new Error('报销申请不存在');
  const user = getUserById(userId);
  if (!user) throw new Error('用户不存在');

  checkPermission(user.role, ['clerk']);

  if (exp.status !== expenseStatuses.DRAFT) {
    throw new Error('只有草稿状态可以提交');
  }
  if (exp.creator !== userId) {
    throw new Error('只能提交自己创建的报销单');
  }

  if (!exp.applicant || !exp.amount || exp.amount <= 0) {
    throw new Error('请完善申请人和金额信息');
  }

  const materialInfo = checkMaterials(exp, true);

  checkVersion(exp, version);
  exp.status = expenseStatuses.SUBMITTED;
  exp.currentHandler = null;
  exp.exceptionReason = null;

  addAuditLog(exp, 'submit', userId, `提交报销申请，材料齐全：${materialInfo.uploadedLabels.join('、')}`);
  updateLastInfo(exp, '已提交待核验，材料齐全', userId);

  return enrichExpense(exp);
};

export const startVerify = (id, userId, version) => {
  const exp = expenses.find(e => e.id === id);
  if (!exp) throw new Error('报销申请不存在');
  const user = getUserById(userId);
  if (!user) throw new Error('用户不存在');

  checkPermission(user.role, ['accountant']);

  if (exp.status !== expenseStatuses.SUBMITTED) {
    throw new Error('只有已提交状态可以开始核验');
  }

  checkVersion(exp, version);
  const materialInfo = calcMaterialInfo(exp);
  exp.status = expenseStatuses.VERIFYING;
  exp.currentHandler = userId;

  let remark = '开始核验';
  if (!materialInfo.isComplete) {
    exp.exceptionReason = `材料不全，缺少：${materialInfo.missingLabels.join('、')}`;
    exp.lastResult = '核验中，发现材料不全';
    remark += `，发现材料不全：${materialInfo.missingLabels.join('、')}`;
  } else {
    exp.lastResult = '核验中，材料齐全';
    remark += '，材料齐全';
  }

  addAuditLog(exp, 'start_verify', userId, remark);
  updateLastInfo(exp, exp.lastResult, userId);

  return enrichExpense(exp);
};

export const passVerify = (id, userId, data = {}, version) => {
  const exp = expenses.find(e => e.id === id);
  if (!exp) throw new Error('报销申请不存在');
  const user = getUserById(userId);
  if (!user) throw new Error('用户不存在');

  checkPermission(user.role, ['accountant']);

  if (exp.status !== expenseStatuses.VERIFYING) {
    throw new Error('只有核验中状态可以通过核验');
  }
  if (exp.currentHandler !== userId) {
    throw new Error('只能处理分配给自己的报销单');
  }

  if (!data.opinion || data.opinion.trim().length < 5) {
    throw new Error('请填写核验意见（至少5个字）');
  }

  const materialInfo = checkMaterials(exp, false);

  checkVersion(exp, version);
  exp.verifyOpinion = data.opinion;

  if (materialInfo.isComplete) {
    exp.status = expenseStatuses.PENDING_REVIEW;
    exp.currentHandler = null;
    exp.exceptionReason = null;
    exp.lastResult = '核验通过，材料齐全，待复核';
    addAuditLog(exp, 'verify_pass', userId, `核验通过：${data.opinion}，材料状态：齐全`);
  } else {
    exp.status = expenseStatuses.SUPPLEMENT_REQUIRED;
    exp.currentHandler = exp.creator;
    exp.exceptionReason = `材料不全（缺少：${materialInfo.missingLabels.join('、')}），需补齐后重新提交`;
    exp.lastResult = `材料不全，需补齐：${materialInfo.missingLabels.join('、')}，已退回补材料`;
    addAuditLog(exp, 'verify_supplement', userId, `核验发现材料不全：${data.opinion}，缺少：${materialInfo.missingLabels.join('、')}，退回补材料`);
  }

  updateLastInfo(exp, exp.lastResult, userId);

  return enrichExpense(exp);
};

export const rejectVerify = (id, userId, data = {}, version) => {
  const exp = expenses.find(e => e.id === id);
  if (!exp) throw new Error('报销申请不存在');
  const user = getUserById(userId);
  if (!user) throw new Error('用户不存在');

  checkPermission(user.role, ['accountant']);

  if (exp.status !== expenseStatuses.VERIFYING) {
    throw new Error('只有核验中状态可以驳回');
  }
  if (exp.currentHandler !== userId) {
    throw new Error('只能处理分配给自己的报销单');
  }

  if (!data.reason || data.reason.trim().length < 5) {
    throw new Error('请填写驳回原因（至少5个字）');
  }

  const materialInfo = checkMaterials(exp, false);

  checkVersion(exp, version);
  exp.status = expenseStatuses.REJECTED;
  exp.currentHandler = null;
  exp.verifyOpinion = data.reason;
  exp.exceptionReason = data.reason;

  addAuditLog(exp, 'verify_reject', userId, `核验驳回：${data.reason}，材料状态：${materialInfo.isComplete ? '齐全' : '缺少：' + materialInfo.missingLabels.join('、')}`);
  updateLastInfo(exp, '核验驳回', userId);

  return enrichExpense(exp);
};

export const requestSupplement = (id, userId, data = {}, version) => {
  const exp = expenses.find(e => e.id === id);
  if (!exp) throw new Error('报销申请不存在');
  const user = getUserById(userId);
  if (!user) throw new Error('用户不存在');

  checkPermission(user.role, ['accountant', 'manager']);

  if (exp.status !== expenseStatuses.VERIFYING && exp.status !== expenseStatuses.PENDING_REVIEW) {
    throw new Error('只有核验中或待复核状态可以要求补材料');
  }

  if (exp.status === expenseStatuses.VERIFYING && exp.currentHandler !== userId) {
    throw new Error('只能处理分配给自己的报销单');
  }

  if (!data.reason || data.reason.trim().length < 5) {
    throw new Error('请填写补材料说明（至少5个字）');
  }

  checkVersion(exp, version);
  exp.status = expenseStatuses.SUPPLEMENT_REQUIRED;
  exp.currentHandler = exp.creator;
  exp.exceptionReason = `需补材料：${data.reason}`;

  const roleLabel = user.role === 'manager' ? '复核' : '核验';
  addAuditLog(exp, 'request_supplement', userId, `${roleLabel}要求补材料：${data.reason}`);
  updateLastInfo(exp, '需补充材料，退回创建者', userId);

  return enrichExpense(exp);
};

export const passReview = (id, userId, data = {}, version) => {
  const exp = expenses.find(e => e.id === id);
  if (!exp) throw new Error('报销申请不存在');
  const user = getUserById(userId);
  if (!user) throw new Error('用户不存在');

  checkPermission(user.role, ['manager']);

  if (exp.status !== expenseStatuses.PENDING_REVIEW) {
    throw new Error('只有待复核状态可以复核通过');
  }

  if (!data.opinion || data.opinion.trim().length < 3) {
    throw new Error('请填写复核意见');
  }

  const materialInfo = checkMaterials(exp, false);

  checkVersion(exp, version);
  exp.reviewOpinion = data.opinion;

  if (materialInfo.isComplete) {
    exp.status = expenseStatuses.APPROVED;
    exp.currentHandler = null;
    exp.exceptionReason = null;
    exp.lastResult = '复核通过，流程完成';
    addAuditLog(exp, 'review_pass', userId, `复核通过：${data.opinion}，材料状态：齐全`);
  } else {
    exp.status = expenseStatuses.SUPPLEMENT_REQUIRED;
    exp.currentHandler = exp.creator;
    exp.exceptionReason = `材料不全（缺少：${materialInfo.missingLabels.join('、')}），需补齐后重新提交`;
    exp.lastResult = `材料不全，需补齐：${materialInfo.missingLabels.join('、')}，已退回补材料`;
    addAuditLog(exp, 'review_supplement', userId, `复核发现材料不全：${data.opinion}，缺少：${materialInfo.missingLabels.join('、')}，退回补材料`);
  }

  updateLastInfo(exp, exp.lastResult, userId);

  return enrichExpense(exp);
};

export const rejectReview = (id, userId, data = {}, version) => {
  const exp = expenses.find(e => e.id === id);
  if (!exp) throw new Error('报销申请不存在');
  const user = getUserById(userId);
  if (!user) throw new Error('用户不存在');

  checkPermission(user.role, ['manager']);

  if (exp.status !== expenseStatuses.PENDING_REVIEW) {
    throw new Error('只有待复核状态可以复核驳回');
  }

  if (!data.reason || data.reason.trim().length < 5) {
    throw new Error('请填写驳回原因（至少5个字）');
  }

  const materialInfo = checkMaterials(exp, false);

  checkVersion(exp, version);
  exp.status = expenseStatuses.REJECTED;
  exp.currentHandler = null;
  exp.reviewOpinion = data.reason;
  exp.exceptionReason = data.reason;

  addAuditLog(exp, 'review_reject', userId, `复核驳回：${data.reason}，材料状态：${materialInfo.isComplete ? '齐全' : '缺少：' + materialInfo.missingLabels.join('、')}`);
  updateLastInfo(exp, '复核驳回', userId);

  return enrichExpense(exp);
};

export const batchPassReview = (items, userId, data = {}) => {
  const results = [];
  const errors = [];

  for (const item of items) {
    try {
      const result = passReview(item.id, userId, { opinion: data.opinion || '批量复核通过' }, item.version);
      results.push(result);
    } catch (err) {
      errors.push({ id: item.id, title: item.title, message: err.message });
    }
  }

  return { success: results.length, failed: errors.length, results, errors };
};

export const batchRejectReview = (items, userId, data = {}) => {
  const results = [];
  const errors = [];

  for (const item of items) {
    try {
      const result = rejectReview(item.id, userId, { reason: data.reason || '批量驳回' }, item.version);
      results.push(result);
    } catch (err) {
      errors.push({ id: item.id, title: item.title, message: err.message });
    }
  }

  return { success: results.length, failed: errors.length, results, errors };
};

export const batchStartVerify = (items, userId) => {
  const results = [];
  const errors = [];

  for (const item of items) {
    try {
      const result = startVerify(item.id, userId, item.version);
      results.push(result);
    } catch (err) {
      errors.push({ id: item.id, title: item.title, message: err.message });
    }
  }

  return { success: results.length, failed: errors.length, results, errors };
};

export const getStats = ({ userId, role } = {}) => {
  const list = getExpenseList({ userId, role });
  const now = Date.now();

  const total = list.length;
  const overdue = list.filter(e => e.deadline < now).length;
  const warning = list.filter(e => e.deadline >= now && e.deadline <= now + WARN_THRESHOLD).length;
  const normal = list.filter(e => e.deadline > now + WARN_THRESHOLD).length;

  const byStatus = {};
  for (const key of Object.keys(statusLabels)) {
    byStatus[key] = list.filter(e => e.status === key).length;
  }

  const myPending = list.filter(e => e.currentHandler === userId).length;

  return {
    total,
    overdue,
    warning,
    normal,
    byStatus,
    myPending,
  };
};

export const getAuditLogs = (id) => {
  const exp = expenses.find(e => e.id === id);
  if (!exp) return null;
  return exp.auditLogs.sort((a, b) => b.time - a.time);
};

export const getUsers = () => {
  return users.map(u => ({ id: u.id, name: u.name, role: u.role, dept: u.dept }));
};

export const updateExpenseDeadline = (id, deadline, userId) => {
  const exp = expenses.find(e => e.id === id);
  if (!exp) throw new Error('报销申请不存在');
  const user = getUserById(userId);
  if (!user) throw new Error('用户不存在');

  checkPermission(user.role, ['manager', 'clerk']);

  const oldDeadline = exp.deadline;
  exp.deadline = new Date(deadline).getTime();
  exp.updatedAt = Date.now();
  exp.version += 1;

  addAuditLog(exp, 'update_deadline', userId, `调整截止时间：从${new Date(oldDeadline).toLocaleString()}到${new Date(exp.deadline).toLocaleString()}`);

  return enrichExpense(exp);
};

export const supplementMaterials = (id, data, userId, version) => {
  const exp = expenses.find(e => e.id === id);
  if (!exp) throw new Error('报销申请不存在');
  const user = getUserById(userId);
  if (!user) throw new Error('用户不存在');

  if (exp.status !== expenseStatuses.SUPPLEMENT_REQUIRED) {
    throw new Error('只有待补材料状态可以补充材料');
  }
  if (exp.creator !== userId) {
    throw new Error('只能补充自己创建的报销单材料');
  }

  checkVersion(exp, version);

  const oldMaterials = [...exp.materials];
  exp.materials = data.materials || [];

  const materialInfo = calcMaterialInfo(exp);

  const added = exp.materials.filter(m => !oldMaterials.includes(m));
  const addedLabels = added.map(m => materialTypes[m] || m);

  if (materialInfo.isComplete) {
    exp.status = expenseStatuses.SUBMITTED;
    exp.currentHandler = null;
    exp.exceptionReason = null;
    exp.lastResult = '材料已补齐，重新提交待核验';
    addAuditLog(exp, 'supplement_complete', userId, `补充材料完成：新增${addedLabels.join('、')}，材料已齐全，重新提交`);
  } else {
    exp.status = expenseStatuses.SUPPLEMENT_REQUIRED;
    exp.currentHandler = exp.creator;
    exp.exceptionReason = `材料不全（缺少：${materialInfo.missingLabels.join('、')}），需补齐后重新提交`;
    exp.lastResult = `已补充部分材料，仍缺：${materialInfo.missingLabels.join('、')}`;
    addAuditLog(exp, 'supplement_partial', userId, `补充材料：新增${addedLabels.length > 0 ? addedLabels.join('、') : '无'}，仍缺少：${materialInfo.missingLabels.join('、')}`);
  }

  updateLastInfo(exp, exp.lastResult, userId);

  return enrichExpense(exp);
};
