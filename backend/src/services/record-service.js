const db = require('../db');
const { RECORD_STATUSES, ROLES, OPERATION_TYPES } = require('../constants');

class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

const getRecordById = (id) => {
  return db.prepare(`
    SELECT r.*,
           u.name as created_by_name,
           u.username as created_by_username,
           h.name as handler_name,
           h.username as handler_username
    FROM supervision_records r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN users h ON r.current_handler_id = h.id
    WHERE r.id = ?
  `).get(id);
};

const getEvidencesByRecordId = (recordId) => {
  return db.prepare(`
    SELECT e.*, u.name as uploaded_by_name
    FROM evidences e
    LEFT JOIN users u ON e.uploaded_by = u.id
    WHERE e.record_id = ?
    ORDER BY e.created_at DESC
  `).all(recordId);
};

const getReviewRecordsByRecordId = (recordId) => {
  return db.prepare(`
    SELECT rv.*, u.name as handler_name, u.role as handler_role
    FROM review_records rv
    LEFT JOIN users u ON rv.handler_id = u.id
    WHERE rv.record_id = ?
    ORDER BY rv.created_at ASC
  `).all(recordId);
};

const getOperationLogsByRecordId = (recordId) => {
  return db.prepare(`
    SELECT l.*, u.name as user_name, u.role as user_role
    FROM operation_logs l
    LEFT JOIN users u ON l.user_id = u.id
    WHERE l.record_id = ?
    ORDER BY l.created_at DESC
  `).all(recordId);
};

const logOperation = (recordId, userId, operationType, description, ipAddress = '127.0.0.1') => {
  db.prepare(`
    INSERT INTO operation_logs (record_id, user_id, operation_type, description, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(recordId, userId, operationType, description, ipAddress);
};

const addReviewRecord = (recordId, handlerId, operationType, opinion, result, previousStatus, newStatus, rejectReason, version) => {
  return db.prepare(`
    INSERT INTO review_records (
      record_id, handler_id, operation_type, opinion, result,
      previous_status, new_status, reject_reason, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(recordId, handlerId, operationType, opinion, result, previousStatus, newStatus, rejectReason, version);
};

const updateRecordStatus = (recordId, newStatus, version, currentHandlerId = null) => {
  const params = [newStatus, version, recordId];
  let handlerSql = '';
  if (currentHandlerId !== null) {
    handlerSql = ', current_handler_id = ?';
    params.splice(2, 0, currentHandlerId);
  }
  return db.prepare(`
    UPDATE supervision_records
    SET status = ?, updated_at = CURRENT_TIMESTAMP ${handlerSql}
    WHERE id = ? AND version = ?
  `).run(...params);
};

const incrementVersion = (recordId) => {
  return db.prepare(`
    UPDATE supervision_records
    SET version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(recordId);
};

const validateRequiredEvidences = (recordId, requiredTypes = ['photo']) => {
  const evidences = getEvidencesByRecordId(recordId);
  const hasRequired = requiredTypes.every(type => 
    evidences.some(e => e.type === type)
  );
  return {
    valid: hasRequired,
    evidences,
    missingTypes: requiredTypes.filter(type => 
      !evidences.some(e => e.type === type)
    ),
  };
};

const validateHandler = (record, userId, role) => {
  if (!record.current_handler_id) {
    return { valid: true, message: '记录无当前处理人' };
  }
  if (record.current_handler_id !== userId) {
    return { valid: false, message: '您不是当前处理人，无权操作此记录' };
  }
  return { valid: true };
};

const validateVersion = (record, expectedVersion) => {
  if (record.version !== expectedVersion) {
    return {
      valid: false,
      message: `版本冲突，当前版本为${record.version}，您提交的版本为${expectedVersion}`,
    };
  }
  return { valid: true };
};

const getSupervisorList = () => {
  return db.prepare('SELECT id, name, username FROM users WHERE role = ?').all(ROLES.SUPERVISOR);
};

const getReviewerList = () => {
  return db.prepare('SELECT id, name, username FROM users WHERE role = ?').all(ROLES.REVIEWER);
};

const getRoleForStatus = (status) => {
  const statusRoleMap = {
    [RECORD_STATUSES.DRAFT]: ROLES.REGISTRAR,
    [RECORD_STATUSES.SUBMITTED]: ROLES.SUPERVISOR,
    [RECORD_STATUSES.IN_REVIEW]: ROLES.SUPERVISOR,
    [RECORD_STATUSES.REVIEW_PASSED]: ROLES.REVIEWER,
    [RECORD_STATUSES.NEEDS_CORRECTION]: ROLES.REGISTRAR,
    [RECORD_STATUSES.CORRECTED]: ROLES.SUPERVISOR,
    [RECORD_STATUSES.IN_FINAL_REVIEW]: ROLES.REVIEWER,
    [RECORD_STATUSES.EVIDENCE_MISSING]: ROLES.REGISTRAR,
    [RECORD_STATUSES.OVERDUE]: ROLES.SUPERVISOR,
    [RECORD_STATUSES.STATUS_CONFLICT]: ROLES.REGISTRAR,
    [RECORD_STATUSES.FINAL_PASSED]: ROLES.REVIEWER,
    [RECORD_STATUSES.FINAL_REJECTED]: ROLES.REGISTRAR,
    [RECORD_STATUSES.REVIEW_REJECTED]: ROLES.REGISTRAR,
    [RECORD_STATUSES.ARCHIVED]: null,
  };
  return statusRoleMap[status] || null;
};

const validateStatusTransition = (record, operation, userId, role) => {
  const transitions = {
    [RECORD_STATUSES.DRAFT]: {
      [OPERATION_TYPES.SUBMIT]: {
        allowedRoles: [ROLES.REGISTRAR],
        newStatus: RECORD_STATUSES.SUBMITTED,
        requireCreator: true,
        requireEvidence: true,
      },
    },
    [RECORD_STATUSES.SUBMITTED]: {
      [OPERATION_TYPES.REVIEW]: {
        allowedRoles: [ROLES.SUPERVISOR],
        newStatus: RECORD_STATUSES.IN_REVIEW,
      },
    },
    [RECORD_STATUSES.IN_REVIEW]: {
      [OPERATION_TYPES.REVIEW_PASS]: {
        allowedRoles: [ROLES.SUPERVISOR],
        newStatus: RECORD_STATUSES.REVIEW_PASSED,
        requireOpinion: true,
      },
      [OPERATION_TYPES.REVIEW_REJECT]: {
        allowedRoles: [ROLES.SUPERVISOR],
        newStatus: RECORD_STATUSES.REVIEW_REJECTED,
        requireOpinion: true,
        requireRejectReason: true,
      },
      [OPERATION_TYPES.REQUEST_CORRECTION]: {
        allowedRoles: [ROLES.SUPERVISOR],
        newStatus: RECORD_STATUSES.NEEDS_CORRECTION,
        requireOpinion: true,
        requireRejectReason: true,
      },
      [OPERATION_TYPES.MARK_EVIDENCE_MISSING]: {
        allowedRoles: [ROLES.SUPERVISOR],
        newStatus: RECORD_STATUSES.EVIDENCE_MISSING,
        requireOpinion: true,
        requireRejectReason: true,
      },
      [OPERATION_TYPES.MARK_STATUS_CONFLICT]: {
        allowedRoles: [ROLES.SUPERVISOR],
        newStatus: RECORD_STATUSES.STATUS_CONFLICT,
        requireOpinion: true,
        requireRejectReason: true,
      },
    },
    [RECORD_STATUSES.REVIEW_PASSED]: {
      [OPERATION_TYPES.FINAL_REVIEW]: {
        allowedRoles: [ROLES.REVIEWER],
        newStatus: RECORD_STATUSES.IN_FINAL_REVIEW,
      },
    },
    [RECORD_STATUSES.IN_FINAL_REVIEW]: {
      [OPERATION_TYPES.FINAL_PASS]: {
        allowedRoles: [ROLES.REVIEWER],
        newStatus: RECORD_STATUSES.FINAL_PASSED,
        requireOpinion: true,
      },
      [OPERATION_TYPES.FINAL_REJECT]: {
        allowedRoles: [ROLES.REVIEWER],
        newStatus: RECORD_STATUSES.REVIEW_REJECTED,
        requireOpinion: true,
        requireRejectReason: true,
      },
    },
    [RECORD_STATUSES.NEEDS_CORRECTION]: {
      [OPERATION_TYPES.CORRECT]: {
        allowedRoles: [ROLES.REGISTRAR],
        newStatus: RECORD_STATUSES.CORRECTED,
        requireOpinion: true,
        requireCreator: true,
        requireEvidence: true,
      },
    },
    [RECORD_STATUSES.CORRECTED]: {
      [OPERATION_TYPES.RESUBMIT]: {
        allowedRoles: [ROLES.REGISTRAR],
        newStatus: RECORD_STATUSES.SUBMITTED,
        requireCreator: true,
      },
    },
    [RECORD_STATUSES.EVIDENCE_MISSING]: {
      [OPERATION_TYPES.CORRECT]: {
        allowedRoles: [ROLES.REGISTRAR],
        newStatus: RECORD_STATUSES.CORRECTED,
        requireOpinion: true,
        requireCreator: true,
        requireEvidence: true,
      },
    },
    [RECORD_STATUSES.REVIEW_REJECTED]: {
      [OPERATION_TYPES.CORRECT]: {
        allowedRoles: [ROLES.REGISTRAR],
        newStatus: RECORD_STATUSES.CORRECTED,
        requireOpinion: true,
        requireCreator: true,
        requireEvidence: true,
      },
    },
    [RECORD_STATUSES.STATUS_CONFLICT]: {
      [OPERATION_TYPES.CORRECT]: {
        allowedRoles: [ROLES.REGISTRAR],
        newStatus: RECORD_STATUSES.CORRECTED,
        requireOpinion: true,
        requireCreator: true,
        requireEvidence: true,
      },
      [OPERATION_TYPES.FINAL_REJECT]: {
        allowedRoles: [ROLES.REVIEWER],
        newStatus: RECORD_STATUSES.FINAL_REJECTED,
        requireOpinion: true,
        requireRejectReason: true,
      },
    },
    [RECORD_STATUSES.OVERDUE]: {
      [OPERATION_TYPES.REQUEST_CORRECTION]: {
        allowedRoles: [ROLES.SUPERVISOR],
        newStatus: RECORD_STATUSES.NEEDS_CORRECTION,
        requireOpinion: true,
        requireRejectReason: true,
      },
      [OPERATION_TYPES.REVIEW_PASS]: {
        allowedRoles: [ROLES.SUPERVISOR],
        newStatus: RECORD_STATUSES.REVIEW_PASSED,
        requireOpinion: true,
      },
      [OPERATION_TYPES.REVIEW_REJECT]: {
        allowedRoles: [ROLES.SUPERVISOR],
        newStatus: RECORD_STATUSES.REVIEW_REJECTED,
        requireOpinion: true,
        requireRejectReason: true,
      },
    },
    [RECORD_STATUSES.FINAL_PASSED]: {
      [OPERATION_TYPES.ARCHIVE]: {
        allowedRoles: [ROLES.REVIEWER],
        newStatus: RECORD_STATUSES.ARCHIVED,
      },
    },
    [RECORD_STATUSES.FINAL_REJECTED]: {
      [OPERATION_TYPES.CORRECT]: {
        allowedRoles: [ROLES.REGISTRAR],
        newStatus: RECORD_STATUSES.CORRECTED,
        requireOpinion: true,
        requireCreator: true,
        requireEvidence: true,
      },
    },
  };

  const statusTransitions = transitions[record.status];
  if (!statusTransitions) {
    throw new ValidationError(`当前状态"${record.status}"不支持任何操作`);
  }

  const transition = statusTransitions[operation];
  if (!transition) {
    throw new ValidationError(`当前状态下不支持此操作`);
  }

  if (!transition.allowedRoles.includes(role)) {
    throw new ValidationError('您的角色无权执行此操作');
  }

  if (transition.requireCreator && record.created_by !== userId) {
    throw new ValidationError('只有记录创建人才能执行此操作');
  }

  if (transition.requireEvidence) {
    const evidenceCheck = validateRequiredEvidences(record.id);
    if (!evidenceCheck.valid) {
      const missingNames = evidenceCheck.missingTypes.join('、');
      throw new ValidationError(`缺少必要证据：${missingNames}`, { missingTypes: evidenceCheck.missingTypes });
    }
  }

  return transition;
};

const getAvailableOperations = (record, userRole) => {
  const transitions = {
    [RECORD_STATUSES.DRAFT]: [
      { operation: OPERATION_TYPES.SUBMIT, label: '提交审核', roles: [ROLES.REGISTRAR] },
    ],
    [RECORD_STATUSES.SUBMITTED]: [
      { operation: OPERATION_TYPES.REVIEW, label: '开始审核', roles: [ROLES.SUPERVISOR] },
    ],
    [RECORD_STATUSES.IN_REVIEW]: [
      { operation: OPERATION_TYPES.REVIEW_PASS, label: '审核通过', roles: [ROLES.SUPERVISOR] },
      { operation: OPERATION_TYPES.REVIEW_REJECT, label: '审核驳回', roles: [ROLES.SUPERVISOR] },
      { operation: OPERATION_TYPES.REQUEST_CORRECTION, label: '退回补正', roles: [ROLES.SUPERVISOR] },
      { operation: OPERATION_TYPES.MARK_EVIDENCE_MISSING, label: '标记缺证据', roles: [ROLES.SUPERVISOR] },
      { operation: OPERATION_TYPES.MARK_STATUS_CONFLICT, label: '标记状态冲突', roles: [ROLES.SUPERVISOR] },
    ],
    [RECORD_STATUSES.REVIEW_PASSED]: [
      { operation: OPERATION_TYPES.FINAL_REVIEW, label: '开始复核', roles: [ROLES.REVIEWER] },
    ],
    [RECORD_STATUSES.IN_FINAL_REVIEW]: [
      { operation: OPERATION_TYPES.FINAL_PASS, label: '复核通过', roles: [ROLES.REVIEWER] },
      { operation: OPERATION_TYPES.FINAL_REJECT, label: '复核驳回', roles: [ROLES.REVIEWER] },
    ],
    [RECORD_STATUSES.NEEDS_CORRECTION]: [
      { operation: OPERATION_TYPES.CORRECT, label: '补正材料', roles: [ROLES.REGISTRAR] },
    ],
    [RECORD_STATUSES.CORRECTED]: [
      { operation: OPERATION_TYPES.RESUBMIT, label: '再次提交', roles: [ROLES.REGISTRAR] },
    ],
    [RECORD_STATUSES.EVIDENCE_MISSING]: [
      { operation: OPERATION_TYPES.CORRECT, label: '补充证据', roles: [ROLES.REGISTRAR] },
    ],
    [RECORD_STATUSES.REVIEW_REJECTED]: [
      { operation: OPERATION_TYPES.CORRECT, label: '整改后重新提交', roles: [ROLES.REGISTRAR] },
    ],
    [RECORD_STATUSES.STATUS_CONFLICT]: [
      { operation: OPERATION_TYPES.CORRECT, label: '现场核实后补正', roles: [ROLES.REGISTRAR] },
      { operation: OPERATION_TYPES.FINAL_REJECT, label: '最终裁定驳回', roles: [ROLES.REVIEWER] },
    ],
    [RECORD_STATUSES.OVERDUE]: [
      { operation: OPERATION_TYPES.REVIEW_PASS, label: '逾期情况确认通过', roles: [ROLES.SUPERVISOR] },
      { operation: OPERATION_TYPES.REVIEW_REJECT, label: '逾期并审核驳回', roles: [ROLES.SUPERVISOR] },
      { operation: OPERATION_TYPES.REQUEST_CORRECTION, label: '逾期要求补正', roles: [ROLES.SUPERVISOR] },
    ],
    [RECORD_STATUSES.FINAL_REJECTED]: [
      { operation: OPERATION_TYPES.CORRECT, label: '复核驳回后补正', roles: [ROLES.REGISTRAR] },
    ],
    [RECORD_STATUSES.FINAL_PASSED]: [
      { operation: OPERATION_TYPES.ARCHIVE, label: '归档', roles: [ROLES.REVIEWER] },
    ],
  };

  const ops = transitions[record.status] || [];
  return ops.filter(op => op.roles.includes(userRole));
};

const getRecordList = (filters = {}, page = 1, pageSize = 10) => {
  const conditions = [];
  const params = [];

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(`r.status IN (${filters.status.map(() => '?').join(',')})`);
      params.push(...filters.status);
    } else {
      conditions.push('r.status = ?');
      params.push(filters.status);
    }
  }

  if (filters.role) {
    const roleHandlers = {
      [ROLES.REGISTRAR]: () => {
        conditions.push('r.created_by = ?');
        params.push(filters.userId);
      },
      [ROLES.SUPERVISOR]: () => {
        conditions.push(`(r.current_handler_id = ? OR r.status IN ('submitted', 'corrected'))`);
        params.push(filters.userId);
      },
      [ROLES.REVIEWER]: () => {
        conditions.push(`(r.current_handler_id = ? OR r.status IN ('review_passed', 'final_passed'))`);
        params.push(filters.userId);
      },
    };
    if (roleHandlers[filters.role]) {
      roleHandlers[filters.role]();
    }
  }

  if (filters.projectName) {
    conditions.push('r.project_name LIKE ?');
    params.push(`%${filters.projectName}%`);
  }

  if (filters.recordNo) {
    conditions.push('r.record_no LIKE ?');
    params.push(`%${filters.recordNo}%`);
  }

  if (filters.createdBy) {
    conditions.push('r.created_by = ?');
    params.push(filters.createdBy);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const countStmt = db.prepare(`
    SELECT COUNT(*) as total FROM supervision_records r ${whereSql}
  `);
  const { total } = countStmt.get(...params);

  const offset = (page - 1) * pageSize;
  const listStmt = db.prepare(`
    SELECT r.*,
           u.name as created_by_name,
           h.name as handler_name
    FROM supervision_records r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN users h ON r.current_handler_id = h.id
    ${whereSql}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `);
  const list = listStmt.all(...params, pageSize, offset);

  return { list, total, page, pageSize };
};

const getStatistics = (userId, role) => {
  const stats = {};

  const baseSql = 'SELECT status, COUNT(*) as count FROM supervision_records WHERE 1=1';
  const allStatuses = Object.values(RECORD_STATUSES);

  allStatuses.forEach(status => {
    stats[status] = 0;
  });

  const allCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM supervision_records GROUP BY status
  `).all();
  allCounts.forEach(row => {
    stats[row.status] = row.count;
  });

  const myPending = db.prepare(`
    SELECT COUNT(*) as count FROM supervision_records
    WHERE current_handler_id = ? AND status NOT IN ('draft', 'archived', 'final_passed', 'final_rejected')
  `).get(userId).count;

  const myCreated = db.prepare(`
    SELECT COUNT(*) as count FROM supervision_records
    WHERE created_by = ?
  `).get(userId).count;

  const todoCounts = {};
  if (role === ROLES.REGISTRAR) {
    todoCounts.needCorrection = db.prepare(`
      SELECT COUNT(*) as count FROM supervision_records
      WHERE created_by = ? AND status IN ('needs_correction', 'evidence_missing', 'review_rejected', 'status_conflict')
    `).get(userId).count;
    todoCounts.draft = db.prepare(`
      SELECT COUNT(*) as count FROM supervision_records
      WHERE created_by = ? AND status = 'draft'
    `).get(userId).count;
  } else if (role === ROLES.SUPERVISOR) {
    todoCounts.pendingReview = db.prepare(`
      SELECT COUNT(*) as count FROM supervision_records
      WHERE status IN ('submitted', 'corrected')
    `).get().count;
    todoCounts.inReview = db.prepare(`
      SELECT COUNT(*) as count FROM supervision_records
      WHERE current_handler_id = ? AND status = 'in_review'
    `).get(userId).count;
  } else if (role === ROLES.REVIEWER) {
    todoCounts.pendingFinal = db.prepare(`
      SELECT COUNT(*) as count FROM supervision_records
      WHERE status = 'review_passed'
    `).get().count;
    todoCounts.inFinal = db.prepare(`
      SELECT COUNT(*) as count FROM supervision_records
      WHERE current_handler_id = ? AND status = 'in_final_review'
    `).get(userId).count;
  }

  const overdue = db.prepare(`
    SELECT COUNT(*) as count FROM supervision_records
    WHERE deadline IS NOT NULL AND deadline < CURRENT_TIMESTAMP
      AND status NOT IN ('archived', 'final_passed', 'final_rejected')
  `).get().count;

  return {
    byStatus: stats,
    myPending,
    myCreated,
    todoCounts,
    overdue,
    total: allCounts.reduce((sum, row) => sum + row.count, 0),
  };
};

module.exports = {
  ValidationError,
  getRecordById,
  getEvidencesByRecordId,
  getReviewRecordsByRecordId,
  getOperationLogsByRecordId,
  logOperation,
  addReviewRecord,
  updateRecordStatus,
  incrementVersion,
  validateRequiredEvidences,
  validateHandler,
  validateVersion,
  validateStatusTransition,
  getAvailableOperations,
  getRecordList,
  getStatistics,
  getSupervisorList,
  getReviewerList,
  getRoleForStatus,
};
