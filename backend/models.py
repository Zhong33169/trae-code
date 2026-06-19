from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import enum

db = SQLAlchemy()


class RoleEnum(enum.Enum):
    breeder = "breeder"
    vet_supervisor = "vet_supervisor"
    farm_manager = "farm_manager"


class RecordStatus(enum.Enum):
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    returned = "returned"
    timeout = "timeout"


class AttachmentType(enum.Enum):
    required = "required"
    supplementary = "supplementary"
    rejected = "rejected"


class RecheckStatus(enum.Enum):
    pending = "pending"
    rechecked = "rechecked"
    resolved = "resolved"
    escalated = "escalated"


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    display_name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.Enum(RoleEnum), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "display_name": self.display_name,
            "role": self.role.value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ImmunizationPlan(db.Model):
    __tablename__ = "immunization_plans"
    id = db.Column(db.Integer, primary_key=True)
    plan_code = db.Column(db.String(50), unique=True, nullable=False)
    plan_name = db.Column(db.String(200), nullable=False)
    vaccine_type = db.Column(db.String(100), nullable=False)
    target_species = db.Column(db.String(100), nullable=False)
    target_count = db.Column(db.Integer, nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.Enum(RecordStatus), default=RecordStatus.draft)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = db.relationship("User", foreign_keys=[created_by])
    records = db.relationship("VaccinationRecord", backref="plan", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "plan_code": self.plan_code,
            "plan_name": self.plan_name,
            "vaccine_type": self.vaccine_type,
            "target_species": self.target_species,
            "target_count": self.target_count,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status.value,
            "created_by": self.created_by,
            "creator_name": self.creator.display_name if self.creator else None,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "record_count": len(self.records),
        }


class VaccinationRecord(db.Model):
    __tablename__ = "vaccination_records"
    id = db.Column(db.Integer, primary_key=True)
    record_code = db.Column(db.String(50), unique=True, nullable=False)
    plan_id = db.Column(db.Integer, db.ForeignKey("immunization_plans.id"), nullable=False)
    animal_id = db.Column(db.String(50), nullable=False)
    animal_tag = db.Column(db.String(100))
    species = db.Column(db.String(100))
    status = db.Column(db.Enum(RecordStatus), default=RecordStatus.draft)
    vaccinated_at = db.Column(db.DateTime)
    vaccine_batch = db.Column(db.String(100))
    dosage = db.Column(db.String(50))
    result = db.Column(db.String(50))
    return_reason = db.Column(db.Text)
    audit_note = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    approved_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime)
    approved_at = db.Column(db.DateTime)
    deadline_at = db.Column(db.DateTime)

    creator = db.relationship("User", foreign_keys=[created_by])
    reviewer = db.relationship("User", foreign_keys=[reviewed_by])
    approver = db.relationship("User", foreign_keys=[approved_by])
    attachments = db.relationship("Attachment", backref="record", lazy=True)
    rechecks = db.relationship("AbnormalRecheck", backref="record", lazy=True)

    def to_dict(self, include_attachments=True):
        d = {
            "id": self.id,
            "record_code": self.record_code,
            "plan_id": self.plan_id,
            "plan_name": self.plan.plan_name if self.plan else None,
            "animal_id": self.animal_id,
            "animal_tag": self.animal_tag,
            "species": self.species,
            "status": self.status.value,
            "vaccinated_at": self.vaccinated_at.isoformat() if self.vaccinated_at else None,
            "vaccine_batch": self.vaccine_batch,
            "dosage": self.dosage,
            "result": self.result,
            "return_reason": self.return_reason,
            "audit_note": self.audit_note,
            "created_by": self.created_by,
            "creator_name": self.creator.display_name if self.creator else None,
            "reviewed_by": self.reviewed_by,
            "reviewer_name": self.reviewer.display_name if self.reviewer else None,
            "approved_by": self.approved_by,
            "approver_name": self.approver.display_name if self.approver else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "deadline_at": self.deadline_at.isoformat() if self.deadline_at else None,
            "is_overdue": self.deadline_at and datetime.utcnow() > self.deadline_at and self.status not in [RecordStatus.approved],
        }
        if include_attachments:
            d["attachments"] = [a.to_dict() for a in self.attachments]
            d["required_attachment_count"] = sum(1 for a in self.attachments if a.attachment_type == AttachmentType.required)
            d["supplementary_attachment_count"] = sum(1 for a in self.attachments if a.attachment_type == AttachmentType.supplementary)
            d["rejected_attachment_count"] = sum(1 for a in self.attachments if a.attachment_type == AttachmentType.rejected)
            d["has_all_required"] = all(a.attachment_type != AttachmentType.required or a.file_path for a in self.attachments)
            d["missing_required"] = [a.to_dict() for a in self.attachments if a.attachment_type == AttachmentType.required and not a.file_path]
        return d


class Attachment(db.Model):
    __tablename__ = "attachments"
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey("vaccination_records.id"), nullable=False)
    file_name = db.Column(db.String(255))
    file_path = db.Column(db.String(500))
    attachment_type = db.Column(db.Enum(AttachmentType), default=AttachmentType.required)
    label = db.Column(db.String(200))
    rejection_reason = db.Column(db.Text)
    uploaded_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    uploaded_at = db.Column(db.DateTime)
    rejected_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    uploader = db.relationship("User", foreign_keys=[uploaded_by])

    def to_dict(self):
        return {
            "id": self.id,
            "record_id": self.record_id,
            "file_name": self.file_name,
            "file_path": self.file_path,
            "attachment_type": self.attachment_type.value,
            "label": self.label,
            "rejection_reason": self.rejection_reason,
            "uploaded_by": self.uploaded_by,
            "uploader_name": self.uploader.display_name if self.uploader else None,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "rejected_at": self.rejected_at.isoformat() if self.rejected_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AbnormalRecheck(db.Model):
    __tablename__ = "abnormal_rechecks"
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey("vaccination_records.id"), nullable=False)
    abnormal_type = db.Column(db.String(100))
    description = db.Column(db.Text)
    status = db.Column(db.Enum(RecheckStatus), default=RecheckStatus.pending)
    recheck_result = db.Column(db.Text)
    resolution = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    rechecked_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    rechecked_at = db.Column(db.DateTime)
    deadline_at = db.Column(db.DateTime)

    creator = db.relationship("User", foreign_keys=[created_by])
    rechecker = db.relationship("User", foreign_keys=[rechecked_by])

    def to_dict(self):
        return {
            "id": self.id,
            "record_id": self.record_id,
            "record_code": self.record.record_code if self.record else None,
            "animal_id": self.record.animal_id if self.record else None,
            "abnormal_type": self.abnormal_type,
            "description": self.description,
            "status": self.status.value,
            "recheck_result": self.recheck_result,
            "resolution": self.resolution,
            "created_by": self.created_by,
            "creator_name": self.creator.display_name if self.creator else None,
            "rechecked_by": self.rechecked_by,
            "rechecker_name": self.rechecker.display_name if self.rechecker else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "rechecked_at": self.rechecked_at.isoformat() if self.rechecked_at else None,
            "deadline_at": self.deadline_at.isoformat() if self.deadline_at else None,
            "is_overdue": self.deadline_at and datetime.utcnow() > self.deadline_at and self.status not in [RecheckStatus.resolved],
        }


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey("vaccination_records.id"), nullable=True)
    recheck_id = db.Column(db.Integer, db.ForeignKey("abnormal_rechecks.id"), nullable=True)
    action = db.Column(db.String(100), nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    actor_role = db.Column(db.Enum(RoleEnum))
    detail = db.Column(db.Text)
    failure_reason = db.Column(db.Text)
    next_step_suggestion = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    actor = db.relationship("User", foreign_keys=[actor_id])

    def to_dict(self):
        return {
            "id": self.id,
            "record_id": self.record_id,
            "recheck_id": self.recheck_id,
            "action": self.action,
            "actor_id": self.actor_id,
            "actor_name": self.actor.display_name if self.actor else None,
            "actor_role": self.actor_role.value if self.actor_role else None,
            "detail": self.detail,
            "failure_reason": self.failure_reason,
            "next_step_suggestion": self.next_step_suggestion,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
