from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from models.inspection import InspectionStatus, InspectionType
from schemas.charging_pile import ChargingPileResponse
from schemas.qr_record import QRCodeRecordResponse
from schemas.fault_report import FaultReportResponse
from schemas.repair_acceptance import RepairAcceptanceResponse


class InspectionOrderBase(BaseModel):
    type: InspectionType
    charging_pile_id: int
    inspection_date: date
    inspector_name: str
    appearance_check: Optional[str] = None
    appearance_note: Optional[str] = None
    cable_check: Optional[str] = None
    cable_note: Optional[str] = None
    connector_check: Optional[str] = None
    connector_note: Optional[str] = None
    display_check: Optional[str] = None
    display_note: Optional[str] = None
    charging_check: Optional[str] = None
    charging_note: Optional[str] = None
    emergency_stop_check: Optional[str] = None
    emergency_stop_note: Optional[str] = None
    grounding_check: Optional[str] = None
    grounding_note: Optional[str] = None
    overall_result: Optional[str] = None
    registrar_opinion: Optional[str] = None
    time_limit: Optional[datetime] = None


class InspectionOrderCreate(InspectionOrderBase):
    pass


class InspectionOrderUpdate(InspectionOrderBase):
    pass


class StatusUpdateRequest(BaseModel):
    target_status: InspectionStatus
    opinion: Optional[str] = None
    signature: Optional[str] = None
    request_id: Optional[str] = None
    current_version: Optional[int] = None


class InspectionOrderResponse(BaseModel):
    id: int
    order_no: str
    type: InspectionType
    type_label: str
    status: InspectionStatus
    status_label: str
    charging_pile_id: int
    charging_pile: ChargingPileResponse
    inspection_date: date
    inspector_name: str
    appearance_check: Optional[str] = None
    appearance_note: Optional[str] = None
    cable_check: Optional[str] = None
    cable_note: Optional[str] = None
    connector_check: Optional[str] = None
    connector_note: Optional[str] = None
    display_check: Optional[str] = None
    display_note: Optional[str] = None
    charging_check: Optional[str] = None
    charging_note: Optional[str] = None
    emergency_stop_check: Optional[str] = None
    emergency_stop_note: Optional[str] = None
    grounding_check: Optional[str] = None
    grounding_note: Optional[str] = None
    overall_result: Optional[str] = None
    registrar_opinion: Optional[str] = None
    supervisor_opinion: Optional[str] = None
    supervisor_review_date: Optional[datetime] = None
    reviewer_opinion: Optional[str] = None
    reviewer_review_date: Optional[datetime] = None
    time_limit: Optional[datetime] = None
    is_overdue: bool = False
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    version: int
    can_operate: bool = False
    allowed_actions: List[str] = []

    class Config:
        from_attributes = True


class InspectionOrderListResponse(BaseModel):
    total: int
    items: List[InspectionOrderResponse]
    page: int
    page_size: int
    statistics: dict


class InspectionOrderWithDetails(InspectionOrderResponse):
    qr_records: List[QRCodeRecordResponse] = []
    fault_report: Optional[FaultReportResponse] = None
    repair_acceptance: Optional[RepairAcceptanceResponse] = None
    can_operate: bool = False
    allowed_actions: List[str] = []
