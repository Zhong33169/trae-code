from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date

class LoginRequest(BaseModel):
    username: str
    password: str

class UserInfo(BaseModel):
    username: str
    role: str
    name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo

class StudentBase(BaseModel):
    student_no: str
    name: str
    gender: Optional[str] = None
    grade: Optional[str] = None
    school: Optional[str] = None
    phone: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    remark: Optional[str] = None

class StudentCreate(StudentBase):
    pass

class Student(StudentBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CourseBase(BaseModel):
    course_code: str
    name: str
    subject: str
    grade: Optional[str] = None
    total_hours: int = 0
    teacher: Optional[str] = None
    classroom: Optional[str] = None

class CourseCreate(CourseBase):
    pass

class Course(CourseBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ScheduleBase(BaseModel):
    course_id: int
    schedule_date: date
    start_time: str
    end_time: str
    teacher: Optional[str] = None
    classroom: Optional[str] = None
    capacity: int = 30

class ScheduleCreate(ScheduleBase):
    pass

class Schedule(ScheduleBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class MaterialCreate(BaseModel):
    material_type: str
    material_name: str
    file_url: Optional[str] = None

class Material(MaterialCreate):
    id: int
    uploaded_by: Optional[str] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True

class FeedbackBase(BaseModel):
    attendance: Optional[str] = None
    performance: Optional[str] = None
    homework: Optional[str] = None
    teacher_comment: Optional[str] = None

class FeedbackCreate(FeedbackBase):
    pass

class Feedback(FeedbackBase):
    id: int
    order_id: int
    feedback_time: Optional[datetime] = None
    feedback_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ServiceOrderCreate(BaseModel):
    student_id: int
    course_id: int
    schedule_id: Optional[int] = None
    service_type: str

class ServiceOrderUpdate(BaseModel):
    opinion: Optional[str] = None
    materials: Optional[List[MaterialCreate]] = None

class ServiceOrder(BaseModel):
    id: int
    order_no: str
    qr_code: str
    student_id: int
    course_id: int
    schedule_id: Optional[int] = None
    service_type: str
    status: str
    current_handler: Optional[str] = None
    register_by: Optional[str] = None
    reviewer_by: Optional[str] = None
    finalizer_by: Optional[str] = None
    register_time: Optional[datetime] = None
    review_time: Optional[datetime] = None
    finalize_time: Optional[datetime] = None
    register_opinion: Optional[str] = None
    review_opinion: Optional[str] = None
    finalize_opinion: Optional[str] = None
    material_complete: int = 0
    time_limit_hours: int = 24
    version: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ServiceOrderDetail(ServiceOrder):
    student: Optional[dict] = None
    course: Optional[dict] = None
    schedule: Optional[dict] = None
    materials: List[dict] = []
    feedback: Optional[dict] = None
    audit_logs: List[dict] = []

class AuditLog(BaseModel):
    id: int
    order_id: int
    action: str
    operator: str
    operator_role: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ScanResult(BaseModel):
    valid: bool
    message: str
    order: Optional[ServiceOrderDetail] = None
    error_code: Optional[str] = None

class BatchOperationRequest(BaseModel):
    order_ids: List[int]
    opinion: Optional[str] = None

class StatisticsResponse(BaseModel):
    total: int = 0
    draft: int = 0
    pending_review: int = 0
    pending_finalize: int = 0
    completed: int = 0
    rejected: int = 0
