import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "data.db"

SQL_DROP_TABLES = """
DROP TABLE IF EXISTS operation_records;
DROP TABLE IF EXISTS appeals;
DROP TABLE IF EXISTS users;
"""

SQL_CREATE_TABLES = """
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('registrar', 'reviewer', 'rechecker'))
);

CREATE TABLE appeals (
    id TEXT PRIMARY KEY,
    appeal_no TEXT UNIQUE NOT NULL,
    visitor_name TEXT NOT NULL,
    visitor_phone TEXT NOT NULL,
    appointment_date TEXT NOT NULL,
    anomaly_type TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_urls TEXT,
    status TEXT NOT NULL,
    current_handler_id TEXT,
    current_handler_role TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (current_handler_id) REFERENCES users(id)
);

CREATE TABLE operation_records (
    id TEXT PRIMARY KEY,
    appeal_id TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    action TEXT NOT NULL,
    opinion TEXT,
    from_status TEXT,
    to_status TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (appeal_id) REFERENCES appeals(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
);
"""

SQL_INSERT_USERS = """
INSERT INTO users (id, name, role) VALUES
    ('u1', '张登记', 'registrar'),
    ('u2', '李审核', 'reviewer'),
    ('u3', '王复核', 'rechecker');
"""

SQL_INSERT_APPEALS = """
INSERT INTO appeals (id, appeal_no, visitor_name, visitor_phone, appointment_date, anomaly_type, description, evidence_urls, status, current_handler_id, current_handler_role, version, created_at, updated_at) VALUES
    ('a1', 'VZ-2026-001', '陈明', '13800000001', '2026-01-15', 'normal', '来访登记信息与系统记录存在差异', '["https://example.com/evidence1.jpg"]', 'archived', 'u3', 'rechecker', 3, '2026-01-15T09:00:00', '2026-01-16T14:30:00'),
    ('a2', 'VZ-2026-002', '林芳', '13800000002', '2026-02-20', 'missing_evidence', '来访未提供必要证明材料', NULL, 'pending_review', 'u2', 'reviewer', 1, '2026-02-20T10:30:00', '2026-02-20T10:30:00'),
    ('a3', 'VZ-2026-003', '赵强', '13800000003', '2026-03-10', 'overdue', '来访登记超出规定办理时限', '["https://example.com/evidence3.jpg"]', 'pending_recheck', 'u3', 'rechecker', 2, '2026-03-10T11:00:00', '2026-03-11T16:00:00'),
    ('a4', 'VZ-2026-004', '周丽', '13800000004', '2026-04-05', 'returned', '来访登记信息被退回要求补充', '["https://example.com/evidence4.jpg"]', 'returned', 'u1', 'registrar', 2, '2026-04-05T14:00:00', '2026-04-06T09:00:00'),
    ('a5', 'VZ-2026-005', '吴刚', '13800000005', '2026-05-12', 'status_conflict', '系统状态与实际办理情况不一致', '["https://example.com/evidence5.jpg"]', 'rejected', 'u1', 'registrar', 3, '2026-05-12T08:30:00', '2026-05-14T10:00:00');
"""

SQL_INSERT_OPERATION_RECORDS = """
INSERT INTO operation_records (id, appeal_id, operator_id, operator_name, operator_role, action, opinion, from_status, to_status, created_at) VALUES
    ('r1', 'a1', 'u1', '张登记', 'registrar', 'submit', '发现来访登记信息异常', '', 'pending_review', '2026-01-15T09:00:00'),
    ('r2', 'a1', 'u2', '李审核', 'reviewer', 'approve', '审核通过，提交复核', 'pending_review', 'pending_recheck', '2026-01-15T16:00:00'),
    ('r3', 'a1', 'u3', '王复核', 'rechecker', 'approve', '复核通过，已归档', 'pending_recheck', 'archived', '2026-01-16T14:30:00'),

    ('r4', 'a2', 'u1', '张登记', 'registrar', 'submit', '来访人未提供必要证明材料', '', 'pending_review', '2026-02-20T10:30:00'),

    ('r5', 'a3', 'u1', '张登记', 'registrar', 'submit', '来访登记超出规定办理时限', '', 'pending_review', '2026-03-10T11:00:00'),
    ('r6', 'a3', 'u2', '李审核', 'reviewer', 'approve', '审核通过，提交复核', 'pending_review', 'pending_recheck', '2026-03-11T16:00:00'),

    ('r7', 'a4', 'u1', '张登记', 'registrar', 'submit', '来访登记信息不完整', '', 'pending_review', '2026-04-05T14:00:00'),
    ('r8', 'a4', 'u2', '李审核', 'reviewer', 'return', '信息不完整，退回补充', 'pending_review', 'returned', '2026-04-06T09:00:00'),

    ('r9', 'a5', 'u1', '张登记', 'registrar', 'submit', '系统状态与实际不符', '', 'pending_review', '2026-05-12T08:30:00'),
    ('r10', 'a5', 'u2', '李审核', 'reviewer', 'approve', '审核通过，提交复核', 'pending_review', 'pending_recheck', '2026-05-13T15:00:00'),
    ('r11', 'a5', 'u3', '王复核', 'rechecker', 'reject', '复核不通过，驳回', 'pending_recheck', 'rejected', '2026-05-14T10:00:00');
"""


def main():
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    cursor.executescript(SQL_DROP_TABLES)
    cursor.executescript(SQL_CREATE_TABLES)
    cursor.executescript(SQL_INSERT_USERS)
    cursor.executescript(SQL_INSERT_APPEALS)
    cursor.executescript(SQL_INSERT_OPERATION_RECORDS)

    conn.commit()
    conn.close()

    print(f"数据库初始化完成: {DB_PATH}")


if __name__ == "__main__":
    main()
