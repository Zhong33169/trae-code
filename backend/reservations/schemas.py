from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class UserProfileOut(BaseModel):
    id: int
    username: str
    role: str
    role_display: str
    department: str

    class Config:
        from_attributes = True


class LoginIn(BaseModel):
    username: str
    password: str


class LoginOut(BaseModel):
    user: UserProfileOut
    message: str


class EvidenceOut(BaseModel):
    id: int
    evidence_type: str
    evidence_type_display: str
    title: str
    description: str
    uploaded_by: str
    uploaded_at: datetime
    version: int
    is_supplementary: bool

    class Config:
        from_attributes = True


class SupplementaryRecordOut(BaseModel):
    id: int
    action: str
    action_display: str
    description: str
    supplementer: str
    supplementary_at: datetime
    previous_status: str
    new_status: str
    related_evidence_id: Optional[int] = None

    class Config:
        from_attributes = True


class AuditLogOut(BaseModel):
    id: int
    action: str
    action_display: str
    actor: str
    action_time: datetime
    comment: str
    previous_status: str
    new_status: str
    reason: str

    class Config:
        from_attributes = True


class LabReservationListItem(BaseModel):
    id: int
    reservation_no: str
    title: str
    lab_name: str
    experiment_name: str
    applicant: str
    department: str
    status: str
    status_display: str
    version: int
    start_time: datetime
    end_time: datetime
    student_count: int
    has_experiment_plan: bool
    has_material_application: bool
    has_safety_confirmation: bool
    created_at: datetime
    updated_at: datetime
    rejection_reason: str
    supplementary_count: int = 0

    class Config:
        from_attributes = True


class LabReservationDetail(BaseModel):
    id: int
    reservation_no: str
    title: str
    lab_name: str
    course_name: str
    experiment_name: str
    applicant: str
    department: str
    status: str
    status_display: str
    version: int
    start_time: datetime
    end_time: datetime
    student_count: int
    has_experiment_plan: bool
    has_material_application: bool
    has_safety_confirmation: bool
    missing_evidence: List[str]
    created_at: datetime
    updated_at: datetime
    submitted_at: Optional[datetime] = None
    lab_reviewed_at: Optional[datetime] = None
    lab_reviewer: Optional[str] = None
    lab_review_comment: str
    confirmed_at: Optional[datetime] = None
    confirmer: Optional[str] = None
    confirm_comment: str
    rejection_reason: str
    rejected_by: Optional[str] = None
    rejected_at: Optional[datetime] = None
    can_submit: bool
    can_lab_review: bool
    can_college_confirm: bool
    can_supplement: bool
    submit_error: str
    lab_review_error: str
    college_confirm_error: str
    supplement_error: str

    class Config:
        from_attributes = True


class ReservationCreateIn(BaseModel):
    title: str
    lab_name: str
    course_name: str = ''
    experiment_name: str
    department: str
    start_time: datetime
    end_time: datetime
    student_count: int = 0


class ReservationUpdateIn(BaseModel):
    title: Optional[str] = None
    lab_name: Optional[str] = None
    course_name: Optional[str] = None
    experiment_name: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    student_count: Optional[int] = None
    expected_version: int = Field(..., description='当前版本号，用于乐观锁校验')


class SubmitIn(BaseModel):
    expected_version: int = Field(..., description='当前版本号，用于乐观锁校验')


class ReviewIn(BaseModel):
    pass_: bool = Field(..., alias='pass')
    comment: str = ''
    expected_version: int = Field(..., description='当前版本号，用于乐观锁校验')


class CollegeConfirmIn(BaseModel):
    pass_: bool = Field(..., alias='pass')
    comment: str = ''
    expected_version: int = Field(..., description='当前版本号，用于乐观锁校验')


class SupplementEvidenceIn(BaseModel):
    evidence_type: str
    title: str
    description: str = ''
    expected_version: int = Field(..., description='当前版本号，用于乐观锁校验')


class BatchOperationIn(BaseModel):
    ids: List[int]
    expected_versions: List[int]
    operation: str
    comment: str = ''


class ApiError(BaseModel):
    detail: str
    code: str = 'error'
    errors: Optional[List[str]] = None


class ReservationListResponse(BaseModel):
    items: List[LabReservationListItem]
    total: int
    page: int
    page_size: int
