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

FIELD_VISIBILITY = {
    ROLE_CLERK: [
        "id", "form_no", "title", "instructor_name", "instructor_id", "course_name",
        "course_type", "training_company", "start_date", "end_date", "location",
        "student_count", "description", "status", "status_label", "created_by",
        "created_by_name", "created_at", "updated_at", "courseware_status",
        "evaluation_status", "is_timeout", "timeout_remaining_hours", "has_pending_timeout",
    ],
    ROLE_SUPERVISOR: [
        "id", "form_no", "title", "instructor_name", "instructor_id", "course_name",
        "course_type", "training_company", "start_date", "end_date", "location",
        "student_count", "description", "status", "status_label", "created_by",
        "created_by_name", "created_at", "updated_at", "current_node_entered_at",
        "courseware_status", "evaluation_status", "is_timeout", "timeout_remaining_hours",
    ],
    ROLE_MANAGER: [
        "id", "form_no", "title", "instructor_name", "instructor_id", "course_name",
        "course_type", "training_company", "start_date", "end_date", "location",
        "student_count", "description", "status", "status_label", "created_by",
        "created_by_name", "created_at", "updated_at", "current_node_entered_at",
        "courseware_status", "evaluation_status", "is_timeout", "timeout_remaining_hours",
        "has_pending_timeout",
    ],
}

ALL_FIELDS = list({field for fields in FIELD_VISIBILITY.values() for field in fields})

FIELD_LABELS = {
    "id": "ID",
    "form_no": "排课单号",
    "title": "标题",
    "instructor_name": "讲师姓名",
    "instructor_id": "讲师编号",
    "course_name": "课程名称",
    "course_type": "课程类型",
    "training_company": "培训公司",
    "start_date": "开始日期",
    "end_date": "结束日期",
    "location": "培训地点",
    "student_count": "学员人数",
    "description": "描述",
    "status": "状态",
    "status_label": "状态名称",
    "created_by": "创建人ID",
    "created_by_name": "创建人",
    "created_at": "创建时间",
    "updated_at": "更新时间",
    "current_node_entered_at": "节点进入时间",
    "courseware_status": "课件审核状态",
    "evaluation_status": "课后评价状态",
    "is_timeout": "是否超时",
    "timeout_remaining_hours": "超时剩余时间",
    "has_pending_timeout": "有待处理超时",
}

SUBMIT_ACTION_STRATEGY = {
    ROLE_CLERK: {
        "draft": [
            {"action": "submit", "label": "提交审核", "requires_remark": False},
        ],
        "rejected": [
            {"action": "submit", "label": "重新提交", "requires_remark": True, "remark_label": "补正说明"},
        ],
        "timeout_handling": [
            {"action": "submit", "label": "重新提交审核", "requires_remark": True, "remark_label": "补正说明"},
        ],
    },
    ROLE_SUPERVISOR: {
        "pending_review": [
            {"action": "submit", "label": "审核通过", "requires_remark": False},
            {"action": "reject", "label": "驳回", "requires_remark": True, "remark_label": "驳回原因"},
        ],
        "reviewing": [
            {"action": "submit", "label": "审核通过", "requires_remark": False},
            {"action": "reject", "label": "驳回", "requires_remark": True, "remark_label": "驳回原因"},
        ],
    },
    ROLE_MANAGER: {
        "pending_courseware": [
            {"action": "courseware_review", "label": "课件审核", "requires_result": True, "requires_comment": True},
        ],
        "courseware_reviewing": [
            {"action": "courseware_review", "label": "课件审核", "requires_result": True, "requires_comment": True},
        ],
        "pending_teaching": [
            {"action": "confirm_teaching", "label": "确认授课完成", "requires_remark": False},
        ],
        "teaching_completed": [
            {"action": "submit", "label": "进入课后评价", "requires_remark": False},
        ],
        "pending_evaluation": [
            {"action": "evaluate", "label": "提交评价", "requires_score": True, "requires_comment": True},
            {"action": "reject", "label": "驳回评价", "requires_remark": True, "remark_label": "驳回原因"},
        ],
        "evaluating": [
            {"action": "evaluate", "label": "提交评价", "requires_score": True, "requires_comment": True},
            {"action": "reject", "label": "驳回评价", "requires_remark": True, "remark_label": "驳回原因"},
        ],
        "pending_archive": [
            {"action": "archive", "label": "归档", "requires_remark": False},
        ],
    },
}


def enrich_form(conn, form_dict):
    c = conn.cursor()
    form_id = form_dict.get("id")
    if not form_id:
        return form_dict

    result = dict(form_dict)

    creator = c.execute(
        "SELECT display_name FROM users WHERE id=?",
        (form_dict.get("created_by"),),
    ).fetchone()
    if creator:
        result["created_by_name"] = creator["display_name"]

    pending_timeout = c.execute(
        "SELECT id, node_name, timeout_at FROM timeout_records WHERE form_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1",
        (form_id,),
    ).fetchone()

    result["has_pending_timeout"] = pending_timeout is not None

    current_status = form_dict.get("status")
    current_node_entered_at = form_dict.get("current_node_entered_at")

    if current_status in NODE_TIME_LIMITS and current_node_entered_at:
        try:
            now = datetime.now()
            entered = datetime.strptime(current_node_entered_at, "%Y-%m-%d %H:%M:%S")
            limit_hours = NODE_TIME_LIMITS[current_status]
            elapsed_hours = (now - entered).total_seconds() / 3600
            remaining_hours = limit_hours - elapsed_hours

            result["timeout_remaining_hours"] = round(remaining_hours, 1)
            result["is_timeout"] = remaining_hours < 0 or pending_timeout is not None
        except (ValueError, TypeError):
            result["timeout_remaining_hours"] = None
            result["is_timeout"] = pending_timeout is not None
    else:
        result["timeout_remaining_hours"] = None
        result["is_timeout"] = pending_timeout is not None

    return result


def apply_visibility(form_dict, role):
    allowed = FIELD_VISIBILITY.get(role, [])
    return {k: v for k, v in form_dict.items() if k in allowed}


def get_visible_fields(role):
    return [
        {"field": f, "label": FIELD_LABELS.get(f, f)}
        for f in FIELD_VISIBILITY.get(role, [])
    ]


def get_submit_actions(role, status, form_id=None, conn=None):
    role_actions = SUBMIT_ACTION_STRATEGY.get(role, {})
    status_actions = list(role_actions.get(status, []))

    if role == ROLE_CLERK and form_id and conn:
        pending = conn.execute(
            "SELECT id FROM timeout_records WHERE form_id=? AND status='pending' LIMIT 1",
            (form_id,),
        ).fetchone()
        if pending:
            timeout_action = {
                "action": "timeout_handle",
                "label": "超时处理",
                "requires_reason": True,
                "requires_follow_up": True,
            }
            status_actions.insert(0, timeout_action)

    return status_actions


def state_machine_transition(conn, form_id, role, action, **kwargs):
    c = conn.cursor()
    row = c.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    if not row:
        raise ValueError(f"排课单 {form_id} 不存在")
    current_status = row["status"]
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    new_status = None
    action_type = action

    if action == "submit":
        role_map = NEXT_STATUS_MAP.get(role, {})
        if current_status not in role_map:
            raise ValueError(f"角色 {role} 无法从 {current_status} 提交")
        new_status = role_map[current_status]
    elif action == "reject":
        if current_status not in REJECT_MAP.get(role, []):
            raise ValueError(f"角色 {role} 无法驳回 {current_status}")
        new_status = "rejected"
    elif action == "timeout_handle":
        if role != ROLE_CLERK:
            raise ValueError("只有登记员可处理超时")
        pending_timeout = c.execute(
            "SELECT id FROM timeout_records WHERE form_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1",
            (form_id,),
        ).fetchone()
        if not pending_timeout:
            raise ValueError("该排课单没有待处理的超时记录")
        reason = kwargs.get("reason")
        follow_up = kwargs.get("follow_up")
        operator_id = kwargs.get("operator_id")
        if not reason or not follow_up:
            raise ValueError("超时处理必须填写原因和后续处理记录")
        c.execute(
            """UPDATE timeout_records
            SET reason=?, follow_up=?, handled_by=?, handled_at=?, status='handled'
            WHERE id=?""",
            (reason, follow_up, operator_id, current_time, pending_timeout["id"]),
        )
        new_status = "timeout_handling"
    elif action == "archive":
        if role != ROLE_MANAGER or current_status != "pending_archive":
            raise ValueError("只有复核负责人可归档")
        new_status = "archived"
    elif action == "courseware_review":
        if role != ROLE_MANAGER:
            raise ValueError("只有复核负责人可审核课件")
        result = kwargs.get("result")
        if result == "approved":
            new_status = "pending_teaching"
        else:
            new_status = "rejected"
        action_type = "courseware_review"
    elif action == "evaluate":
        if role != ROLE_MANAGER:
            raise ValueError("只有复核负责人可评价")
        new_status = "pending_archive"
        action_type = "evaluate"
    elif action == "confirm_teaching":
        if role != ROLE_MANAGER or current_status != "pending_teaching":
            raise ValueError("只有复核负责人可确认授课")
        schedules = c.execute(
            "SELECT id FROM instructor_schedules WHERE form_id=? AND status != 'completed'",
            (form_id,),
        ).fetchall()
        for s in schedules:
            c.execute(
                "UPDATE instructor_schedules SET status='completed' WHERE id=?",
                (s["id"],),
            )
        sched_completed = c.execute(
            "SELECT COUNT(*) FROM instructor_schedules WHERE form_id=? AND status='completed'",
            (form_id,),
        ).fetchone()[0]
        sched_total = c.execute(
            "SELECT COUNT(*) FROM instructor_schedules WHERE form_id=?",
            (form_id,),
        ).fetchone()[0]
        if sched_completed == sched_total and sched_total > 0:
            new_status = "pending_evaluation"
        else:
            new_status = "teaching_completed"
        action_type = "confirm_teaching"
    else:
        raise ValueError(f"不支持的操作: {action}")

    c.execute(
        "UPDATE scheduling_forms SET status=?, updated_at=?, current_node_entered_at=? WHERE id=?",
        (new_status, current_time, current_time, form_id),
    )

    if action == "courseware_review":
        result = kwargs.get("result")
        c.execute(
            "UPDATE scheduling_forms SET courseware_status=? WHERE id=?",
            ("approved" if result == "approved" else "rejected", form_id),
        )
    elif action == "evaluate":
        c.execute(
            "UPDATE scheduling_forms SET evaluation_status='completed' WHERE id=?",
            (form_id,),
        )
    elif new_status == "rejected":
        c.execute(
            "UPDATE timeout_records SET status='cancelled' WHERE form_id=? AND status='pending'",
            (form_id,),
        )

    remark = kwargs.get("remark", "")
    if action == "courseware_review":
        result = kwargs.get("result", "")
        comment = kwargs.get("comment", "")
        remark = f"课件审核{('通过' if result == 'approved' else '驳回')}: {comment}"
    elif action == "evaluate":
        score = kwargs.get("score", 0)
        comment = kwargs.get("comment", "")
        remark = f"课后评价: 分数{score}, {comment}"
    elif action == "timeout_handle":
        reason = kwargs.get("reason", "")
        follow_up = kwargs.get("follow_up", "")
        remark = f"超时处理: 原因={reason}, 后续处理={follow_up}"

    c.execute(
        """INSERT INTO operation_logs (form_id, operator_id, action, from_status, to_status, remark)
        VALUES (?, ?, ?, ?, ?, ?)""",
        (form_id, kwargs.get("operator_id"), action_type, current_status, new_status, remark),
    )

    return new_status, current_status, current_time



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
        {
            "form_no": "PK-2026-006",
            "title": "云原生架构与微服务培训",
            "instructor_name": "吴讲师",
            "instructor_id": "INS-006",
            "course_name": "云原生架构与微服务",
            "course_type": "技术培训",
            "training_company": "智联培训公司",
            "start_date": "2026-06-25",
            "end_date": "2026-06-28",
            "location": "培训中心A-201",
            "student_count": 18,
            "description": "面向架构师和高级开发的云原生架构培训",
            "status": "pending_teaching",
            "created_by": 1,
            "courseware_status": "approved",
            "evaluation_status": "pending",
        },
        {
            "form_no": "PK-2026-007",
            "title": "敏捷开发与Scrum实战",
            "instructor_name": "郑讲师",
            "instructor_id": "INS-007",
            "course_name": "敏捷开发与Scrum实战",
            "course_type": "管理培训",
            "training_company": "华信培训公司",
            "start_date": "2026-06-15",
            "end_date": "2026-06-17",
            "location": "培训中心B-103",
            "student_count": 22,
            "description": "敏捷开发方法论与Scrum实战演练",
            "status": "teaching_completed",
            "created_by": 1,
            "courseware_status": "approved",
            "evaluation_status": "pending",
        },
        {
            "form_no": "PK-2026-008",
            "title": "企业数字化转型培训",
            "instructor_name": "冯讲师",
            "instructor_id": "INS-008",
            "course_name": "企业数字化转型",
            "course_type": "综合培训",
            "training_company": "智联培训公司",
            "start_date": "2026-06-05",
            "end_date": "2026-06-06",
            "location": "培训中心C-302",
            "student_count": 35,
            "description": "面向企业中高层的数字化转型战略培训",
            "status": "rejected",
            "created_by": 1,
            "courseware_status": "rejected",
            "evaluation_status": "pending",
        },
    ]

    now = datetime.now()

    c.execute("DELETE FROM operation_logs")
    c.execute("DELETE FROM timeout_records")
    c.execute("DELETE FROM evaluations")
    c.execute("DELETE FROM courseware_reviews")
    c.execute("DELETE FROM instructor_schedules")
    c.execute("DELETE FROM scheduling_forms")

    for f in demo_forms:
        entered_at = (now - timedelta(hours=12)).strftime("%Y-%m-%d %H:%M:%S")
        if f["status"] == "pending_archive":
            entered_at = (now - timedelta(hours=120)).strftime("%Y-%m-%d %H:%M:%S")
        elif f["status"] == "reviewing":
            entered_at = (now - timedelta(hours=18)).strftime("%Y-%m-%d %H:%M:%S")
        elif f["status"] == "pending_courseware":
            entered_at = (now - timedelta(hours=36)).strftime("%Y-%m-%d %H:%M:%S")
        elif f["status"] == "pending_review":
            entered_at = (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S")
        elif f["status"] == "pending_teaching":
            entered_at = (now - timedelta(hours=50)).strftime("%Y-%m-%d %H:%M:%S")
        elif f["status"] == "teaching_completed":
            entered_at = (now - timedelta(hours=30)).strftime("%Y-%m-%d %H:%M:%S")
        elif f["status"] == "rejected":
            entered_at = (now - timedelta(hours=100)).strftime("%Y-%m-%d %H:%M:%S")
        c.execute(
            """INSERT INTO scheduling_forms
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

    form_id_map = {}
    c.execute("SELECT form_no, id FROM scheduling_forms")
    for row in c.fetchall():
        form_id_map[row["form_no"]] = row["id"]

    def _fid(form_no):
        return form_id_map.get(form_no)

    demo_schedules = [
        ("PK-2026-001", "赵讲师", "2026-07-01", "09:00-12:00", "planned", "第一天上午"),
        ("PK-2026-001", "赵讲师", "2026-07-01", "14:00-17:00", "planned", "第一天下午"),
        ("PK-2026-001", "赵讲师", "2026-07-02", "09:00-12:00", "planned", "第二天上午"),
        ("PK-2026-002", "钱讲师", "2026-07-10", "09:00-17:00", "planned", "全天"),
        ("PK-2026-002", "钱讲师", "2026-07-11", "09:00-17:00", "planned", "全天"),
        ("PK-2026-004", "李讲师", "2026-06-20", "09:00-17:00", "completed", "全天"),
        ("PK-2026-006", "吴讲师", "2026-06-25", "09:00-12:00", "confirmed", "第一天上午"),
        ("PK-2026-006", "吴讲师", "2026-06-25", "14:00-17:00", "confirmed", "第一天下午"),
        ("PK-2026-006", "吴讲师", "2026-06-26", "09:00-17:00", "planned", "第二天全天"),
        ("PK-2026-007", "郑讲师", "2026-06-15", "09:00-17:00", "completed", "第一天全天"),
        ("PK-2026-007", "郑讲师", "2026-06-16", "09:00-17:00", "completed", "第二天全天"),
        ("PK-2026-007", "郑讲师", "2026-06-17", "09:00-12:00", "completed", "第三天上午"),
    ]
    for s in demo_schedules:
        fid = _fid(s[0])
        if fid is None:
            continue
        c.execute(
            """INSERT INTO instructor_schedules
            (form_id, instructor_name, schedule_date, time_slot, status, remark)
            VALUES (?, ?, ?, ?, ?, ?)""",
            (fid, s[1], s[2], s[3], s[4], s[5]),
        )

    fid_4 = _fid("PK-2026-004")
    fid_5 = _fid("PK-2026-005")
    if fid_4:
        c.execute(
            """INSERT INTO evaluations (form_id, evaluator_id, score, comment)
            VALUES (?, ?, ?, ?)""",
            (fid_4, 3, 92, "培训效果良好，学员反馈积极"),
        )
    if fid_5:
        c.execute(
            """INSERT INTO evaluations (form_id, evaluator_id, score, comment)
            VALUES (?, ?, ?, ?)""",
            (fid_5, 3, 88, "新员工入职培训流程规范，内容完善，建议增加互动环节"),
        )

    demo_cw_reviews = [
        ("PK-2026-003", 3, "approved", "课件内容完整，结构清晰，案例丰富，符合培训需求"),
        ("PK-2026-004", 3, "approved", "课件理论深度适中，案例贴合实际，适合中高层管理者"),
        ("PK-2026-005", 3, "approved", "课件内容全面，图文并茂，适合新员工快速了解公司"),
        ("PK-2026-006", 3, "approved", "课件技术深度足够，架构图清晰，代码示例可运行"),
        ("PK-2026-007", 3, "approved", "敏捷培训课件实战性强，演练流程设计合理"),
        ("PK-2026-008", 3, "rejected", "课件内容过于宏观，缺少具体实施路径和案例支撑，建议补充数字化转型方法论和行业实践案例"),
    ]
    for r in demo_cw_reviews:
        fid = _fid(r[0])
        if fid is None:
            continue
        c.execute(
            """INSERT INTO courseware_reviews (form_id, reviewer_id, result, comment)
            VALUES (?, ?, ?, ?)""",
            (fid, r[1], r[2], r[3]),
        )

    base_time = now - timedelta(days=30)
    demo_logs = [
        ("PK-2026-001", 1, "create", None, "pending_review", "创建Python高级编程培训排课单"),
        ("PK-2026-002", 1, "create", None, "pending_review", "创建项目管理实战培训排课单"),
        ("PK-2026-002", 2, "submit", "pending_review", "reviewing", "审核通过"),
        ("PK-2026-003", 1, "create", None, "pending_review", "创建数据分析与可视化培训排课单"),
        ("PK-2026-003", 2, "submit", "pending_review", "reviewing", "审核通过"),
        ("PK-2026-003", 2, "submit", "reviewing", "pending_courseware", "审核通过，进入课件审核"),
        ("PK-2026-004", 1, "create", None, "pending_review", "创建领导力发展培训排课单"),
        ("PK-2026-004", 2, "submit", "pending_review", "reviewing", "审核通过"),
        ("PK-2026-004", 2, "submit", "reviewing", "pending_courseware", "审核通过"),
        ("PK-2026-004", 3, "courseware_review", "pending_courseware", "pending_teaching", "课件审核通过，进入待授课"),
        ("PK-2026-004", 3, "confirm_teaching", "pending_teaching", "pending_evaluation", "授课完成，进入待评价"),
        ("PK-2026-004", 3, "evaluate", "pending_evaluation", "pending_archive", "课后评价：分数92，培训效果良好"),
        ("PK-2026-005", 1, "create", None, "pending_review", "创建新员工入职培训排课单"),
        ("PK-2026-005", 2, "submit", "pending_review", "reviewing", "审核通过"),
        ("PK-2026-005", 2, "submit", "reviewing", "pending_courseware", "审核通过"),
        ("PK-2026-005", 3, "courseware_review", "pending_courseware", "pending_teaching", "课件审核通过"),
        ("PK-2026-005", 3, "confirm_teaching", "pending_teaching", "pending_evaluation", "授课完成"),
        ("PK-2026-005", 3, "evaluate", "pending_evaluation", "pending_archive", "课后评价：分数88，建议增加互动环节"),
        ("PK-2026-005", 3, "archive", "pending_archive", "archived", "已归档"),
        ("PK-2026-006", 1, "create", None, "pending_review", "创建云原生架构与微服务培训排课单"),
        ("PK-2026-006", 2, "submit", "pending_review", "reviewing", "审核通过"),
        ("PK-2026-006", 2, "submit", "reviewing", "pending_courseware", "审核通过"),
        ("PK-2026-006", 3, "courseware_review", "pending_courseware", "pending_teaching", "课件审核通过，进入待授课"),
        ("PK-2026-007", 1, "create", None, "pending_review", "创建敏捷开发与Scrum实战培训排课单"),
        ("PK-2026-007", 2, "submit", "pending_review", "reviewing", "审核通过"),
        ("PK-2026-007", 2, "submit", "reviewing", "pending_courseware", "审核通过"),
        ("PK-2026-007", 3, "courseware_review", "pending_courseware", "pending_teaching", "课件审核通过"),
        ("PK-2026-007", 3, "confirm_teaching", "pending_teaching", "pending_evaluation", "所有排期已完成，自动进入待评价"),
        ("PK-2026-008", 1, "create", None, "pending_review", "创建企业数字化转型培训排课单"),
        ("PK-2026-008", 2, "submit", "pending_review", "reviewing", "审核通过"),
        ("PK-2026-008", 2, "submit", "reviewing", "pending_courseware", "审核通过"),
        ("PK-2026-008", 3, "courseware_review", "pending_courseware", "rejected", "课件审核驳回，建议补充方法论和案例"),
        ("PK-2026-008", 1, "timeout_handle", "rejected", "timeout_handling", "超时处理: 原因=课件内容深度不够，缺少行业案例, 后续处理=已通知讲师补充数字化转型实施路径和金融行业案例，预计48小时内重新提交"),
    ]

    for i, log in enumerate(demo_logs):
        log_time = (base_time + timedelta(minutes=30 * i)).strftime("%Y-%m-%d %H:%M:%S")
        form_no, op_id, action, from_s, to_s, remark = log
        fid = _fid(form_no)
        if fid is None:
            continue
        c.execute(
            """INSERT INTO operation_logs
            (form_id, operator_id, action, from_status, to_status, remark, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (fid, op_id, action, from_s, to_s, remark, log_time),
        )

    demo_timeouts = [
        {
            "form_no": "PK-2026-008",
            "node_name": "pending_courseware",
            "timeout_at": (now - timedelta(hours=60)).strftime("%Y-%m-%d %H:%M:%S"),
            "reason": "课件内容深度不够，缺少行业案例",
            "follow_up": "已通知讲师补充数字化转型实施路径和金融行业案例，预计48小时内重新提交",
            "handled_by": 1,
            "handled_at": (now - timedelta(hours=10)).strftime("%Y-%m-%d %H:%M:%S"),
            "status": "handled",
            "created_at": (now - timedelta(hours=60)).strftime("%Y-%m-%d %H:%M:%S"),
        },
        {
            "form_no": "PK-2026-004",
            "node_name": "pending_archive",
            "timeout_at": (now - timedelta(hours=72)).strftime("%Y-%m-%d %H:%M:%S"),
            "reason": "",
            "follow_up": "",
            "handled_by": None,
            "handled_at": None,
            "status": "pending",
            "created_at": (now - timedelta(hours=72)).strftime("%Y-%m-%d %H:%M:%S"),
        },
    ]

    for t in demo_timeouts:
        fid = _fid(t["form_no"])
        if fid is None:
            continue
        c.execute(
            """INSERT INTO timeout_records
            (form_id, node_name, timeout_at, reason, follow_up, handled_by, handled_at, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (fid, t["node_name"], t["timeout_at"], t["reason"],
             t["follow_up"], t["handled_by"], t["handled_at"], t["status"], t["created_at"]),
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
