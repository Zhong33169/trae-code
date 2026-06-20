-- 投诉工单系统数据库 Schema

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('registrar', 'auditor', 'reviewer')),
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaint_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_no TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    complainant TEXT NOT NULL,
    contact TEXT,
    status TEXT NOT NULL DEFAULT 'pending_audit' CHECK(status IN (
        'draft', 'pending_audit', 'processing', 'pending_review',
        'returned', 'archived'
    )),
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
    source TEXT DEFAULT 'online' CHECK(source IN ('online', 'phone', 'offline_import', 'other')),
    is_exception BOOLEAN DEFAULT 0,
    exception_reason TEXT,
    deadline TIMESTAMP,
    created_by INTEGER NOT NULL,
    handler_id INTEGER,
    reviewer_id INTEGER,
    result_summary TEXT,
    return_reason TEXT,
    audit_remark TEXT,
    import_batch_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (handler_id) REFERENCES users(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id),
    FOREIGN KEY (import_batch_id) REFERENCES import_batches(id)
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    uploaded_by INTEGER NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES complaint_tickets(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    is_failure BOOLEAN DEFAULT 0,
    failure_reason TEXT,
    batch_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES complaint_tickets(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (batch_id) REFERENCES import_batches(id)
);

CREATE TABLE IF NOT EXISTS import_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    imported_by INTEGER NOT NULL,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (imported_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS import_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    ticket_id INTEGER,
    original_ticket_no TEXT NOT NULL,
    original_data TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
        'pending', 'success', 'failed', 'conflict', 'duplicate'
    )),
    diff_detail TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES import_batches(id),
    FOREIGN KEY (ticket_id) REFERENCES complaint_tickets(id)
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON complaint_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON complaint_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_is_exception ON complaint_tickets(is_exception);
CREATE INDEX IF NOT EXISTS idx_audit_ticket ON audit_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_batch ON import_records(batch_id);
