from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
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
    offline_count: int = 1
    offline_status: Optional[str] = None
    offline_attachment_list: Optional[str] = None


class MeetingReservationCreate(MeetingReservationBase):
    batch_no: str
    force_submit: bool = False


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
    offline_count: Optional[int] = None
    offline_status: Optional[str] = None
    offline_attachment_list: Optional[str] = None


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
    offline_check_diff: Optional[Dict[str, Any]] = None
    offline_checked: bool = False
    offline_checked_at: Optional[datetime] = None
    offline_checked_by: Optional[str] = None
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
    batch_no: Optional[str] = None
    action: str
    status_from: Optional[str] = None
    status_to: Optional[str] = None
    operator: Optional[str] = None
    operator_role: Optional[str] = None
    remark: Optional[str] = None
    item_results: Optional[List[Dict[str, Any]]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BlockLogOut(BaseModel):
    id: int
    reservation_id: Optional[int] = None
    batch_no: Optional[str] = None
    block_type: str
    reason: str
    detail: Optional[Dict[str, Any]] = None
    operator: Optional[str] = None
    operator_role: Optional[str] = None
    item_results: Optional[List[Dict[str, Any]]] = None
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
    is_blocked: bool = False
    message: str
    existing_count: int = 0
    statuses: List[str] = []
    diff_details: Optional[List[Dict[str, Any]]] = None


class OfflineReconcileRequest(BaseModel):
    batch_no: str
    offline_count: int = 0
    offline_statuses: List[Dict[str, Any]] = []
    offline_attachments: List[Dict[str, Any]] = []


class DiffItem(BaseModel):
    field: str
    online_value: Optional[Any] = None
    offline_value: Optional[Any] = None
    status: str


class BatchReconcileResult(BaseModel):
    batch_no: str
    is_consistent: bool = False
    is_blocked: bool = False
    message: str
    total_online: int = 0
    total_offline: int = 0
    diff_count: int = 0
    diffs: List[DiffItem] = []
    item_results: List[Dict[str, Any]] = []
