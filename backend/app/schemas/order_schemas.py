from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.database import RoleEnum, OrderStatus, EvidenceType, BatchStatus, BatchItemStatus


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    role: RoleEnum

    class Config:
        from_attributes = True


class EvidenceOut(BaseModel):
    id: int
    evidence_type: EvidenceType
    file_name: str
    file_ref: str
    remark: Optional[str]
    uploaded_by: Optional[int]
    uploaded_at: datetime

    class Config:
        from_attributes = True


class TransportOrderOut(BaseModel):
    id: int
    order_no: str
    customer: str
    cargo_name: str
    cargo_weight: float
    origin: str
    destination: str
    status: OrderStatus
    version: int
    plate_number: Optional[str]
    driver: Optional[str]
    receiver: Optional[str]
    signed_at: Optional[datetime]
    rejected_reason: Optional[str]
    initiator_id: Optional[int]
    handler_id: Optional[int]
    reviewer_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    evidences: List[EvidenceOut] = []

    class Config:
        from_attributes = True


class TransportOrderCreate(BaseModel):
    customer: str
    cargo_name: str
    cargo_weight: float
    origin: str
    destination: str


class TransportOrderUpdate(BaseModel):
    plate_number: Optional[str] = None
    driver: Optional[str] = None
    receiver: Optional[str] = None
    remark: Optional[str] = None


class EvidenceUpload(BaseModel):
    evidence_type: EvidenceType
    file_name: str
    file_ref: str
    remark: Optional[str] = None
    expected_version: int = Field(..., description="客户端当前持有的版本号，用于乐观锁")


class OrderTransition(BaseModel):
    target_status: OrderStatus
    remark: Optional[str] = None
    expected_version: int = Field(..., description="客户端当前持有的版本号，用于乐观锁")


class BatchItemOut(BaseModel):
    id: int
    order_id: int
    order_no: str
    status: BatchItemStatus
    error_message: Optional[str]
    retry_count: int
    processed_at: Optional[datetime]
    order_version: Optional[int]

    class Config:
        from_attributes = True


class BatchChangeOut(BaseModel):
    id: int
    batch_no: str
    operator_id: int
    change_type: str
    target_status: Optional[OrderStatus]
    status: BatchStatus
    total_count: int
    success_count: int
    failed_count: int
    created_at: datetime
    finished_at: Optional[datetime]
    items: List[BatchItemOut] = []

    class Config:
        from_attributes = True


class BatchCreateRequest(BaseModel):
    order_ids: List[int]
    target_status: OrderStatus
    change_type: str = Field(default="status_transition")


class BatchRetryRequest(BaseModel):
    batch_item_ids: List[int]
    remark: Optional[str] = None
    expected_versions: Optional[dict] = Field(default=None, description="订单ID→期望版本号映射，用于乐观锁")


class AuditLogOut(BaseModel):
    id: int
    order_id: Optional[int]
    order_no: Optional[str]
    batch_id: Optional[int]
    batch_no: Optional[str]
    user_id: Optional[int]
    username: Optional[str]
    action: str
    old_status: Optional[str]
    new_status: Optional[str]
    old_version: Optional[int]
    new_version: Optional[int]
    detail: Optional[str]
    remark: Optional[str]
    failure_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None
