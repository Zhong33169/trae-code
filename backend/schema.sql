PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('REGISTRAR', 'AUDITOR', 'REVIEWER')),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS financing_applications (
    id TEXT PRIMARY KEY,
    application_no TEXT NOT NULL UNIQUE,
    applicant_name TEXT NOT NULL,
    applicant_id_card TEXT NOT NULL,
    company_name TEXT NOT NULL,
    company_credit_code TEXT NOT NULL,
    financing_amount REAL NOT NULL,
    financing_term_months INTEGER NOT NULL,
    risk_level TEXT NOT NULL CHECK(risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL CHECK(status IN (
        'DRAFT',
        'PENDING_VERIFICATION',
        'VERIFICATION_PASSED',
        'EVIDENCE_MISSING',
        'OVERDUE',
        'RETURNED_FOR_CORRECTION',
        'STATUS_CONFLICT',
        'REVIEW_PENDING',
        'ARCHIVED',
        'REJECTED'
    )),
    current_handler TEXT NOT NULL REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 1,
    required_evidence TEXT NOT NULL DEFAULT '[]',
    submitted_evidence TEXT NOT NULL DEFAULT '[]',
    last_handler_id TEXT REFERENCES users(id),
    last_opinion TEXT,
    last_result TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operation_records (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES financing_applications(id),
    operator_id TEXT NOT NULL REFERENCES users(id),
    operator_role TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN (
        'CREATE',
        'SUBMIT',
        'CORRECT',
        'VERIFY_PASS',
        'VERIFY_FAIL_EVIDENCE',
        'VERIFY_FAIL_OVERDUE',
        'VERIFY_RETURN_CORRECTION',
        'VERIFY_CONFLICT',
        'REVIEW_PASS_ARCHIVE',
        'REVIEW_REJECT',
        'RISK_UPGRADE',
        'RISK_DOWNGRADE',
        'AUDIT_PASS',
        'AUDIT_FAIL'
    )),
    from_status TEXT,
    to_status TEXT,
    from_risk_level TEXT,
    to_risk_level TEXT,
    opinion TEXT,
    result TEXT NOT NULL,
    version_before INTEGER NOT NULL,
    version_after INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_application_status ON financing_applications(status);
CREATE INDEX IF NOT EXISTS idx_application_risk ON financing_applications(risk_level);
CREATE INDEX IF NOT EXISTS idx_application_handler ON financing_applications(current_handler);
CREATE INDEX IF NOT EXISTS idx_record_application ON operation_records(application_id);
CREATE INDEX IF NOT EXISTS idx_record_created ON operation_records(created_at);
