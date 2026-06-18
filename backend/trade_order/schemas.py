from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    role: str

    class Config:
        from_attributes = True


class EvidenceOut(BaseModel):
    id: int
    order_id: int
    evidence_type: str
    evidence_type_display: str
    file_name: str
    file_url: str
    uploader_id: int
    uploader_name: str
    uploaded_at: datetime
    remark: str

    class Config:
        from_attributes = True


class EvidenceIn(BaseModel):
    evidence_type: str
    file_name: str
    file_url: str
    remark: Optional[str] = ""


class TradeOrderOut(BaseModel):
    id: int
    order_no: str
    customer_name: str
    country: str
    product_name: str
    quantity: Decimal
    unit: str
    amount: Decimal
    currency: str
    status: str
    status_display: str
    version: int
    sales_remark: str
    doc_remark: str
    confirm_remark: str
    exception_remark: str
    created_by_id: int
    created_by_name: str
    doc_handler_id: Optional[int] = None
    doc_handler_name: Optional[str] = None
    confirm_handler_id: Optional[int] = None
    confirm_handler_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    submitted_at: Optional[datetime] = None
    doc_processed_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    evidences: List[EvidenceOut] = []

    class Config:
        from_attributes = True


class TradeOrderIn(BaseModel):
    order_no: Optional[str] = None
    customer_name: str
    country: str
    product_name: str
    quantity: Decimal
    unit: Optional[str] = "PCS"
    amount: Decimal
    currency: Optional[str] = "USD"
    sales_remark: Optional[str] = ""


class TradeOrderUpdate(BaseModel):
    customer_name: Optional[str] = None
    country: Optional[str] = None
    product_name: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    sales_remark: Optional[str] = None
    version: int


class ActionIn(BaseModel):
    version: int
    remark: Optional[str] = ""


class BatchItemResult(BaseModel):
    order_id: int
    order_no: str
    item_status: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    submitted_version: int = 0


class BatchOperationOut(BaseModel):
    id: int
    batch_no: str
    action: str
    action_display: str
    operator_id: int
    operator_name: str
    status: str
    status_display: str
    total_count: int
    success_count: int
    failed_count: int
    retry_count: int
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    remark: str
    items: List[BatchItemResult] = []

    class Config:
        from_attributes = True


class BatchOrderItem(BaseModel):
    order_id: int
    version: int


class BatchOperationIn(BaseModel):
    action: str
    order_items: List[BatchOrderItem]
    remark: Optional[str] = ""


class OrderHistoryOut(BaseModel):
    id: int
    order_id: int
    operator_id: int
    operator_name: str
    action: str
    from_status: str
    from_status_display: str
    to_status: str
    to_status_display: str
    remark: str
    created_at: datetime

    class Config:
        from_attributes = True


class ErrorOut(BaseModel):
    code: str
    message: str
