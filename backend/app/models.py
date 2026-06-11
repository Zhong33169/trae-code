from __future__ import annotations

from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List
from uuid import uuid4

from pydantic import BaseModel, Field, validator


class Role(str, Enum):
    REGISTRAR = "registrar"
    AUDITOR = "auditor"
    REVIEWER = "reviewer"

    @property
    def display_name(self) -> str:
        return {
            "registrar": "售电合同登记员",
            "auditor": "售电合同审核主管",
            "reviewer": "售电公司复核负责人",
        }[self.value]


class ContractStatus(str, Enum):
    DRAFT = "draft"
    PENDING_AUDIT = "pending_audit"
    NEEDS_CORRECTION = "needs_correction"
    PENDING_REVIEW = "pending_review"
    REVIEW_REJECTED = "review_rejected"
    ARCHIVED = "archived"
    EXPIRED = "expired"

    @property
    def display_name(self) -> str:
        return {
            "draft": "草稿",
            "pending_audit": "待审核",
            "needs_correction": "待补正",
            "pending_review": "待复核",
            "review_rejected": "复核驳回",
            "archived": "已归档",
            "expired": "已逾期",
        }[self.value]

    @property
    def badge_color(self) -> str:
        return {
            "draft": "gray",
            "pending_audit": "blue",
            "needs_correction": "orange",
            "pending_review": "purple",
            "review_rejected": "red",
            "archived": "green",
            "expired": "red",
        }[self.value]


class MaterialType(str, Enum):
    CUSTOMER_INFO = "customer_info"
    PRICE_QUOTATION = "price_quotation"
    CONTRACT_CONFIRM = "contract_confirm"


class Material(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex[:8])
    type: MaterialType
    name: str
    uploaded_at: datetime = Field(default_factory=datetime.now)
    uploaded_by: str
    note: Optional[str] = None


class Customer(BaseModel):
    name: str
    customer_id: str
    address: str
    contact_person: str
    contact_phone: str
    power_consumption: float = Field(description="月用电量(万kWh)")


class PriceQuotation(BaseModel):
    quoted_price: float = Field(description="报价电价(元/kWh)")
    contract_term_months: int = Field(description="合同期限(月)")
    estimated_annual_amount: float = Field(description="预估年金额(万元)")
    settlement_method: str = Field(description="结算方式")
    quotation_valid_until: datetime = Field(description="报价有效期至")


class ContractConfirmation(BaseModel):
    confirmed_price: float
    confirmed_term_months: int
    signing_date: Optional[datetime] = None
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class AuditRecord(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex[:8])
    contract_id: str
    role: Role
    operator: str
    action: str
    comment: Optional[str] = None
    previous_status: Optional[ContractStatus] = None
    new_status: ContractStatus
    created_at: datetime = Field(default_factory=datetime.now)


class ExpiryInfo(BaseModel):
    is_expired: bool = False
    expired_since: Optional[datetime] = None
    deadline: Optional[datetime] = None
    reason: str = ""
    next_action: str = ""
    overdue_hours: float = 0.0


class SalesContract(BaseModel):
    id: str = Field(default_factory=lambda: "SC" + uuid4().hex[:8].upper())
    contract_no: str = Field(default_factory=lambda: "HT" + datetime.now().strftime("%Y%m%d") + uuid4().hex[:4].upper())
    title: str
    status: ContractStatus = ContractStatus.DRAFT
    created_by: str
    created_by_role: Role
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    version: int = 1
    last_lock_token: Optional[str] = None

    customer: Optional[Customer] = None
    price_quotation: Optional[PriceQuotation] = None
    contract_confirm: Optional[ContractConfirmation] = None
    materials: List[Material] = Field(default_factory=list)

    current_handler_role: Optional[Role] = None
    current_deadline: Optional[datetime] = None

    registrar_comment: Optional[str] = None
    auditor_comment: Optional[str] = None
    reviewer_comment: Optional[str] = None

    audit_records: List[AuditRecord] = Field(default_factory=list)

    def get_expiry_info(self, now: Optional[datetime] = None) -> ExpiryInfo:
        now = now or datetime.now()
        info = ExpiryInfo()
        info.deadline = self.current_deadline

        if self.current_deadline and self.status in (
            ContractStatus.PENDING_AUDIT,
            ContractStatus.NEEDS_CORRECTION,
            ContractStatus.PENDING_REVIEW,
            ContractStatus.REVIEW_REJECTED,
        ):
            if now > self.current_deadline:
                info.is_expired = True
                info.expired_since = self.current_deadline
                delta = now - self.current_deadline
                info.overdue_hours = round(delta.total_seconds() / 3600, 1)

                if self.status == ContractStatus.PENDING_AUDIT:
                    info.reason = f"审核主管超过 {self._format_deadline()} 未办理审核"
                    info.next_action = "由登记员联系审核主管催办，或升级至复核负责人介入"
                elif self.status == ContractStatus.NEEDS_CORRECTION:
                    info.reason = f"登记员超过 {self._format_deadline()} 未完成补正"
                    info.next_action = "补正超时自动锁定，需审核主管确认后解除并重新计算时限"
                elif self.status == ContractStatus.PENDING_REVIEW:
                    info.reason = f"复核负责人超过 {self._format_deadline()} 未完成复核"
                    info.next_action = "系统自动标记逾期，不自动推进，需人工判断是否继续复核或退回"
                elif self.status == ContractStatus.REVIEW_REJECTED:
                    info.reason = f"审核主管超过 {self._format_deadline()} 未处理复核驳回意见"
                    info.next_action = "需审核主管尽快根据驳回意见调整或升级处理"

        return info

    def _format_deadline(self) -> str:
        if not self.current_deadline:
            return "未设定期限"
        return self.current_deadline.strftime("%Y-%m-%d %H:%M")

    def add_audit_record(
        self,
        role: Role,
        operator: str,
        action: str,
        new_status: ContractStatus,
        comment: Optional[str] = None,
    ) -> None:
        record = AuditRecord(
            contract_id=self.id,
            role=role,
            operator=operator,
            action=action,
            comment=comment,
            previous_status=self.status,
            new_status=new_status,
        )
        self.audit_records.append(record)
        self.updated_at = datetime.now()


class Statistics(BaseModel):
    total: int = 0
    draft: int = 0
    pending_audit: int = 0
    needs_correction: int = 0
    pending_review: int = 0
    review_rejected: int = 0
    archived: int = 0
    expired: int = 0
