from datetime import datetime

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Text
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False)
    role = Column(Text, nullable=False)

    __table_args__ = (
        CheckConstraint(role.in_(["registrar", "reviewer", "rechecker"]), name="ck_user_role"),
    )


class Appeal(Base):
    __tablename__ = "appeals"

    id = Column(Text, primary_key=True)
    appeal_no = Column(Text, unique=True, nullable=False)
    visitor_name = Column(Text, nullable=False)
    visitor_phone = Column(Text, nullable=False)
    appointment_date = Column(Text, nullable=False)
    anomaly_type = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    evidence_urls = Column(Text, nullable=True)
    status = Column(Text, nullable=False)
    current_handler_id = Column(Text, ForeignKey("users.id"), nullable=True)
    current_handler_role = Column(Text, nullable=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(Text, nullable=False, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(Text, nullable=False, default=lambda: datetime.utcnow().isoformat())


class OperationRecord(Base):
    __tablename__ = "operation_records"

    id = Column(Text, primary_key=True)
    appeal_id = Column(Text, ForeignKey("appeals.id"), nullable=True)
    operator_id = Column(Text, ForeignKey("users.id"), nullable=False)
    operator_name = Column(Text, nullable=False)
    operator_role = Column(Text, nullable=False)
    action = Column(Text, nullable=False)
    opinion = Column(Text, nullable=True)
    from_status = Column(Text, nullable=True)
    to_status = Column(Text, nullable=True)
    request_summary = Column(Text, nullable=True)
    failure_reason = Column(Text, nullable=True)
    original_version = Column(Integer, nullable=True)
    failure_type = Column(Text, nullable=True)
    created_at = Column(Text, nullable=False, default=lambda: datetime.utcnow().isoformat())
