const express = require('express');
const router = express.Router();
const store = require('../data/store');

const STATUS_MAP = {
  draft: { name: '待登记', color: '#d9d9d9', currentRole: 'registrar' },
  pending_audit: { name: '待核验', color: '#faad14', currentRole: 'auditor' },
  auditing: { name: '核验中', color: '#1890ff', currentRole: 'auditor' },
  pending_review: { name: '待复核', color: '#722ed1', currentRole: 'reviewer' },
  reviewing: { name: '复核中', color: '#13c2c2', currentRole: 'reviewer' },
  completed: { name: '已归档', color: '#52c41a', currentRole: null },
  rejected: { name: '已驳回', color: '#f5222d', currentRole: 'registrar' }
};

const SCAN_ERROR_CODES = {
  INVALID_QR: { code: 'INVALID_QR', message: '无效的生产工单码', detail: '该二维码未在系统中登记，请确认二维码是否正确' },
  NOT_FOUND: { code: 'NOT_FOUND', message: '工单不存在', detail: '未找到对应该二维码的生产工单记录' },
  DUPLICATE_SCAN: { code: 'DUPLICATE_SCAN', message: '重复扫码', detail: '该工单已完成当前环节处理，无需重复操作' },
  WRONG_ROLE: { code: 'WRONG_ROLE', message: '非当前处理人', detail: '该工单当前不由您的岗位处理，请转交对应岗位人员' },
  WRONG_STATUS: { code: 'WRONG_STATUS', message: '工单状态不允许扫码', detail: '工单当前状态不支持扫码操作' },
  ALREADY_COMPLETED: { code: 'ALREADY_COMPLETED', message: '工单已归档', detail: '该工单已完成全部流程并归档，无法再次处理' }
};

router.get('/', (req, res) => {
  const { 
    status, 
    role, 
    myQueue,
    mineOnly,
    page = 1, 
    pageSize = 10,
    keyword,
    priority
  } = req.query;

  const userRole = req.user.role;
  let workOrders = [...store.workOrders];

  if (status) {
    workOrders = workOrders.filter(wo => wo.status === status);
  }

  const useMyQueue = myQueue === 'true' || mineOnly === 'true';
  if (useMyQueue && userRole !== 'guest') {
    workOrders = workOrders.filter(wo => wo.currentRole === userRole);
  } else if (role) {
    workOrders = workOrders.filter(wo => wo.currentRole === role);
  }

  if (keyword) {
    const kw = keyword.toLowerCase();
    workOrders = workOrders.filter(wo => 
      wo.qrCode.toLowerCase().includes(kw) ||
      wo.productName.toLowerCase().includes(kw) ||
      wo.productBatch.toLowerCase().includes(kw)
    );
  }

  if (priority) {
    workOrders = workOrders.filter(wo => wo.priority === priority);
  }

  workOrders.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  const total = workOrders.length;
  const start = (page - 1) * pageSize;
  const list = workOrders.slice(start, start + parseInt(pageSize));

  res.json({
    success: true,
    data: {
      list: list.map(wo => formatWorkOrder(wo)),
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const workOrder = store.getWorkOrderById(id);

  if (!workOrder) {
    return res.status(404).json({
      success: false,
      message: '工单不存在',
      code: 'NOT_FOUND'
    });
  }

  res.json({
    success: true,
    data: formatWorkOrder(workOrder, true)
  });
});

router.post('/scan', (req, res) => {
  const { qrCode } = req.body;
  const userRole = req.user.role;
  const userId = req.user.id;
  const userName = req.user.name;

  if (!qrCode) {
    return res.status(400).json({
      success: false,
      message: '二维码内容不能为空',
      code: 'EMPTY_QR'
    });
  }

  const qrExists = store.qrCodeExists(qrCode);
  if (!qrExists) {
    store.addAuditLog({
      workOrderId: null,
      qrCode,
      action: 'scan_fail',
      actionName: '扫码失败',
      userId,
      userName,
      role: userRole,
      roleName: getRoleName(userRole),
      details: { reason: '无效的生产工单码' },
      result: 'fail',
      errorCode: 'INVALID_QR'
    });

    return res.status(400).json({
      success: false,
      ...SCAN_ERROR_CODES.INVALID_QR
    });
  }

  const workOrder = store.getWorkOrderByQrCode(qrCode);
  if (!workOrder) {
    store.addAuditLog({
      workOrderId: null,
      qrCode,
      action: 'scan_fail',
      actionName: '扫码失败',
      userId,
      userName,
      role: userRole,
      roleName: getRoleName(userRole),
      details: { reason: '工单不存在' },
      result: 'fail',
      errorCode: 'NOT_FOUND'
    });

    return res.status(404).json({
      success: false,
      ...SCAN_ERROR_CODES.NOT_FOUND
    });
  }

  if (workOrder.status === 'completed') {
    store.addAuditLog({
      workOrderId: workOrder.id,
      qrCode,
      action: 'scan_fail',
      actionName: '扫码失败',
      userId,
      userName,
      role: userRole,
      roleName: getRoleName(userRole),
      details: { reason: '工单已归档' },
      result: 'fail',
      errorCode: 'ALREADY_COMPLETED'
    });

    return res.status(400).json({
      success: false,
      ...SCAN_ERROR_CODES.ALREADY_COMPLETED,
      workOrder: formatWorkOrder(workOrder)
    });
  }

  const expectedRole = STATUS_MAP[workOrder.status]?.currentRole;

  if (!expectedRole) {
    return res.status(400).json({
      success: false,
      ...SCAN_ERROR_CODES.WRONG_STATUS,
      workOrder: formatWorkOrder(workOrder)
    });
  }

  if (expectedRole !== userRole) {
    store.addAuditLog({
      workOrderId: workOrder.id,
      qrCode,
      action: 'scan_fail',
      actionName: '扫码失败',
      userId,
      userName,
      role: userRole,
      roleName: getRoleName(userRole),
      details: { reason: '非当前处理人', expectedRole, currentStatus: workOrder.status },
      result: 'fail',
      errorCode: 'WRONG_ROLE'
    });

    return res.status(403).json({
      success: false,
      ...SCAN_ERROR_CODES.WRONG_ROLE,
      detail: `该工单当前状态为「${STATUS_MAP[workOrder.status].name}」，应由「${getRoleName(expectedRole)}」处理，您的岗位是「${getRoleName(userRole)}」`,
      workOrder: formatWorkOrder(workOrder),
      expectedRole,
      expectedRoleName: getRoleName(expectedRole)
    });
  }

  const lockResult = store.acquireLock(workOrder.id, userId);
  if (!lockResult.success) {
    return res.status(409).json({
      success: false,
      message: '工单正在被处理',
      code: 'CONFLICT',
      detail: `该工单正在由「${lockResult.lockedBy}」处理，请稍后再试`,
      workOrder: formatWorkOrder(workOrder)
    });
  }

  store.addAuditLog({
    workOrderId: workOrder.id,
    qrCode,
    action: 'scan_success',
    actionName: '扫码成功',
    userId,
    userName,
    role: userRole,
    roleName: getRoleName(userRole),
    details: { status: workOrder.status },
    result: 'success'
  });

  const formatted = formatWorkOrder(workOrder, true);
  res.json({
    success: true,
    data: {
      ...formatted,
      canProcess: true,
      nextAction: getNextAction(userRole, workOrder.status)
    }
  });
});

router.post('/:id/submit', (req, res) => {
  const { id } = req.params;
  const { materials, opinion, comment, deadline } = req.body;
  const actualOpinion = opinion || comment;
  const userId = req.user.id;
  const userName = req.user.name;
  const userRole = req.user.role;

  const workOrder = store.getWorkOrderById(id);
  if (!workOrder) {
    return res.status(404).json({ success: false, message: '工单不存在', code: 'NOT_FOUND' });
  }

  if (userRole !== 'registrar') {
    return res.status(403).json({ success: false, message: '只有生产登记员可以提交工单', code: 'PERMISSION_DENIED' });
  }

  if (workOrder.status !== 'draft' && workOrder.status !== 'rejected') {
    return res.status(400).json({ 
      success: false, 
      message: '工单状态不允许提交',
      code: 'INVALID_STATUS',
      detail: `当前状态「${STATUS_MAP[workOrder.status].name}」不允许提交操作`
    });
  }

  if (!materials || !Array.isArray(materials) || materials.length === 0) {
    return res.status(400).json({
      success: false,
      message: '请上传必需的生产材料',
      code: 'MATERIALS_REQUIRED',
      detail: '至少需要提交生产图纸、工艺卡和领料单'
    });
  }

  if (!actualOpinion || actualOpinion.trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: '请填写处理意见',
      code: 'OPINION_REQUIRED',
      detail: '处理意见至少需要5个字符'
    });
  }

  if (deadline) {
    workOrder.deadline = new Date(deadline).toISOString();
  }

  const deadlineDate = new Date(workOrder.deadline);
  if (deadlineDate < new Date()) {
    return res.status(400).json({
      success: false,
      message: '已超过处理时限',
      code: 'DEADLINE_EXCEEDED',
      detail: `该工单应于 ${deadlineDate.toLocaleDateString()} 前完成，现已逾期，请联系主管`
    });
  }

  workOrder.status = 'pending_audit';
  workOrder.currentRole = 'auditor';
  workOrder.updatedAt = new Date().toISOString();
  workOrder.version++;
  workOrder.registrarInfo = {
    userId,
    userName,
    submitTime: new Date().toISOString(),
    materials,
    opinion: actualOpinion.trim()
  };

  if (workOrder.rejectInfo) {
    workOrder.rejectInfo = null;
  }

  store.releaseLock(id);

  store.addAuditLog({
    workOrderId: workOrder.id,
    qrCode: workOrder.qrCode,
    action: 'submit',
    actionName: '提交登记',
    userId,
    userName,
    role: userRole,
    roleName: getRoleName(userRole),
    details: { materials, version: workOrder.version },
    opinion: actualOpinion.trim(),
    result: 'success'
  });

  res.json({
    success: true,
    message: '工单提交成功，已进入核验队列',
    data: formatWorkOrder(workOrder, true)
  });
});

router.post('/:id/audit', (req, res) => {
  const { id } = req.params;
  const { result, action, checkItems, opinion, comment } = req.body;
  const actualResult = result || action;
  const actualOpinion = opinion || comment;
  const userId = req.user.id;
  const userName = req.user.name;
  const userRole = req.user.role;

  const workOrder = store.getWorkOrderById(id);
  if (!workOrder) {
    return res.status(404).json({ success: false, message: '工单不存在', code: 'NOT_FOUND' });
  }

  if (userRole !== 'auditor') {
    return res.status(403).json({ success: false, message: '只有生产审核主管可以核验', code: 'PERMISSION_DENIED' });
  }

  if (workOrder.status !== 'pending_audit') {
    return res.status(400).json({ 
      success: false, 
      message: '工单状态不允许核验',
      code: 'INVALID_STATUS',
      detail: `当前状态「${STATUS_MAP[workOrder.status].name}」不允许核验操作`
    });
  }

  if (!checkItems || !Array.isArray(checkItems) || checkItems.length < 2) {
    return res.status(400).json({
      success: false,
      message: '请完成核验项检查',
      code: 'CHECK_ITEMS_REQUIRED',
      detail: '至少需要完成尺寸检验、外观检查两项核验'
    });
  }

  if (!actualOpinion || actualOpinion.trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: '请填写核验意见',
      code: 'OPINION_REQUIRED',
      detail: '核验意见至少需要5个字符'
    });
  }

  if (actualResult === 'pass') {
    workOrder.status = 'pending_review';
    workOrder.currentRole = 'reviewer';
  } else if (actualResult === 'reject') {
    workOrder.status = 'rejected';
    workOrder.currentRole = 'registrar';
    workOrder.rejectInfo = {
      fromRole: 'auditor',
      rejectTime: new Date().toISOString(),
      reason: actualOpinion.trim(),
      rejectCount: (workOrder.rejectInfo?.rejectCount || 0) + 1
    };
  } else {
    return res.status(400).json({ success: false, message: '无效的核验结果', code: 'INVALID_RESULT' });
  }

  workOrder.updatedAt = new Date().toISOString();
  workOrder.version++;
  workOrder.auditorInfo = {
    userId,
    userName,
    auditTime: new Date().toISOString(),
    checkItems,
    result: actualResult,
    opinion: actualOpinion.trim()
  };

  store.releaseLock(id);

  store.addAuditLog({
    workOrderId: workOrder.id,
    qrCode: workOrder.qrCode,
    action: actualResult === 'pass' ? 'audit_pass' : 'audit_reject',
    actionName: actualResult === 'pass' ? '核验通过' : '核验驳回',
    userId,
    userName,
    role: userRole,
    roleName: getRoleName(userRole),
    details: { checkItems, version: workOrder.version },
    opinion: actualOpinion.trim(),
    result: actualResult
  });

  res.json({
    success: true,
    message: actualResult === 'pass' ? '核验通过，已进入复核队列' : '核验已驳回，已退回登记员',
    data: formatWorkOrder(workOrder, true)
  });
});

router.post('/:id/review', (req, res) => {
  const { id } = req.params;
  const { result, action, archiveNo, opinion, comment } = req.body;
  let actualResult = result || action;
  if (!actualResult && archiveNo) {
    actualResult = 'pass';
  }
  const actualOpinion = opinion || comment;
  const userId = req.user.id;
  const userName = req.user.name;
  const userRole = req.user.role;

  const workOrder = store.getWorkOrderById(id);
  if (!workOrder) {
    return res.status(404).json({ success: false, message: '工单不存在', code: 'NOT_FOUND' });
  }

  if (userRole !== 'reviewer') {
    return res.status(403).json({ success: false, message: '只有制造工厂复核负责人可以复核', code: 'PERMISSION_DENIED' });
  }

  if (workOrder.status !== 'pending_review') {
    return res.status(400).json({ 
      success: false, 
      message: '工单状态不允许复核',
      code: 'INVALID_STATUS',
      detail: `当前状态「${STATUS_MAP[workOrder.status].name}」不允许复核操作`
    });
  }

  if (actualResult === 'pass') {
    if (!archiveNo || archiveNo.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: '请填写归档编号',
        code: 'ARCHIVE_NO_REQUIRED',
        detail: '归档编号至少需要5个字符'
      });
    }

    workOrder.status = 'completed';
    workOrder.currentRole = null;
  } else if (actualResult === 'reject') {
    workOrder.status = 'rejected';
    workOrder.currentRole = 'registrar';
    workOrder.rejectInfo = {
      fromRole: 'reviewer',
      rejectTime: new Date().toISOString(),
      reason: actualOpinion.trim(),
      rejectCount: (workOrder.rejectInfo?.rejectCount || 0) + 1
    };
  } else {
    return res.status(400).json({ success: false, message: '无效的复核结果', code: 'INVALID_RESULT' });
  }

  if (!actualOpinion || actualOpinion.trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: '请填写复核意见',
      code: 'OPINION_REQUIRED',
      detail: '复核意见至少需要5个字符'
    });
  }

  workOrder.updatedAt = new Date().toISOString();
  workOrder.version++;
  workOrder.reviewerInfo = {
    userId,
    userName,
    reviewTime: new Date().toISOString(),
    archiveNo: archiveNo || null,
    result: actualResult,
    opinion: actualOpinion.trim()
  };

  store.releaseLock(id);

  store.addAuditLog({
    workOrderId: workOrder.id,
    qrCode: workOrder.qrCode,
    action: actualResult === 'pass' ? 'review_pass' : 'review_reject',
    actionName: actualResult === 'pass' ? '复核归档' : '复核驳回',
    userId,
    userName,
    role: userRole,
    roleName: getRoleName(userRole),
    details: { archiveNo: archiveNo || null, version: workOrder.version },
    opinion: actualOpinion.trim(),
    result: actualResult
  });

  res.json({
    success: true,
    message: actualResult === 'pass' ? '复核通过，已完成归档' : '复核已驳回，已退回登记员',
    data: formatWorkOrder(workOrder, true)
  });
});

router.post('/batch/audit', (req, res) => {
  const { ids, result, action, checkItems, opinion, comment } = req.body;
  const actualResult = result || action;
  const actualOpinion = opinion || comment;
  const userId = req.user.id;
  const userName = req.user.name;
  const userRole = req.user.role;

  if (userRole !== 'auditor') {
    return res.status(403).json({ success: false, message: '只有生产审核主管可以批量核验', code: 'PERMISSION_DENIED' });
  }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: '请选择要处理的工单', code: 'NO_SELECTED' });
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const id of ids) {
    try {
      const workOrder = store.getWorkOrderById(id);
      if (!workOrder) {
        results.push({ id, success: false, message: '工单不存在', code: 'NOT_FOUND' });
        failCount++;
        continue;
      }

      if (workOrder.status !== 'pending_audit') {
        results.push({ id, success: false, message: '工单状态不允许核验', code: 'INVALID_STATUS' });
        failCount++;
        continue;
      }

      if (actualResult === 'pass') {
        workOrder.status = 'pending_review';
        workOrder.currentRole = 'reviewer';
      } else {
        workOrder.status = 'rejected';
        workOrder.currentRole = 'registrar';
        workOrder.rejectInfo = {
          fromRole: 'auditor',
          rejectTime: new Date().toISOString(),
          reason: actualOpinion,
          rejectCount: (workOrder.rejectInfo?.rejectCount || 0) + 1
        };
      }

      workOrder.updatedAt = new Date().toISOString();
      workOrder.version++;
      workOrder.auditorInfo = {
        userId,
        userName,
        auditTime: new Date().toISOString(),
        checkItems,
        result: actualResult,
        opinion: actualOpinion
      };

      store.addAuditLog({
        workOrderId: workOrder.id,
        qrCode: workOrder.qrCode,
        action: actualResult === 'pass' ? 'batch_audit_pass' : 'batch_audit_reject',
        actionName: actualResult === 'pass' ? '批量核验通过' : '批量核验驳回',
        userId,
        userName,
        role: userRole,
        roleName: getRoleName(userRole),
        details: { checkItems, batch: true, total: ids.length },
        opinion: actualOpinion,
        result: actualResult
      });

      results.push({ id, success: true, message: '处理成功' });
      successCount++;
    } catch (e) {
      results.push({ id, success: false, message: e.message, code: 'ERROR' });
      failCount++;
    }
  }

  res.json({
    success: true,
    message: `批量处理完成：成功 ${successCount} 个，失败 ${failCount} 个`,
    data: {
      successCount,
      failCount,
      success: successCount,
      failed: failCount,
      total: ids.length,
      results
    }
  });
});

router.post('/batch/review', (req, res) => {
  const { ids, result, action, opinion, comment } = req.body;
  const actualResult = result || action;
  const actualOpinion = opinion || comment;
  const userId = req.user.id;
  const userName = req.user.name;
  const userRole = req.user.role;

  if (userRole !== 'reviewer') {
    return res.status(403).json({ success: false, message: '只有复核负责人可以批量复核', code: 'PERMISSION_DENIED' });
  }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: '请选择要处理的工单', code: 'NO_SELECTED' });
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const id of ids) {
    try {
      const workOrder = store.getWorkOrderById(id);
      if (!workOrder) {
        results.push({ id, success: false, message: '工单不存在', code: 'NOT_FOUND' });
        failCount++;
        continue;
      }

      if (workOrder.status !== 'pending_review') {
        results.push({ id, success: false, message: '工单状态不允许复核', code: 'INVALID_STATUS' });
        failCount++;
        continue;
      }

      if (actualResult === 'pass') {
        const archiveNo = `GD2024${String(Date.now() % 1000000).padStart(6, '0')}`;
        workOrder.status = 'completed';
        workOrder.currentRole = null;
        workOrder.reviewerInfo = {
          userId,
          userName,
          reviewTime: new Date().toISOString(),
          archiveNo,
          result: actualResult,
          opinion: actualOpinion
        };
      } else {
        workOrder.status = 'rejected';
        workOrder.currentRole = 'registrar';
        workOrder.rejectInfo = {
          fromRole: 'reviewer',
          rejectTime: new Date().toISOString(),
          reason: actualOpinion,
          rejectCount: (workOrder.rejectInfo?.rejectCount || 0) + 1
        };
        workOrder.reviewerInfo = {
          userId,
          userName,
          reviewTime: new Date().toISOString(),
          result: actualResult,
          opinion: actualOpinion
        };
      }

      workOrder.updatedAt = new Date().toISOString();
      workOrder.version++;

      store.addAuditLog({
        workOrderId: workOrder.id,
        qrCode: workOrder.qrCode,
        action: actualResult === 'pass' ? 'batch_review_pass' : 'batch_review_reject',
        actionName: actualResult === 'pass' ? '批量复核归档' : '批量复核驳回',
        userId,
        userName,
        role: userRole,
        roleName: getRoleName(userRole),
        details: { batch: true, total: ids.length },
        opinion: actualOpinion,
        result: actualResult
      });

      results.push({ id, success: true, message: '处理成功' });
      successCount++;
    } catch (e) {
      results.push({ id, success: false, message: e.message, code: 'ERROR' });
      failCount++;
    }
  }

  res.json({
    success: true,
    message: `批量处理完成：成功 ${successCount} 个，失败 ${failCount} 个`,
    data: {
      successCount,
      failCount,
      success: successCount,
      failed: failCount,
      total: ids.length,
      results
    }
  });
});

function getRoleName(role) {
  const map = {
    registrar: '生产登记员',
    auditor: '生产审核主管',
    reviewer: '制造工厂复核负责人',
    guest: '访客'
  };
  return map[role] || role;
}

function getNextAction(role, status) {
  const actions = {
    'registrar+draft': { action: 'submit', label: '提交登记' },
    'registrar+rejected': { action: 'submit', label: '补正后提交' },
    'auditor+pending_audit': { action: 'audit', label: '核验处理' },
    'reviewer+pending_review': { action: 'review', label: '复核归档' }
  };
  return actions[`${role}+${status}`] || null;
}

function formatWorkOrder(wo, detailed = false) {
  const statusInfo = STATUS_MAP[wo.status] || { name: wo.status, color: '#999' };
  
  const base = {
    id: wo.id,
    qrCode: wo.qrCode,
    productName: wo.productName,
    productBatch: wo.productBatch,
    batchNo: wo.productBatch,
    quantity: wo.quantity,
    status: wo.status,
    statusName: statusInfo.name,
    statusText: statusInfo.name,
    statusColor: statusInfo.color,
    currentRole: wo.currentRole,
    currentRoleName: wo.currentRole ? getRoleName(wo.currentRole) : null,
    currentHandlerName: wo.currentRole ? getRoleName(wo.currentRole) : null,
    currentHandler: wo.currentRole ? getRoleName(wo.currentRole) : null,
    priority: wo.priority,
    priorityName: { high: '高', medium: '中', low: '低' }[wo.priority],
    priorityText: { high: '高', medium: '中', low: '低' }[wo.priority],
    deadline: wo.deadline,
    createdAt: wo.createdAt,
    updatedAt: wo.updatedAt,
    version: wo.version
  };

  if (detailed) {
    base.registrarInfo = wo.registrarInfo;
    base.auditorInfo = wo.auditorInfo;
    base.reviewerInfo = wo.reviewerInfo;
    base.rejectInfo = wo.rejectInfo;
    
    if (wo.registrarInfo) {
      base.registrarName = wo.registrarInfo.userName;
      base.registration = {
        submittedAt: wo.registrarInfo.submitTime,
        comment: wo.registrarInfo.opinion,
        materials: wo.registrarInfo.materials
      };
    } else {
      base.registrarName = null;
      base.registration = null;
    }
    
    if (wo.auditorInfo) {
      base.auditorName = wo.auditorInfo.userName;
      base.audit = {
        completedAt: wo.auditorInfo.auditTime,
        result: wo.auditorInfo.result,
        comment: wo.auditorInfo.opinion,
        checkItems: wo.auditorInfo.checkItems
      };
    } else {
      base.auditorName = null;
      base.audit = null;
    }
    
    if (wo.reviewerInfo) {
      base.reviewerName = wo.reviewerInfo.userName;
      base.review = {
        archiveNo: wo.reviewerInfo.archiveNo,
        completedAt: wo.reviewerInfo.reviewTime,
        comment: wo.reviewerInfo.opinion,
        result: wo.reviewerInfo.result
      };
    } else {
      base.reviewerName = null;
      base.review = null;
    }
  }

  return base;
}

module.exports = router;
