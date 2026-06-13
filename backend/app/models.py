import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship

from app.database import Base


class UserRole(str, enum.Enum):
    REGISTRAR = "registrar"
    SUPERVISOR = "supervisor"
    REVIEWER = "reviewer"


class OrderStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    MATERIALS_MISSING = "materials_missing"
    RESUBMITTED = "resubmitted"
    APPROVED_REVIEW = "approved_review"
    REJECTED = "rejected"
    REVIEWED = "reviewed"
    ARCHIVED = "archived"


class AttachmentType(str, enum.Enum):
    ID_CARD = "id_card"
    PHOTO = "photo"
    HEALTH_CERT = "health_cert"
    CONTRACT = "contract"
    OTHER = "other"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    audit_logs = relationship("AuditLog", back_populates="operator")


class MembershipOrder(Base):
    __tablename__ = "membership_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(32), unique=True, nullable=False, index=True)
    member_name = Column(String(100), nullable=False)
    member_phone = Column(String(20))
    member_id_no = Column(String(30))
    membership_type = Column(String(50), nullable=False)
    membership_duration = Column(Integer, nullable=False)
    amount = Column(Integer, nullable=False)
    contract_confirmed = Column(Boolean, default=False)
    card_activated = Column(Boolean, default=False)
    status = Column(Enum(OrderStatus), default=OrderStatus.DRAFT, nullable=False, index=True)
    is_overdue = Column(Boolean, default=False, index=True)
    reject_reason = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    attachments = relationship("Attachment", back_populates="order", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="order", cascade="all, delete-orphan")
    required_attachments = relationship("RequiredAttachment", back_populates="order", cascade="all, delete-orphan")


class RequiredAttachment(Base):
    __tablename__ = "required_attachments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("membership_orders.id"), nullable=False)
    attachment_type = Column(Enum(AttachmentType), nullable=False)
    attachment_name = Column(String(100), nullable=False)
    is_provided = Column(Boolean, default=False)
    missing_reason = Column(Text)
    reject_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("MembershipOrder", back_populates="required_attachments")
    attachment = relationship("Attachment", back_populates="required_attachment", uselist=False)


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("membership_orders.id"), nullable=False)
    required_attachment_id = Column(Integer, ForeignKey("required_attachments.id"))
    file_name = Column(String(255), nullable=False)
    file_type = Column(Enum(AttachmentType), nullable=False)
    file_size = Column(Integer)
    stored_name = Column(String(255))
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("MembershipOrder", back_populates="attachments")
    required_attachment = relationship("RequiredAttachment", back_populates="attachment")


class AuditAction(str, enum.Enum):
    CREATE = "create"
    SUBMIT = "submit"
    RESUBMIT = "resubmit"
    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_SUPPLEMENT = "request_supplement"
    UPLOAD_ATTACHMENT = "upload_attachment"
    DELETE_ATTACHMENT = "delete_attachment"
    CONFIRM_CONTRACT = "confirm_contract"
    ACTIVATE_CARD = "activate_card"
    ARCHIVE = "archive"
    REVIEW = "review"
    MARK_OVERDUE = "mark_overdue"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("membership_orders.id"), nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(Enum(AuditAction), nullable=False)
    from_status = Column(Enum(OrderStatus))
    to_status = Column(Enum(OrderStatus))
    remark = Column(Text)
    failure_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    order = relationship("MembershipOrder", back_populates="audit_logs")
    operator = relationship("User", back_populates="audit_logs")
