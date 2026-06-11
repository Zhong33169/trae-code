CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    real_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('registrar', 'auditor', 'reviewer')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sampling_tasks (
    id TEXT PRIMARY KEY,
    task_no TEXT UNIQUE NOT NULL,
    order_no TEXT,
    style_no TEXT NOT NULL,
    style_name TEXT NOT NULL,
    customer_name TEXT,
    fabric_type TEXT,
    color TEXT,
    size_spec TEXT,
    quantity INTEGER DEFAULT 1,
    current_node TEXT NOT NULL DEFAULT 'order_sampling',
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT DEFAULT 'normal',
    deadline DATETIME,
    order_sampling_started_at DATETIME,
    order_sampling_completed_at DATETIME,
    sample_confirmation_started_at DATETIME,
    sample_confirmation_completed_at DATETIME,
    production_scheduling_started_at DATETIME,
    production_scheduling_completed_at DATETIME,
    archived_at DATETIME,
    registrar_id TEXT,
    auditor_id TEXT,
    reviewer_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(registrar_id) REFERENCES users(id),
    FOREIGN KEY(auditor_id) REFERENCES users(id),
    FOREIGN KEY(reviewer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS node_records (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    node_type TEXT NOT NULL CHECK(node_type IN ('order_sampling', 'sample_confirmation', 'production_scheduling', 'archived')),
    operator_id TEXT NOT NULL,
    action TEXT NOT NULL,
    remark TEXT,
    abnormal_reason TEXT,
    started_at DATETIME NOT NULL,
    completed_at DATETIME,
    is_timeout INTEGER DEFAULT 0,
    timeout_hours INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES sampling_tasks(id),
    FOREIGN KEY(operator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    from_node TEXT,
    to_node TEXT,
    detail TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES sampling_tasks(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON sampling_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_current_node ON sampling_tasks(current_node);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON sampling_tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_node_records_task ON node_records(task_id);
CREATE INDEX IF NOT EXISTS idx_node_records_timeout ON node_records(is_timeout);
CREATE INDEX IF NOT EXISTS idx_operation_logs_task ON operation_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_user ON operation_logs(user_id);
