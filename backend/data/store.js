class DataStore {
  constructor() {
    this.workOrders = [];
    this.auditLogs = [];
    this.users = [];
    this.qrCodePool = [];
    this.locks = new Map();
    this._initMockData();
  }

  _initMockData() {
    this.users = [
      { id: 'reg001', name: '张登记', role: 'registrar', roleName: '生产登记员' },
      { id: 'reg002', name: '李登记', role: 'registrar', roleName: '生产登记员' },
      { id: 'aud001', name: '王审核', role: 'auditor', roleName: '生产审核主管' },
      { id: 'aud002', name: '赵审核', role: 'auditor', roleName: '生产审核主管' },
      { id: 'rev001', name: '陈复核', role: 'reviewer', roleName: '制造工厂复核负责人' },
      { id: 'rev002', name: '刘复核', role: 'reviewer', roleName: '制造工厂复核负责人' }
    ];

    const products = ['电机组件A1', '控制器B2', '传感器C3', '减速器D4', '电路板E5'];
    const statuses = ['draft', 'pending_audit', 'auditing', 'pending_review', 'reviewing', 'completed', 'rejected'];
    
    for (let i = 1; i <= 15; i++) {
      const productIdx = (i - 1) % products.length;
      const qrCode = `WO${String(2024000 + i).padStart(10, '0')}`;
      let status, currentRole;
      
      if (i <= 3) {
        status = 'draft';
        currentRole = 'registrar';
      } else if (i <= 6) {
        status = 'pending_audit';
        currentRole = 'auditor';
      } else if (i <= 9) {
        status = 'pending_review';
        currentRole = 'reviewer';
      } else if (i <= 12) {
        status = 'completed';
        currentRole = null;
      } else {
        status = 'rejected';
        currentRole = 'registrar';
      }

      const workOrder = {
        id: `wo${i}`,
        qrCode,
        productName: products[productIdx],
        productBatch: `B${2024}-${String(i).padStart(4, '0')}`,
        quantity: Math.floor(Math.random() * 500) + 100,
        status,
        currentRole,
        priority: i <= 5 ? 'high' : i <= 10 ? 'medium' : 'low',
        deadline: this._getDeadline(status),
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        registrarInfo: i > 3 ? {
          userId: 'reg001',
          userName: '张登记',
          submitTime: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString(),
          materials: ['生产图纸', '工艺卡', '领料单'],
          opinion: '生产准备完毕，申请核验'
        } : null,
        auditorInfo: i > 6 ? {
          userId: 'aud001',
          userName: '王审核',
          auditTime: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString(),
          checkItems: ['尺寸检验', '外观检查', '性能测试'],
          result: i > 9 ? 'pass' : (i === 13 ? 'reject' : 'pass'),
          opinion: i === 13 ? '尺寸超差，需返工补正' : (i > 9 ? '核验通过，申请复核' : '核验通过，申请复核')
        } : null,
        reviewerInfo: i > 9 ? {
          userId: 'rev001',
          userName: '陈复核',
          reviewTime: new Date(Date.now() - Math.random() * 1 * 24 * 60 * 60 * 1000).toISOString(),
          archiveNo: `GD2024${String(i).padStart(6, '0')}`,
          result: 'pass',
          opinion: '复核通过，归档完成'
        } : null,
        rejectInfo: i === 13 ? {
          fromRole: 'auditor',
          rejectTime: new Date(Date.now() - Math.random() * 1 * 24 * 60 * 60 * 1000).toISOString(),
          reason: '尺寸超差，需返工补正',
          rejectCount: 1
        } : null
      };

      this.workOrders.push(workOrder);
      this.qrCodePool.push(qrCode);

      this._generateAuditLogs(workOrder);
    }

    for (let i = 16; i <= 20; i++) {
      this.qrCodePool.push(`WO${String(2024000 + i).padStart(10, '0')}`);
    }
  }

  _getDeadline(status) {
    const base = new Date();
    switch (status) {
      case 'draft':
        base.setDate(base.getDate() + 2);
        break;
      case 'pending_audit':
      case 'auditing':
        base.setDate(base.getDate() + 1);
        break;
      case 'pending_review':
      case 'reviewing':
        base.setDate(base.getDate() + 3);
        break;
      default:
        base.setDate(base.getDate() + 7);
    }
    return base.toISOString();
  }

  _generateAuditLogs(workOrder) {
    const logs = [];
    const baseTime = new Date(workOrder.createdAt);

    logs.push({
      id: `log_${workOrder.id}_1`,
      workOrderId: workOrder.id,
      qrCode: workOrder.qrCode,
      action: 'create',
      actionName: '创建工单',
      userId: 'reg001',
      userName: '张登记',
      role: 'registrar',
      roleName: '生产登记员',
      timestamp: baseTime.toISOString(),
      details: { productName: workOrder.productName, quantity: workOrder.quantity },
      result: 'success'
    });

    if (workOrder.status !== 'draft') {
      logs.push({
        id: `log_${workOrder.id}_2`,
        workOrderId: workOrder.id,
        qrCode: workOrder.qrCode,
        action: 'submit',
        actionName: '提交登记',
        userId: 'reg001',
        userName: '张登记',
        role: 'registrar',
        roleName: '生产登记员',
        timestamp: new Date(baseTime.getTime() + 30 * 60 * 1000).toISOString(),
        details: { materials: workOrder.registrarInfo?.materials || [] },
        opinion: workOrder.registrarInfo?.opinion || '',
        result: 'success'
      });
    }

    if (workOrder.auditorInfo && workOrder.status !== 'pending_audit') {
      const auditTime = new Date(workOrder.auditorInfo.auditTime);
      logs.push({
        id: `log_${workOrder.id}_3`,
        workOrderId: workOrder.id,
        qrCode: workOrder.qrCode,
        action: workOrder.auditorInfo.result === 'pass' ? 'audit_pass' : 'audit_reject',
        actionName: workOrder.auditorInfo.result === 'pass' ? '核验通过' : '核验驳回',
        userId: workOrder.auditorInfo.userId,
        userName: workOrder.auditorInfo.userName,
        role: 'auditor',
        roleName: '生产审核主管',
        timestamp: auditTime.toISOString(),
        details: { checkItems: workOrder.auditorInfo.checkItems },
        opinion: workOrder.auditorInfo.opinion,
        result: workOrder.auditorInfo.result
      });
    }

    if (workOrder.reviewerInfo) {
      const reviewTime = new Date(workOrder.reviewerInfo.reviewTime);
      logs.push({
        id: `log_${workOrder.id}_4`,
        workOrderId: workOrder.id,
        qrCode: workOrder.qrCode,
        action: 'review_pass',
        actionName: '复核归档',
        userId: workOrder.reviewerInfo.userId,
        userName: workOrder.reviewerInfo.userName,
        role: 'reviewer',
        roleName: '制造工厂复核负责人',
        timestamp: reviewTime.toISOString(),
        details: { archiveNo: workOrder.reviewerInfo.archiveNo },
        opinion: workOrder.reviewerInfo.opinion,
        result: 'pass'
      });
    }

    this.auditLogs.push(...logs);
  }

  addAuditLog(log) {
    log.id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    log.timestamp = new Date().toISOString();
    this.auditLogs.unshift(log);
    return log;
  }

  getWorkOrderById(id) {
    return this.workOrders.find(wo => wo.id === id);
  }

  getWorkOrderByQrCode(qrCode) {
    return this.workOrders.find(wo => wo.qrCode === qrCode);
  }

  qrCodeExists(qrCode) {
    return this.qrCodePool.includes(qrCode);
  }

  acquireLock(workOrderId, userId) {
    const now = Date.now();
    const existing = this.locks.get(workOrderId);
    
    if (existing && existing.userId !== userId && now - existing.timestamp < 30000) {
      return { success: false, lockedBy: existing.userName };
    }
    
    this.locks.set(workOrderId, { userId, timestamp: now });
    return { success: true };
  }

  releaseLock(workOrderId) {
    this.locks.delete(workOrderId);
  }
}

module.exports = new DataStore();
