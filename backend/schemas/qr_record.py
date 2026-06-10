from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models.qr_record import ScanResult
from schemas.user import UserResponse


class QRCodeScanRequest(BaseModel):
    qr_code_content: str
    inspection_order_id: Optional[int] = None
    location_evidence: Optional[str] = None
    photo_evidence_path: Optional[str] = None
    note: Optional[str] = None
    request_id: Optional[str] = None


class QRCodeBatchScanRequest(BaseModel):
    items: List[QRCodeScanRequest]


class ScanResultResponse(BaseModel):
    success: bool
    result: ScanResult
    result_label: str
    message: str
    record_id: Optional[int] = None
    inspection_order_id: Optional[int] = None
    inspection_order_no: Optional[str] = None
    scan_time: Optional[datetime] = None
    next_step: Optional[str] = None
    suggestion: Optional[str] = None


class QRCodeRecordResponse(BaseModel):
    id: int
    qr_code_content: str
    scan_time: datetime
    result: ScanResult
    result_label: str
    scanned_by: int
    scanner: Optional[UserResponse] = None
    inspection_order_id: Optional[int] = None
    charging_pile_id: Optional[int] = None
    location_evidence: Optional[str] = None
    photo_evidence_path: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
