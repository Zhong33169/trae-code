from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON
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
    hashed_password = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    operations = relationship("OperationLog", back_populates="operator")


class RectificationOrder(Base):
    __tablename__ = "rectification_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    patient_name = Column(String(100), nullable=False)
    medical_record_no = Column(String(50), nullable=False)
    department = Column(String(100), nullable=False)
    admission_date = Column(DateTime)
    discharge_date = Column(DateTime)
    diagnosis = Column(String(500))

    status = Column(String(50), default="PENDING_SUBMIT", nullable=False)
    current_node = Column(String(50), default="DEPARTMENT_SUBMIT")

    content = Column(Text)
    rectification_requirements = Column(Text)
    quality_opinion = Column(Text)
    notice_content = Column(Text)
    review_opinion = Column(Text)
    director_opinion = Column(Text)

    department_secretary_id = Column(Integer, ForeignKey("users.id"))
    quality_doctor_id = Column(Integer, ForeignKey("users.id"))
    medical_director_id = Column(Integer, ForeignKey("users.id"))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    nodes = relationship("NodeRecord", back_populates="order", cascade="all, delete-orphan")
    logs = relationship("OperationLog", back_populates="order", cascade="all, delete-orphan")
    quality_control = relationship("QualityControl", back_populates="order", uselist=False)
    rectification_notice = relationship("RectificationNotice", back_populates="order", uselist=False)
    review_archive = relationship("ReviewArchive", back_populates="order", uselist=False)


class NodeRecord(Base):
    __tablename__ = "node_records"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("rectification_orders.id"), nullable=False)
    node_name = Column(String(50), nullable=False)
    node_name_cn = Column(String(100), nullable=False)

    started_at = Column(DateTime, default=datetime.utcnow)
    deadline = Column(DateTime, nullable=False)
    completed_at = Column(DateTime)

    is_overdue = Column(Boolean, default=False)
    overdue_reason = Column(Text)
    follow_up_action = Column(Text)

    handler_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String(50), default="IN_PROGRESS")

    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("RectificationOrder", back_populates="nodes")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("rectification_orders.id"))
    operator_id = Column(Integer, ForeignKey("users.id"))
    operation = Column(String(100), nullable=False)
    operation_cn = Column(String(100), nullable=False)
    old_status = Column(String(50))
    new_status = Column(String(50))
    remark = Column(Text)
    extra_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("RectificationOrder", back_populates="logs")
    operator = relationship("User", back_populates="operations")


class QualityControl(Base):
    __tablename__ = "quality_controls"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("rectification_orders.id"), unique=True)
    quality_doctor_id = Column(Integer, ForeignKey("users.id"))

    problems_found = Column(Text)
    quality_score = Column(Integer)
    check_result = Column(String(50))
    checked_at = Column(DateTime)

    status = Column(String(50), default="PENDING")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("RectificationOrder", back_populates="quality_control")


class RectificationNotice(Base):
    __tablename__ = "rectification_notices"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("rectification_orders.id"), unique=True)
    sender_id = Column(Integer, ForeignKey("users.id"))

    notice_title = Column(String(200))
    notice_content = Column(Text)
    deadline = Column(DateTime)
    sent_at = Column(DateTime)

    recipient_department = Column(String(100))
    status = Column(String(50), default="DRAFT")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("RectificationOrder", back_populates="rectification_notice")


class ReviewArchive(Base):
    __tablename__ = "review_archives"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("rectification_orders.id"), unique=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"))

    review_opinion = Column(Text)
    review_result = Column(String(50))
    archived_at = Column(DateTime)
    archive_location = Column(String(200))

    status = Column(String(50), default="PENDING_REVIEW")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("RectificationOrder", back_populates="review_archive")
