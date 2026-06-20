from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class LoginRequest(BaseModel):
    username: str


class MaterialItem(BaseModel):
    id: Optional[int] = None
    name: str
    is_required: bool = True
    is_submitted: bool = False
    submitted_at: Optional[str] = None
    remarks: Optional[str] = None
    category: str = "transfer"


class CreateApplicationRequest(BaseModel):
    seller_name: str
    seller_id_no: str
    buyer_name: str
    buyer_id_no: str
    vehicle_plate: str
    vehicle_vin: str
    vehicle_brand: str


class ActionRequest(BaseModel):
    action: str
    opinion: Optional[str] = None
    materials: Optional[List[MaterialItem]] = None
    correction_materials: Optional[List[MaterialItem]] = None
    version: int


class BatchItem(BaseModel):
    id: int
    version: int


class BatchActionRequest(BaseModel):
    items: List[BatchItem]
    action: str
    opinion: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: int
    application_no: str
    seller_name: str
    seller_id_no: str
    buyer_name: str
    buyer_id_no: str
    vehicle_plate: str
    vehicle_vin: str
    vehicle_brand: str
    status: str
    current_role: str
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    deadline_at: Optional[str] = None
    overdue_reason: Optional[str] = None
    overdue_action: Optional[str] = None
    created_at: str
    updated_at: str
    version: int
    materials: List[MaterialItem] = []
    last_action: Optional[str] = None
    last_action_result: Optional[str] = None


class ApplicationListItem(BaseModel):
    id: int
    application_no: str
    seller_name: str
    buyer_name: str
    vehicle_plate: str
    vehicle_brand: str
    status: str
    current_role: str
    assignee_name: Optional[str] = None
    deadline_at: Optional[str] = None
    overdue_reason: Optional[str] = None
    overdue_action: Optional[str] = None
    updated_at: str
    version: int
    last_action: Optional[str] = None
    last_action_result: Optional[str] = None
    is_overdue: bool = False


class QueueStats(BaseModel):
    role: str
    total: int
    statuses: dict


class CorrectionRecordResponse(BaseModel):
    id: int
    application_id: int
    correction_no: str
    reason: str
    required_materials: str
    deadline_at: str
    status: str
    submitted_at: Optional[str] = None
    review_opinion: Optional[str] = None
    created_at: str


class ProcessRecordResponse(BaseModel):
    id: int
    application_id: int
    action: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    operator_id: int
    operator_name: str
    operator_role: str
    opinion: Optional[str] = None
    materials_snapshot: Optional[str] = None
    created_at: str


class AuditLogResponse(BaseModel):
    id: int
    application_id: Optional[int] = None
    action: str
    actor_id: int
    actor_name: str
    actor_role: str
    detail: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: str


class DashboardStats(BaseModel):
    total: int
    by_status: dict
    by_role: dict
    overdue_count: int
