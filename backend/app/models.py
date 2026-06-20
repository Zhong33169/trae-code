from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum, Float
from sqlalchemy.orm import relationship

from .database import Base


class UserRole(str, PyEnum):
    INSPECTOR = "inspector"
    HANDLER = "handler"
    REVIEWER = "reviewer"


class InspectionStatus(str, PyEnum):
    DRAFT = "draft"
    PENDING_HANDLING = "pending_handling"
    IN_PROGRESS = "in_progress"
    PENDING_REVIEW = "pending_review"
    RETURNED = "returned"
    ARCHIVED = "archived"


class RiskLevel(str, PyEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class InspectionResult(str, PyEnum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    MISSING_EVIDENCE = "missing_evidence"
    OVERDUE = "overdue"
    RETURNED = "returned"
    STATUS_CONFLICT = "status_conflict"


class OperationType(str, PyEnum):
    INITIATE = "initiate"
    ASSIGN = "assign"
    HANDLE = "handle"
    SUBMIT = "submit"
    REVIEW = "review"
    RETURN = "return"
    ARCHIVE = "archive"
    RISK_UPGRADE = "risk_upgrade"
    RISK_DOWNGRADE = "risk_downgrade"
    REPORT_FAULT = "report_fault"
    CONFIRM_RECOVERY = "confirm_recovery"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    initiated_orders = relationship("InspectionOrder", foreign_keys="InspectionOrder.initiator_id", back_populates="initiator")
    handling_orders = relationship("InspectionOrder", foreign_keys="InspectionOrder.current_handler_id", back_populates="current_handler")
    operation_records = relationship("OperationRecord", back_populates="operator")


class Equipment(Base):
    __tablename__ = "equipments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    location = Column(String(200), nullable=False)
    specification = Column(String(500))
    last_inspection_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    inspection_orders = relationship("InspectionOrder", back_populates="equipment")


class InspectionOrder(Base):
    __tablename__ = "inspection_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)

    equipment_id = Column(Integer, ForeignKey("equipments.id"), nullable=False)
    equipment = relationship("Equipment", back_populates="inspection_orders")

    initiator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    initiator = relationship("User", foreign_keys=[initiator_id], back_populates="initiated_orders")

    current_handler_id = Column(Integer, ForeignKey("users.id"))
    current_handler = relationship("User", foreign_keys=[current_handler_id], back_populates="handling_orders")

    status = Column(Enum(InspectionStatus), default=InspectionStatus.DRAFT, nullable=False)
    risk_level = Column(Enum(RiskLevel), default=RiskLevel.LOW, nullable=False)
    inspection_result = Column(Enum(InspectionResult))

    inspection_date = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime)

    appearance_check = Column(Boolean)
    appearance_evidence = Column(String(500))
    appearance_remark = Column(Text)

    function_check = Column(Boolean)
    function_evidence = Column(String(500))
    function_remark = Column(Text)

    safety_check = Column(Boolean)
    safety_evidence = Column(String(500))
    safety_remark = Column(Text)

    maintenance_check = Column(Boolean)
    maintenance_evidence = Column(String(500))
    maintenance_remark = Column(Text)

    last_handler_opinion = Column(Text)
    last_handler_result = Column(String(100))

    handler_opinion = Column(Text)
    handler_result = Column(String(100))
    handled_at = Column(DateTime)

    reviewer_opinion = Column(Text)
    reviewer_result = Column(String(100))
    reviewed_at = Column(DateTime)

    version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    operation_records = relationship("OperationRecord", back_populates="inspection_order", cascade="all, delete-orphan")
    risk_changes = relationship("RiskLevelChange", back_populates="inspection_order", cascade="all, delete-orphan")
    evidences = relationship("InspectionEvidence", back_populates="inspection_order", cascade="all, delete-orphan")
    fault_reports = relationship("FaultReport", back_populates="inspection_order", cascade="all, delete-orphan")


class InspectionEvidence(Base):
    __tablename__ = "inspection_evidences"

    id = Column(Integer, primary_key=True, index=True)
    inspection_order_id = Column(Integer, ForeignKey("inspection_orders.id"), nullable=False)
    inspection_order = relationship("InspectionOrder", back_populates="evidences")

    evidence_type = Column(String(50), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(200))
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    remark = Column(Text)


class OperationRecord(Base):
    __tablename__ = "operation_records"

    id = Column(Integer, primary_key=True, index=True)
    inspection_order_id = Column(Integer, ForeignKey("inspection_orders.id"), nullable=False)
    inspection_order = relationship("InspectionOrder", back_populates="operation_records")

    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    operator = relationship("User", back_populates="operation_records")

    operation_type = Column(Enum(OperationType), nullable=False)
    from_status = Column(Enum(InspectionStatus))
    to_status = Column(Enum(InspectionStatus))
    from_risk_level = Column(Enum(RiskLevel))
    to_risk_level = Column(Enum(RiskLevel))

    opinion = Column(Text)
    result = Column(String(200))
    remark = Column(Text)

    version = Column(Integer)
    operated_at = Column(DateTime, default=datetime.utcnow)


class RiskLevelChange(Base):
    __tablename__ = "risk_level_changes"

    id = Column(Integer, primary_key=True, index=True)
    inspection_order_id = Column(Integer, ForeignKey("inspection_orders.id"), nullable=False)
    inspection_order = relationship("InspectionOrder", back_populates="risk_changes")

    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    from_level = Column(Enum(RiskLevel), nullable=False)
    to_level = Column(Enum(RiskLevel), nullable=False)
    reason = Column(Text, nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow)


class FaultReport(Base):
    __tablename__ = "fault_reports"

    id = Column(Integer, primary_key=True, index=True)
    inspection_order_id = Column(Integer, ForeignKey("inspection_orders.id"), nullable=False)
    inspection_order = relationship("InspectionOrder", back_populates="fault_reports")

    fault_description = Column(Text, nullable=False)
    fault_level = Column(Enum(RiskLevel), nullable=False)
    reported_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reported_at = Column(DateTime, default=datetime.utcnow)

    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"))
    resolved_at = Column(DateTime)
    resolution = Column(Text)

    recovery_confirm = relationship("RecoveryConfirm", back_populates="fault_report", uselist=False)


class RecoveryConfirm(Base):
    __tablename__ = "recovery_confirms"

    id = Column(Integer, primary_key=True, index=True)
    fault_report_id = Column(Integer, ForeignKey("fault_reports.id"), nullable=False)
    fault_report = relationship("FaultReport", back_populates="recovery_confirm")

    inspection_order_id = Column(Integer, ForeignKey("inspection_orders.id"), nullable=True)

    confirmed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    confirmed_at = Column(DateTime, default=datetime.utcnow)
    confirmation_remark = Column(Text)
    evidence_path = Column(String(500))
    is_successful = Column(Boolean, default=True)
