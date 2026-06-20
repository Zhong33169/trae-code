from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    id: int
    username: str
    role: str
    display_name: str
    token: str

class SchedulingFormCreate(BaseModel):
    title: str
    instructor_name: str
    instructor_id: Optional[str] = None
    course_name: str
    course_type: Optional[str] = None
    training_company: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    student_count: Optional[int] = 0
    description: Optional[str] = None

class SchedulingFormUpdate(BaseModel):
    title: Optional[str] = None
    instructor_name: Optional[str] = None
    instructor_id: Optional[str] = None
    course_name: Optional[str] = None
    course_type: Optional[str] = None
    training_company: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    student_count: Optional[int] = None
    description: Optional[str] = None

class StatusTransition(BaseModel):
    action: str
    remark: Optional[str] = None

class TimeoutHandle(BaseModel):
    reason: str
    follow_up: str

class CoursewareReview(BaseModel):
    result: str
    comment: Optional[str] = None

class EvaluationCreate(BaseModel):
    score: int
    comment: Optional[str] = None

class ScheduleCreate(BaseModel):
    schedule_date: str
    time_slot: str
    remark: Optional[str] = None

class BatchAction(BaseModel):
    form_ids: List[int]
    action: str
    remark: Optional[str] = None

class SchedulingFormResponse(BaseModel):
    id: int
    form_no: str
    title: str
    instructor_name: str
    instructor_id: Optional[str] = None
    course_name: str
    course_type: Optional[str] = None
    training_company: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    student_count: Optional[int] = 0
    description: Optional[str] = None
    status: str
    status_label: str
    created_by: int
    created_by_name: Optional[str] = None
    created_at: str
    updated_at: str
    current_node_entered_at: Optional[str] = None
    courseware_status: str
    evaluation_status: str
    is_timeout: bool = False
    timeout_remaining_hours: Optional[float] = None

class TimeoutRecordResponse(BaseModel):
    id: int
    form_id: int
    node_name: str
    node_label: str
    timeout_at: str
    reason: Optional[str] = None
    follow_up: Optional[str] = None
    handled_by: Optional[int] = None
    handled_by_name: Optional[str] = None
    handled_at: Optional[str] = None
    status: str
    created_at: str

class OperationLogResponse(BaseModel):
    id: int
    form_id: int
    operator_id: int
    operator_name: Optional[str] = None
    action: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    from_status_label: Optional[str] = None
    to_status_label: Optional[str] = None
    remark: Optional[str] = None
    created_at: str

class StatisticsResponse(BaseModel):
    total: int
    by_status: dict
    timeout_count: int
    pending_count: int

class CoursewareReviewResponse(BaseModel):
    id: int
    form_id: int
    reviewer_id: int
    reviewer_name: Optional[str] = None
    result: str
    comment: Optional[str] = None
    reviewed_at: str

class EvaluationResponse(BaseModel):
    id: int
    form_id: int
    evaluator_id: int
    evaluator_name: Optional[str] = None
    score: int
    comment: Optional[str] = None
    evaluated_at: str

class InstructorScheduleResponse(BaseModel):
    id: int
    form_id: int
    instructor_name: str
    schedule_date: str
    time_slot: str
    status: str
    remark: Optional[str] = None
    created_at: str
