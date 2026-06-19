CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    real_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('hr_specialist', 'salary_supervisor', 'hrbp_leader')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    current_salary REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transfer_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_no TEXT UNIQUE NOT NULL,
    employee_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('transfer', 'salary_adjustment', 'both')),
    from_department TEXT,
    to_department TEXT,
    from_position TEXT,
    to_position TEXT,
    from_salary REAL,
    to_salary REAL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN (
        'pending_review',
        'budget_checking',
        'pending_confirm',
        'approved',
        'synced',
        'rejected'
    )),
    current_node TEXT NOT NULL DEFAULT 'hr_specialist' CHECK(current_node IN (
        'hr_specialist',
        'salary_supervisor',
        'hrbp_leader',
        'completed'
    )),
    budget_verified INTEGER DEFAULT 0,
    salary_processed INTEGER DEFAULT 0,
    registered INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    node_deadline DATETIME,
    is_timeout INTEGER DEFAULT 0,
    timeout_reason TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS processing_trails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    node TEXT NOT NULL,
    handler_id INTEGER,
    action TEXT NOT NULL,
    remark TEXT,
    status TEXT NOT NULL,
    is_timeout INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES transfer_applications(id),
    FOREIGN KEY (handler_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id INTEGER,
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON transfer_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_node ON transfer_applications(current_node);
CREATE INDEX IF NOT EXISTS idx_trails_app ON processing_trails(application_id);
CREATE INDEX IF NOT EXISTS idx_logs_user ON operation_logs(user_id);
