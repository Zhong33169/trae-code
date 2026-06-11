const express = require('express');
const router = express.Router();
const store = require('../data/store');

function formatAuditLog(log) {
  const formatted = { ...log };
  formatted.createdAt = log.timestamp;
  formatted.operatorName = log.userName;
  formatted.workOrderQrCode = log.qrCode;
  formatted.comment = log.opinion || '';
  formatted.success = log.result === 'success' || log.result === 'pass';
  
  if (!formatted.success) {
    formatted.failureReason = log.details?.reason || log.errorCode || '操作失败';
    formatted.failureCode = log.errorCode || log.action;
  }
  
  return formatted;
}

function getStats(logs) {
  const total = logs.length;
  const success = logs.filter(l => l.result === 'success' || l.result === 'pass').length;
  const failed = total - success;
  const scanFailures = logs.filter(l => l.action === 'scan_fail').length;
  return { total, success, failed, scanFailures };
}

router.get('/', (req, res) => {
  const { 
    workOrderId, 
    action,
    role,
    page = 1, 
    pageSize = 20,
    startTime,
    endTime
  } = req.query;

  let logs = [...store.auditLogs];

  if (workOrderId) {
    logs = logs.filter(log => log.workOrderId === workOrderId);
  }

  if (action) {
    logs = logs.filter(log => log.action === action);
  }

  if (role) {
    logs = logs.filter(log => log.role === role);
  }

  if (startTime) {
    logs = logs.filter(log => new Date(log.timestamp) >= new Date(startTime));
  }

  if (endTime) {
    logs = logs.filter(log => new Date(log.timestamp) <= new Date(endTime));
  }

  const total = logs.length;
  const stats = getStats(logs);
  const start = (page - 1) * pageSize;
  const list = logs.slice(start, start + parseInt(pageSize)).map(formatAuditLog);

  res.json({
    success: true,
    data: {
      list,
      total,
      stats,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  });
});

router.get('/workorder/:workOrderId', (req, res) => {
  const { workOrderId } = req.params;
  const { page = 1, pageSize = 50 } = req.query;

  let logs = store.auditLogs.filter(log => log.workOrderId === workOrderId);
  
  logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const total = logs.length;
  const start = (page - 1) * pageSize;
  const list = logs.slice(start, start + parseInt(pageSize)).map(formatAuditLog);

  res.json({
    success: true,
    data: {
      list,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  });
});

router.get('/failures', (req, res) => {
  const { page = 1, pageSize = 20, errorCode } = req.query;

  let logs = store.auditLogs.filter(log => 
    log.result === 'fail' || log.action === 'scan_fail'
  );

  if (errorCode) {
    logs = logs.filter(log => log.errorCode === errorCode);
  }

  const total = logs.length;
  const start = (page - 1) * pageSize;
  const list = logs.slice(start, start + parseInt(pageSize)).map(formatAuditLog);

  const codeMap = {};
  logs.forEach(log => {
    const code = log.errorCode || log.action;
    if (!codeMap[code]) {
      codeMap[code] = { code, name: log.details?.reason || code, count: 0 };
    }
    codeMap[code].count++;
  });
  const failureTypes = Object.values(codeMap);

  res.json({
    success: true,
    data: {
      list,
      total,
      failureTypes,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  });
});

module.exports = router;
