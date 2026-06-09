from datetime import datetime
from typing import List, Optional
from uuid import UUID

from ninja import Schema, ModelSchema

from .models import (
    GlassesOrder,
    OrderAttachment,
    AuditLog,
    SystemUser,
    OrderStatus,
    Role,
    AnomalyType,
)


class UserSchema(Schema):
    id: UUID
    username: str
    name: str
    role: str
    role_label: str

    @staticmethod
    def resolve_role_label(obj):
        return dict(Role.choices).get(obj.role, obj.role)


class AttachmentSchema(ModelSchema):
    class Meta:
        model = OrderAttachment
        fields = [
            'id', 'file_name', 'file_type', 'file_size',
            'file_url', 'uploaded_by', 'uploaded_at', 'remark',
        ]


class AuditLogSchema(ModelSchema):
    actor_role_label: str
    status_before_label: str
    status_after_label: str

    class Meta:
        model = AuditLog
        fields = [
            'id', 'action', 'actor', 'actor_role', 'status_before',
            'status_after', 'reason', 'detail', 'is_failure',
            'failure_reason', 'created_at',
        ]

    @staticmethod
    def resolve_actor_role_label(obj):
        return dict(Role.choices).get(obj.actor_role, obj.actor_role)

    @staticmethod
    def resolve_status_before_label(obj):
        return dict(OrderStatus.choices).get(obj.status_before, obj.status_before or '-')

    @staticmethod
    def resolve_status_after_label(obj):
        return dict(OrderStatus.choices).get(obj.status_after, obj.status_after or '-')


class OrderListSchema(Schema):
    id: UUID
    order_no: str
    batch_no: str
    patient_name: str
    status: str
    status_label: str
    offline_status: str
    offline_status_label: str
    is_overdue: bool
    anomaly_types: List[str]
    anomaly_remark: str
    registered_by: str
    reviewed_by: str
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_status_label(obj):
        return dict(OrderStatus.choices).get(obj.status, obj.status)

    @staticmethod
    def resolve_offline_status_label(obj):
        from .models import OfflineStatus
        return dict(OfflineStatus.choices).get(obj.offline_status, obj.offline_status)


class OrderDetailSchema(OrderListSchema):
    patient_id_card: str
    lens_type: str
    lens_power: str
    frame_model: str
    prescription_no: str
    has_prescription: bool
    has_insurance: bool
    has_id_copy: bool
    has_receipt: bool
    registered_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    finalized_by: str
    finalized_at: Optional[datetime] = None
    return_reason: str
    return_by: str
    return_at: Optional[datetime] = None
    audit_remark: str
    result_remark: str
    attachments: List[AttachmentSchema] = []
    audit_logs: List[AuditLogSchema] = []


class OrderCreateSchema(Schema):
    patient_name: str
    patient_id_card: str = ''
    batch_no: str
    lens_type: str = ''
    lens_power: str = ''
    frame_model: str = ''
    prescription_no: str = ''
    has_prescription: bool = False
    has_insurance: bool = False
    has_id_copy: bool = False
    has_receipt: bool = False
    offline_status: str = 'not_recorded'


class OrderUpdateSchema(Schema):
    patient_name: Optional[str] = None
    patient_id_card: Optional[str] = None
    batch_no: Optional[str] = None
    lens_type: Optional[str] = None
    lens_power: Optional[str] = None
    frame_model: Optional[str] = None
    prescription_no: Optional[str] = None
    has_prescription: Optional[bool] = None
    has_insurance: Optional[bool] = None
    has_id_copy: Optional[bool] = None
    has_receipt: Optional[bool] = None
    offline_status: Optional[str] = None
    result_remark: Optional[str] = None
    audit_remark: Optional[str] = None


class OrderReviewSchema(Schema):
    result_remark: str = ''
    audit_remark: str = ''


class OrderReturnSchema(Schema):
    reason: str
    audit_remark: str = ''


class BatchResultItem(Schema):
    order_id: UUID
    order_no: str
    success: bool
    message: str


class BatchOperationResult(Schema):
    total: int
    success_count: int
    failure_count: int
    results: List[BatchResultItem]


class QueueStatsSchema(Schema):
    total: int
    pending_registration: int
    pending_review: int
    pending_final: int
    returned: int
    abnormal: int
    overdue: int


class FilterOptionsSchema(Schema):
    status_options: List[dict]
    anomaly_options: List[dict]
    role_options: List[dict]

    @staticmethod
    def build():
        return FilterOptionsSchema(
            status_options=[
                {'value': k, 'label': v} for k, v in OrderStatus.choices
            ],
            anomaly_options=[
                {'value': k, 'label': v} for k, v in AnomalyType.choices
            ],
            role_options=[
                {'value': k, 'label': v} for k, v in Role.choices
            ],
        )


class AttachmentCreateSchema(Schema):
    file_name: str
    file_type: str
    file_size: int = 0
    file_url: str = ''
    remark: str = ''


class ErrorSchema(Schema):
    detail: str
    code: str = 'error'
