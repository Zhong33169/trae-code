from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from ninja import Schema, ModelSchema
from apps.loan.models import (
    ExtensionApplication,
    RepaymentPlan,
    Material,
    AuditLog,
    QrCodeRecord,
    BatchTask,
    BatchTaskItem,
)


class LoginSchema(Schema):
    username: str


class UserInfoSchema(Schema):
    id: int
    username: str
    role_code: str
    role_name: str
    department: str = ''


class LoginResponseSchema(Schema):
    token: str
    user: UserInfoSchema


class ErrorResponseSchema(Schema):
    code: str
    message: str
    detail: Optional[str] = None


class PaginationSchema(Schema):
    page: int = 1
    page_size: int = 20
    total: int = 0


class ApplicationListQuerySchema(Schema):
    status: Optional[str] = None
    keyword: Optional[str] = None
    is_urgent: Optional[bool] = None
    page: int = 1
    page_size: int = 20


class ApplicationSchema(Schema):
    id: int
    application_no: str
    qr_code: str
    borrower_name: str
    borrower_id_card: str
    borrower_phone: str
    loan_contract_no: str
    original_principal: Decimal
    original_interest_rate: Decimal
    original_due_date: date
    extension_days: int
    extension_reason: str
    new_due_date: date
    new_interest_rate: Optional[Decimal] = None
    status: str
    status_display: str
    current_handler_role: str
    registrar_name: str
    reviewer_name: Optional[str] = None
    final_reviewer_name: Optional[str] = None
    review_opinion: str = ''
    final_review_opinion: str = ''
    is_urgent: bool
    deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    version: int


class ApplicationListResponseSchema(Schema):
    items: List[ApplicationSchema]
    page: int
    page_size: int
    total: int


class ApplicationCreateSchema(Schema):
    borrower_name: str
    borrower_id_card: str
    borrower_phone: str
    loan_contract_no: str
    original_principal: Decimal
    original_interest_rate: Decimal
    original_due_date: date
    extension_days: int
    extension_reason: str
    is_urgent: bool = False


class ApplicationUpdateSchema(Schema):
    borrower_name: Optional[str] = None
    borrower_phone: Optional[str] = None
    extension_days: Optional[int] = None
    extension_reason: Optional[str] = None
    is_urgent: Optional[bool] = None


class RepaymentPlanSchema(Schema):
    id: int
    plan_no: int
    due_date: date
    principal: Decimal
    interest: Decimal
    total_amount: Decimal
    is_extension_period: bool


class MaterialSchema(Schema):
    id: int
    material_type: str
    material_type_display: str
    material_name: str
    is_required: bool
    is_verified: bool
    upload_time: datetime


class ApplicationDetailSchema(ApplicationSchema):
    repayment_plans: List[RepaymentPlanSchema] = []
    materials: List[MaterialSchema] = []


class ReviewSchema(Schema):
    application_id: int
    approved: bool
    opinion: str
    new_interest_rate: Optional[Decimal] = None


class FinalReviewSchema(Schema):
    application_id: int
    approved: bool
    opinion: str


class QrCodeScanSchema(Schema):
    qr_code: str
    location: str = ''


class QrCodeScanResultSchema(Schema):
    success: bool
    scan_result: str
    scan_result_display: str
    error_message: str
    application: Optional[ApplicationDetailSchema] = None


class AuditLogSchema(Schema):
    id: int
    application_no: Optional[str] = None
    operator_name: str
    action: str
    action_display: str
    action_detail: str
    old_status: str
    new_status: str
    remark: str
    created_at: datetime


class AuditLogQuerySchema(Schema):
    application_no: Optional[str] = None
    action: Optional[str] = None
    operator_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    page: int = 1
    page_size: int = 20


class AuditLogListResponseSchema(Schema):
    items: List[AuditLogSchema]
    page: int
    page_size: int
    total: int


class DashboardStatsSchema(Schema):
    total_count: int
    pending_count: int
    my_pending_count: int
    approved_count: int
    rejected_count: int
    urgent_count: int
    returned_count: int


class BatchProcessSchema(Schema):
    application_ids: List[int]
    action: str
    remark: str = ''


class BatchTaskItemSchema(Schema):
    id: int
    application_id: int
    application_no: str
    borrower_name: str
    status: str
    status_display: str
    error_code: str
    error_message: str
    next_step: str
    processed_at: Optional[datetime] = None


class BatchTaskSchema(Schema):
    id: int
    task_no: str
    action: str
    action_display: str
    total_count: int
    success_count: int
    failed_count: int
    status: str
    status_display: str
    remark: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    items: List[BatchTaskItemSchema] = []


class BatchTaskListResponseSchema(Schema):
    items: List[BatchTaskSchema]
    page: int
    page_size: int
    total: int
