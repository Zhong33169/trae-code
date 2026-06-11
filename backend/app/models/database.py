from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum as SAEnum, Float
from sqlalchemy.orm import relationship, declarative_base
import enum

Base = declarative_base()


class RoleEnum(str, enum.Enum):
    INITIATOR = "initiator"
    HANDLER = "handler"
    REVIEWER = "reviewer"


class OrderStatus(str, enum.Enum):
    DRAFT = "draft"
    ENTRUSTED = "entrusted"
    DISPATCHED = "dispatched"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    REVIEWED = "reviewed"
    REJECTED = "rejected"


class EvidenceType(str, enum.Enum):
    ENTRUSTMENT = "entrustment"
    DISPATCH = "dispatch"
    RECEIPT = "receipt"


class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PARTIAL_SUCCESS = "partial_success"
    ALL_SUCCESS = "all_success"
    ALL_FAILED = "all_failed"


class BatchItemStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    RETRY_PENDING = "retry_pending"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    role = Column(SAEnum(RoleEnum), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class TransportOrder(Base):
    __tablename__ = "transport_orders"
    id = Column(Integer, primary_key=True)
    order_no = Column(String(50), unique=True, nullable=False)
    customer = Column(String(100), nullable=False)
    cargo_name = Column(String(100), nullable=False)
    cargo_weight = Column(Float, nullable=False)
    origin = Column(String(200), nullable=False)
    destination = Column(String(200), nullable=False)
    status = Column(SAEnum(OrderStatus), default=OrderStatus.DRAFT, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    plate_number = Column(String(50))
    driver = Column(String(100))
    receiver = Column(String(100))
    signed_at = Column(DateTime)
    rejected_reason = Column(Text)
    initiator_id = Column(Integer, ForeignKey("users.id"))
    handler_id = Column(Integer, ForeignKey("users.id"))
    reviewer_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    initiator = relationship("User", foreign_keys=[initiator_id])
    handler = relationship("User", foreign_keys=[handler_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    evidences = relationship("OrderEvidence", back_populates="order", cascade="all, delete-orphan")


class OrderEvidence(Base):
    __tablename__ = "order_evidences"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("transport_orders.id"), nullable=False)
    evidence_type = Column(SAEnum(EvidenceType), nullable=False)
    file_name = Column(String(200), nullable=False)
    file_ref = Column(String(500), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    remark = Column(Text)

    order = relationship("TransportOrder", back_populates="evidences")


class BatchChange(Base):
    __tablename__ = "batch_changes"
    id = Column(Integer, primary_key=True)
    batch_no = Column(String(50), unique=True, nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    change_type = Column(String(50), nullable=False)
    target_status = Column(SAEnum(OrderStatus))
    status = Column(SAEnum(BatchStatus), default=BatchStatus.PENDING, nullable=False)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime)

    items = relationship("BatchItem", back_populates="batch", cascade="all, delete-orphan")
    operator = relationship("User")


class BatchItem(Base):
    __tablename__ = "batch_items"
    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("batch_changes.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("transport_orders.id"), nullable=False)
    order_no = Column(String(50), nullable=False)
    status = Column(SAEnum(BatchItemStatus), default=BatchItemStatus.PENDING, nullable=False)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    processed_at = Column(DateTime)

    batch = relationship("BatchChange", back_populates="items")
    order = relationship("TransportOrder")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("transport_orders.id"))
    order_no = Column(String(50))
    batch_id = Column(Integer, ForeignKey("batch_changes.id"))
    batch_no = Column(String(50))
    user_id = Column(Integer, ForeignKey("users.id"))
    username = Column(String(50))
    action = Column(String(100), nullable=False)
    old_status = Column(String(50))
    new_status = Column(String(50))
    old_version = Column(Integer)
    new_version = Column(Integer)
    detail = Column(Text)
    remark = Column(Text)
    failure_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
