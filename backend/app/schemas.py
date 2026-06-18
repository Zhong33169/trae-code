from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from .config import STATUS, ROLES


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


class UserResponse(BaseModel):
    id: int
    username: str
    name: str
    role: str
    role_cn: str
    department: Optional[str]

    class Config:
        from_attributes = True


class NodeRecordResponse(BaseModel):
    id: int
    node_name: str
    node_name_cn: str
    started_at: datetime
    deadline: datetime
    completed_at: Optional[datetime]
    is_overdue: bool
    overdue_reason: Optional[str]
    follow_up_action: Optional[str]
    status: str
    handler_name: Optional[str]

    class Config:
        from_attributes = True


class OperationLogResponse(BaseModel):
    id: int
    operation: str
    operation_cn: str
    old_status: Optional[str]
    new_status: Optional[str]
    old_status_cn: Optional[str]
    new_status_cn: Optional[str]
    operator_name: str
    remark: Optional[str]
    extra_data: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class RectificationOrderBase(BaseModel):
    patient_name: str
    medical_record_no: str
    department: str
    diagnosis: Optional[str] = None
    content: Optional[str] = None
    rectification_requirements: Optional[str] = None


class RectificationOrderCreate(RectificationOrderBase):
    pass


class RectificationOrderUpdate(BaseModel):
    content: Optional[str] = None
    rectification_requirements: Optional[str] = None
    quality_opinion: Optional[str] = None
    review_opinion: Optional[str] = None
    director_opinion: Optional[str] = None


class StatusUpdateRequest(BaseModel):
    new_status: str
    remark: Optional[str] = None
    overdue_reason: Optional[str] = None
    follow_up_action: Optional[str] = None
    quality_data: Optional[Dict[str, Any]] = None
    notice_data: Optional[Dict[str, Any]] = None
    review_data: Optional[Dict[str, Any]] = None


class RectificationOrderResponse(BaseModel):
    id: int
    order_no: str
    patient_name: str
    medical_record_no: str
    department: str
    diagnosis: Optional[str]
    status: str
    status_cn: str
    current_node: str
    current_node_cn: str
    content: Optional[str]
    rectification_requirements: Optional[str]
    quality_opinion: Optional[str]
    notice_content: Optional[str]
    review_opinion: Optional[str]
    director_opinion: Optional[str]
    department_secretary_name: Optional[str]
    quality_doctor_name: Optional[str]
    medical_director_name: Optional[str]
    is_overdue: bool
    created_at: datetime
    updated_at: datetime
    nodes: Optional[List[NodeRecordResponse]] = None
    logs: Optional[List[OperationLogResponse]] = None

    class Config:
        from_attributes = True


class QualityControlRequest(BaseModel):
    problems_found: Optional[str] = None
    quality_score: Optional[int] = None
    check_result: str
    quality_opinion: Optional[str] = None


class RectificationNoticeRequest(BaseModel):
    notice_title: str
    notice_content: str
    deadline: datetime
    recipient_department: str


class ReviewArchiveRequest(BaseModel):
    review_opinion: str
    review_result: str
    archive_location: Optional[str] = None


class BatchOperationRequest(BaseModel):
    order_ids: List[int]
    operation: str
    remark: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class BatchOperationResult(BaseModel):
    success_count: int
    failed_count: int
    total_count: int
    results: List[Dict[str, Any]]


class StatisticsResponse(BaseModel):
    total: int
    by_status: Dict[str, int]
    by_department: Dict[str, int]
    overdue_count: int
    pending_my_action: int
