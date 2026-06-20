CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_code TEXT NOT NULL UNIQUE,
    role_name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    real_name TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS accounts_receivable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ar_no TEXT NOT NULL UNIQUE,
    buyer_name TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    amount REAL NOT NULL,
    invoice_no TEXT,
    invoice_date DATE,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'pending',
    remark TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS confirmation_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL UNIQUE,
    ar_id INTEGER NOT NULL,
    ar_no TEXT NOT NULL,
    buyer_name TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    amount REAL NOT NULL,
    confirm_amount REAL,
    status TEXT NOT NULL DEFAULT 'draft',
    current_handler_role TEXT,
    reject_reason TEXT,
    advance_reason TEXT,
    shift TEXT,
    handover_from INTEGER,
    handover_to INTEGER,
    handover_time DATETIME,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ar_id) REFERENCES accounts_receivable(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (handover_from) REFERENCES users(id),
    FOREIGN KEY (handover_to) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payment_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    verify_no TEXT NOT NULL UNIQUE,
    order_id INTEGER NOT NULL,
    order_no TEXT NOT NULL,
    payment_amount REAL NOT NULL,
    payment_date DATE NOT NULL,
    payer_name TEXT,
    bank_slip_no TEXT,
    remark TEXT,
    status TEXT NOT NULL DEFAULT 'verified',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES confirmation_orders(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    target_no TEXT,
    from_status TEXT,
    to_status TEXT,
    remark TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_ar_status ON accounts_receivable(status);
CREATE INDEX IF NOT EXISTS idx_co_status ON confirmation_orders(status);
CREATE INDEX IF NOT EXISTS idx_co_ar_id ON confirmation_orders(ar_id);
CREATE INDEX IF NOT EXISTS idx_pv_order_id ON payment_verifications(order_id);
CREATE INDEX IF NOT EXISTS idx_log_target ON operation_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_log_created ON operation_logs(created_at);
