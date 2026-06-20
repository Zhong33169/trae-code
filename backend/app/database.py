import sqlite3
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = os.environ.get("SCHEDULING_DB_PATH", str(Path(__file__).parent.parent / "scheduling.db"))

STATUSES = [
    "draft",
    "pending_review",
    "reviewing",
    "pending_courseware",
    "courseware_reviewing",
    "pending_teaching",
    "teaching_completed",
    "pending_evaluation",
    "evaluating",
    "pending_archive",
    "archived",
    "rejected",
    "timeout_handling",
]

STATUS_LABELS = {
    "draft": "草稿",
    "pending_review": "待审核",
    "reviewing": "审核中",
    "pending_courseware": "待课件审核",
    "courseware_reviewing": "课件审核中",
    "pending_teaching": "待授课",
    "teaching_completed": "授课完成",
    "pending_evaluation": "待课后评价",
    "evaluating": "评价中",
    "pending_archive": "待归档",
    "archived": "已归档",
    "rejected": "已驳回",
    "timeout_handling": "超时处理中",
}

ROLE_CLERK = "clerk"
ROLE_SUPERVISOR = "supervisor"
ROLE_MANAGER = "manager"

ROLES = [ROLE_CLERK, ROLE_SUPERVISOR, ROLE_MANAGER]

ROLE_LABELS = {
    ROLE_CLERK: "讲师排课登记员",
    ROLE_SUPERVISOR: "讲师排课审核主管",
    ROLE_MANAGER: "企业培训公司复核负责人",
}

NODE_TIME_LIMITS = {
    "pending_review": 48,
    "reviewing": 24,
    "pending_courseware": 48,
    "courseware_reviewing": 24,
    "pending_teaching": 72,
    "pending_evaluation": 48,
    "evaluating": 24,
    "pending_archive": 48,
}

NEXT_STATUS_MAP = {
    ROLE_CLERK: {
        "draft": "pending_review",
        "rejected": "pending_review",
        "timeout_handling": "pending_review",
    },
    ROLE_SUPERVISOR: {
        "pending_review": "reviewing",
        "reviewing": "pending_courseware",
    },
    ROLE_MANAGER: {
        "pending_courseware": "courseware_reviewing",
        "courseware_reviewing": "pending_teaching",
        "pending_teaching": "teaching_completed",
        "teaching_completed": "pending_evaluation",
        "pending_evaluation": "evaluating",
        "evaluating": "pending_archive",
        "pending_archive": "archived",
    },
}

REJECT_MAP = {
    ROLE_SUPERVISOR: ["pending_review", "reviewing"],
    ROLE_MANAGER: ["pending_courseware", "courseware_reviewing", "pending_evaluation", "evaluating"],
}

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('clerk','supervisor','manager')),
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS scheduling_forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_no TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        instructor_name TEXT NOT NULL,
        instructor_id TEXT,
        course_name TEXT NOT NULL,
        course_type TEXT,
        training_company TEXT,
        start_date TEXT,
        end_date TEXT,
        location TEXT,
        student_count INTEGER DEFAULT 0,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        created_by INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        current_node_entered_at TEXT,
        courseware_status TEXT DEFAULT 'pending',
        evaluation_status TEXT DEFAULT 'pending',
        FOREIGN KEY (created_by) REFERENCES users(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS node_time_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_name TEXT NOT NULL,
        hours INTEGER NOT NULL,
        description TEXT
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS timeout_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER NOT NULL,
        node_name TEXT NOT NULL,
        timeout_at TEXT NOT NULL,
        reason TEXT,
        follow_up TEXT,
        handled_by INTEGER,
        handled_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (form_id) REFERENCES scheduling_forms(id),
        FOREIGN KEY (handled_by) REFERENCES users(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER NOT NULL,
        operator_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        remark TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (form_id) REFERENCES scheduling_forms(id),
        FOREIGN KEY (operator_id) REFERENCES users(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS courseware_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER NOT NULL,
        reviewer_id INTEGER NOT NULL,
        result TEXT NOT NULL CHECK(result IN ('approved','rejected')),
        comment TEXT,
        reviewed_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (form_id) REFERENCES scheduling_forms(id),
        FOREIGN KEY (reviewer_id) REFERENCES users(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER NOT NULL,
        evaluator_id INTEGER NOT NULL,
        score INTEGER CHECK(score BETWEEN 1 AND 100),
        comment TEXT,
        evaluated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (form_id) REFERENCES scheduling_forms(id),
        FOREIGN KEY (evaluator_id) REFERENCES users(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS instructor_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER NOT NULL,
        instructor_name TEXT NOT NULL,
        schedule_date TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','confirmed','completed','cancelled')),
        remark TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (form_id) REFERENCES scheduling_forms(id)
    )
    """)

    for node, hours in NODE_TIME_LIMITS.items():
        c.execute(
            "INSERT OR IGNORE INTO node_time_limits (node_name, hours, description) VALUES (?, ?, ?)",
            (node, hours, f"{STATUS_LABELS.get(node, node)}节点时限{hours}小时"),
        )

    demo_users = [
        ("clerk1", "clerk1", ROLE_CLERK, "张登记"),
        ("supervisor1", "supervisor1", ROLE_SUPERVISOR, "李审核"),
        ("manager1", "manager1", ROLE_MANAGER, "王复核"),
    ]
    for u in demo_users:
        try:
            c.execute(
                "INSERT OR IGNORE INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)",
                (u[0], u[1], u[2], u[3]),
            )
        except sqlite3.IntegrityError:
            pass

    demo_forms = [
        {
            "form_no": "PK-2026-001",
            "title": "Python高级编程培训",
            "instructor_name": "赵讲师",
            "instructor_id": "INS-001",
            "course_name": "Python高级编程",
            "course_type": "技术培训",
            "training_company": "智联培训公司",
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
            "location": "培训中心A-301",
            "student_count": 30,
            "description": "面向企业开发人员的Python高级编程技能提升培训",
            "status": "pending_review",
            "created_by": 1,
            "courseware_status": "pending",
            "evaluation_status": "pending",
        },
        {
            "form_no": "PK-2026-002",
            "title": "项目管理实战培训",
            "instructor_name": "钱讲师",
            "instructor_id": "INS-002",
            "course_name": "项目管理实战",
            "course_type": "管理培训",
            "training_company": "智联培训公司",
            "start_date": "2026-07-10",
            "end_date": "2026-07-12",
            "location": "培训中心B-205",
            "student_count": 25,
            "description": "PMP项目管理方法论实战培训",
            "status": "reviewing",
            "created_by": 1,
            "courseware_status": "pending",
            "evaluation_status": "pending",
        },
        {
            "form_no": "PK-2026-003",
            "title": "数据分析与可视化培训",
            "instructor_name": "孙讲师",
            "instructor_id": "INS-003",
            "course_name": "数据分析与可视化",
            "course_type": "技术培训",
            "training_company": "华信培训公司",
            "start_date": "2026-07-15",
            "end_date": "2026-07-18",
            "location": "培训中心A-102",
            "student_count": 20,
            "description": "基于Python的数据分析与可视化技能培训",
            "status": "pending_courseware",
            "created_by": 1,
            "courseware_status": "pending",
            "evaluation_status": "pending",
        },
        {
            "form_no": "PK-2026-004",
            "title": "领导力发展培训",
            "instructor_name": "李讲师",
            "instructor_id": "INS-004",
            "course_name": "领导力发展",
            "course_type": "管理培训",
            "training_company": "智联培训公司",
            "start_date": "2026-06-20",
            "end_date": "2026-06-22",
            "location": "培训中心C-401",
            "student_count": 15,
            "description": "中高层管理者领导力提升培训",
            "status": "pending_archive",
            "created_by": 1,
            "courseware_status": "approved",
            "evaluation_status": "completed",
        },
        {
            "form_no": "PK-2026-005",
            "title": "新员工入职培训",
            "instructor_name": "周讲师",
            "instructor_id": "INS-005",
            "course_name": "新员工入职培训",
            "course_type": "综合培训",
            "training_company": "华信培训公司",
            "start_date": "2026-06-10",
            "end_date": "2026-06-11",
            "location": "培训中心A-301",
            "student_count": 40,
            "description": "2026年新员工入职培训课程",
            "status": "archived",
            "created_by": 1,
            "courseware_status": "approved",
            "evaluation_status": "completed",
        },
    ]

    now = datetime.now()
    for f in demo_forms:
        try:
            entered_at = (now - timedelta(hours=12)).strftime("%Y-%m-%d %H:%M:%S")
            if f["status"] in ("pending_archive", "archived"):
                entered_at = (now - timedelta(hours=120)).strftime("%Y-%m-%d %H:%M:%S")
            c.execute(
                """INSERT OR IGNORE INTO scheduling_forms
                (form_no, title, instructor_name, instructor_id, course_name, course_type,
                 training_company, start_date, end_date, location, student_count, description,
                 status, created_by, current_node_entered_at, courseware_status, evaluation_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    f["form_no"], f["title"], f["instructor_name"], f["instructor_id"],
                    f["course_name"], f["course_type"], f["training_company"],
                    f["start_date"], f["end_date"], f["location"], f["student_count"],
                    f["description"], f["status"], f["created_by"], entered_at,
                    f["courseware_status"], f["evaluation_status"],
                ),
            )
        except sqlite3.IntegrityError:
            pass

    demo_schedules = [
        (1, "赵讲师", "2026-07-01", "09:00-12:00", "planned", "第一天上午"),
        (1, "赵讲师", "2026-07-01", "14:00-17:00", "planned", "第一天下午"),
        (1, "赵讲师", "2026-07-02", "09:00-12:00", "planned", "第二天上午"),
        (2, "钱讲师", "2026-07-10", "09:00-17:00", "planned", "全天"),
        (2, "钱讲师", "2026-07-11", "09:00-17:00", "planned", "全天"),
        (4, "李讲师", "2026-06-20", "09:00-17:00", "completed", "全天"),
    ]
    for s in demo_schedules:
        c.execute(
            """INSERT OR IGNORE INTO instructor_schedules
            (form_id, instructor_name, schedule_date, time_slot, status, remark)
            VALUES (?, ?, ?, ?, ?, ?)""",
            s,
        )

    c.execute(
        """INSERT OR IGNORE INTO evaluations (form_id, evaluator_id, score, comment)
        VALUES (?, ?, ?, ?)""",
        (4, 3, 92, "培训效果良好，学员反馈积极"),
    )

    conn.commit()
    conn.close()

def check_timeouts():
    conn = get_db()
    c = conn.cursor()
    now = datetime.now()
    c.execute("""
        SELECT sf.id, sf.status, sf.current_node_entered_at, sf.form_no
        FROM scheduling_forms sf
        WHERE sf.status NOT IN ('draft', 'archived', 'rejected')
        AND sf.current_node_entered_at IS NOT NULL
    """)
    timeout_forms = []
    for row in c.fetchall():
        entered = datetime.strptime(row["current_node_entered_at"], "%Y-%m-%d %H:%M:%S")
        limit_hours = NODE_TIME_LIMITS.get(row["status"])
        if limit_hours and (now - entered).total_seconds() > limit_hours * 3600:
            existing = c.execute(
                "SELECT id FROM timeout_records WHERE form_id=? AND node_name=? AND status='pending'",
                (row["id"], row["status"]),
            ).fetchone()
            if not existing:
                timeout_at = (entered + timedelta(hours=limit_hours)).strftime("%Y-%m-%d %H:%M:%S")
                c.execute(
                    """INSERT INTO timeout_records (form_id, node_name, timeout_at, status)
                    VALUES (?, ?, ?, 'pending')""",
                    (row["id"], row["status"], timeout_at),
                )
                timeout_forms.append(row["id"])
    conn.commit()
    conn.close()
    return timeout_forms
