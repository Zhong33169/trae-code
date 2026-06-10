from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from models import RoleEnum, TicketStatusEnum, AttachmentTypeEnum


class LoginRequest(BaseModel):
    username: str
    password: str
    role: RoleEnum


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserInfo(BaseModel):
    id: int
    username: str
    full_name: str
    phone: Optional[str] = None
    role_code: str
    role_name: str
    role: RoleEnum


class RoleResponse(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None


class AttachmentBase(BaseModel):
    file_name: str
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    attachment_type: AttachmentTypeEnum = AttachmentTypeEnum.REQUIRED
    is_required: bool = False
    is_supplementary: bool = False
    is_rejected: bool = False
    reject_reason: Optional[str] = None
    review_note: Optional[str] = None


class AttachmentCreate(AttachmentBase):
    pass


class AttachmentResponse(AttachmentBase):
    id: int
    ticket_id: int
    uploaded_by_id: Optional[int] = None
    uploaded_by_name: Optional[str] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


class AttachmentUpdate(BaseModel):
    attachment_type: Optional[AttachmentTypeEnum] = None
    is_required: Optional[bool] = None
    is_supplementary: Optional[bool] = None
    is_rejected: Optional[bool] = None
    reject_reason: Optional[str] = None
    review_note: Optional[str] = None


class WorkOrderLogResponse(BaseModel):
    id: int
    ticket_id: int
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    action: str
    remark: Optional[str] = None
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    ticket_id: Optional[int] = None
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    action: str
    module: Optional[str] = None
    detail: Optional[str] = None
    failure_reason: Optional[str] = None
    is_success: bool
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RepairTicketBase(BaseModel):
    title: str
    owner_name: str
    owner_phone: str
    address: str
    repair_type: str
    priority: str = "normal"
    description: str
    deadline_at: Optional[datetime] = None


class RepairTicketCreate(RepairTicketBase):
    pass


class RepairTicketUpdate(BaseModel):
    title: Optional[str] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    address: Optional[str] = None
    repair_type: Optional[str] = None
    priority: Optional[str] = None
    description: Optional[str] = None
    deadline_at: Optional[datetime] = None
    repair_result: Optional[str] = None
    reject_reason: Optional[str] = None
    review_note: Optional[str] = None
    visit_feedback: Optional[str] = None
    visit_remark: Optional[str] = None


class RepairTicketResponse(RepairTicketBase):
    id: int
    ticket_no: str
    status: TicketStatusEnum
    is_overdue: bool
    created_at: datetime
    updated_at: datetime
    assigned_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    handled_by_id: Optional[int] = None
    handled_by_name: Optional[str] = None
    reviewed_by_id: Optional[int] = None
    reviewed_by_name: Optional[str] = None

    repair_result: Optional[str] = None
    reject_reason: Optional[str] = None
    review_note: Optional[str] = None
    visit_feedback: Optional[str] = None
    visit_remark: Optional[str] = None

    attachments: List[AttachmentResponse] = []
    work_logs: List[WorkOrderLogResponse] = []

    class Config:
        from_attributes = True


class TicketListResponse(BaseModel):
    total: int
    items: List[RepairTicketResponse]


class TicketActionRequest(BaseModel):
    remark: Optional[str] = None
    reject_reason: Optional[str] = None
    review_note: Optional[str] = None
    repair_result: Optional[str] = None
    visit_feedback: Optional[str] = None
    visit_remark: Optional[str] = None
    handled_by_id: Optional[int] = None
