from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from models.inspection import InspectionStatus


class BatchProcessItem(BaseModel):
    inspection_order_id: int
    order_no: str
    target_status: InspectionStatus
    opinion: Optional[str] = None
    signature: Optional[str] = None
    current_version: Optional[int] = None


class BatchProcessRequest(BaseModel):
    items: List[BatchProcessItem]
    request_id: Optional[str] = None
    operation: str


class BatchItemResult(BaseModel):
    inspection_order_id: int
    order_no: str
    success: bool
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    previous_status: Optional[InspectionStatus] = None
    current_status: Optional[InspectionStatus] = None
    suggestion: Optional[str] = None
    next_step: Optional[str] = None


class BatchStatistics(BaseModel):
    total_count: int
    success_count: int
    failed_count: int
    skipped_count: int = 0


class BatchProcessResult(BaseModel):
    success: bool
    message: str
    statistics: BatchStatistics
    results: List[BatchItemResult]
    request_id: Optional[str] = None
    completed_at: datetime
