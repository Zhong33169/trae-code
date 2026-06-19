import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.getenv("DB_PATH", str(Path(__file__).resolve().parent / "data.db")))

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
    appeal_id TEXT,
    operator_id TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    action TEXT NOT NULL,
    opinion TEXT,
    from_status TEXT,
    to_status TEXT,
    request_summary TEXT,
    failure_reason TEXT,
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
    ('a2', 'VZ-2026-002', '林芳', '13800000002', '2026-02-20', 'missing_evidence', '来访未提供必要证明材料', '[]', 'pending_review', 'u2', 'reviewer', 1, '2026-02-20T10:30:00', '2026-02-20T10:30:00'),
    ('a3', 'VZ-2026-003', '赵强', '13800000003', '2026-03-10', 'overdue', '来访登记超出规定办理时限', '["https://example.com/evidence3.jpg"]', 'pending_recheck', 'u3', 'rechecker', 2, '2026-03-10T11:00:00', '2026-03-11T16:00:00'),
    ('a4', 'VZ-2026-004', '周丽', '13800000004', '2026-04-05', 'returned', '来访登记信息被退回要求补充', '["https://example.com/evidence4.jpg"]', 'returned', 'u1', 'registrar', 2, '2026-04-05T14:00:00', '2026-04-06T09:00:00'),
    ('a5', 'VZ-2026-005', '吴刚', '13800000005', '2026-05-12', 'status_conflict', '系统状态与实际办理情况不一致', '["https://example.com/evidence5.jpg"]', 'rejected', 'u1', 'registrar', 3, '2026-05-12T08:30:00', '2026-05-14T10:00:00');
"""

SQL_INSERT_OPERATION_RECORDS = """
INSERT INTO operation_records (id, appeal_id, operator_id, operator_name, operator_role, action, opinion, from_status, to_status, request_summary, failure_reason, created_at) VALUES
    ('r1', 'a1', 'u1', '张登记', 'registrar', 'submit', '经核查，来访人陈明的登记信息与系统记录存在不一致，已上传佐证材料，提请审核处理', '', 'pending_review', '访客姓名:陈明, 异常类型:normal, 证据数:1', NULL, '2026-01-15T09:00:00'),
    ('r2', 'a1', 'u2', '李审核', 'reviewer', 'approve', '已核对登记材料与系统记录，差异情况属实，证据材料充分有效，同意提交复核', 'pending_review', 'pending_recheck', '操作:approve, 意见:已核对登记材料与系统记录，差异情况属实，证据材料充分有效，同意提交复核', NULL, '2026-01-15T16:00:00'),
    ('r3', 'a1', 'u3', '王复核', 'rechecker', 'approve', '复核确认登记信息异常情况属实，已按流程完成异常登记归档处理', 'pending_recheck', 'archived', '操作:approve, 意见:复核确认登记信息异常情况属实，已按流程完成异常登记归档处理', NULL, '2026-01-16T14:30:00'),

    ('r4', 'a2', 'u1', '张登记', 'registrar', 'submit', '来访人林芳未能提供身份证原件及预约凭证等必要证明材料，按缺证类型提交审核', '', 'pending_review', '访客姓名:林芳, 异常类型:missing_evidence, 证据数:0', NULL, '2026-02-20T10:30:00'),

    ('r5', 'a3', 'u1', '张登记', 'registrar', 'submit', '来访人赵强的登记申请超出规定办理时限2个工作日，已附超时情况说明，提请审核', '', 'pending_review', '访客姓名:赵强, 异常类型:overdue, 证据数:1', NULL, '2026-03-10T11:00:00'),
    ('r6', 'a3', 'u2', '李审核', 'reviewer', 'approve', '经核实超时原因系系统故障导致延迟，情况属实，相关说明材料齐全，同意提交复核', 'pending_review', 'pending_recheck', '操作:approve, 意见:经核实超时原因系系统故障导致延迟，情况属实，相关说明材料齐全，同意提交复核', NULL, '2026-03-11T16:00:00'),

    ('r7', 'a4', 'u1', '张登记', 'registrar', 'submit', '来访人周丽的登记信息中联系电话填写不完整，工作单位信息缺失，已提交初步材料', '', 'pending_review', '访客姓名:周丽, 异常类型:returned, 证据数:1', NULL, '2026-04-05T14:00:00'),
    ('r8', 'a4', 'u2', '李审核', 'reviewer', 'return', '登记信息不完整：1.联系电话缺区号无法核实；2.工作单位未填写；3.缺少来访事由说明。请补充完整上述信息后重新提交', 'pending_review', 'returned', '操作:return, 意见:登记信息不完整：1.联系电话缺区号无法核实；2.工作单位未填写；3.缺少来访事由说明。请补充完整上述信息后重新提交', NULL, '2026-04-06T09:00:00'),

    ('r9', 'a5', 'u1', '张登记', 'registrar', 'submit', '系统显示来访人吴刚已办理完成，但实际未完成签字确认环节，系统状态与实际办理情况不符，已提交情况说明', '', 'pending_review', '访客姓名:吴刚, 异常类型:status_conflict, 证据数:1', NULL, '2026-05-12T08:30:00'),
    ('r10', 'a5', 'u2', '李审核', 'reviewer', 'approve', '已核实系统日志与办理记录，确认存在状态不同步问题，情况属实，提请复核裁定', 'pending_review', 'pending_recheck', '操作:approve, 意见:已核实系统日志与办理记录，确认存在状态不同步问题，情况属实，提请复核裁定', NULL, '2026-05-13T15:00:00'),
    ('r11', 'a5', 'u3', '王复核', 'rechecker', 'reject', '复核认为：系统状态差异系来访人中途离场未完成全部流程导致，不属于系统异常范畴，不符合异常登记受理条件，予以驳回。建议按正常流程重新办理登记', 'pending_recheck', 'rejected', '操作:reject, 意见:复核认为：系统状态差异系来访人中途离场未完成全部流程导致，不属于系统异常范畴，不符合异常登记受理条件，予以驳回。建议按正常流程重新办理登记', NULL, '2026-05-14T10:00:00'),

    ('r12', NULL, 'u2', '李审核', 'reviewer', 'validation_failed', '尝试以审核主管身份发起申诉', '', '', '访客姓名:测试用户, 异常类型:normal, 角色:reviewer', '只有登记员可以发起申诉', '2026-06-17 09:15:00'),
    ('r13', NULL, 'u1', '张登记', 'registrar', 'validation_failed', '缺证据类型未上传凭证', '', '', '访客姓名:王某某, 异常类型:missing_evidence, 证据数:0', '缺证据类型申诉必须提供至少一项证据材料', '2026-06-17 10:30:00'),
    ('r14', 'a3', 'u3', '王复核', 'rechecker', 'validation_failed', '版本不匹配，页面可能已过期', 'pending_recheck', 'pending_recheck', '操作:approve, 版本:1, 当前版本:2', '版本冲突：提交版本与当前版本不一致，请刷新后重试', '2026-06-18 14:00:00');
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
