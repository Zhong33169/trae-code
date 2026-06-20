from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: int
    username: str
    real_name: str
    role: str
    role_label: str = ''
    phone: str = ''

    class Config:
        from_attributes = True


class LoginIn(BaseModel):
    username: str
    password: str


class LoginOut(BaseModel):
    success: bool
    message: str = ''
    user: Optional[UserOut] = None
    token: str = ''


class BookingApplicationBase(BaseModel):
    form_no: str = Field(..., max_length=50)
    batch_no: str = Field(..., max_length=50)
    customer: str = Field(..., max_length=100)
    forwarder: str = ''
    port_of_loading: str = ''
    port_of_discharge: str = ''
    container_type: str = ''
    container_qty: int = 1
    cargo_desc: str = ''
    weight: float = 0
    volume: float = 0
    etd: Optional[date] = None
    eta: Optional[date] = None
    bl_no: str = ''
    vessel: str = ''
    so_no: str = ''
    deadline: Optional[datetime] = None
    return_reason: str = ''
    audit_remark: str = ''
    result_note: str = ''
    offline_booking_status: str = 'draft'
    offline_loading_status: str = 'not_arranged'
    offline_bl_status: str = 'not_issued'


class BookingApplicationIn(BookingApplicationBase):
    pass


class BookingApplicationOut(BookingApplicationBase):
    id: int
    booking_status: str
    booking_status_label: str
    loading_status: str
    loading_status_label: str
    bl_status: str
    bl_status_label: str
    is_exception: bool = False
    exception_type: str = 'none'
    exception_note: str = ''
    status_mismatch: List[str] = []
    submitter_name: str = ''
    reviewer_name: str = ''
    archivist_name: str = ''
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BookingListOut(BaseModel):
    total: int
    items: List[BookingApplicationOut]


class StatusChangeIn(BaseModel):
    remark: str = ''
    fail_reason: str = ''
    result_note: str = ''


class BatchActionIn(BaseModel):
    ids: List[int]
    action: str
    remark: str = ''


class BatchActionResult(BaseModel):
    id: int
    form_no: str
    success: bool
    message: str = ''


class BatchActionOut(BaseModel):
    results: List[BatchActionResult]
    success_count: int = 0
    fail_count: int = 0


class OperationLogOut(BaseModel):
    id: int
    action: str
    action_label: str
    operator_name: str
    role: str
    role_label: str
    from_status: str
    to_status: str
    remark: str
    field_changed: str
    old_value: str
    new_value: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogOut(BaseModel):
    id: int
    audit_type: str
    audit_type_label: str = ''
    auditor_name: str
    result: str
    result_label: str = ''
    fail_reason: str
    remark: str
    created_at: datetime

    class Config:
        from_attributes = True


class AttachmentOut(BaseModel):
    id: int
    category: str
    category_label: str = ''
    file_name: str
    file_size: int = 0
    uploader_name: str = ''
    file_url: str = ''
    created_at: datetime

    class Config:
        from_attributes = True


class OfflineLedgerRecordOut(BaseModel):
    id: int
    field_name: str
    field_label: str
    old_value: str
    new_value: str
    source: str
    operator_name: str
    remark: str
    created_at: datetime

    class Config:
        from_attributes = True


class OfflineFillIn(BaseModel):
    field_name: str
    new_value: str
    source: str = '离线台账Excel'
    remark: str = ''


class ValidateCheckIn(BaseModel):
    form_no: Optional[str] = None
    batch_no: Optional[str] = None
    exclude_id: Optional[int] = None


class ValidateCheckOut(BaseModel):
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []


class MessageOut(BaseModel):
    success: bool
    message: str = ''
