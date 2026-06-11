const { v4: uuidv4 } = require('uuid');
const {
  ROLES,
  ROLE_NAMES,
  ORDER_STATUS,
  STATUS_NAMES,
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
} = require('./constants');

class DataStore {
  constructor() {
    this.orders = generateSeedOrders();
    this.auditLogs = generateSeedAuditLogs(this.orders);
    this.orderLocks = new Map();
    this.checkOverdueOrders();
  }

  checkOverdueOrders() {
    const now = new Date();
    for (const order of this.orders) {
      const timeoutHours = STAGE_TIMEOUT_HOURS[order.status];
      if (timeoutHours && order.stageEnteredAt) {
        const entered = new Date(order.stageEnteredAt);
        const deadline = new Date(entered.getTime() + timeoutHours * 60 * 60 * 1000);
        const overdue = now > deadline;
        if (overdue !== order.overdue) {
          order.overdue = overdue;
          if (overdue) {
            const hours = ((now - deadline) / (60 * 60 * 1000)).toFixed(1);
            order.overdueReason = `${STATUS_NAMES[order.status]}时限为${timeoutHours}小时，已逾期${hours}小时，需立即处理或申请延期`;
          } else {
            order.overdueReason = null;
          }
        }
      }
    }
  }

  getUserInfo(userId) {
    const userMap = {
      'registrar_wang': { id: 'registrar_wang', name: '王登记', role: ROLES.REGISTRAR },
      'registrar_li': { id: 'registrar_li', name: '李登记', role: ROLES.REGISTRAR },
      'registrar_chen': { id: 'registrar_chen', name: '陈登记', role: ROLES.REGISTRAR },
      'registrar_zhao': { id: 'registrar_zhao', name: '赵登记', role: ROLES.REGISTRAR },
      'registrar_sun': { id: 'registrar_sun', name: '孙登记', role: ROLES.REGISTRAR },
      'registrar_qian': { id: 'registrar_qian', name: '钱登记', role: ROLES.REGISTRAR },
      'supervisor_zhou': { id: 'supervisor_zhou', name: '周主管', role: ROLES.SUPERVISOR },
      'supervisor_wu': { id: 'supervisor_wu', name: '吴主管', role: ROLES.SUPERVISOR },
      'reviewer_huang': { id: 'reviewer_huang', name: '黄复核', role: ROLES.REVIEWER },
      'registrar_demo': { id: 'registrar_demo', name: '演示-登记员', role: ROLES.REGISTRAR },
      'supervisor_demo': { id: 'supervisor_demo', name: '演示-审核主管', role: ROLES.SUPERVISOR },
      'reviewer_demo': { id: 'reviewer_demo', name: '演示-复核负责人', role: ROLES.REVIEWER },
    };
    return userMap[userId] || { id: userId, name: userId, role: ROLES.REGISTRAR };
  }

  getRoleName(role) {
    return ROLE_NAMES[role] || role;
  }

  getStatusName(status) {
    return STATUS_NAMES[status] || status;
  }

  getActionName(action) {
    return ACTION_NAMES[action] || action;
  }

  getAllowedActions(order, role) {
    let actions = ACTION_ALLOWED_MAP[order.status]?.[role] || [];
    if (order.overdue) {
      if ([ROLES.SUPERVISOR, ROLES.REVIEWER, ROLES.REGISTRAR].includes(role)) {
        actions = [ACTIONS.OVERDUE_EXTEND];
      } else {
        actions = [];
      }
    }
    return actions.slice();
  }

  listOrders({ role, status, store, overdue, keyword, page = 1, pageSize = 20 } = {}) {
    this.checkOverdueOrders();
    let list = this.orders.slice();

    if (status) {
      list = list.filter(o => o.status === status);
    }
    if (store) {
      list = list.filter(o => o.store === store);
    }
    if (overdue !== undefined && overdue !== null && overdue !== '') {
      const od = overdue === 'true' || overdue === true;
      list = list.filter(o => o.overdue === od);
    }
    if (keyword) {
      const kw = String(keyword).toLowerCase();
      list = list.filter(o =>
        o.orderNo.toLowerCase().includes(kw) ||
        o.title.toLowerCase().includes(kw) ||
        o.store.toLowerCase().includes(kw)
      );
    }

    let visibleStatuses = [];
    if (role === ROLES.REGISTRAR) {
      visibleStatuses = [
        ORDER_STATUS.DRAFT,
        ORDER_STATUS.PENDING_VERIFICATION,
        ORDER_STATUS.VERIFICATION_REJECTED,
        ORDER_STATUS.PENDING_REVIEW,
        ORDER_STATUS.REVIEW_REJECTED,
        ORDER_STATUS.ARCHIVED,
        ORDER_STATUS.CANCELLED,
      ];
    } else if (role === ROLES.SUPERVISOR) {
      visibleStatuses = [
        ORDER_STATUS.PENDING_VERIFICATION,
        ORDER_STATUS.VERIFICATION_REJECTED,
        ORDER_STATUS.PENDING_REVIEW,
        ORDER_STATUS.REVIEW_REJECTED,
        ORDER_STATUS.ARCHIVED,
      ];
    } else if (role === ROLES.REVIEWER) {
      visibleStatuses = [
        ORDER_STATUS.PENDING_REVIEW,
        ORDER_STATUS.REVIEW_REJECTED,
        ORDER_STATUS.ARCHIVED,
      ];
    }
    if (visibleStatuses.length > 0) {
      list = list.filter(o => visibleStatuses.includes(o.status));
    }

    list.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    const total = list.length;
    const start = (page - 1) * pageSize;
    const data = list.slice(start, start + pageSize);

    return {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      data,
    };
  }

  getStatistics(role) {
    this.checkOverdueOrders();
    const list = this.orders;
    const stats = {
      total: 0,
      byStatus: {},
      overdueCount: 0,
      myToDo: 0,
      byStage: {},
      totalAmount: 0,
    };

    for (const o of list) {
      stats.total++;
      stats.totalAmount += o.totalAmount || 0;
      stats.byStatus[o.status] = (stats.byStatus[o.status] || 0) + 1;
      const stage = STATUS_TO_STAGE[o.status];
      stats.byStage[stage] = (stats.byStage[stage] || 0) + 1;
      if (o.overdue) stats.overdueCount++;
    }

    if (role === ROLES.REGISTRAR) {
      stats.myToDo = list.filter(o =>
        o.status === ORDER_STATUS.DRAFT ||
        o.status === ORDER_STATUS.VERIFICATION_REJECTED
      ).length;
    } else if (role === ROLES.SUPERVISOR) {
      stats.myToDo = list.filter(o =>
        o.status === ORDER_STATUS.PENDING_VERIFICATION ||
        o.status === ORDER_STATUS.REVIEW_REJECTED
      ).length;
    } else if (role === ROLES.REVIEWER) {
      stats.myToDo = list.filter(o =>
        o.status === ORDER_STATUS.PENDING_REVIEW
      ).length;
    }

    return stats;
  }

  getOrderById(id) {
    this.checkOverdueOrders();
    const order = this.orders.find(o => o.id === id);
    if (!order) return null;
    return JSON.parse(JSON.stringify(order));
  }

  acquireLock(orderId) {
    const token = uuidv4();
    const now = Date.now();
    this.orderLocks.set(orderId, { token, acquiredAt: now });
    const orderIdRef = orderId;
    const tokenRef = token;
    setTimeout(() => {
      const current = this.orderLocks.get(orderIdRef);
      if (current && current.token === tokenRef) {
        this.orderLocks.delete(orderIdRef);
      }
    }, 30000);
    return token;
  }

  releaseLock(orderId, token) {
    const current = this.orderLocks.get(orderId);
    if (current && current.token === token) {
      this.orderLocks.delete(orderId);
    }
  }

  validateLock(orderId, lockToken) {
    const current = this.orderLocks.get(orderId);
    if (!current) return false;
    if (lockToken && current.token === lockToken) return true;
    return false;
  }

  createOrder({ createdBy, title, store, category, supplier, totalAmount, items, materials }) {
    this.checkOverdueOrders();
    const user = this.getUserInfo(createdBy);
    const now = new Date().toISOString();
    const now2 = new Date();
    const orderNo = `DD${now2.getFullYear()}${String(now2.getMonth() + 1).padStart(2, '0')}${String(this.orders.length + 1).padStart(4, '0')}`;

    const order = {
      id: uuidv4(),
      orderNo,
      title,
      store,
      category,
      supplier,
      totalAmount: Number(totalAmount) || 0,
      items: items || [],
      status: ORDER_STATUS.DRAFT,
      currentStage: STAGE_NAMES.REGISTRATION,
      createdAt: now,
      updatedAt: now,
      stageEnteredAt: now,
      createdBy,
      materials: {
        [STAGE_NAMES.REGISTRATION]: {
          items: materials || [],
          uploadedAt: now,
        },
      },
      stageOpinions: {},
      overdue: false,
      overdueReason: null,
      version: 1,
    };
    this.orders.push(order);
    this._addAuditLog({
      orderId: order.id,
      orderNo: order.orderNo,
      action: 'create',
      actionName: '创建订货单',
      operator: createdBy,
      operatorRole: user.role,
      details: `创建订货单「${title}」`,
      createdAt: now,
    });
    return JSON.parse(JSON.stringify(order));
  }

  updateDraftOrder({ orderId, updatedBy, title, store, category, supplier, totalAmount, items, materials }) {
    this.checkOverdueOrders();
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return { error: '订货单不存在' };
    if (order.status !== ORDER_STATUS.DRAFT) {
      return { error: '只有草稿状态可以编辑' };
    }
    const user = this.getUserInfo(updatedBy);
    if (user.role !== ROLES.REGISTRAR) {
      return { error: '只有门店订货登记员可以编辑草稿' };
    }

    const now = new Date().toISOString();
    if (title !== undefined) order.title = title;
    if (store !== undefined) order.store = store;
    if (category !== undefined) order.category = category;
    if (supplier !== undefined) order.supplier = supplier;
    if (totalAmount !== undefined) order.totalAmount = Number(totalAmount);
    if (items !== undefined) order.items = items;
    if (materials !== undefined) {
      order.materials[STAGE_NAMES.REGISTRATION] = {
        items: materials,
        uploadedAt: now,
      };
    }
    order.updatedAt = now;
    order.version++;
    this._addAuditLog({
      orderId: order.id,
      orderNo: order.orderNo,
      action: 'update_draft',
      actionName: '编辑草稿',
      operator: updatedBy,
      operatorRole: user.role,
      details: `编辑订货单草稿`,
      createdAt: now,
    });
    return { order: JSON.parse(JSON.stringify(order)) };
  }

  validateMaterialsComplete(stage, order) {
    const required = REQUIRED_MATERIALS[stage] || [];
    const uploaded = order.materials[stage]?.items || [];
    const missing = required.filter(r => !uploaded.includes(r));
    return { complete: missing.length === 0, missing, required, uploaded };
  }

  processAction({ orderId, action, operator, opinion, lockToken, version, materials, extendHours }) {
    this.checkOverdueOrders();
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return { error: '订货单不存在' };

    const user = this.getUserInfo(operator);
    const allowed = this.getAllowedActions(order, user.role);

    const lockMatched = this.validateLock(orderId, lockToken);
    const release = () => { if (lockMatched) this.releaseLock(orderId, lockToken); };

    if (!allowed.includes(action)) {
      release();
      return {
        error: `无权执行该操作`,
        errorDetail: `当前角色「${this.getRoleName(user.role)}」在状态「${this.getStatusName(order.status)}」下允许的操作：${allowed.map(a => this.getActionName(a)).join('、') || '无'}`,
      };
    }

    if (!lockMatched) {
      return {
        error: '页面已过期或被他人占用，请刷新后重试',
        concurrencyError: true,
      };
    }

    const lockValidated = true;

    if (order.overdue && action !== ACTIONS.OVERDUE_EXTEND) {
      release();
      return {
        error: '该单据已超过时限，不能直接推进',
        errorDetail: `请先执行「申请延期」操作，或在详情页处理逾期；逾期原因：${order.overdueReason || '请刷新查看最新时限状态'}`,
        overdueBlocked: true,
      };
    }

    if (version !== undefined && version !== order.version) {
      release();
      return {
        error: '订货单已被他人修改，请刷新后重试',
        versionError: true,
        currentVersion: order.version,
      };
    }

    if (action === ACTIONS.OVERDUE_EXTEND) {
      return this._handleOverdueExtend({ order, extendHours, opinion, user, release });
    }

    const nextStatus = NEXT_STATUS_MAP[action];
    if (!nextStatus) {
      release();
      return { error: '无效操作' };
    }

    const currentStage = STATUS_TO_STAGE[order.status];
    const nextStage = STATUS_TO_STAGE[nextStatus];
    const nextStageName = STAGE_ORDER.includes(nextStage) ? nextStage : currentStage;

    if (action === ACTIONS.SUBMIT || action === ACTIONS.CORRECT_SUBMIT) {
      const check = this.validateMaterialsComplete(STAGE_NAMES.REGISTRATION, {
        ...order,
        materials: materials
          ? { ...order.materials, [STAGE_NAMES.REGISTRATION]: { items: materials, uploadedAt: new Date().toISOString() } }
          : order.materials,
      });
      if (!check.complete) {
        release();
        return {
          error: '材料不完整，无法推进',
          errorDetail: `登记阶段需提交的材料：${check.required.join('、')}；缺失：${check.missing.join('、')}`,
        };
      }
      if (!opinion || opinion.trim().length < 10) {
        release();
        return {
          error: '处理意见过短',
          errorDetail: '订货说明至少10个字符，请说明订货依据、数量测算逻辑',
        };
      }
      if (materials) {
        order.materials[STAGE_NAMES.REGISTRATION] = { items: materials, uploadedAt: new Date().toISOString() };
      }
    }

    if (action === ACTIONS.APPROVE_VERIFY || action === ACTIONS.REJECT_VERIFY) {
      const check = this.validateMaterialsComplete(STAGE_NAMES.VERIFICATION, {
        ...order,
        materials: materials
          ? { ...order.materials, [STAGE_NAMES.VERIFICATION]: { items: materials, uploadedAt: new Date().toISOString() } }
          : order.materials,
      });
      if (action === ACTIONS.APPROVE_VERIFY && !check.complete) {
        release();
        return {
          error: '核验材料不完整，无法推进',
          errorDetail: `核验阶段需提交的材料：${check.required.join('、')}；缺失：${check.missing.join('、')}`,
        };
      }
      if (!opinion || opinion.trim().length < 10) {
        release();
        return {
          error: '处理意见过短',
          errorDetail: action === ACTIONS.REJECT_VERIFY
            ? '退回原因至少10个字符，请逐条说明问题和补正要求'
            : '核验意见至少10个字符，请说明核验结论和依据',
        };
      }
      if (materials) {
        order.materials[STAGE_NAMES.VERIFICATION] = { items: materials, uploadedAt: new Date().toISOString() };
      }
    }

    if (action === ACTIONS.APPROVE_REVIEW || action === ACTIONS.REJECT_REVIEW) {
      const check = this.validateMaterialsComplete(STAGE_NAMES.REVIEW, {
        ...order,
        materials: materials
          ? { ...order.materials, [STAGE_NAMES.REVIEW]: { items: materials, uploadedAt: new Date().toISOString() } }
          : order.materials,
      });
      if (action === ACTIONS.APPROVE_REVIEW && !check.complete) {
        release();
        return {
          error: '复核材料不完整，无法归档',
          errorDetail: `复核阶段需提交的材料：${check.required.join('、')}；缺失：${check.missing.join('、')}`,
        };
      }
      if (!opinion || opinion.trim().length < 10) {
        release();
        return {
          error: '处理意见过短',
          errorDetail: action === ACTIONS.REJECT_REVIEW
            ? '复核退回原因至少10个字符，请逐条说明问题和重核要求'
            : '复核归档意见至少10个字符，请说明合规性、预算、结论',
        };
      }
      if (materials) {
        order.materials[STAGE_NAMES.REVIEW] = { items: materials, uploadedAt: new Date().toISOString() };
      }
    }

    const now = new Date().toISOString();
    const regCheck = this.validateMaterialsComplete(STAGE_NAMES.REGISTRATION, order);
    const verCheck =
      currentStage === STAGE_NAMES.VERIFICATION || nextStageName === STAGE_NAMES.REVIEW
        ? this.validateMaterialsComplete(STAGE_NAMES.VERIFICATION, order)
        : { complete: true, missing: [] };
    const revCheck =
      nextStageName === STAGE_NAMES.REVIEW && nextStatus === ORDER_STATUS.ARCHIVED
        ? this.validateMaterialsComplete(STAGE_NAMES.REVIEW, order)
        : { complete: true, missing: [] };

    let rejectReasons = null;
    if (action === ACTIONS.REJECT_VERIFY || action === ACTIONS.REJECT_REVIEW) {
      const reCheck = action === ACTIONS.REJECT_VERIFY ? regCheck : verCheck;
      if (!reCheck.complete) {
        rejectReasons = reCheck.missing.map(m => `缺少材料：${m}`);
      }
      if (opinion) {
        const custom = opinion
          .split(/[;；\n]/)
          .map(s => s.trim())
          .filter(s => s.length > 2);
        if (custom.length > 0) {
          rejectReasons = rejectReasons ? [...rejectReasons, ...custom] : custom;
        }
      }
    }

    order.stageOpinions[currentStage] = {
      action,
      operator: user.id,
      operatorName: user.name,
      operatorRole: user.role,
      opinion: opinion || '',
      materialsVerified: action.startsWith('approve') ? (action === ACTIONS.APPROVE_VERIFY ? verCheck.complete && regCheck.complete : revCheck.complete && verCheck.complete && regCheck.complete) : action.startsWith('reject') ? false : regCheck.complete,
      timelineVerified: !order.overdue,
      rejectReasons,
      createdAt: now,
    };

    if (action === ACTIONS.APPROVE_REVIEW) {
      order.archivedAt = now;
    }

    order.status = nextStatus;
    order.currentStage = nextStageName;
    order.stageEnteredAt = now;
    order.updatedAt = now;
    order.overdue = false;
    order.overdueReason = null;
    order.version++;

    this.releaseLock(orderId, lockToken);

    this._addAuditLog({
      orderId: order.id,
      orderNo: order.orderNo,
      action,
      actionName: this.getActionName(action),
      operator: user.id,
      operatorRole: user.role,
      details: `[${currentStage}] → [${nextStageName}]：${opinion || ''}`,
      createdAt: now,
      oldStatus: order.status,
      newStatus: nextStatus,
    });

    return { order: JSON.parse(JSON.stringify(order)) };
  }

  _handleOverdueExtend({ order, extendHours, opinion, user, release }) {
    if (!extendHours || extendHours <= 0) {
      release && release();
      return { error: '请输入有效延期小时数' };
    }
    if (!opinion || opinion.trim().length < 5) {
      release && release();
      return { error: '请说明延期理由（至少5个字符）' };
    }
    const now = new Date().toISOString();
    order.stageEnteredAt = new Date(Date.now() - (STAGE_TIMEOUT_HOURS[order.status] / 2) * 60 * 60 * 1000).toISOString();
    order.overdue = false;
    order.overdueReason = null;
    order.updatedAt = now;
    order.version++;
    this._addAuditLog({
      orderId: order.id,
      orderNo: order.orderNo,
      action: ACTIONS.OVERDUE_EXTEND,
      actionName: this.getActionName(ACTIONS.OVERDUE_EXTEND),
      operator: user.id,
      operatorRole: user.role,
      details: `延期${extendHours}小时处理，理由：${opinion}`,
      createdAt: now,
    });
    return { order: JSON.parse(JSON.stringify(order)) };
  }

  batchProcess({ operator, action, orderIds, opinion, lockTokens, materials, versions }) {
    this.checkOverdueOrders();
    const user = this.getUserInfo(operator);
    const results = {
      success: [],
      failed: [],
      skipped: [],
      summary: {
        total: orderIds.length,
        attempted: 0,
        successCount: 0,
        failedCount: 0,
        versionConflictCount: 0,
      },
    };

    const SUBMIT_ACTIONS = [ACTIONS.SUBMIT, ACTIONS.CORRECT_SUBMIT];
    const VERIFY_ACTIONS = [ACTIONS.APPROVE_VERIFY, ACTIONS.REJECT_VERIFY];
    const REVIEW_ACTIONS = [ACTIONS.APPROVE_REVIEW, ACTIONS.REJECT_REVIEW];

    const submitLikeStatuses = new Set([ORDER_STATUS.DRAFT, ORDER_STATUS.VERIFICATION_REJECTED]);
    const verifyLikeStatuses = new Set([ORDER_STATUS.PENDING_VERIFICATION, ORDER_STATUS.REVIEW_REJECTED]);
    const reviewLikeStatuses = new Set([ORDER_STATUS.PENDING_REVIEW]);

    const mixedStatus = { found: false, statuses: new Set() };

    for (let i = 0; i < orderIds.length; i++) {
      const id = orderIds[i];
      const order = this.orders.find(o => o.id === id);
      if (!order) continue;

      if (SUBMIT_ACTIONS.includes(action)) {
        if (submitLikeStatuses.has(order.status)) mixedStatus.statuses.add(order.status);
      } else if (VERIFY_ACTIONS.includes(action)) {
        if (verifyLikeStatuses.has(order.status)) mixedStatus.statuses.add(order.status);
      } else if (REVIEW_ACTIONS.includes(action)) {
        if (reviewLikeStatuses.has(order.status)) mixedStatus.statuses.add(order.status);
      }
    }
    if (SUBMIT_ACTIONS.includes(action) && mixedStatus.statuses.size > 1) {
      mixedStatus.found = true;
    }

    for (let i = 0; i < orderIds.length; i++) {
      results.summary.attempted++;
      const id = orderIds[i];
      const token = lockTokens?.[i];
      const expectedVersion = versions?.[i];
      const order = this.orders.find(o => o.id === id);
      const now = new Date().toISOString();

      const logAudit = ({ ok, reason, oldStatus, newStatus, detail, expectedVer, currentVer }) => {
        const payload = {
          orderId: id,
          orderNo: order?.orderNo || 'unknown',
          action,
          actionName: this.getActionName(action),
          operator: user.id,
          operatorRole: user.role,
          details: detail || `${ok ? '批量处理成功' : '批量处理失败'}：${reason || ''}`,
          createdAt: now,
          batch: true,
          success: ok,
          failureReason: reason || null,
          oldStatus: oldStatus || (order ? order.status : null),
          newStatus: newStatus || (order ? order.status : null),
          expectedVersion: expectedVer !== undefined ? expectedVer : (expectedVersion !== undefined ? expectedVersion : null),
          currentVersion: order ? order.version : null,
          versionAfter: order ? order.version : null,
        };
        this._addAuditLog(payload);
      };

      if (!order) {
        const reason = '订货单不存在';
        results.failed.push({
          orderId: id,
          orderNo: null,
          reason,
          failureType: 'not_found',
        });
        logAudit({ ok: false, reason, expectedVer: expectedVersion, currentVer: null });
        results.summary.failedCount++;
        continue;
      }

      const orderNo = order.orderNo;
      const oldStatus = order.status;

      if (expectedVersion !== undefined && expectedVersion !== null && order.version !== expectedVersion) {
        const reason = `版本冲突：期望版本 v${expectedVersion}，当前版本 v${order.version}，单据已被他人修改`;
        results.failed.push({
          orderId: id,
          orderNo,
          reason,
          failureType: 'version',
          expectedVersion,
          currentVersion: order.version,
          status: order.status,
          statusName: this.getStatusName(order.status),
          versionError: true,
        });
        logAudit({ ok: false, reason, oldStatus, newStatus: oldStatus, expectedVer: expectedVersion, currentVer: order.version });
        results.summary.failedCount++;
        results.summary.versionConflictCount++;
        continue;
      }

      const allowed = this.getAllowedActions(order, user.role);

      const effectiveAction = (() => {
        if (action === ACTIONS.SUBMIT || action === ACTIONS.CORRECT_SUBMIT) {
          if (order.status === ORDER_STATUS.DRAFT) return ACTIONS.SUBMIT;
          if (order.status === ORDER_STATUS.VERIFICATION_REJECTED) return ACTIONS.CORRECT_SUBMIT;
        }
        return action;
      })();

      if (!allowed.includes(effectiveAction)) {
        const reason = `状态「${this.getStatusName(order.status)}」+角色「${this.getRoleName(user.role)}」不允许执行此操作；允许操作：${allowed.map(a => this.getActionName(a)).join('、') || '无'}`;
        results.failed.push({
          orderId: id,
          orderNo,
          reason,
          failureType: 'permission',
          status: order.status,
          statusName: this.getStatusName(order.status),
        });
        logAudit({ ok: false, reason, oldStatus, newStatus: oldStatus, expectedVer: expectedVersion, currentVer: order.version });
        results.summary.failedCount++;
        continue;
      }

      if (order.overdue && effectiveAction !== ACTIONS.OVERDUE_EXTEND) {
        const reason = `已超过时限（${order.overdueReason || '请刷新查看'}），不能直接推进，需先申请延期`;
        results.failed.push({
          orderId: id,
          orderNo,
          reason,
          failureType: 'overdue',
          overdue: true,
          overdueReason: order.overdueReason,
        });
        logAudit({ ok: false, reason, oldStatus, newStatus: oldStatus, expectedVer: expectedVersion, currentVer: order.version });
        results.summary.failedCount++;
        continue;
      }

      if (!this.validateLock(id, token)) {
        const reason = '操作锁已过期或被其他页面占用，请刷新列表后重新获取锁';
        results.failed.push({
          orderId: id,
          orderNo,
          reason,
          failureType: 'lock',
        });
        logAudit({ ok: false, reason, oldStatus, newStatus: oldStatus, expectedVer: expectedVersion, currentVer: order.version });
        results.summary.failedCount++;
        continue;
      }

      const release = () => { this.releaseLock(id, token); };

      if (SUBMIT_ACTIONS.includes(effectiveAction)) {
        const check = this.validateMaterialsComplete(STAGE_NAMES.REGISTRATION, order);
        if (!check.complete) {
          release();
          const reason = `登记阶段材料缺失：${check.missing.join('、')}`;
          results.failed.push({
            orderId: id,
            orderNo,
            reason,
            failureType: 'materials',
            missingMaterials: check.missing,
            requiredMaterials: check.required,
            stage: STAGE_NAMES.REGISTRATION,
          });
          logAudit({ ok: false, reason, oldStatus, newStatus: oldStatus, detail: `材料缺失：${check.missing.join('、')}`, expectedVer: expectedVersion, currentVer: order.version });
          results.summary.failedCount++;
          continue;
        }
      }

      if (effectiveAction === ACTIONS.APPROVE_VERIFY) {
        const check = this.validateMaterialsComplete(STAGE_NAMES.VERIFICATION, order);
        if (!check.complete) {
          release();
          const reason = `核验阶段材料缺失：${check.missing.join('、')}`;
          results.failed.push({
            orderId: id,
            orderNo,
            reason,
            failureType: 'materials',
            missingMaterials: check.missing,
            requiredMaterials: check.required,
            stage: STAGE_NAMES.VERIFICATION,
          });
          logAudit({ ok: false, reason, oldStatus, newStatus: oldStatus, detail: reason, expectedVer: expectedVersion, currentVer: order.version });
          results.summary.failedCount++;
          continue;
        }
      }

      if (effectiveAction === ACTIONS.APPROVE_REVIEW) {
        const check = this.validateMaterialsComplete(STAGE_NAMES.REVIEW, order);
        if (!check.complete) {
          release();
          const reason = `复核阶段材料缺失：${check.missing.join('、')}`;
          results.failed.push({
            orderId: id,
            orderNo,
            reason,
            failureType: 'materials',
            missingMaterials: check.missing,
            requiredMaterials: check.required,
            stage: STAGE_NAMES.REVIEW,
          });
          logAudit({ ok: false, reason, oldStatus, newStatus: oldStatus, detail: reason, expectedVer: expectedVersion, currentVer: order.version });
          results.summary.failedCount++;
          continue;
        }
      }

      if (!opinion || opinion.trim().length < 5) {
        release();
        const reason = '批量处理意见至少5个字符';
        results.failed.push({
          orderId: id,
          orderNo,
          reason,
          failureType: 'opinion',
        });
        logAudit({ ok: false, reason, oldStatus, newStatus: oldStatus, expectedVer: expectedVersion, currentVer: order.version });
        results.summary.failedCount++;
        continue;
      }

      if (SUBMIT_ACTIONS.includes(effectiveAction) && materials) {
        order.materials[STAGE_NAMES.REGISTRATION] = { items: materials, uploadedAt: now };
      }

      const currentStage = STATUS_TO_STAGE[order.status];
      const nextStatus = NEXT_STATUS_MAP[effectiveAction];

      const regCheck = this.validateMaterialsComplete(STAGE_NAMES.REGISTRATION, order);
      const verCheck = (currentStage === STAGE_NAMES.VERIFICATION || nextStatus === ORDER_STATUS.PENDING_REVIEW || nextStatus === ORDER_STATUS.ARCHIVED)
        ? this.validateMaterialsComplete(STAGE_NAMES.VERIFICATION, order)
        : { complete: true, missing: [] };
      const revCheck = (nextStatus === ORDER_STATUS.ARCHIVED)
        ? this.validateMaterialsComplete(STAGE_NAMES.REVIEW, order)
        : { complete: true, missing: [] };

      let rejectReasons = null;
      if (effectiveAction === ACTIONS.REJECT_VERIFY || effectiveAction === ACTIONS.REJECT_REVIEW) {
        const reCheck = effectiveAction === ACTIONS.REJECT_VERIFY ? regCheck : verCheck;
        if (!reCheck.complete) {
          rejectReasons = reCheck.missing.map(m => `缺少材料：${m}`);
        }
        if (opinion) {
          const custom = opinion
            .split(/[;；\n]/)
            .map(s => s.trim())
            .filter(s => s.length > 2);
          if (custom.length > 0) {
            rejectReasons = rejectReasons ? [...rejectReasons, ...custom] : custom;
          }
        }
      }

      order.stageOpinions[currentStage] = {
        action: effectiveAction,
        operator: user.id,
        operatorName: user.name,
        operatorRole: user.role,
        opinion: `${opinion}（批量处理）`,
        materialsVerified: effectiveAction.startsWith('approve')
          ? (effectiveAction === ACTIONS.APPROVE_VERIFY ? verCheck.complete && regCheck.complete : revCheck.complete && verCheck.complete && regCheck.complete)
          : effectiveAction.startsWith('reject') ? false : regCheck.complete,
        timelineVerified: !order.overdue,
        rejectReasons,
        createdAt: now,
      };

      if (effectiveAction === ACTIONS.APPROVE_REVIEW) {
        order.archivedAt = now;
      }

      order.status = nextStatus;
      order.currentStage = STATUS_TO_STAGE[nextStatus];
      order.stageEnteredAt = now;
      order.updatedAt = now;
      order.overdue = false;
      order.overdueReason = null;
      order.version++;
      release();

      logAudit({
        ok: true,
        reason: null,
        oldStatus,
        newStatus: nextStatus,
        detail: `[${this.getStatusName(oldStatus)}] → [${this.getStatusName(nextStatus)}]：${opinion}（批量）`,
        expectedVer: expectedVersion,
        currentVer: order.version,
      });

      const stages = [STAGE_NAMES.REGISTRATION, STAGE_NAMES.VERIFICATION, STAGE_NAMES.REVIEW];
      const nextStageName = stages.includes(STATUS_TO_STAGE[nextStatus]) ? STATUS_TO_STAGE[nextStatus] : currentStage;
      results.success.push({
        orderId: id,
        orderNo,
        oldStatus,
        oldStatusName: this.getStatusName(oldStatus),
        newStatus: nextStatus,
        newStatusName: this.getStatusName(nextStatus),
        newStage: nextStageName,
        versionBefore: expectedVersion || order.version - 1,
        versionAfter: order.version,
        appliedAction: effectiveAction,
        appliedActionName: this.getActionName(effectiveAction),
        materialsVerified: order.stageOpinions[currentStage].materialsVerified,
        timelineVerified: order.stageOpinions[currentStage].timelineVerified,
      });
      results.summary.successCount++;
    }

    return results;
  }

  previewBatch({ operator, orderIds, action }) {
    this.checkOverdueOrders();
    const user = this.getUserInfo(operator);

    const SUBMIT_ACTIONS = [ACTIONS.SUBMIT, ACTIONS.CORRECT_SUBMIT];

    const result = {
      orders: [],
      summary: {
        total: orderIds.length,
        canProcess: 0,
        blocked: 0,
        overdue: 0,
        missingMaterials: 0,
        permissionDenied: 0,
        lockNeeded: 0,
        mixedSubmitStatuses: false,
        statusDistribution: {},
      },
    };

    const submitStatuses = new Set();

    for (const id of orderIds) {
      const order = this.orders.find(o => o.id === id);
      if (!order) {
        result.orders.push({
          orderId: id,
          orderNo: null,
          status: null,
          statusName: null,
          canProcess: false,
          blockReasons: ['订货单不存在'],
        });
        result.summary.blocked++;
        continue;
      }

      const allowed = this.getAllowedActions(order, user.role);
      let effectiveAction = action;
      if (SUBMIT_ACTIONS.includes(action)) {
        if (order.status === ORDER_STATUS.DRAFT) effectiveAction = ACTIONS.SUBMIT;
        else if (order.status === ORDER_STATUS.VERIFICATION_REJECTED) effectiveAction = ACTIONS.CORRECT_SUBMIT;
        submitStatuses.add(order.status);
      }

      const blockReasons = [];

      if (!allowed.includes(effectiveAction)) {
        blockReasons.push(`角色「${this.getRoleName(user.role)}」在状态「${this.getStatusName(order.status)}」下无权执行此操作`);
        result.summary.permissionDenied++;
      }

      if (order.overdue) {
        blockReasons.push(`已逾期：${order.overdueReason || '超过时限未处理'}`);
        result.summary.overdue++;
      }

      const stageMaterialMap = {
        [ACTIONS.SUBMIT]: STAGE_NAMES.REGISTRATION,
        [ACTIONS.CORRECT_SUBMIT]: STAGE_NAMES.REGISTRATION,
        [ACTIONS.APPROVE_VERIFY]: STAGE_NAMES.VERIFICATION,
        [ACTIONS.REJECT_VERIFY]: STAGE_NAMES.VERIFICATION,
        [ACTIONS.APPROVE_REVIEW]: STAGE_NAMES.REVIEW,
        [ACTIONS.REJECT_REVIEW]: STAGE_NAMES.REVIEW,
      };
      const materialStage = stageMaterialMap[effectiveAction];
      let materialCheck = { complete: true, missing: [], required: [], uploaded: [] };
      if (materialStage && effectiveAction.startsWith('approve')) {
        materialCheck = this.validateMaterialsComplete(materialStage, order);
        if (!materialCheck.complete) {
          blockReasons.push(`材料缺失：${materialCheck.missing.join('、')}`);
          result.summary.missingMaterials++;
        }
      } else if (materialStage && SUBMIT_ACTIONS.includes(effectiveAction)) {
        materialCheck = this.validateMaterialsComplete(materialStage, order);
        if (!materialCheck.complete) {
          blockReasons.push(`登记阶段材料缺失：${materialCheck.missing.join('、')}`);
          result.summary.missingMaterials++;
        }
      }

      const hasLock = this.orderLocks.has(id);
      if (!hasLock) {
        result.summary.lockNeeded++;
      }

      result.summary.statusDistribution[order.status] = (result.summary.statusDistribution[order.status] || 0) + 1;

      const canProcess = blockReasons.length === 0;
      if (canProcess) result.summary.canProcess++;
      else result.summary.blocked++;

      const nextStatus = NEXT_STATUS_MAP[effectiveAction] || order.status;

      result.orders.push({
        orderId: order.id,
        orderNo: order.orderNo,
        title: order.title,
        store: order.store,
        status: order.status,
        statusName: this.getStatusName(order.status),
        stage: order.currentStage,
        overdue: order.overdue,
        overdueReason: order.overdueReason,
        version: order.version,
        effectiveAction,
        effectiveActionName: this.getActionName(effectiveAction),
        nextStatus,
        nextStatusName: this.getStatusName(nextStatus),
        nextStage: STATUS_TO_STAGE[nextStatus] || order.currentStage,
        canProcess,
        blockReasons,
        missingMaterials: materialCheck.missing,
        requiredMaterials: materialCheck.required,
        uploadedMaterials: materialCheck.uploaded,
        hasLock,
        materialsVerified: materialCheck.complete,
      });
    }

    if (SUBMIT_ACTIONS.includes(action) && submitStatuses.size > 1) {
      result.summary.mixedSubmitStatuses = true;
      result.summary.mixedSubmitStatusList = Array.from(submitStatuses).map(s => ({
        value: s,
        label: this.getStatusName(s),
      }));
    }

    return result;
  }

  listAuditLogs({ orderId, operator, action, page = 1, pageSize = 50 } = {}) {
    let list = this.auditLogs.slice();
    if (orderId) list = list.filter(l => l.orderId === orderId);
    if (operator) list = list.filter(l => l.operator === operator);
    if (action) list = list.filter(l => l.action === action);
    const total = list.length;
    const start = (page - 1) * pageSize;
    return {
      total,
      page,
      pageSize,
      data: list.slice(start, start + pageSize),
    };
  }

  _addAuditLog(entry) {
    this.auditLogs.unshift({
      id: uuidv4(),
      ...entry,
    });
  }

  getReference() {
    return {
      stores: STORES,
      suppliers: SUPPLIERS,
      categories: CATEGORIES,
      roles: Object.values(ROLES).map(r => ({ value: r, label: ROLE_NAMES[r] })),
      statuses: Object.entries(ORDER_STATUS).map(([k, v]) => ({
        value: v,
        label: STATUS_NAMES[v],
        key: k,
      })),
      actions: Object.entries(ACTIONS).map(([k, v]) => ({
        value: v,
        label: ACTION_NAMES[v],
        key: k,
      })),
      stages: STAGE_ORDER,
      requiredMaterials: REQUIRED_MATERIALS,
      stageTimeoutHours: STAGE_TIMEOUT_HOURS,
    };
  }
}

module.exports = { DataStore };
