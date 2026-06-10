from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models.audit_log import AuditAction
from schemas.user import UserResponse


class AuditLogQuery(BaseModel):
    inspection_order_id: Optional[int] = None
    operator_id: Optional[int] = None
    action: Optional[AuditAction] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = 1
    page_size: int = 50


class AuditLogResponse(BaseModel):
    id: int
    inspection_order_id: Optional[int] = None
    order_no: Optional[str] = None
    action: AuditAction
    action_label: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    operator_id: int
    operator_name: Optional[str] = None
    operator_role: Optional[str] = None
    detail: Optional[str] = None
    opinion: Optional[str] = None
    signature: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    suggestion: Optional[str] = None
    next_step: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditStatistics(BaseModel):
    total_operations: int
    operations_by_action: dict
    operations_by_role: dict
    operations_by_status: dict
    operations_today: int
    operations_this_week: int
    average_processing_time: Optional[float] = None
