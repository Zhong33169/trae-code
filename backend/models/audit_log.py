from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
import enum


class AuditAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    SUBMIT = "submit"
    REVIEW = "review"
    REJECT = "reject"
    SCAN_QR = "scan_qr"
    REPORT_FAULT = "report_fault"
    REPAIR_COMPLETE = "repair_complete"
    ACCEPT = "accept"
    FINAL_REVIEW = "final_review"
    ARCHIVE = "archive"
    CANCEL = "cancel"
    BATCH_PROCESS = "batch_process"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    inspection_order_id = Column(Integer, ForeignKey("inspection_orders.id"))
    inspection_order = relationship("InspectionOrder", back_populates="audit_logs")

    action = Column(Enum(AuditAction), nullable=False)
    from_status = Column(String(100))
    to_status = Column(String(100))
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    operator = relationship("User", foreign_keys=[operator_id])
    operator_name = Column(String(100))
    operator_role = Column(String(50))

    detail = Column(Text)
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    request_id = Column(String(100))

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
