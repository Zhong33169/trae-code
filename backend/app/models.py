from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, Enum
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class Role(PyEnum):
    REGISTRAR = "registrar"
    AUDITOR = "auditor"
    PROPERTY = "property"


class BillStatus(PyEnum):
    DRAFT = "draft"
    PENDING_AUDIT = "pending_audit"
    REJECTED = "rejected"
    AUDITED = "audited"
    PENDING_REVIEW = "pending_review"
    REVIEW_REJECTED = "review_rejected"
    ARCHIVED = "archived"


class ProcessNode(PyEnum):
    REGISTRATION = "registration"
    AUDIT = "audit"
    REVIEW = "review"
    COMPLETED = "completed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    real_name = Column(String(50), nullable=False)
    role = Column(Enum(Role), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    operations = relationship("OperationLog", back_populates="operator")


class EnergyBill(Base):
    __tablename__ = "energy_bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_no = Column(String(50), unique=True, index=True, nullable=False)
    period = Column(String(20), nullable=False)
    park_name = Column(String(100), nullable=False)
    building = Column(String(50))
    room = Column(String(50))
    electricity_usage = Column(Float)
    water_usage = Column(Float)
    gas_usage = Column(Float)
    electricity_amount = Column(Float)
    water_amount = Column(Float)
    gas_amount = Column(Float)
    total_amount = Column(Float, default=0)
    status = Column(Enum(BillStatus), default=BillStatus.DRAFT, nullable=False)
    current_node = Column(Enum(ProcessNode), default=ProcessNode.REGISTRATION, nullable=False)
    current_responsible_role = Column(Enum(Role), default=Role.REGISTRAR, nullable=False)
    has_meter_reading = Column(Boolean, default=False)
    has_bill_generated = Column(Boolean, default=False)
    has_payment_verified = Column(Boolean, default=False)
    is_overdue = Column(Boolean, default=False)
    overdue_hours = Column(Float, default=0)
    current_node_started_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    meter_readings = relationship("MeterReading", back_populates="bill", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="bill", cascade="all, delete-orphan")
    operation_logs = relationship("OperationLog", back_populates="bill", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])


class MeterReading(Base):
    __tablename__ = "meter_readings"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("energy_bills.id"), nullable=False)
    reading_type = Column(String(20), nullable=False)
    previous_reading = Column(Float, nullable=False)
    current_reading = Column(Float, nullable=False)
    usage = Column(Float, nullable=False)
    read_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    read_at = Column(DateTime, default=datetime.utcnow)
    remark = Column(Text)

    bill = relationship("EnergyBill", back_populates="meter_readings")
    reader = relationship("User", foreign_keys=[read_by])


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("energy_bills.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(50))
    transaction_no = Column(String(100))
    paid_by = Column(String(100))
    paid_at = Column(DateTime)
    verified_by = Column(Integer, ForeignKey("users.id"))
    verified_at = Column(DateTime)
    is_verified = Column(Boolean, default=False)
    remark = Column(Text)

    bill = relationship("EnergyBill", back_populates="payments")
    verifier = relationship("User", foreign_keys=[verified_by])


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("energy_bills.id"), nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    operation = Column(String(50), nullable=False)
    from_status = Column(Enum(BillStatus))
    to_status = Column(Enum(BillStatus))
    from_node = Column(Enum(ProcessNode))
    to_node = Column(Enum(ProcessNode))
    anomaly_reason = Column(Text)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    bill = relationship("EnergyBill", back_populates="operation_logs")
    operator = relationship("User", back_populates="operations")


class NodeTimeoutConfig(Base):
    __tablename__ = "node_timeout_configs"

    id = Column(Integer, primary_key=True, index=True)
    node = Column(Enum(ProcessNode), unique=True, nullable=False)
    timeout_hours = Column(Float, default=24, nullable=False)
    description = Column(String(200))
