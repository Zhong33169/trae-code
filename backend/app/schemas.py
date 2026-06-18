import enum
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

from .models import (
    Role, Stage, Status, AppealResult, EvidenceType, ActionType,
    ROLE_LABELS, STAGE_LABELS, STATUS_LABELS, EVIDENCE_TYPE_LABELS
)


class UserBase(BaseModel):
    name: str
    role: Role
    department: Optional[str] = None


class UserCreate(UserBase):
    pass


class User(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

    @property
    def role_label(self) -> str:
        return ROLE_LABELS.get(self.role, str(self.role))


class EvidenceBase(BaseModel):
    name: str
    evidence_type: EvidenceType
    file_path: Optional[str] = None
    description: Optional[str] = None


class EvidenceCreate(EvidenceBase):
    uploaded_by_id: int


class Evidence(EvidenceBase):
    id: int
    project_id: int
    uploaded_by_id: int
    uploaded_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @property
    def evidence_type_label(self) -> str:
        return EVIDENCE_TYPE_LABELS.get(self.evidence_type, str(self.evidence_type))


class AppealRecordBase(BaseModel):
    appeal_reason: str
    submitter_opinion: Optional[str] = None


class AppealRecordCreate(AppealRecordBase):
    submitter_id: int


class AppealRecordReview(BaseModel):
    reviewer_id: int
    reviewer_opinion: str
    result: AppealResult


class AppealRecord(AppealRecordBase):
    id: int
    project_id: int
    version: int
    submitter_id: int
    submitter_name: str
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    reviewer_opinion: Optional[str] = None
    result: AppealResult
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class OperationLogBase(BaseModel):
    pass


class OperationLog(OperationLogBase):
    id: int
    project_id: int
    user_id: int
    user_role: Role
    user_name: str
    action: ActionType
    from_status: Optional[Status] = None
    to_status: Optional[Status] = None
    stage: Optional[Stage] = None
    version: Optional[int] = None
    comment: Optional[str] = None
    opinion: Optional[str] = None
    reject_reason: Optional[str] = None
    audit_note: Optional[str] = None
    recovery_source: Optional[Status] = None
    next_handler_id: Optional[int] = None
    next_handler_name: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @property
    def recovery_source_label(self) -> Optional[str]:
        return STATUS_LABELS.get(self.recovery_source) if self.recovery_source else None

    @property
    def user_role_label(self) -> str:
        return ROLE_LABELS.get(self.user_role, str(self.user_role))

    @property
    def stage_label(self) -> Optional[str]:
        return STAGE_LABELS.get(self.stage) if self.stage else None

    @property
    def from_status_label(self) -> Optional[str]:
        return STATUS_LABELS.get(self.from_status) if self.from_status else None

    @property
    def to_status_label(self) -> Optional[str]:
        return STATUS_LABELS.get(self.to_status) if self.to_status else None


class TrainingProjectBase(BaseModel):
    project_name: str
    client_company: str
    stage: Stage = Stage.NEED
    description: Optional[str] = None
    budget: Optional[float] = None
    deadline: Optional[datetime] = None


class TrainingProjectCreate(TrainingProjectBase):
    created_by_id: int


class TrainingProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    client_company: Optional[str] = None
    description: Optional[str] = None
    budget: Optional[float] = None
    deadline: Optional[datetime] = None


class SubmitData(BaseModel):
    current_user_id: int
    comment: Optional[str] = None


class ReviewData(BaseModel):
    current_user_id: int
    opinion: Optional[str] = None
    reject_reason: Optional[str] = None
    next_stage: Optional[Stage] = None


class ReturnForCorrectionData(BaseModel):
    current_user_id: int
    reject_reason: str
    opinion: Optional[str] = None


class CorrectData(BaseModel):
    current_user_id: int
    comment: Optional[str] = None


class ConflictRecoveryData(BaseModel):
    current_user_id: int
    comment: Optional[str] = None
    audit_note: Optional[str] = None


class AppealSubmitData(BaseModel):
    current_user_id: int
    appeal_reason: str
    submitter_opinion: Optional[str] = None


class AppealReviewData(BaseModel):
    current_user_id: int
    reviewer_opinion: str
    result: AppealResult


class TrainingProject(TrainingProjectBase):
    id: int
    project_no: str
    status: Status
    version: int
    created_by_id: int
    current_handler_id: Optional[int] = None
    is_overdue: bool = False
    created_at: datetime
    updated_at: datetime

    created_by: Optional[User] = None
    current_handler: Optional[User] = None
    evidences: List[Evidence] = []
    operation_logs: List[OperationLog] = []
    appeals: List[AppealRecord] = []

    model_config = ConfigDict(from_attributes=True)

    @property
    def stage_label(self) -> str:
        return STAGE_LABELS.get(self.stage, str(self.stage))

    @property
    def status_label(self) -> str:
        return STATUS_LABELS.get(self.status, str(self.status))

    @property
    def last_handler_opinion(self) -> Optional[dict]:
        review_logs = [
            log for log in self.operation_logs
            if log.action in [
                ActionType.REVIEW_APPROVE,
                ActionType.REVIEW_REJECT,
                ActionType.RETURN_FOR_CORRECTION,
                ActionType.APPEAL_REVIEW,
                ActionType.APPEAL_APPROVE,
                ActionType.APPEAL_REJECT
            ]
        ]
        if review_logs:
            last = review_logs[-1]
            return {
                "user_name": last.user_name,
                "user_role": last.user_role,
                "user_role_label": ROLE_LABELS.get(last.user_role, str(last.user_role)),
                "opinion": last.opinion,
                "reject_reason": last.reject_reason,
                "action": last.action,
                "created_at": last.created_at,
                "from_status": last.from_status,
                "from_status_label": STATUS_LABELS.get(last.from_status) if last.from_status else None,
                "to_status": last.to_status,
                "to_status_label": STATUS_LABELS.get(last.to_status) if last.to_status else None,
            }
        return None


class ConflictFilter(str, enum.Enum):
    PENDING_CONFLICT = "pending_conflict"
    CONFLICT_RECOVERED = "conflict_recovered"
    RECOVERED_PENDING_RECEIVE = "recovered_pending_receive"


class TrainingProjectListItem(BaseModel):
    id: int
    project_no: str
    project_name: str
    client_company: str
    stage: Stage
    status: Status
    version: int
    current_handler_name: Optional[str] = None
    current_handler_role: Optional[Role] = None
    created_at: datetime
    updated_at: datetime
    is_overdue: bool = False
    recovery_summary: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @property
    def stage_label(self) -> str:
        return STAGE_LABELS.get(self.stage, str(self.stage))

    @property
    def status_label(self) -> str:
        return STATUS_LABELS.get(self.status, str(self.status))

    @property
    def current_handler_role_label(self) -> Optional[str]:
        return ROLE_LABELS.get(self.current_handler_role) if self.current_handler_role else None


class Statistics(BaseModel):
    total: int = 0
    draft: int = 0
    submitted: int = 0
    under_review: int = 0
    returned: int = 0
    approved: int = 0
    rejected: int = 0
    appeal_submitted: int = 0
    appeal_under_review: int = 0
    appeal_approved: int = 0
    appeal_rejected: int = 0
    overdue: int = 0
    archived: int = 0
    pending_conflict: int = 0
    conflict_recovered: int = 0
    recovered_pending_receive: int = 0
    by_stage_need: int = 0
    by_stage_quotation: int = 0
    by_stage_contract: int = 0


class LabelMap(BaseModel):
    roles: dict
    stages: dict
    statuses: dict
    evidence_types: dict
