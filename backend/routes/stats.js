const express = require('express');
const router = express.Router();
const store = require('../data/store');

router.get('/summary', (req, res) => {
  const workOrders = store.workOrders;
  
  const stats = {
    total: workOrders.length,
    draft: workOrders.filter(w => w.status === 'draft').length,
    pending_audit: workOrders.filter(w => w.status === 'pending_audit').length,
    pending_review: workOrders.filter(w => w.status === 'pending_review').length,
    completed: workOrders.filter(w => w.status === 'completed').length,
    rejected: workOrders.filter(w => w.status === 'rejected').length,
    overdue: workOrders.filter(w => {
      const deadline = new Date(w.deadline);
      return deadline < new Date() && w.status !== 'completed';
    }).length
  };

  const registrarQueue = workOrders.filter(w => w.currentRole === 'registrar').length;
  const auditorQueue = workOrders.filter(w => w.currentRole === 'auditor').length;
  const reviewerQueue = workOrders.filter(w => w.currentRole === 'reviewer').length;

  const today = new Date().toDateString();
  const todayActions = store.auditLogs.filter(log => 
    new Date(log.timestamp).toDateString() === today
  ).length;

  const failureCount = store.auditLogs.filter(log => 
    log.result === 'fail' || log.action === 'scan_fail'
  ).length;

  res.json({
    success: true,
    data: {
      statusCounts: stats,
      queueCounts: {
        registrar: registrarQueue,
        auditor: auditorQueue,
        reviewer: reviewerQueue
      },
      todayActions,
      failureCount,
      highPriority: workOrders.filter(w => w.priority === 'high' && w.status !== 'completed').length
    }
  });
});

router.get('/by-role', (req, res) => {
  const { role } = req.query;
  
  if (!role) {
    return res.status(400).json({ success: false, message: '请指定岗位', code: 'ROLE_REQUIRED' });
  }

  const workOrders = store.workOrders.filter(w => w.currentRole === role);
  
  const stats = {
    total: workOrders.length,
    highPriority: workOrders.filter(w => w.priority === 'high').length,
    mediumPriority: workOrders.filter(w => w.priority === 'medium').length,
    lowPriority: workOrders.filter(w => w.priority === 'low').length,
    overdue: workOrders.filter(w => {
      const deadline = new Date(w.deadline);
      return deadline < new Date();
    }).length
  };

  res.json({
    success: true,
    data: stats
  });
});

module.exports = router;
