const path = require('path');

module.exports = {
  port: process.env.PORT || 8003,
  db: {
    path: path.join(__dirname, '..', '..', 'data', 'pharmacy.db')
  },
  roles: {
    REGISTRAR: 'registrar',
    AUDITOR: 'auditor',
    REVIEWER: 'reviewer'
  },
  riskLevels: {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
  },
  orderStatus: {
    DRAFT: 'draft',
    PENDING_AUDIT: 'pending_audit',
    AUDITING: 'auditing',
    RETURNED: 'returned',
    PENDING_REVIEW: 'pending_review',
    REVIEWING: 'reviewing',
    ARCHIVED: 'archived',
    REJECTED: 'rejected',
    OVERDUE: 'overdue'
  },
  evidenceTypes: {
    PRESCRIPTION: 'prescription',
    ID_CARD: 'id_card',
    MEDICAL_RECORD: 'medical_record',
    INSURANCE_CARD: 'insurance_card'
  }
};
