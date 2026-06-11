const path = require('path');

module.exports = {
  port: 8002,
  dbPath: path.join(__dirname, '..', '..', 'data', 'bus_schedule.db'),
  jwtSecret: 'bus-schedule-jwt-secret-2024',
  tokenExpiresIn: '24h',
  roles: {
    REGISTRAR: 'registrar',
    AUDITOR: 'auditor',
    REVIEWER: 'reviewer'
  },
  statuses: {
    DRAFT: 'draft',
    PENDING_AUDIT: 'pending_audit',
    AUDIT_REJECTED: 'audit_rejected',
    PENDING_REVIEW: 'pending_review',
    REVIEW_REJECTED: 'review_rejected',
    ARCHIVED: 'archived'
  }
};
