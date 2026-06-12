from ninja import Schema
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class ApplicationCreate(Schema):
    applicant_name: str
    applicant_id_card: str
    difficulty_type: str
    difficulty_description: str
    assistance_amount: Decimal


class ApplicationOut(Schema):
    id: int
    application_no: str
    creator_id: int
    creator_name: str
    applicant_name: str
    applicant_id_card: str
    difficulty_type: str
    difficulty_description: str
    assistance_amount: Decimal
    status: str
    version: int
    created_at: datetime
    deadline: Optional[datetime]
    submitted_at: Optional[datetime]
    verified_at: Optional[datetime]
    approved_at: Optional[datetime]
    opinion_text: str
    available_actions: List[str] = []


class ApplicationDetailOut(ApplicationOut):
    materials: List["MaterialOut"] = []
    scan_records: List["ScanRecordOut"] = []
    audit_logs: List["AuditLogOut"] = []


class MaterialOut(Schema):
    id: int
    application_id: int
    stage: str
    file_name: str
    file_path: str
    material_type: str
    uploaded_at: datetime


class MaterialCreate(Schema):
    stage: str
    file_name: str
    file_path: str
    material_type: str = ""


class ScanRecordOut(Schema):
    id: int
    application_id: Optional[int]
    scanner_id: int
    scanner_name: str = ""
    code: str
    credential_no: str
    result: str
    scan_time: datetime


class AuditLogOut(Schema):
    id: int
    application_id: int
    operator_id: int
    operator_name: str
    action: str
    from_status: str
    to_status: str
    opinion: str
    extra_data: dict
    created_at: datetime


class AdvanceRequest(Schema):
    action: str
    opinion: str = ""
    materials: List[MaterialCreate] = []


class AdvanceResponse(Schema):
    success: bool
    message: str
    application: Optional[ApplicationOut] = None


class BatchAdvanceItem(Schema):
    application_id: int
    action: str
    opinion: str = ""
    materials: List[MaterialCreate] = []
    version: int = 1


class BatchAdvanceRequest(Schema):
    items: List[BatchAdvanceItem]


class BatchAdvanceItemResult(Schema):
    application_id: int
    application_no: str = ""
    success: bool
    error: str = ""
    suggestion: str = ""


class BatchAdvanceResponse(Schema):
    results: List[BatchAdvanceItemResult]
    batch_id: str = ""


class BatchFailRecordOut(Schema):
    id: int
    batch_id: str
    application_id: int
    application_no: str
    operator_name: str
    action: str
    error: str
    suggestion: str
    created_at: datetime


class ScanVerifyRequest(Schema):
    code: str
    credential_no: str = ""


class ScanVerifyResponse(Schema):
    result: str
    message: str
    application: Optional[ApplicationOut] = None
    credential_no: str = ""
    scan_time: str = ""


class StatsSummary(Schema):
    pending_count: int
    done_count: int
    overdue_count: int
    today_scan_count: int


ApplicationDetailOut.model_rebuild()
