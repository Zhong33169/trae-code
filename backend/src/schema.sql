CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('registrar', 'auditor', 'reviewer')),
    real_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seed_records (
    id TEXT PRIMARY KEY,
    batch_no TEXT UNIQUE NOT NULL,
    seed_type TEXT NOT NULL,
    seed_species TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT NOT NULL DEFAULT '尾',
    source TEXT NOT NULL,
    supplier TEXT,
    register_id TEXT NOT NULL,
    register_name TEXT NOT NULL,
    register_time TEXT NOT NULL,
    current_node TEXT NOT NULL DEFAULT 'registration',
    overall_status TEXT NOT NULL DEFAULT 'pending',
    pond_entry_time TEXT,
    pond_id TEXT,
    pond_quantity INTEGER,
    survival_rate REAL,
    survival_observe_time TEXT,
    archive_time TEXT,
    archive_remark TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS node_tracking (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL,
    node_type TEXT NOT NULL,
    node_name TEXT NOT NULL,
    assignee_id TEXT,
    assignee_name TEXT,
    deadline TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    is_timeout INTEGER NOT NULL DEFAULT 0,
    timeout_reason TEXT,
    follow_up_action TEXT,
    timeout_remark TEXT,
    remark TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES seed_records(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    record_id TEXT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    action_target TEXT NOT NULL,
    detail TEXT,
    old_status TEXT,
    new_status TEXT,
    evidence_note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seed_records_status ON seed_records(overall_status);
CREATE INDEX IF NOT EXISTS idx_seed_records_node ON seed_records(current_node);
CREATE INDEX IF NOT EXISTS idx_node_tracking_record ON node_tracking(record_id);
CREATE INDEX IF NOT EXISTS idx_node_tracking_status ON node_tracking(status);
CREATE INDEX IF NOT EXISTS idx_node_tracking_timeout ON node_tracking(is_timeout);
CREATE INDEX IF NOT EXISTS idx_oplogs_record ON operation_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_oplogs_user ON operation_logs(user_id);
