import enum
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum, Float
from sqlalchemy.orm import relationship

from app.database import Base


class RoleEnum(str, enum.Enum):
    REGISTRAR = "registrar"
    AUDIT_SUPERVISOR = "audit_supervisor"
    REVIEW_LEADER = "review_leader"


class ApplicationStatusEnum(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    CORRECTION_REQUESTED = "correction_requested"
    CORRECTED = "corrected"
    AUDIT_PASSED = "audit_passed"
    REJECTED = "rejected"
    REVIEW_PASSED = "review_passed"
    ARCHIVED = "archived"


STATUS_TIME_LIMITS = {
    ApplicationStatusEnum.SUBMITTED: 24,
    ApplicationStatusEnum.UNDER_REVIEW: 48,
    ApplicationStatusEnum.CORRECTION_REQUESTED: 72,
    ApplicationStatusEnum.CORRECTED: 24,
    ApplicationStatusEnum.AUDIT_PASSED: 48,
    ApplicationStatusEnum.REVIEW_PASSED: 24,
}


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    hashed_password = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    audit_logs = relationship("AuditLog", back_populates="operator")


class ExhibitorApplication(Base):
    __tablename__ = "exhibitor_applications"

    id = Column(Integer, primary_key=True, index=True)
    application_no = Column(String(50), unique=True, index=True, nullable=False)
    company_name = Column(String(200), nullable=False)
    contact_person = Column(String(50), nullable=False)
    contact_phone = Column(String(20), nullable=False)
    contact_email = Column(String(100))
    booth_type = Column(String(50))
    booth_size = Column(String(50))
    expected_area = Column(Float)
    industry = Column(String(100))
    product_description = Column(Text)
    status = Column(Enum(ApplicationStatusEnum), default=ApplicationStatusEnum.DRAFT, nullable=False)
    is_overdue = Column(Boolean, default=False)
    overdue_reason = Column(String(500))
    status_changed_at = Column(DateTime, default=datetime.utcnow)
    deadline_at = Column(DateTime)

    registrar_id = Column(Integer, ForeignKey("users.id"))
    audit_supervisor_id = Column(Integer, ForeignKey("users.id"))
    review_leader_id = Column(Integer, ForeignKey("users.id"))

    audit_opinion = Column(Text)
    review_opinion = Column(Text)
    correction_request = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    version = Column(Integer, default=1)

    materials = relationship("ApplicationMaterial", back_populates="application", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="application", cascade="all, delete-orphan", order_by="AuditLog.created_at.desc()")

    def calculate_deadline(self):
        limit_hours = STATUS_TIME_LIMITS.get(self.status)
        if limit_hours and self.status_changed_at:
            self.deadline_at = self.status_changed_at + timedelta(hours=limit_hours)
        else:
            self.deadline_at = None

    def check_overdue(self):
        if self.deadline_at and datetime.utcnow() > self.deadline_at:
            if not self.is_overdue:
                self.is_overdue = True
                self.overdue_reason = f"状态【{self.status.value}】已超过处理时限 {STATUS_TIME_LIMITS.get(self.status, 0)} 小时"
            return True
        self.is_overdue = False
        self.overdue_reason = None
        return False


class MaterialTypeEnum(str, enum.Enum):
    BUSINESS_LICENSE = "business_license"
    TAX_CERTIFICATE = "tax_certificate"
    PRODUCT_CATALOG = "product_catalog"
    BOOTH_DESIGN = "booth_design"
    OTHER = "other"


class ApplicationMaterial(Base):
    __tablename__ = "application_materials"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("exhibitor_applications.id"), nullable=False)
    material_type = Column(Enum(MaterialTypeEnum), nullable=False)
    material_name = Column(String(200), nullable=False)
    file_path = Column(String(500))
    is_approved = Column(Boolean, default=None)
    review_comment = Column(String(500))
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("ExhibitorApplication", back_populates="materials")


class AuditActionEnum(str, enum.Enum):
    CREATE = "create"
    SUBMIT = "submit"
    START_AUDIT = "start_audit"
    REQUEST_CORRECTION = "request_correction"
    CORRECT = "correct"
    AUDIT_PASS = "audit_pass"
    REJECT = "reject"
    REVIEW_PASS = "review_pass"
    ARCHIVE = "archive"
    UPDATE = "update"
    OVERDUE = "overdue"
    BATCH_PROCESS = "batch_process"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("exhibitor_applications.id"), nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(Enum(AuditActionEnum), nullable=False)
    action_name = Column(String(100), nullable=False)
    from_status = Column(Enum(ApplicationStatusEnum))
    to_status = Column(Enum(ApplicationStatusEnum))
    remark = Column(Text)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("ExhibitorApplication", back_populates="audit_logs")
    operator = relationship("User", back_populates="audit_logs")
