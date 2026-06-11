from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class UserOut(BaseModel):
    id: int
    username: str
    name: str
    role: str
    department: Optional[str] = None

    class Config:
        from_attributes = True


class MeetingReservationBase(BaseModel):
    title: str
    meeting_room: str
    meeting_date: str
    start_time: str
    end_time: str
    participants: int = 0
    organizer: Optional[str] = None
    organizer_dept: Optional[str] = None
    contact_phone: Optional[str] = None
    equipment: Optional[str] = None
    attachment_names: Optional[str] = None
    offline_attachment_count: int = 0


class MeetingReservationCreate(MeetingReservationBase):
    batch_no: str


class MeetingReservationUpdate(BaseModel):
    title: Optional[str] = None
    meeting_room: Optional[str] = None
    meeting_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    participants: Optional[int] = None
    organizer: Optional[str] = None
    organizer_dept: Optional[str] = None
    contact_phone: Optional[str] = None
    equipment: Optional[str] = None
    attachment_names: Optional[str] = None
    offline_attachment_count: Optional[int] = None
    audit_remark: Optional[str] = None


class MeetingReservationOut(MeetingReservationBase):
    id: int
    reservation_no: str
    batch_no: str
    status: str
    exception_type: Optional[str] = None
    exception_desc: Optional[str] = None
    equipment_ready: bool = False
    result: Optional[str] = None
    usage_confirm: bool = False
    usage_confirm_time: Optional[datetime] = None
    usage_confirm_user: Optional[str] = None
    return_reason: Optional[str] = None
    audit_remark: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_by: Optional[str] = None
    updated_at: datetime
    submitted_at: Optional[datetime] = None
    audit_by: Optional[str] = None
    audit_at: Optional[datetime] = None
    review_by: Optional[str] = None
    review_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MeetingReservationListOut(BaseModel):
    total: int
    items: List[MeetingReservationOut]


class AuditLogOut(BaseModel):
    id: int
    reservation_id: Optional[int] = None
    action: str
    status_from: Optional[str] = None
    status_to: Optional[str] = None
    operator: Optional[str] = None
    operator_role: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListOut(BaseModel):
    items: List[AuditLogOut]


class StatusUpdate(BaseModel):
    status: str
    remark: Optional[str] = None
    return_reason: Optional[str] = None
    result: Optional[str] = None


class BatchCheckResult(BaseModel):
    batch_no: str
    is_duplicate: bool
    message: str
    existing_count: int = 0


class BatchImportResult(BaseModel):
    batch_no: str
    total: int
    success: int
    failed: int
    failed_details: List[dict] = []
