import os
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'medical_records.db')}"

SECRET_KEY = "medical-records-secret-key-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

CORS_ORIGINS = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

ROLES = {
    "DEPARTMENT_SECRETARY": "科室秘书",
    "QUALITY_DOCTOR": "质控医生",
    "MEDICAL_DIRECTOR": "医务部主任",
}

STATUS = {
    "PENDING_SUBMIT": "待提交",
    "SUBMITTED": "已提交",
    "REJECTED": "已退回",
    "RESUBMITTED": "重新提交",
    "QUALITY_CHECKED": "质控已审核",
    "NOTICE_SENT": "整改通知已发送",
    "REVIEWED": "复核通过",
    "ARCHIVED": "已归档",
    "CONFIRMED": "医务部确认",
}

NODE_DEADLINES = {
    "DEPARTMENT_SUBMIT": timedelta(hours=24),
    "QUALITY_REVIEW": timedelta(hours=48),
    "NOTICE_SEND": timedelta(hours=12),
    "RECTIFICATION": timedelta(days=7),
    "REVIEW_ARCHIVE": timedelta(hours=48),
    "DIRECTOR_CONFIRM": timedelta(hours=24),
}
