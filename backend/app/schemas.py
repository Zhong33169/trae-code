from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

from .models import Role, BillStatus, ProcessNode


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserBase(BaseModel):
    username: str
    real_name: str
    role: Role


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class UserCreate(UserBase):
    password: str


class MeterReadingBase(BaseModel):
    reading_type: str
    previous_reading: float
    current_reading: float
    usage: float
    remark: Optional[str] = None


class MeterReadingCreate(MeterReadingBase):
    bill_id: int


class MeterReadingResponse(MeterReadingBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    bill_id: int
    read_by: int
    read_at: datetime
    reader_name: Optional[str] = None


class PaymentBase(BaseModel):
    amount: float
    payment_method: Optional[str] = None
    transaction_no: Optional[str] = None
    paid_by: Optional[str] = None
    paid_at: Optional[datetime] = None
    remark: Optional[str] = None


class PaymentCreate(PaymentBase):
    bill_id: int


class PaymentVerify(BaseModel):
    is_verified: bool
    remark: Optional[str] = None


class PaymentResponse(PaymentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    bill_id: int
    verified_by: Optional[int] = None
    verified_at: Optional[datetime] = None
    is_verified: bool
    verifier_name: Optional[str] = None


class OperationLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    bill_id: int
    operator_id: int
    operator_name: Optional[str] = None
    operation: str
    from_status: Optional[BillStatus] = None
    to_status: Optional[BillStatus] = None
    from_node: Optional[ProcessNode] = None
    to_node: Optional[ProcessNode] = None
    anomaly_reason: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime


class EnergyBillBase(BaseModel):
    period: str
    park_name: str
    building: Optional[str] = None
    room: Optional[str] = None
    electricity_usage: Optional[float] = None
    water_usage: Optional[float] = None
    gas_usage: Optional[float] = None
    electricity_amount: Optional[float] = None
    water_amount: Optional[float] = None
    gas_amount: Optional[float] = None


class EnergyBillCreate(EnergyBillBase):
    pass


class EnergyBillUpdate(EnergyBillBase):
    pass


class BillAction(BaseModel):
    action: str
    anomaly_reason: Optional[str] = None
    remark: Optional[str] = None


class OverdueInfo(BaseModel):
    is_overdue: bool
    overdue_hours: float
    current_node: ProcessNode
    current_node_started_at: datetime
    timeout_hours: float
    responsible_role: Role
    next_responsible_role: Optional[Role] = None


class EnergyBillResponse(EnergyBillBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    bill_no: str
    total_amount: float
    status: BillStatus
    current_node: ProcessNode
    current_responsible_role: Role
    has_meter_reading: bool
    has_bill_generated: bool
    has_payment_verified: bool
    is_overdue: bool
    overdue_hours: float
    current_node_started_at: datetime
    created_by: int
    creator_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    meter_readings: List[MeterReadingResponse] = []
    payments: List[PaymentResponse] = []
    operation_logs: List[OperationLogResponse] = []
    overdue_info: Optional[OverdueInfo] = None
    allowed_actions: List[str] = []
    visible_fields: List[str] = []


class BillListResponse(BaseModel):
    items: List[EnergyBillResponse]
    total: int
    stats: "BillStats"


class BillStats(BaseModel):
    total_count: int
    draft_count: int
    pending_audit_count: int
    rejected_count: int
    audited_count: int
    pending_review_count: int
    review_rejected_count: int
    archived_count: int
    overdue_count: int
    total_amount: float
