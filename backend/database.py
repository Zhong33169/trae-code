import os
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "inspection.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('registrar','supervisor','reviewer'))
);

CREATE TABLE IF NOT EXISTS inspection_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_no TEXT NOT NULL UNIQUE,
    pen_id TEXT NOT NULL,
    animal_type TEXT NOT NULL,
    animal_count INTEGER NOT NULL DEFAULT 0,
    inspector_name TEXT NOT NULL,
    inspection_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','under_review','reviewed','archived','rejected','returned')),
    version INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS pen_inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    pen_area TEXT NOT NULL,
    cleanliness TEXT NOT NULL CHECK(cleanliness IN ('clean','acceptable','dirty')),
    ventilation TEXT NOT NULL CHECK(ventilation IN ('good','fair','poor')),
    temperature REAL,
    humidity REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (ticket_id) REFERENCES inspection_tickets(id)
);

CREATE TABLE IF NOT EXISTS health_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    animal_id TEXT NOT NULL,
    animal_tag TEXT NOT NULL,
    health_status TEXT NOT NULL CHECK(health_status IN ('healthy','mild','sick','critical')),
    symptoms TEXT,
    diagnosis TEXT,
    reporter_name TEXT NOT NULL,
    reported_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (ticket_id) REFERENCES inspection_tickets(id)
);

CREATE TABLE IF NOT EXISTS treatment_trackings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    health_report_id INTEGER NOT NULL,
    treatment_type TEXT NOT NULL,
    medication TEXT,
    dosage TEXT,
    administered_by TEXT NOT NULL,
    administered_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    next_check_date TEXT,
    FOREIGN KEY (ticket_id) REFERENCES inspection_tickets(id),
    FOREIGN KEY (health_report_id) REFERENCES health_reports(id)
);

CREATE TABLE IF NOT EXISTS supplement_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    supplement_type TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    operated_by INTEGER NOT NULL,
    operated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    version_after INTEGER NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES inspection_tickets(id),
    FOREIGN KEY (operated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS workflow_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    operated_by INTEGER NOT NULL,
    operated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    comment TEXT,
    FOREIGN KEY (ticket_id) REFERENCES inspection_tickets(id),
    FOREIGN KEY (operated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS evidence_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    evidence_type TEXT NOT NULL CHECK(evidence_type IN ('pen_inspection','health_report','treatment_tracking','photo','document')),
    reference_id INTEGER,
    description TEXT,
    uploaded_by INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (ticket_id) REFERENCES inspection_tickets(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS batch_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT NOT NULL UNIQUE,
    action TEXT NOT NULL,
    operated_by INTEGER NOT NULL,
    operated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    total_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    comment TEXT,
    FOREIGN KEY (operated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS batch_operation_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    ticket_no TEXT,
    success INTEGER NOT NULL DEFAULT 0,
    error_reason TEXT,
    old_status TEXT,
    new_status TEXT,
    FOREIGN KEY (batch_id) REFERENCES batch_operations(id),
    FOREIGN KEY (ticket_id) REFERENCES inspection_tickets(id)
);
"""


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript(SCHEMA_SQL)
    conn.close()


def seed_data():
    conn = get_db()
    cur = conn.cursor()

    existing = cur.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if existing > 0:
        conn.close()
        return

    users = [
        ("zhangsan", "张三(登记员)", "registrar"),
        ("lisi", "李四(审核主管)", "supervisor"),
        ("wangwu", "王五(复核负责人)", "reviewer"),
    ]
    for u in users:
        cur.execute("INSERT INTO users (username, display_name, role) VALUES (?,?,?)", u)

    now = "2026-06-12T09:00:00"

    tickets = [
        ("XJ-20260610-001", "A1", "生猪", 120, "张三", "2026-06-10", "archived", 5, 1, now, now),
        ("XJ-20260611-001", "B2", "肉牛", 45, "张三", "2026-06-11", "reviewed", 4, 1, now, now),
        ("XJ-20260612-001", "C3", "山羊", 80, "张三", "2026-06-12", "under_review", 3, 1, now, now),
        ("XJ-20260612-002", "A1", "生猪", 118, "张三", "2026-06-12", "submitted", 5, 1, now, now),
        ("XJ-20260612-003", "D4", "绵羊", 200, "张三", "2026-06-12", "submitted", 2, 1, now, now),
        ("XJ-20260612-004", "B2", "肉牛", 43, "张三", "2026-06-12", "submitted", 7, 1, now, now),
        ("XJ-20260612-005", "E5", "蛋鸡", 500, "张三", "2026-06-12", "rejected", 4, 1, now, now),
        ("XJ-20260612-006", "F6", "生猪", 60, "张三", "2026-06-12", "returned", 4, 1, now, now),
        ("XJ-20260612-007", "G7", "肉牛", 30, "张三", "2026-06-12", "returned", 7, 1, now, now),
        ("XJ-20260612-008", "H8", "蛋鸡", 800, "张三", "2026-06-12", "draft", 1, 1, now, now),
    ]
    for t in tickets:
        cur.execute(
            "INSERT INTO inspection_tickets (ticket_no,pen_id,animal_type,animal_count,inspector_name,inspection_date,status,version,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            t,
        )

    ticket_ids = [row[0] for row in cur.execute("SELECT id FROM inspection_tickets ORDER BY id").fetchall()]

    pen_data = [
        (ticket_ids[0], "A1-1号栏", "clean", "good", 22.5, 65.0, "正常巡检"),
        (ticket_ids[0], "A1-2号栏", "acceptable", "fair", 23.0, 70.0, "通风略差"),
        (ticket_ids[1], "B2-1号栏", "clean", "good", 18.0, 55.0, "正常"),
        (ticket_ids[2], "C3-1号栏", "dirty", "poor", 26.0, 80.0, "需清洁整改"),
        (ticket_ids[3], "A1-1号栏", "clean", "good", 22.0, 63.0, "日常巡检"),
        (ticket_ids[4], "D4-1号栏", "acceptable", "good", 20.0, 60.0, "日常巡检"),
        (ticket_ids[5], "B2-1号栏", "acceptable", "fair", 19.0, 58.0, "补录后复检"),
        (ticket_ids[6], "E5-1号栏", "dirty", "poor", 30.0, 85.0, "高温高湿预警"),
        (ticket_ids[7], "F6-1号栏", "clean", "good", 22.5, 62.0, "正常巡检"),
        (ticket_ids[8], "G7-1号栏", "acceptable", "fair", 19.0, 58.0, "常规检查"),
    ]
    for p in pen_data:
        cur.execute(
            "INSERT INTO pen_inspections (ticket_id,pen_area,cleanliness,ventilation,temperature,humidity,notes) VALUES (?,?,?,?,?,?,?)",
            p,
        )

    health_data = [
        (ticket_ids[0], "A1-P001", "猪-001", "healthy", "", "", "张三"),
        (ticket_ids[0], "A1-P002", "猪-002", "mild", "食欲下降", "消化不良", "张三"),
        (ticket_ids[1], "B2-C001", "牛-001", "healthy", "", "", "张三"),
        (ticket_ids[2], "C3-G001", "羊-001", "sick", "咳嗽、流涕", "呼吸道感染", "张三"),
        (ticket_ids[2], "C3-G002", "羊-002", "mild", "跛行", "蹄部轻微炎症", "张三"),
        (ticket_ids[3], "A1-P003", "猪-003", "healthy", "", "", "张三"),
        (ticket_ids[4], "D4-M001", "羊-001", "healthy", "", "", "张三"),
        (ticket_ids[5], "B2-C002", "牛-002", "mild", "体温偏高", "疑似感冒", "张三"),
        (ticket_ids[6], "E5-H001", "鸡-001", "critical", "大量死亡", "疑似禽流感", "张三"),
        (ticket_ids[7], "F6-P001", "猪-004", "healthy", "", "", "张三"),
        (ticket_ids[8], "G7-C001", "牛-003", "healthy", "", "", "张三"),
    ]
    for h in health_data:
        cur.execute(
            "INSERT INTO health_reports (ticket_id,animal_id,animal_tag,health_status,symptoms,diagnosis,reporter_name) VALUES (?,?,?,?,?,?,?)",
            h,
        )

    health_ids = [row[0] for row in cur.execute("SELECT id FROM health_reports ORDER BY id").fetchall()]

    treatment_data = [
        (ticket_ids[0], health_ids[1], "medication", "健胃散", "50g/头/日", "兽医赵", "2026-06-10T10:30:00", "2026-06-12"),
        (ticket_ids[2], health_ids[3], "medication", "氟苯尼考", "0.1ml/kg", "兽医赵", "2026-06-12T11:00:00", "2026-06-14"),
        (ticket_ids[2], health_ids[4], "topical", "碘伏消毒", "患处涂抹", "兽医赵", "2026-06-12T11:15:00", "2026-06-13"),
        (ticket_ids[5], health_ids[6], "medication", "安乃近", "5ml/头", "兽医赵", "2026-06-12T14:00:00", "2026-06-13"),
        (ticket_ids[6], health_ids[7], "quarantine", "隔离观察", "-", "兽医赵", "2026-06-12T09:30:00", "2026-06-15"),
    ]
    for t2 in treatment_data:
        cur.execute(
            "INSERT INTO treatment_trackings (ticket_id,health_report_id,treatment_type,medication,dosage,administered_by,administered_at,next_check_date) VALUES (?,?,?,?,?,?,?,?)",
            t2,
        )

    treatment_ids = [row[0] for row in cur.execute("SELECT id FROM treatment_trackings ORDER BY id").fetchall()]

    evidence_data = [
        (ticket_ids[0], "pen_inspection", 1, "A1栏舍日常巡检记录", 1),
        (ticket_ids[0], "health_report", 2, "猪-002健康异常报告", 1),
        (ticket_ids[0], "treatment_tracking", treatment_ids[0], "猪-002治疗跟踪", 1),
        (ticket_ids[1], "pen_inspection", 3, "B2栏舍巡检记录", 1),
        (ticket_ids[1], "health_report", 3, "牛-001健康报告", 1),
        (ticket_ids[2], "pen_inspection", 4, "C3栏舍异常巡检", 1),
        (ticket_ids[2], "health_report", 4, "羊-001呼吸道感染报告", 1),
        (ticket_ids[2], "health_report", 5, "羊-002跛行报告", 1),
        (ticket_ids[2], "treatment_tracking", treatment_ids[1], "羊-001治疗记录", 1),
        (ticket_ids[2], "treatment_tracking", treatment_ids[2], "羊-002治疗记录", 1),
        (ticket_ids[3], "pen_inspection", 5, "A1日常巡检", 1),
        (ticket_ids[3], "health_report", 6, "猪-003健康报告", 1),
        (ticket_ids[4], "pen_inspection", 6, "D4日常巡检", 1),
        (ticket_ids[4], "health_report", 7, "羊-001健康报告", 1),
        (ticket_ids[5], "pen_inspection", 7, "B2补录后复检", 1),
        (ticket_ids[5], "health_report", 8, "牛-002体温偏高报告", 1),
        (ticket_ids[5], "treatment_tracking", treatment_ids[3], "牛-002治疗跟踪", 1),
        (ticket_ids[6], "pen_inspection", 8, "E5高温高湿环境记录", 1),
        (ticket_ids[6], "health_report", 9, "鸡-001疑似禽流感报告", 1),
        (ticket_ids[6], "treatment_tracking", treatment_ids[4], "鸡-001隔离措施", 1),
        (ticket_ids[7], "pen_inspection", 9, "F6栏舍巡检记录", 1),
        (ticket_ids[7], "health_report", 10, "猪-004健康报告", 1),
        (ticket_ids[8], "pen_inspection", 10, "G7栏舍常规检查", 1),
        (ticket_ids[8], "health_report", 11, "牛-003健康报告", 1),
    ]
    for e in evidence_data:
        cur.execute(
            "INSERT INTO evidence_attachments (ticket_id,evidence_type,reference_id,description,uploaded_by) VALUES (?,?,?,?,?)",
            e,
        )

    supplement_data = [
        (ticket_ids[5], "correction", "pen_area", "B2-1号栏", "B2-1号栏（补录后复检）", "原记录遗漏复检标记", 1, "2026-06-12T13:00:00", 5),
        (ticket_ids[5], "correction", "temperature", "18.0", "19.0", "温度计校准后修正", 1, "2026-06-12T13:05:00", 6),
    ]
    for s in supplement_data:
        cur.execute(
            "INSERT INTO supplement_records (ticket_id,supplement_type,field_name,old_value,new_value,reason,operated_by,operated_at,version_after) VALUES (?,?,?,?,?,?,?,?,?)",
            s,
        )

    workflow_data = [
        (ticket_ids[0], "submit", "draft", "submitted", 1, "2026-06-10T09:30:00", "提交审核"),
        (ticket_ids[0], "review", "submitted", "under_review", 2, "2026-06-10T10:00:00", "开始审核"),
        (ticket_ids[0], "approve_review", "under_review", "reviewed", 2, "2026-06-10T14:00:00", "审核通过"),
        (ticket_ids[0], "archive", "reviewed", "archived", 3, "2026-06-10T16:00:00", "归档完成"),
        (ticket_ids[1], "submit", "draft", "submitted", 1, "2026-06-11T09:15:00", ""),
        (ticket_ids[1], "review", "submitted", "under_review", 2, "2026-06-11T10:00:00", ""),
        (ticket_ids[1], "approve_review", "under_review", "reviewed", 2, "2026-06-11T15:00:00", "审核通过待复核"),
        (ticket_ids[5], "submit", "draft", "submitted", 1, "2026-06-12T08:00:00", "首次提交"),
        (ticket_ids[6], "submit", "draft", "submitted", 1, "2026-06-12T08:00:00", ""),
        (ticket_ids[3], "submit", "draft", "submitted", 1, "2026-06-12T08:15:00", ""),
        (ticket_ids[2], "submit", "draft", "submitted", 1, "2026-06-12T08:30:00", ""),
        (ticket_ids[6], "review", "submitted", "under_review", 2, "2026-06-12T08:30:00", ""),
        (ticket_ids[3], "review", "submitted", "under_review", 2, "2026-06-12T08:45:00", ""),
        (ticket_ids[6], "reject", "under_review", "rejected", 2, "2026-06-12T09:00:00", "疑似禽流感需上报，巡检单流程终止"),
        (ticket_ids[7], "submit", "draft", "submitted", 1, "2026-06-12T09:00:00", ""),
        (ticket_ids[3], "return", "under_review", "returned", 2, "2026-06-12T09:15:00", "数据存疑，退回补正"),
        (ticket_ids[5], "review", "submitted", "under_review", 2, "2026-06-12T09:30:00", ""),
        (ticket_ids[7], "review", "submitted", "under_review", 2, "2026-06-12T09:45:00", ""),
        (ticket_ids[8], "submit", "draft", "submitted", 1, "2026-06-12T09:45:00", ""),
        (ticket_ids[3], "resubmit", "returned", "submitted", 1, "2026-06-12T10:00:00", "补正后重新提交"),
        (ticket_ids[5], "return", "under_review", "returned", 2, "2026-06-12T10:00:00", "温度数据存疑，请补录修正"),
        (ticket_ids[7], "return", "under_review", "returned", 2, "2026-06-12T10:15:00", "审核退回补充"),
        (ticket_ids[8], "review", "submitted", "under_review", 2, "2026-06-12T10:15:00", ""),
        (ticket_ids[8], "return", "under_review", "returned", 2, "2026-06-12T10:25:00", "第一次退回"),
        (ticket_ids[2], "review", "submitted", "under_review", 2, "2026-06-12T10:30:00", "[批次PL-20260612-001] 批量开始审核"),
        (ticket_ids[8], "resubmit", "returned", "submitted", 1, "2026-06-12T10:45:00", "第一次重新提交"),
        (ticket_ids[8], "review", "submitted", "under_review", 2, "2026-06-12T10:50:00", ""),
        (ticket_ids[8], "return", "under_review", "returned", 2, "2026-06-12T10:55:00", "第二次退回"),
        (ticket_ids[4], "submit", "draft", "submitted", 1, "2026-06-12T11:00:00", "[批次PL-20260612-002] 批量提交"),
        (ticket_ids[5], "resubmit", "returned", "submitted", 1, "2026-06-12T13:10:00", "已补录修正后重新提交"),
    ]
    for w in workflow_data:
        cur.execute(
            "INSERT INTO workflow_logs (ticket_id,action,from_status,to_status,operated_by,operated_at,comment) VALUES (?,?,?,?,?,?,?)",
            w,
        )

    batch_data = [
        ("PL-20260612-001", "review", 2, "2026-06-12T10:30:00", 6, 1, 5, "日常批量审核"),
        ("PL-20260612-002", "submit", 1, "2026-06-12T11:00:00", 4, 1, 3, "登记员批量提交演示"),
    ]
    for b in batch_data:
        cur.execute(
            "INSERT INTO batch_operations (batch_no,action,operated_by,operated_at,total_count,success_count,error_count,comment) VALUES (?,?,?,?,?,?,?,?)",
            b,
        )

    batch_ids = [row[0] for row in cur.execute("SELECT id FROM batch_operations ORDER BY id").fetchall()]

    batch_items = [
        (batch_ids[0], ticket_ids[2], "XJ-20260612-001", 1, None, "submitted", "under_review"),
        (batch_ids[0], ticket_ids[3], "XJ-20260612-002", 0, "版本冲突: 当前版本为5，提交版本为1，数据可能已被他人修改，请刷新后重试", "submitted", None),
        (batch_ids[0], ticket_ids[0], "XJ-20260610-001", 0, "角色[审核主管]不能对状态为[已归档]的巡检单执行操作", "archived", None),
        (batch_ids[0], ticket_ids[5], "XJ-20260612-004", 0, "角色[审核主管]不能对状态为[已退回]的巡检单执行操作", "returned", None),
        (batch_ids[0], ticket_ids[6], "XJ-20260612-005", 0, "角色[审核主管]不能对状态为[已驳回]的巡检单执行操作", "rejected", None),
        (batch_ids[0], ticket_ids[4], "XJ-20260612-003", 0, "角色[审核主管]不能对状态为[草稿]的巡检单执行操作", "draft", None),
        (batch_ids[1], ticket_ids[4], "XJ-20260612-003", 1, None, "draft", "submitted"),
        (batch_ids[1], ticket_ids[9], "XJ-20260612-008", 0, "证据不足: 执行[submit]操作至少需要2条证据，当前仅有0条", "draft", None),
        (batch_ids[1], ticket_ids[2], "XJ-20260612-001", 0, "角色[登记员]无权执行[submit]操作", "under_review", None),
        (batch_ids[1], ticket_ids[7], "XJ-20260612-006", 0, "版本号缺失: 批量操作需携带每条巡检单的版本号", "returned", None),
    ]
    for bi in batch_items:
        cur.execute(
            "INSERT INTO batch_operation_items (batch_id,ticket_id,ticket_no,success,error_reason,old_status,new_status) VALUES (?,?,?,?,?,?,?)",
            bi,
        )

    conn.commit()
    conn.close()
