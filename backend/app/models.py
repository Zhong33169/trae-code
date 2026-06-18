import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean, Float
)
from sqlalchemy.orm import relationship

from .database import Base


class Role(str, enum.Enum):
    REGISTRAR = "registrar"
    SUPERVISOR = "supervisor"
    REVIEWER = "reviewer"


class Stage(str, enum.Enum):
    NEED = "need"
    QUOTATION = "quotation"
    CONTRACT = "contract"


class Status(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    RETURNED = "returned"
    APPROVED = "approved"
    REJECTED = "rejected"
    APPEAL_SUBMITTED = "appeal_submitted"
    APPEAL_UNDER_REVIEW = "appeal_under_review"
    APPEAL_APPROVED = "appeal_approved"
    APPEAL_REJECTED = "appeal_rejected"
    OVERDUE = "overdue"
    ARCHIVED = "archived"


class AppealResult(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class EvidenceType(str, enum.Enum):
    NEED_DOCUMENT = "need_document"
    QUOTATION_SHEET = "quotation_sheet"
    CONTRACT = "contract"
    OTHER = "other"


class ActionType(str, enum.Enum):
    CREATE = "create"
    SUBMIT = "submit"
    REVIEW_APPROVE = "review_approve"
    REVIEW_REJECT = "review_reject"
    RETURN_FOR_CORRECTION = "return_for_correction"
    CORRECT = "correct"
    APPEAL_SUBMIT = "appeal_submit"
    APPEAL_REVIEW = "appeal_review"
    APPEAL_APPROVE = "appeal_approve"
    APPEAL_REJECT = "appeal_reject"
    ARCHIVE = "archive"
    MARK_OVERDUE = "mark_overdue"
    STATE_CONFLICT = "state_conflict"
    CONFLICT_RECOVERED = "conflict_recovered"


ROLE_LABELS = {
    Role.REGISTRAR: "培训项目登记员",
    Role.SUPERVISOR: "培训项目审核主管",
    Role.REVIEWER: "企业培训公司复核负责人",
}

STAGE_LABELS = {
    Stage.NEED: "培训需求",
    Stage.QUOTATION: "方案报价",
    Stage.CONTRACT: "合同确认",
}

STATUS_LABELS = {
    Status.DRAFT: "草稿",
    Status.SUBMITTED: "已提交",
    Status.UNDER_REVIEW: "审核中",
    Status.RETURNED: "退回补正",
    Status.APPROVED: "通过",
    Status.REJECTED: "驳回",
    Status.APPEAL_SUBMITTED: "申诉已提交",
    Status.APPEAL_UNDER_REVIEW: "申诉复核中",
    Status.APPEAL_APPROVED: "申诉通过",
    Status.APPEAL_REJECTED: "申诉驳回",
    Status.OVERDUE: "逾期",
    Status.ARCHIVED: "已归档",
}

EVIDENCE_TYPE_LABELS = {
    EvidenceType.NEED_DOCUMENT: "需求文档",
    EvidenceType.QUOTATION_SHEET: "报价单",
    EvidenceType.CONTRACT: "合同",
    EvidenceType.OTHER: "其他",
}

STAGE_REQUIRED_EVIDENCES = {
    Stage.NEED: [EvidenceType.NEED_DOCUMENT],
    Stage.QUOTATION: [EvidenceType.NEED_DOCUMENT, EvidenceType.QUOTATION_SHEET],
    Stage.CONTRACT: [EvidenceType.NEED_DOCUMENT, EvidenceType.QUOTATION_SHEET, EvidenceType.CONTRACT],
}


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(Enum(Role), nullable=False)
    department = Column(String(100))

    created_projects = relationship(
        "TrainingProject",
        foreign_keys="TrainingProject.created_by_id",
        back_populates="created_by"
    )
    handled_projects = relationship(
        "TrainingProject",
        foreign_keys="TrainingProject.current_handler_id",
        back_populates="current_handler"
    )


class TrainingProject(Base):
    __tablename__ = "training_projects"

    id = Column(Integer, primary_key=True, index=True)
    project_no = Column(String(50), unique=True, nullable=False, index=True)
    project_name = Column(String(200), nullable=False)
    client_company = Column(String(200), nullable=False)

    stage = Column(Enum(Stage), nullable=False, default=Stage.NEED)
    status = Column(Enum(Status), nullable=False, default=Status.DRAFT)
    version = Column(Integer, nullable=False, default=1)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    current_handler_id = Column(Integer, ForeignKey("users.id"))

    description = Column(Text)
    budget = Column(Float)
    deadline = Column(DateTime)
    is_overdue = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by = relationship(
        "User",
        foreign_keys=[created_by_id],
        back_populates="created_projects"
    )
    current_handler = relationship(
        "User",
        foreign_keys=[current_handler_id],
        back_populates="handled_projects"
    )
    evidences = relationship("Evidence", back_populates="project", cascade="all, delete-orphan")
    operation_logs = relationship("OperationLog", back_populates="project", cascade="all, delete-orphan")
    appeals = relationship("AppealRecord", back_populates="project", cascade="all, delete-orphan")


class Evidence(Base):
    __tablename__ = "evidences"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("training_projects.id"), nullable=False)
    name = Column(String(200), nullable=False)
    evidence_type = Column(Enum(EvidenceType), nullable=False)
    file_path = Column(String(500))
    description = Column(Text)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("TrainingProject", back_populates="evidences")
    uploaded_by = relationship("User")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("training_projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_role = Column(Enum(Role), nullable=False)
    user_name = Column(String(100), nullable=False)
    action = Column(Enum(ActionType), nullable=False)

    from_status = Column(Enum(Status))
    to_status = Column(Enum(Status))
    stage = Column(Enum(Stage))
    version = Column(Integer)

    comment = Column(Text)
    opinion = Column(Text)
    reject_reason = Column(Text)
    audit_note = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("TrainingProject", back_populates="operation_logs")
    user = relationship("User")


class AppealRecord(Base):
    __tablename__ = "appeal_records"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("training_projects.id"), nullable=False)
    version = Column(Integer, nullable=False)

    submitter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    submitter_name = Column(String(100), nullable=False)
    appeal_reason = Column(Text, nullable=False)
    submitter_opinion = Column(Text)

    reviewer_id = Column(Integer, ForeignKey("users.id"))
    reviewer_name = Column(String(100))
    reviewer_opinion = Column(Text)
    result = Column(Enum(AppealResult), default=AppealResult.PENDING)

    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime)

    project = relationship("TrainingProject", back_populates="appeals")
    submitter = relationship("User", foreign_keys=[submitter_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
