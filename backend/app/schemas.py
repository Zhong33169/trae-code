from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

from app.models import UserRole, OrderStatus, AttachmentType, AuditAction


class UserSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str
    role: UserRole
    created_at: datetime


class RequiredAttachmentSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    attachment_type: AttachmentType
    attachment_name: str
    is_provided: bool
    missing_reason: Optional[str] = None
    reject_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AttachmentSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    required_attachment_id: Optional[int] = None
    file_name: str
    file_type: AttachmentType
    file_size: Optional[int] = None
    uploaded_by: Optional[int] = None
    uploaded_at: datetime


class AuditLogSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    operator_id: int
    action: AuditAction
    from_status: Optional[OrderStatus] = None
    to_status: Optional[OrderStatus] = None
    remark: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: datetime
    operator_name: Optional[str] = None


class MembershipOrderSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_no: str
    member_name: str
    member_phone: Optional[str] = None
    member_id_no: Optional[str] = None
    membership_type: str
    membership_duration: int
    amount: int
    contract_confirmed: bool
    card_activated: bool
    status: OrderStatus
    is_overdue: bool
    reject_reason: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    attachments: List[AttachmentSchema] = []
    required_attachments: List[RequiredAttachmentSchema] = []
    audit_logs: List[AuditLogSchema] = []


class MembershipOrderCreate(BaseModel):
    member_name: str
    member_phone: Optional[str] = None
    member_id_no: Optional[str] = None
    membership_type: str
    membership_duration: int
    amount: int


class OrderQueryParams(BaseModel):
    status: Optional[OrderStatus] = None
    is_overdue: Optional[bool] = None
    keyword: Optional[str] = None
    skip: int = 0
    limit: int = 50


class AttachmentUpload(BaseModel):
    required_attachment_id: Optional[int] = None
    file_type: AttachmentType
    file_name: str
    file_size: Optional[int] = None


class ReviewAction(BaseModel):
    action: str
    reject_reason: Optional[str] = None
    remark: Optional[str] = None


class SupplementRequest(BaseModel):
    required_attachment_ids: List[int]
    remark: Optional[str] = None


class ContractConfirm(BaseModel):
    confirmed: bool


class CardActivate(BaseModel):
    activated: bool
