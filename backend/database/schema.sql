-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('initiator', 'handler', 'reviewer', 'admin')),
    real_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 值机记录表
CREATE TABLE IF NOT EXISTS checkin_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT NOT NULL,
    flight_no TEXT NOT NULL,
    flight_date DATE NOT NULL,
    passenger_name TEXT NOT NULL,
    id_card_no TEXT NOT NULL,
    seat_no TEXT,
    boarding_gate TEXT,
    checkin_time DATETIME,
    source TEXT NOT NULL DEFAULT 'offline' CHECK(source IN ('offline', 'online')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'verified', 'archived', 'returned', 'rejected')),
    material_complete INTEGER DEFAULT 1,
    is_overtime INTEGER DEFAULT 0,
    is_abnormal INTEGER DEFAULT 0,
    abnormal_reason TEXT,
    result TEXT,
    return_reason TEXT,
    audit_remark TEXT,
    initiator_id INTEGER,
    handler_id INTEGER,
    reviewer_id INTEGER,
    initiated_at DATETIME,
    handled_at DATETIME,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (initiator_id) REFERENCES users(id),
    FOREIGN KEY (handler_id) REFERENCES users(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_batch_no ON checkin_records(batch_no);
CREATE INDEX IF NOT EXISTS idx_status ON checkin_records(status);
CREATE INDEX IF NOT EXISTS idx_flight_date ON checkin_records(flight_date);

-- 附件表
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkin_record_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_by INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (checkin_record_id) REFERENCES checkin_records(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkin_record_id INTEGER,
    user_id INTEGER,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    detail TEXT,
    failure_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (checkin_record_id) REFERENCES checkin_records(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(checkin_record_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
