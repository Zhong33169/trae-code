from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class UserInfo(BaseModel):
    id: int
    username: str
    name: str
    role: str

    class Config:
        from_attributes = True


class EvidenceItemBase(BaseModel):
    evidence_type: str
    evidence_name: str
    is_provided: int = 0
    is_required: int = 1


class EvidenceItem(EvidenceItemBase):
    id: int
    application_id: int
    verified_at: Optional[datetime] = None
    verified_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AccountApplicationBase(BaseModel):
    applicant_name: str
    applicant_id_card: str
    applicant_phone: Optional[str] = None
    account_type: str
    risk_level: str = "low"
    risk_reason: Optional[str] = None
    deadline: Optional[datetime] = None


class AccountApplicationCreate(AccountApplicationBase):
    evidences: List[EvidenceItemBase]


class AccountApplicationUpdate(BaseModel):
    operator_id: int
    operator_role: str
    target_stage: Optional[str] = None
    target_status: Optional[str] = None
    new_risk_level: Optional[str] = None
    risk_change_reason: Optional[str] = None
    remark: Optional[str] = None
    evidence_ids_verified: Optional[List[int]] = None
    returned_reason: Optional[str] = None
    is_returned: Optional[int] = None
    is_evidence_missing: Optional[int] = None


class AccountApplication(BaseModel):
    id: int
    application_no: str
    applicant_name: str
    applicant_id_card: str
    applicant_phone: Optional[str] = None
    account_type: str
    risk_level: str
    risk_reason: Optional[str] = None
    stage: str
    status: str
    current_handler_id: Optional[int] = None
    current_handler_name: Optional[str] = None
    current_handler_role: Optional[str] = None
    version: int
    deadline: Optional[datetime] = None
    is_overdue: int
    is_evidence_missing: int
    is_returned: int
    returned_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    evidences: Optional[List[EvidenceItem]] = None

    class Config:
        from_attributes = True


class OperationRecord(BaseModel):
    id: int
    application_id: int
    operator_id: int
    operator_role: str
    operator_name: Optional[str] = None
    operation_type: str
    from_stage: Optional[str] = None
    to_stage: Optional[str] = None
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    from_risk_level: Optional[str] = None
    to_risk_level: Optional[str] = None
    remark: Optional[str] = None
    evidence_checked: Optional[str] = None
    version_before: Optional[int] = None
    version_after: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RiskLevelLog(BaseModel):
    id: int
    application_id: int
    operator_id: int
    operator_role: str
    operator_name: Optional[str] = None
    from_level: str
    to_level: str
    change_reason: str
    created_at: datetime

    class Config:
        from_attributes = True


class StatisticsResponse(BaseModel):
    total_count: int
    pending_count: int
    abnormal_count: int
    done_count: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    overdue_count: int
    stage_booking_count: int
    stage_review_count: int
    stage_enable_count: int


class OperationSubmitRequest(BaseModel):
    operator_id: int
    operator_role: str
    application_id: int
    current_version: int
    action: str
    remark: Optional[str] = None
    new_risk_level: Optional[str] = None
    risk_change_reason: Optional[str] = None
    evidence_ids_verified: Optional[List[int]] = None
    returned_reason: Optional[str] = None
