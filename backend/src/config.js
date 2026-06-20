const path = require('path');

module.exports = {
  PORT: 8004,
  FRONTEND_ORIGIN: 'http://localhost:3004',
  JWT_SECRET: 'equipment-borrow-jwt-secret-2024',
  JWT_EXPIRES_IN: '24h',
  DB_PATH: path.join(__dirname, '..', 'data', 'equipment.db'),
  ROLES: {
    REGISTRAR: 'registrar',
    AUDITOR: 'auditor',
    REVIEWER: 'reviewer'
  },
  ORDER_STATUS: {
    DRAFT: 'draft',
    PENDING_AUDIT: 'pending_audit',
    AUDIT_REJECTED: 'audit_rejected',
    PENDING_REVIEW: 'pending_review',
    REVIEW_REJECTED: 'review_rejected',
    ARCHIVED: 'archived'
  },
  EVIDENCE_TYPES: {
    BORROW: 'borrow',
    RETURN: 'return',
    LOSS: 'loss'
  }
};
