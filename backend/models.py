import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship

from database import Base


class RoleEnum(str, enum.Enum):
    REGISTRAR = "registrar"
    SUPERVISOR = "supervisor"
    REVIEWER = "reviewer"


class TicketStatusEnum(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    REVIEW_PASSED = "review_passed"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REVISION_REQUIRED = "revision_required"
    ARCHIVED = "archived"
    REJECTED = "rejected"


class AttachmentTypeEnum(str, enum.Enum):
    REQUIRED = "required"
    SUPPLEMENTARY = "supplementary"
    REJECTED = "rejected"


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    description = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    role = relationship("Role", back_populates="users")
    created_tickets = relationship(
        "RepairTicket",
        foreign_keys="RepairTicket.created_by_id",
        back_populates="created_by"
    )
    handled_tickets = relationship(
        "RepairTicket",
        foreign_keys="RepairTicket.handled_by_id",
        back_populates="handled_by"
    )
    reviewed_tickets = relationship(
        "RepairTicket",
        foreign_keys="RepairTicket.reviewed_by_id",
        back_populates="reviewed_by"
    )


class RepairTicket(Base):
    __tablename__ = "repair_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_no = Column(String(50), unique=True, nullable=False)
    title = Column(String(200), nullable=False)
    owner_name = Column(String(100), nullable=False)
    owner_phone = Column(String(20), nullable=False)
    address = Column(String(200), nullable=False)
    repair_type = Column(String(50), nullable=False)
    priority = Column(String(20), default="normal")
    description = Column(Text, nullable=False)
    status = Column(Enum(TicketStatusEnum), default=TicketStatusEnum.DRAFT)
    is_overdue = Column(Boolean, default=False)

    deadline_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    assigned_at = Column(DateTime)
    completed_at = Column(DateTime)
    archived_at = Column(DateTime)

    created_by_id = Column(Integer, ForeignKey("users.id"))
    handled_by_id = Column(Integer, ForeignKey("users.id"))
    reviewed_by_id = Column(Integer, ForeignKey("users.id"))

    repair_result = Column(Text)
    reject_reason = Column(Text)
    review_note = Column(Text)
    visit_feedback = Column(String(50))
    visit_remark = Column(Text)

    created_by = relationship(
        "User",
        foreign_keys=[created_by_id],
        back_populates="created_tickets"
    )
    handled_by = relationship(
        "User",
        foreign_keys=[handled_by_id],
        back_populates="handled_tickets"
    )
    reviewed_by = relationship(
        "User",
        foreign_keys=[reviewed_by_id],
        back_populates="reviewed_tickets"
    )

    attachments = relationship("Attachment", back_populates="ticket", cascade="all, delete-orphan")
    work_logs = relationship("WorkOrderLog", back_populates="ticket", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="ticket", cascade="all, delete-orphan")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("repair_tickets.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    mime_type = Column(String(100))
    attachment_type = Column(Enum(AttachmentTypeEnum), default=AttachmentTypeEnum.REQUIRED)
    is_required = Column(Boolean, default=False)
    is_supplementary = Column(Boolean, default=False)
    is_rejected = Column(Boolean, default=False)
    reject_reason = Column(String(500))
    uploaded_by_id = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    review_note = Column(String(500))

    ticket = relationship("RepairTicket", back_populates="attachments")
    uploaded_by = relationship("User")


class WorkOrderLog(Base):
    __tablename__ = "work_order_logs"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("repair_tickets.id"), nullable=False)
    from_status = Column(String(50))
    to_status = Column(String(50))
    action = Column(String(100), nullable=False)
    remark = Column(Text)
    operator_id = Column(Integer, ForeignKey("users.id"))
    operator_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("RepairTicket", back_populates="work_logs")
    operator = relationship("User")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("repair_tickets.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    user_name = Column(String(100))
    action = Column(String(100), nullable=False)
    module = Column(String(50))
    detail = Column(Text)
    failure_reason = Column(Text)
    is_success = Column(Boolean, default=True)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("RepairTicket", back_populates="audit_logs")
    user = relationship("User")
