from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any, Generic, TypeVar
from enum import Enum

T = TypeVar("T")

from pydantic import BaseModel, Field, field_validator

from .models import UserRole, InspectionStatus, RiskLevel, InspectionResult, OperationType


class EnergyBillBase(BaseModel):
    customer_name: str = Field(..., max_length=200, description="客户名称")
    customer_id: str = Field(..., max_length=50, description="客户编号")
    billing_month: str = Field(..., max_length=7, description="账单月份 YYYY-MM")
    consumption: float = Field(..., gt=0, description="用电量（度）")
    unit_price: float = Field(..., gt=0, description="单价（元/度）")
    total_amount: float = Field(..., gt=0, description="总金额（元）")
    payment_status: str = Field(default="unpaid", max_length=20, description="缴费状态")
    due_date: Optional[datetime] = Field(None, description="缴费截止日期")
    meter_reading: Optional[float] = Field(None, description="电表读数")
    last_meter_reading: Optional[float] = Field(None, description="上次电表读数")
    location: Optional[str] = Field(None, max_length=500, description="用电地址")
    remark: Optional[str] = Field(None, description="备注")


class EnergyBillCreate(EnergyBillBase):
    pass


class EnergyBillPartialUpdate(BaseModel):
    customer_name: Optional[str] = Field(None, max_length=200)
    customer_id: Optional[str] = Field(None, max_length=50)
    billing_month: Optional[str] = Field(None, max_length=7)
    consumption: Optional[float] = Field(None, gt=0)
    unit_price: Optional[float] = Field(None, gt=0)
    total_amount: Optional[float] = Field(None, gt=0)
    payment_status: Optional[str] = Field(None, max_length=20)
    due_date: Optional[datetime] = None
    meter_reading: Optional[float] = None
    last_meter_reading: Optional[float] = None
    location: Optional[str] = Field(None, max_length=500)
    remark: Optional[str] = None


class EnergyBillBatchUpdate(BaseModel):
    ids: List[int]
    update_data: EnergyBillPartialUpdate


class EnergyBillImportItem(BaseModel):
    customer_name: str
    customer_id: str
    billing_month: str
    consumption: float
    unit_price: float
    total_amount: float
    payment_status: Optional[str] = "unpaid"
    due_date: Optional[datetime] = None
    location: Optional[str] = None


class EnergyBillImportRequest(BaseModel):
    items: List[EnergyBillImportItem]
    overwrite_existing: bool = False


class EnergyBillExportParams(BaseModel):
    start_month: Optional[str] = None
    end_month: Optional[str] = None
    payment_status: Optional[str] = None
    customer_id: Optional[str] = None
    export_format: str = "xlsx"


class EnergyBillStatistics(BaseModel):
    total_count: int = 0
    total_amount: float = 0
    paid_count: int = 0
    paid_amount: float = 0
    unpaid_count: int = 0
    unpaid_amount: float = 0
    overdue_count: int = 0
    overdue_amount: float = 0


class EnergyBillPaymentRecord(BaseModel):
    bill_id: int
    payment_amount: float
    payment_date: datetime
    payment_method: str = Field(..., max_length=50)
    transaction_id: Optional[str] = Field(None, max_length=100)
    remark: Optional[str] = None


class EnergyBillPaymentRequest(BaseModel):
    bill_ids: List[int]
    payment_date: datetime
    payment_method: str = Field(..., max_length=50)
    transaction_id: Optional[str] = None


class EnergyBillReminderParams(BaseModel):
    bill_ids: Optional[List[int]] = None
    due_before: Optional[datetime] = None
    reminder_type: str = "email"
    template_id: Optional[str] = None


class EnergyBillWriteOffRequest(BaseModel):
    bill_ids: List[int]
    write_off_reason: str
    write_off_date: datetime
    approved_by: int



class EnergyBillUpdate(EnergyBillBase):
    customer_name: Optional[str] = Field(None, max_length=200, description="客户名称")
    customer_id: Optional[str] = Field(None, max_length=50, description="客户编号")
    billing_month: Optional[str] = Field(None, max_length=7, description="账单月份 YYYY-MM")
    consumption: Optional[float] = Field(None, gt=0, description="用电量（度）")
    unit_price: Optional[float] = Field(None, gt=0, description="单价（元/度）")
    total_amount: Optional[float] = Field(None, gt=0, description="总金额（元）")
    payment_status: Optional[str] = Field(None, max_length=20, description="缴费状态")


class EnergyBill(EnergyBillBase):
    id: int
    created_at: datetime
    updated_at: datetime
    version: int = 1

    class Config:
        from_attributes = True


class EnergyBillHistoryEntry(BaseModel):
    id: int
    bill_id: int
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: int
    changed_at: datetime


class EnergyBillAuditLogResponse(BaseModel):
    bill_id: int
    changes: List[EnergyBillHistoryEntry]


class UserBase(BaseModel):
    username: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    role: UserRole


class UserCreate(UserBase):
    pass


class User(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class EquipmentBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=200)
    location: str = Field(..., max_length=200)
    specification: Optional[str] = Field(None, max_length=500)


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(EquipmentBase):
    code: Optional[str] = Field(None, max_length=50)
    name: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=200)


class Equipment(EquipmentBase):
    id: int
    last_inspection_date: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InspectionCheckItems(BaseModel):
    appearance_check: Optional[bool] = None
    appearance_evidence: Optional[str] = Field(None, max_length=500)
    appearance_remark: Optional[str] = None

    function_check: Optional[bool] = None
    function_evidence: Optional[str] = Field(None, max_length=500)
    function_remark: Optional[str] = None

    safety_check: Optional[bool] = None
    safety_evidence: Optional[str] = Field(None, max_length=500)
    safety_remark: Optional[str] = None

    maintenance_check: Optional[bool] = None
    maintenance_evidence: Optional[str] = Field(None, max_length=500)
    maintenance_remark: Optional[str] = None


class InspectionOrderBase(BaseModel):
    equipment_id: int
    inspection_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    risk_level: RiskLevel = RiskLevel.LOW


class InspectionOrderCreate(InspectionOrderBase, InspectionCheckItems):
    pass


class InspectionOrderInitiate(BaseModel):
    equipment_id: int
    inspection_date: datetime
    due_date: datetime
    risk_level: RiskLevel = RiskLevel.LOW

    appearance_check: bool
    appearance_evidence: Optional[str] = None
    appearance_remark: Optional[str] = None

    function_check: bool
    function_evidence: Optional[str] = None
    function_remark: Optional[str] = None

    safety_check: bool
    safety_evidence: Optional[str] = None
    safety_remark: Optional[str] = None

    maintenance_check: bool
    maintenance_evidence: Optional[str] = None
    maintenance_remark: Optional[str] = None

    @field_validator('appearance_evidence', 'function_evidence', 'safety_evidence', 'maintenance_evidence')
    @classmethod
    def check_evidence_when_failed(cls, v: Optional[str], info) -> Optional[str]:
        field_name = info.field_name
        check_field = field_name.replace('_evidence', '_check')
        check_value = info.data.get(check_field)
        if check_value is False and not v:
            raise ValueError(f"检查不通过时必须提供{field_name.replace('_', ' ')}证据")
        return v


class InspectionOrderHandle(BaseModel):
    handler_opinion: str = Field(..., description="办理意见")
    handler_result: str = Field(..., max_length=100, description="办理结果")
    new_risk_level: Optional[RiskLevel] = Field(None, description="调整后的风险等级")
    risk_change_reason: Optional[str] = Field(None, description="风险等级变更原因")

    appearance_check: Optional[bool] = None
    appearance_evidence: Optional[str] = None
    appearance_remark: Optional[str] = None

    function_check: Optional[bool] = None
    function_evidence: Optional[str] = None
    function_remark: Optional[str] = None

    safety_check: Optional[bool] = None
    safety_evidence: Optional[str] = None
    safety_remark: Optional[str] = None

    maintenance_check: Optional[bool] = None
    maintenance_evidence: Optional[str] = None
    maintenance_remark: Optional[str] = None

    version: int = Field(..., description="当前版本号，用于乐观锁")


class InspectionOrderReview(BaseModel):
    reviewer_opinion: str = Field(..., description="复核意见")
    reviewer_result: str = Field(..., max_length=100, description="复核结论")
    is_approved: bool = Field(..., description="是否通过复核")
    version: int = Field(..., description="当前版本号，用于乐观锁")


class InspectionOrderReturn(BaseModel):
    opinion: str = Field(..., description="退回意见")
    version: int = Field(..., description="当前版本号，用于乐观锁")


class RiskLevelChangeRequest(BaseModel):
    new_risk_level: RiskLevel = Field(..., description="新的风险等级")
    reason: str = Field(..., description="变更原因")
    version: int = Field(..., description="当前版本号")


class InspectionOrderSubmitRequest(BaseModel):
    current_user_id: int = Field(..., description="当前操作人ID")
    expected_role: UserRole = Field(..., description="预期操作角色")
    expected_status: InspectionStatus = Field(..., description="预期当前状态")
    version: int = Field(..., description="当前版本号")
    required_evidences: Optional[List[str]] = Field(None, description="必填证据字段列表")


class OperationRecordBase(BaseModel):
    operation_type: OperationType
    opinion: Optional[str] = None
    result: Optional[str] = None
    remark: Optional[str] = None


class OperationRecord(OperationRecordBase):
    id: int
    inspection_order_id: int
    operator_id: int
    operator_name: Optional[str] = None
    from_status: Optional[InspectionStatus] = None
    to_status: Optional[InspectionStatus] = None
    from_risk_level: Optional[RiskLevel] = None
    to_risk_level: Optional[RiskLevel] = None
    version: Optional[int] = None
    operated_at: datetime

    class Config:
        from_attributes = True


class RiskLevelChangeBase(BaseModel):
    from_level: RiskLevel
    to_level: RiskLevel
    reason: str


class RiskLevelChange(RiskLevelChangeBase):
    id: int
    inspection_order_id: int
    operator_id: int
    operator_name: Optional[str] = None
    changed_at: datetime

    class Config:
        from_attributes = True


class FaultReportBase(BaseModel):
    fault_description: str = Field(..., description="故障描述")
    fault_level: RiskLevel = Field(..., description="故障风险等级")


class FaultReportCreate(FaultReportBase):
    inspection_order_id: int


class FaultReport(FaultReportBase):
    id: int
    inspection_order_id: int
    reported_by: int
    reported_by_name: Optional[str] = None
    reported_at: datetime
    is_resolved: bool
    resolved_by: Optional[int] = None
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None

    class Config:
        from_attributes = True


class RecoveryConfirmBase(BaseModel):
    confirmation_remark: str = Field(..., description="恢复确认说明")
    is_successful: bool = Field(default=True, description="是否成功恢复")
    evidence_path: Optional[str] = Field(None, description="恢复证据")


class RecoveryConfirmCreate(RecoveryConfirmBase):
    fault_report_id: int


class RecoveryConfirm(RecoveryConfirmBase):
    id: int
    fault_report_id: int
    confirmed_by: int
    confirmed_by_name: Optional[str] = None
    confirmed_at: datetime

    class Config:
        from_attributes = True


class InspectionOrderListItem(BaseModel):
    id: int
    order_no: str
    equipment_id: int
    equipment_name: str
    equipment_code: str
    equipment_location: str
    initiator_id: int
    initiator_name: str
    current_handler_id: Optional[int] = None
    current_handler_name: Optional[str] = None
    status: InspectionStatus
    risk_level: RiskLevel
    inspection_result: Optional[InspectionResult] = None
    inspection_date: datetime
    due_date: Optional[datetime] = None
    last_handler_opinion: Optional[str] = None
    last_handler_result: Optional[str] = None
    handler_opinion: Optional[str] = None
    handler_result: Optional[str] = None
    reviewer_opinion: Optional[str] = None
    reviewer_result: Optional[str] = None
    version: int
    created_at: datetime
    updated_at: datetime
    is_overdue: bool = False
    has_fault: bool = False

    class Config:
        from_attributes = True


class InspectionOrderDetail(InspectionOrderListItem):
    appearance_check: Optional[bool] = None
    appearance_evidence: Optional[str] = None
    appearance_remark: Optional[str] = None
    function_check: Optional[bool] = None
    function_evidence: Optional[str] = None
    function_remark: Optional[str] = None
    safety_check: Optional[bool] = None
    safety_evidence: Optional[str] = None
    safety_remark: Optional[str] = None
    maintenance_check: Optional[bool] = None
    maintenance_evidence: Optional[str] = None
    maintenance_remark: Optional[str] = None
    operation_records: List[OperationRecord] = []
    risk_changes: List[RiskLevelChange] = []
    fault_reports: List[FaultReport] = []


class StatisticsResponse(BaseModel):
    total: int = 0
    draft: int = 0
    pending_handling: int = 0
    in_progress: int = 0
    pending_review: int = 0
    returned: int = 0
    archived: int = 0
    high_risk: int = 0
    medium_risk: int = 0
    low_risk: int = 0
    normal: int = 0
    abnormal: int = 0
    missing_evidence: int = 0
    overdue: int = 0
    status_conflict: int = 0
    by_location: Dict[str, int] = {}


class QueueItem(BaseModel):
    id: int
    order_no: str
    equipment_name: str
    equipment_location: str
    status: InspectionStatus
    risk_level: RiskLevel
    current_handler_name: Optional[str] = None
    updated_at: datetime
    action_required: str


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "操作成功"
    data: Optional[T] = None

    @classmethod
    def ok(cls, data: Optional[T] = None, message: str = "操作成功") -> "ApiResponse[T]":
        return cls(success=True, message=message, data=data)

    @classmethod
    def error(cls, message: str = "操作失败", data: Optional[T] = None) -> "ApiResponse[T]":
        return cls(success=False, message=message, data=data)
