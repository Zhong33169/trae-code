CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('agent', 'qa_manager', 'cs_manager')),
    name TEXT NOT NULL,
    shift TEXT NOT NULL CHECK (shift IN ('morning', 'afternoon', 'night')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('incoming', 'dispatched', 'return_visit', 'closed', 'exception')),
    created_by TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS handover_records (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    shift TEXT NOT NULL CHECK (shift IN ('morning', 'afternoon', 'night')),
    from_user TEXT NOT NULL,
    to_user TEXT NOT NULL,
    handover_time DATETIME NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    remark TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (from_user) REFERENCES users(id),
    FOREIGN KEY (to_user) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_handover_ticket ON handover_records(ticket_id);
CREATE INDEX IF NOT EXISTS idx_handover_status ON handover_records(status);
CREATE INDEX IF NOT EXISTS idx_operation_logs_ticket ON operation_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_user ON operation_logs(user_id);
