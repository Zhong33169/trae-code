from datetime import datetime
from typing import Optional, List
from ninja import Schema, Field
from .models import Role, ChangeOrderStatus, AttachmentStatus, AuditAction


class UserSchema(Schema):
    id: int
    username: str
    name: str
    role: str
    role_display: str

    @staticmethod
    def resolve_role_display(obj):
        return dict(Role.choices).get(obj.role, obj.role)


class AttachmentSchema(Schema):
    id: int
    file_name: str
    file_path: str
    file_type: str
    file_size: int
    status: str
    status_display: str
    reject_reason: Optional[str]
    uploaded_by: str
    uploaded_by_id: int
    rejected_by: Optional[str]
    rejected_at: Optional[datetime]
    created_at: datetime

    @staticmethod
    def resolve_status_display(obj):
        return dict(AttachmentStatus.choices).get(obj.status, obj.status)

    @staticmethod
    def resolve_uploaded_by(obj):
        return obj.uploaded_by.name

    @staticmethod
    def resolve_uploaded_by_id(obj):
        return obj.uploaded_by.id

    @staticmethod
    def resolve_rejected_by(obj):
        return obj.rejected_by.name if obj.rejected_by else None


class AttachmentIn(Schema):
    file_name: str
    file_type: str = ''


class AuditLogSchema(Schema):
    id: int
    action: str
    action_display: str
    operator: str
    operator_id: int
    operator_role: str
    reason: Optional[str]
    detail: dict
    created_at: datetime

    @staticmethod
    def resolve_action_display(obj):
        return dict(AuditAction.choices).get(obj.action, obj.action)

    @staticmethod
    def resolve_operator(obj):
        return obj.operator.name

    @staticmethod
    def resolve_operator_id(obj):
        return obj.operator.id

    @staticmethod
    def resolve_operator_role(obj):
        return dict(Role.choices).get(obj.operator.role, obj.operator.role)


class MaterialChangeOrderSchema(Schema):
    id: int
    order_no: str
    title: str
    material_code: str
    material_name: str
    change_type: str
    description: str
    status: str
    status_display: str
    registrar: str
    registrar_id: int
    supervisor: Optional[str]
    supervisor_id: Optional[int]
    reviewer: Optional[str]
    reviewer_id: Optional[int]
    return_reason: Optional[str]
    audit_remark: Optional[str]
    supplement_note: Optional[str]
    is_overdue: bool
    deadline: Optional[datetime]
    attachments: List[AttachmentSchema] = []
    audit_logs: List[AuditLogSchema] = []
    created_at: datetime
    updated_at: datetime
    submitted_at: Optional[datetime]
    archived_at: Optional[datetime]

    @staticmethod
    def resolve_status_display(obj):
        return dict(ChangeOrderStatus.choices).get(obj.status, obj.status)

    @staticmethod
    def resolve_registrar(obj):
        return obj.registrar.name

    @staticmethod
    def resolve_registrar_id(obj):
        return obj.registrar.id

    @staticmethod
    def resolve_supervisor(obj):
        return obj.supervisor.name if obj.supervisor else None

    @staticmethod
    def resolve_supervisor_id(obj):
        return obj.supervisor.id if obj.supervisor else None

    @staticmethod
    def resolve_reviewer(obj):
        return obj.reviewer.name if obj.reviewer else None

    @staticmethod
    def resolve_reviewer_id(obj):
        return obj.reviewer.id if obj.reviewer else None


class MaterialChangeOrderCreate(Schema):
    order_no: str
    title: str
    material_code: str
    material_name: str
    change_type: str
    description: str
    registrar_id: int


class MaterialChangeOrderUpdate(Schema):
    title: Optional[str] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    change_type: Optional[str] = None
    description: Optional[str] = None
    operator_id: int


class SubmitForReviewSchema(Schema):
    supervisor_id: int
    deadline_days: int = 7
    operator_id: int


class ProcessSchema(Schema):
    reason: str = ''
    audit_remark: str = ''
    operator_id: int


class ReturnSchema(Schema):
    reason: str
    audit_remark: str = ''
    operator_id: int


class SupplementSchema(Schema):
    supplement_note: str = ''
    audit_remark: str = ''
    operator_id: int


class RejectAttachmentSchema(Schema):
    reason: str
    operator_id: int


class DeleteAttachmentSchema(Schema):
    operator_id: int
