from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from database import Base
import enum


class RoleEnum(str, enum.Enum):
    REGISTRAR = "registrar"
    SUPERVISOR = "supervisor"
    REVIEWER = "reviewer"


class ReleaseStatusEnum(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    REVIEW_APPROVED = "review_approved"
    REVIEW_REJECTED = "review_rejected"
    PENDING_RECHECK = "pending_recheck"
    RECHECK_APPROVED = "recheck_approved"
    RECHECK_REJECTED = "recheck_rejected"
    PUBLISHED = "published"
    ROLLED_BACK = "rolled_back"
    REVIEWED_POST_LAUNCH = "reviewed_post_launch"
    ARCHIVED = "archived"


class ShiftEnum(str, enum.Enum):
    DAY = "day"
    NIGHT = "night"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    operations = relationship("OperationLog", back_populates="operator")
    handovers_from = relationship("ShiftHandover", foreign_keys="ShiftHandover.from_user_id", back_populates="from_user")
    handovers_to = relationship("ShiftHandover", foreign_keys="ShiftHandover.to_user_id", back_populates="to_user")


class ReleaseApplication(Base):
    __tablename__ = "release_applications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    project_name = Column(String(100), nullable=False)
    version = Column(String(50), nullable=False)
    description = Column(Text)
    release_content = Column(Text)
    impact_scope = Column(String(200))
    planned_release_time = Column(DateTime)
    status = Column(Enum(ReleaseStatusEnum), default=ReleaseStatusEnum.DRAFT, nullable=False)

    creator_id = Column(Integer, ForeignKey("users.id"))
    creator = relationship("User", foreign_keys=[creator_id])
    reviewer_id = Column(Integer, ForeignKey("users.id"))
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    rechecker_id = Column(Integer, ForeignKey("users.id"))
    rechecker = relationship("User", foreign_keys=[rechecker_id])

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    review_comment = Column(Text)
    recheck_comment = Column(Text)

    rollback_plan = relationship("RollbackPlan", back_populates="release_application", uselist=False, cascade="all, delete-orphan")
    post_launch_review = relationship("PostLaunchReview", back_populates="release_application", uselist=False, cascade="all, delete-orphan")
    operation_logs = relationship("OperationLog", back_populates="release_application", cascade="all, delete-orphan")
    shift_handovers = relationship("ShiftHandover", back_populates="release_application", cascade="all, delete-orphan")


class RollbackPlan(Base):
    __tablename__ = "rollback_plans"

    id = Column(Integer, primary_key=True, index=True)
    release_application_id = Column(Integer, ForeignKey("release_applications.id"), nullable=False)
    trigger_condition = Column(Text, nullable=False)
    rollback_steps = Column(Text, nullable=False)
    rollback_person = Column(String(100))
    expected_duration = Column(String(50))
    is_approved = Column(Boolean, default=False)
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    release_application = relationship("ReleaseApplication", back_populates="rollback_plan")


class PostLaunchReview(Base):
    __tablename__ = "post_launch_reviews"

    id = Column(Integer, primary_key=True, index=True)
    release_application_id = Column(Integer, ForeignKey("release_applications.id"), nullable=False)
    review_content = Column(Text)
    issues_found = Column(Text)
    improvement_measures = Column(Text)
    release_result = Column(String(50))
    reviewer_id = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    release_application = relationship("ReleaseApplication", back_populates="post_launch_review")


class ShiftHandover(Base):
    __tablename__ = "shift_handovers"

    id = Column(Integer, primary_key=True, index=True)
    release_application_id = Column(Integer, ForeignKey("release_applications.id"), nullable=False)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shift = Column(Enum(ShiftEnum), nullable=False)
    handover_content = Column(Text)
    is_confirmed = Column(Boolean, default=False)
    confirmed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    release_application = relationship("ReleaseApplication", back_populates="shift_handovers")
    from_user = relationship("User", foreign_keys=[from_user_id], back_populates="handovers_from")
    to_user = relationship("User", foreign_keys=[to_user_id], back_populates="handovers_to")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    release_application_id = Column(Integer, ForeignKey("release_applications.id"))
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    operation_type = Column(String(50), nullable=False)
    operation_detail = Column(Text)
    old_status = Column(String(50))
    new_status = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    release_application = relationship("ReleaseApplication", back_populates="operation_logs")
    operator = relationship("User", back_populates="operations")
