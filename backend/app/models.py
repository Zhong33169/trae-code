from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)
    department = Column(String(100))
    created_at = Column(DateTime, default=datetime.now)


class MeetingReservation(Base):
    __tablename__ = "meeting_reservations"

    id = Column(Integer, primary_key=True, index=True)
    reservation_no = Column(String(50), unique=True, index=True, nullable=False)
    batch_no = Column(String(50), index=True, nullable=False)
    title = Column(String(200), nullable=False)
    meeting_room = Column(String(100), nullable=False)
    meeting_date = Column(String(20), nullable=False)
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    participants = Column(Integer, default=0)
    organizer = Column(String(100))
    organizer_dept = Column(String(100))
    contact_phone = Column(String(20))

    equipment = Column(Text)
    equipment_ready = Column(Boolean, default=False)

    status = Column(String(50), default="draft", index=True)
    exception_type = Column(String(50))
    exception_desc = Column(Text)

    attachment_names = Column(Text)
    offline_attachment_count = Column(Integer, default=0)

    result = Column(Text)
    usage_confirm = Column(Boolean, default=False)
    usage_confirm_time = Column(DateTime)
    usage_confirm_user = Column(String(100))

    return_reason = Column(Text)
    audit_remark = Column(Text)

    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.now)
    updated_by = Column(String(100))
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    submitted_at = Column(DateTime)
    audit_by = Column(String(100))
    audit_at = Column(DateTime)
    review_by = Column(String(100))
    review_at = Column(DateTime)
    archived_at = Column(DateTime)

    audit_logs = relationship("AuditLog", back_populates="reservation", cascade="all, delete-orphan")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("meeting_reservations.id"))
    action = Column(String(50), nullable=False)
    status_from = Column(String(50))
    status_to = Column(String(50))
    operator = Column(String(100))
    operator_role = Column(String(50))
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    reservation = relationship("MeetingReservation", back_populates="audit_logs")


class BatchRecord(Base):
    __tablename__ = "batch_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    total_count = Column(Integer, default=0)
    processed_count = Column(Integer, default=0)
    status = Column(String(50), default="processing")
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.now)
    remark = Column(Text)
