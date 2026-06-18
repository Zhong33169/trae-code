from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models import RoleEnum, ApplicationStatusEnum, MaterialTypeEnum, AuditActionEnum


class UserBase(BaseModel):
    username: str
    full_name: str
    role: RoleEnum


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MaterialBase(BaseModel):
    material_type: MaterialTypeEnum
    material_name: str
    file_path: Optional[str] = None


class MaterialCreate(MaterialBase):
    pass


class MaterialResponse(MaterialBase):
    id: int
    is_approved: Optional[bool] = None
    review_comment: Optional[str] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


class MaterialUpdate(BaseModel):
    is_approved: Optional[bool] = None
    review_comment: Optional[str] = None


class ApplicationBase(BaseModel):
    company_name: str
    contact_person: str
    contact_phone: str
    contact_email: Optional[str] = None
    booth_type: Optional[str] = None
    booth_size: Optional[str] = None
    expected_area: Optional[float] = None
    industry: Optional[str] = None
    product_description: Optional[str] = None


class ApplicationCreate(ApplicationBase):
    materials: Optional[List[MaterialCreate]] = None


class ApplicationUpdate(ApplicationBase):
    version: int
    materials: Optional[List[MaterialCreate]] = None


class ApplicationResponse(ApplicationBase):
    id: int
    application_no: str
    status: ApplicationStatusEnum
    is_overdue: bool
    overdue_reason: Optional[str] = None
    status_changed_at: datetime
    deadline_at: Optional[datetime] = None
    audit_opinion: Optional[str] = None
    review_opinion: Optional[str] = None
    correction_request: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    version: int
    materials: List[MaterialResponse] = []

    class Config:
        from_attributes = True


class ApplicationDetailResponse(ApplicationResponse):
    audit_logs: List["AuditLogResponse"] = []


class ApplicationListResponse(BaseModel):
    items: List[ApplicationResponse]
    total: int
    page: int
    page_size: int


class SubmitApplicationRequest(BaseModel):
    application_id: int


class AuditRequest(BaseModel):
    version: int
    opinion: Optional[str] = None
    remark: Optional[str] = None
    material_reviews: Optional[dict] = None


class StartAuditRequest(BaseModel):
    version: int
    remark: Optional[str] = None


class CorrectionRequest(BaseModel):
    version: int
    correction_request: str
    material_reviews: Optional[dict] = None


class CorrectRequest(BaseModel):
    version: int
    materials: Optional[List[MaterialCreate]] = None
    remark: Optional[str] = None


class SubmitRequest(BaseModel):
    version: int


class BatchItem(BaseModel):
    id: int
    version: int


class BatchActionRequest(BaseModel):
    items: List[BatchItem]
    action: str
    remark: Optional[str] = None


class AuditLogBase(BaseModel):
    action: AuditActionEnum
    action_name: str
    from_status: Optional[ApplicationStatusEnum] = None
    to_status: Optional[ApplicationStatusEnum] = None
    remark: Optional[str] = None


class AuditLogResponse(AuditLogBase):
    id: int
    application_id: int
    operator_id: int
    operator_name: str = "系统"
    created_at: datetime

    class Config:
        from_attributes = True


ApplicationDetailResponse.model_rebuild()


class StatisticsResponse(BaseModel):
    total: int
    draft: int
    pending_audit: int
    under_review: int
    pending_correction: int
    pending_review: int
    passed: int
    rejected: int
    archived: int
    overdue: int
    correction_overdue: int
    review_overdue: int
