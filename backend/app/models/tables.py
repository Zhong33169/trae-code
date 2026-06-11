CREATE_TABLE_USERS = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('客户经理', '运营主管', '支行行长')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
"""

CREATE_TABLE_ACCOUNT_APPLICATIONS = """
CREATE TABLE IF NOT EXISTS account_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_no TEXT UNIQUE NOT NULL,
    applicant_name TEXT NOT NULL,
    applicant_id_card TEXT NOT NULL,
    applicant_phone TEXT,
    account_type TEXT NOT NULL,
    risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low', 'medium', 'high')),
    risk_reason TEXT,
    stage TEXT NOT NULL DEFAULT '开户预约' CHECK(stage IN ('开户预约', '资料审核', '账户启用')),
    status TEXT NOT NULL DEFAULT '待签收' CHECK(status IN ('待签收', '异常回传', '签收完成')),
    current_handler_id INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    deadline DATETIME,
    is_overdue INTEGER NOT NULL DEFAULT 0,
    is_evidence_missing INTEGER NOT NULL DEFAULT 0,
    is_returned INTEGER NOT NULL DEFAULT 0,
    returned_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (current_handler_id) REFERENCES users(id)
);
"""

CREATE_TABLE_OPERATION_RECORDS = """
CREATE TABLE IF NOT EXISTS operation_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    operator_id INTEGER NOT NULL,
    operator_role TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    is_success INTEGER NOT NULL DEFAULT 1,
    from_stage TEXT,
    to_stage TEXT,
    from_status TEXT,
    to_status TEXT,
    from_risk_level TEXT,
    to_risk_level TEXT,
    remark TEXT,
    evidence_checked TEXT,
    version_before INTEGER,
    version_after INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES account_applications(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
);
"""

CREATE_TABLE_EVIDENCE_ITEMS = """
CREATE TABLE IF NOT EXISTS evidence_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    evidence_type TEXT NOT NULL,
    evidence_name TEXT NOT NULL,
    is_provided INTEGER NOT NULL DEFAULT 0,
    is_required INTEGER NOT NULL DEFAULT 1,
    verified_at DATETIME,
    verified_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES account_applications(id),
    FOREIGN KEY (verified_by) REFERENCES users(id)
);
"""

CREATE_TABLE_RISK_LEVEL_LOGS = """
CREATE TABLE IF NOT EXISTS risk_level_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    operator_id INTEGER NOT NULL,
    operator_role TEXT NOT NULL,
    from_level TEXT NOT NULL,
    to_level TEXT NOT NULL,
    change_reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES account_applications(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
);
"""

CREATE_INDEX_APPLICATION_NO = """
CREATE INDEX IF NOT EXISTS idx_app_no ON account_applications(application_no);
"""

CREATE_INDEX_APPLICATION_STATUS = """
CREATE INDEX IF NOT EXISTS idx_app_status ON account_applications(status, stage);
"""

CREATE_INDEX_OPERATION_APP = """
CREATE INDEX IF NOT EXISTS idx_op_app ON operation_records(application_id);
"""

ALL_DDL = [
    CREATE_TABLE_USERS,
    CREATE_TABLE_ACCOUNT_APPLICATIONS,
    CREATE_TABLE_OPERATION_RECORDS,
    CREATE_TABLE_EVIDENCE_ITEMS,
    CREATE_TABLE_RISK_LEVEL_LOGS,
    CREATE_INDEX_APPLICATION_NO,
    CREATE_INDEX_APPLICATION_STATUS,
    CREATE_INDEX_OPERATION_APP,
]
