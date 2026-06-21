import os

DB_PATH = os.environ.get("DB_PATH", "data/medical_events.db")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-for-demo-only")
JWT_ALGORITHM = "HS256"
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3004").split(",")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8004"))

ROLES = ["registrar", "supervisor", "reviewer"]
ROLE_LABELS = {
    "registrar": "医疗事件登记员",
    "supervisor": "医疗事件审核主管",
    "reviewer": "三甲医院医务部复核负责人",
}
STATUSES = ["draft", "submitted", "review_rejected", "review_passed", "archive_rejected", "archived"]
STATUS_LABELS = {
    "draft": "草稿",
    "submitted": "已提交",
    "review_rejected": "审核退回",
    "review_passed": "审核通过",
    "archive_rejected": "复核退回",
    "archived": "已归档",
}
EVENT_TYPES = ["adverse_event", "incident_report", "rectification_tracking"]
EVENT_TYPE_LABELS = {
    "adverse_event": "不良事件",
    "incident_report": "事件上报",
    "rectification_tracking": "整改追踪",
}
SEVERITIES = ["minor", "moderate", "major", "critical"]
SEVERITY_LABELS = {
    "minor": "一般",
    "moderate": "中度",
    "major": "重大",
    "critical": "特别重大",
}

STATUS_HANDLER = {
    "draft": "registrar",
    "submitted": "supervisor",
    "review_rejected": "registrar",
    "review_passed": "reviewer",
    "archive_rejected": "supervisor",
    "archived": None,
}

VALID_TRANSITIONS = {
    ("registrar", "draft"): ["submitted"],
    ("registrar", "review_rejected"): ["submitted"],
    ("supervisor", "submitted"): ["review_passed", "review_rejected"],
    ("supervisor", "archive_rejected"): ["review_passed", "review_rejected"],
    ("reviewer", "review_passed"): ["archived", "archive_rejected"],
}
