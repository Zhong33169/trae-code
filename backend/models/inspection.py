from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, Date, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
import enum


class InspectionStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    REVIEWING = "reviewing"
    REVIEW_REJECTED = "review_rejected"
    PENDING_FAULT_REPORT = "pending_fault_report"
    FAULT_REPORTED = "fault_reported"
    PENDING_REPAIR = "pending_repair"
    REPAIR_COMPLETED = "repair_completed"
    PENDING_ACCEPTANCE = "pending_acceptance"
    ACCEPTANCE_REJECTED = "acceptance_rejected"
    PENDING_FINAL_REVIEW = "pending_final_review"
    FINAL_REVIEW_REJECTED = "final_review_rejected"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"


class InspectionType(str, enum.Enum):
    ROUTINE = "routine"
    SPECIAL = "special"
    EMERGENCY = "emergency"


class InspectionOrder(Base):
    __tablename__ = "inspection_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    type = Column(Enum(InspectionType), nullable=False)
    status = Column(Enum(InspectionStatus), default=InspectionStatus.DRAFT, nullable=False)

    charging_pile_id = Column(Integer, ForeignKey("charging_piles.id"), nullable=False)
    charging_pile = relationship("ChargingPile", back_populates="inspections")

    inspection_date = Column(Date, nullable=False)
    inspector_name = Column(String(100), nullable=False)

    appearance_check = Column(String(50))
    appearance_note = Column(Text)
    cable_check = Column(String(50))
    cable_note = Column(Text)
    connector_check = Column(String(50))
    connector_note = Column(Text)
    display_check = Column(String(50))
    display_note = Column(Text)
    charging_check = Column(String(50))
    charging_note = Column(Text)
    emergency_stop_check = Column(String(50))
    emergency_stop_note = Column(Text)
    grounding_check = Column(String(50))
    grounding_note = Column(Text)

    overall_result = Column(String(50))
    registrar_opinion = Column(Text)
    registrar_signature = Column(String(255))

    supervisor_opinion = Column(Text)
    supervisor_signature = Column(String(255))
    supervisor_review_date = Column(DateTime(timezone=True))

    reviewer_opinion = Column(Text)
    reviewer_signature = Column(String(255))
    reviewer_review_date = Column(DateTime(timezone=True))

    time_limit = Column(DateTime(timezone=True))
    current_handler_id = Column(Integer, ForeignKey("users.id"))
    current_handler = relationship("User", foreign_keys=[current_handler_id])

    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    creator = relationship("User", foreign_keys=[created_by])
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    version = Column(Integer, default=1)

    qr_records = relationship("QRCodeRecord", back_populates="inspection_order")
    fault_report = relationship("FaultReport", back_populates="inspection_order", uselist=False)
    repair_acceptance = relationship("RepairAcceptance", back_populates="inspection_order", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="inspection_order")


INSPECTION_STATUS_LABELS = {
    InspectionStatus.DRAFT: "草稿",
    InspectionStatus.PENDING_REVIEW: "待审核主管办理",
    InspectionStatus.REVIEWING: "审核主管办理中",
    InspectionStatus.REVIEW_REJECTED: "审核退回补正",
    InspectionStatus.PENDING_FAULT_REPORT: "待故障上报",
    InspectionStatus.FAULT_REPORTED: "已上报故障",
    InspectionStatus.PENDING_REPAIR: "待修复",
    InspectionStatus.REPAIR_COMPLETED: "修复完成待验收",
    InspectionStatus.PENDING_ACCEPTANCE: "待修复验收",
    InspectionStatus.ACCEPTANCE_REJECTED: "验收不合格",
    InspectionStatus.PENDING_FINAL_REVIEW: "待复核归档",
    InspectionStatus.FINAL_REVIEW_REJECTED: "复核退回",
    InspectionStatus.ARCHIVED: "已归档",
    InspectionStatus.CANCELLED: "已取消",
}
