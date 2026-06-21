import sqlite3
import uuid
import os
import hashlib
import hmac
from datetime import datetime
from .config import DB_PATH

HASH_SALT = "medical-events-demo-salt"

def hash_password(password: str) -> str:
    return hashlib.sha256((password + HASH_SALT).encode()).hexdigest()

def verify_password(password: str, password_hash: str) -> bool:
    return hmac.compare_digest(hash_password(password), password_hash)

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            scan_token TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            event_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            current_handler_role TEXT DEFAULT NULL,
            created_by INTEGER REFERENCES users(id),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deadline TEXT,
            version INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            material_type TEXT NOT NULL,
            content TEXT DEFAULT '',
            step TEXT NOT NULL DEFAULT 'draft',
            uploaded_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            action_type TEXT NOT NULL,
            opinion TEXT DEFAULT '',
            result TEXT DEFAULT '',
            actor_id INTEGER REFERENCES users(id),
            actor_role TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS scan_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            event_id INTEGER,
            scanner_id INTEGER REFERENCES users(id),
            scanner_role TEXT NOT NULL,
            success INTEGER NOT NULL DEFAULT 0,
            message TEXT DEFAULT '',
            scanned_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER REFERENCES events(id),
            action TEXT NOT NULL,
            actor_id INTEGER REFERENCES users(id),
            actor_role TEXT NOT NULL,
            detail TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()

def generate_code(prefix="INC"):
    now = datetime.now()
    short_uuid = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{now.strftime('%Y%m%d')}-{short_uuid}"

def generate_scan_token():
    return uuid.uuid4().hex[:12]

def row_to_dict(row):
    if row is None:
        return None
    return dict(row)

def seed_data():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM users")
    if c.fetchone()[0] > 0:
        conn.close()
        return
    now = datetime.now().isoformat()
    users = [
        ("zhangsan", hash_password("123456"), "张三", "registrar"),
        ("lisi", hash_password("123456"), "李四", "supervisor"),
        ("wangwu", hash_password("123456"), "王五", "reviewer"),
    ]
    c.executemany("INSERT INTO users (username, password_hash, name, role) VALUES (?,?,?,?)", users)

    deadline1 = "2026-07-31T23:59:59"
    deadline2 = "2026-07-15T23:59:59"
    deadline3 = "2026-08-31T23:59:59"
    deadline4 = "2026-06-30T23:59:59"

    events_data = [
        ("INC-20260601-A1B2C3", "a1b2c3d4e5f6", "患者跌倒不良事件", "住院部3楼走廊患者滑倒", "adverse_event", "moderate", "draft", "registrar", 1, now, now, deadline1, 1),
        ("INC-20260602-D4E5F6", "d4e5f6a1b2c3", "用药错误上报", "护士给患者发错药物", "incident_report", "major", "submitted", "supervisor", 1, now, now, deadline2, 1),
        ("INC-20260603-G7H8I9", "g7h8i9j0k1l2", "手术器械消毒不合格整改", "手术器械消毒流程不合规", "rectification_tracking", "critical", "review_passed", "reviewer", 1, now, now, deadline3, 2),
        ("INC-20260604-J0K1L2", "j0k1l2m3n4o5", "输血反应不良事件", "患者输血后出现过敏反应", "adverse_event", "major", "review_rejected", "registrar", 1, now, now, deadline4, 2),
        ("INC-20260605-M3N4O5", "m3n4o5p6q7r8", "院内感染事件上报", "ICU病房发现多重耐药菌感染", "incident_report", "critical", "archive_rejected", "supervisor", 1, now, now, deadline1, 3),
        ("INC-20260606-P6Q7R8", "p6q7r8s9t0u1", "医疗器械故障不良事件", "呼吸机运行中突发故障", "adverse_event", "critical", "archived", None, 1, now, now, deadline2, 4),
        ("INC-20260607-S9T0U1", "s9t0u1v2w3x4", "药物不良反应上报", "患者使用新药后出现皮疹", "incident_report", "minor", "submitted", "supervisor", 1, now, now, deadline3, 1),
        ("INC-20260608-V2W3X4", "v2w3x4y5z6a7", "护理差错整改追踪", "未按时执行医嘱导致延误", "rectification_tracking", "moderate", "review_passed", "reviewer", 1, now, now, deadline4, 2),
    ]
    c.executemany(
        "INSERT INTO events (code, scan_token, title, description, event_type, severity, status, current_handler_role, created_by, created_at, updated_at, deadline, version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        events_data,
    )

    materials_data = [
        (1, "跌倒现场照片", "image", "现场走廊湿滑照片", "draft", now),
        (1, "患者病历摘要", "document", "患者入院评估及护理记录", "draft", now),
        (2, "发药记录单", "document", "当班护士发药记录", "draft", now),
        (2, "医嘱原件", "document", "主治医师开具的用药医嘱", "draft", now),
        (3, "消毒流程检测报告", "document", "消毒效果生物监测报告", "draft", now),
        (3, "整改方案", "document", "器械消毒流程整改方案", "submitted", now),
        (4, "输血记录单", "document", "输血操作记录", "draft", now),
        (4, "过敏反应处理记录", "document", "不良反应处理及后续观察记录", "draft", now),
        (5, "ICU环境采样报告", "document", "病房环境微生物采样检测", "draft", now),
        (5, "感染防控措施", "document", "院感科提出的防控措施", "submitted", now),
        (6, "设备维修记录", "document", "呼吸机故障维修报告", "draft", now),
        (6, "替代方案确认", "document", "备用呼吸机启用确认单", "submitted", now),
        (7, "皮疹照片", "image", "患者用药后皮疹照片", "draft", now),
        (8, "医嘱执行延误说明", "document", "护理部对延误原因的说明", "draft", now),
        (8, "整改措施", "document", "护理流程改进措施", "submitted", now),
    ]
    c.executemany(
        "INSERT INTO materials (event_id, name, material_type, content, step, uploaded_at) VALUES (?,?,?,?,?,?)",
        materials_data,
    )

    actions_data = [
        (2, "submit", "", "", 1, "registrar", now),
        (3, "submit", "", "", 1, "registrar", now),
        (3, "review", "材料齐全，同意通过审核", "pass", 2, "supervisor", now),
        (4, "submit", "", "", 1, "registrar", now),
        (4, "review", "材料不完整，需补充过敏原检测报告", "reject", 2, "supervisor", now),
        (5, "submit", "", "", 1, "registrar", now),
        (5, "review", "审核通过，转复核", "pass", 2, "supervisor", now),
        (5, "archive_review", "防控措施落实不到位，需补充整改证据", "reject", 3, "reviewer", now),
        (6, "submit", "", "", 1, "registrar", now),
        (6, "review", "审核通过", "pass", 2, "supervisor", now),
        (6, "archive_review", "整改到位，同意归档", "archive", 3, "reviewer", now),
        (7, "submit", "", "", 1, "registrar", now),
        (8, "submit", "", "", 1, "registrar", now),
        (8, "review", "整改措施可行，通过", "pass", 2, "supervisor", now),
    ]
    c.executemany(
        "INSERT INTO actions (event_id, action_type, opinion, result, actor_id, actor_role, created_at) VALUES (?,?,?,?,?,?,?)",
        actions_data,
    )

    audit_data = [
        (2, "submit", 1, "registrar", "登记员提交事件", now),
        (3, "submit", 1, "registrar", "登记员提交事件", now),
        (3, "review_pass", 2, "supervisor", "审核主管通过审核", now),
        (4, "submit", 1, "registrar", "登记员提交事件", now),
        (4, "review_reject", 2, "supervisor", "审核主管退回：材料不完整", now),
        (5, "submit", 1, "registrar", "登记员提交事件", now),
        (5, "review_pass", 2, "supervisor", "审核主管通过审核", now),
        (5, "archive_reject", 3, "reviewer", "复核负责人退回：防控措施不到位", now),
        (6, "submit", 1, "registrar", "登记员提交事件", now),
        (6, "review_pass", 2, "supervisor", "审核主管通过审核", now),
        (6, "archive", 3, "reviewer", "复核负责人归档", now),
        (7, "submit", 1, "registrar", "登记员提交事件", now),
        (8, "submit", 1, "registrar", "登记员提交事件", now),
        (8, "review_pass", 2, "supervisor", "审核主管通过审核", now),
    ]
    c.executemany(
        "INSERT INTO audit_log (event_id, action, actor_id, actor_role, detail, created_at) VALUES (?,?,?,?,?,?)",
        audit_data,
    )

    conn.commit()
    conn.close()
