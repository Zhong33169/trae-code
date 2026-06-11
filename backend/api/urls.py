import os
import uuid
from datetime import timedelta
from django.utils import timezone
from ninja import NinjaAPI, File, UploadedFile
from ninja.errors import HttpError
from django.db.models import Q

from .models import (
    User, MaterialChangeOrder, Attachment, AuditLog,
    Role, ChangeOrderStatus, AttachmentStatus, AuditAction
)
from .schemas import (
    UserSchema, MaterialChangeOrderSchema, MaterialChangeOrderCreate,
    MaterialChangeOrderUpdate, AttachmentSchema, AttachmentIn,
    AuditLogSchema, SubmitForReviewSchema, ProcessSchema,
    ReturnSchema, SupplementSchema, RejectAttachmentSchema
)

api = NinjaAPI(title='电子元器件工厂-附件缺失补正物料变更单系统', version='1.0.0')

MEDIA_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'media')
os.makedirs(MEDIA_ROOT, exist_ok=True)


def _get_user(user_id: int) -> User:
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        raise HttpError(404, '用户不存在')


def _get_order(order_id: int) -> MaterialChangeOrder:
    try:
        return MaterialChangeOrder.objects.select_related(
            'registrar', 'supervisor', 'reviewer'
        ).prefetch_related(
            'attachments', 'audit_logs', 'audit_logs__operator'
        ).get(id=order_id)
    except MaterialChangeOrder.DoesNotExist:
        raise HttpError(404, '物料变更单不存在')


def _create_audit(order: MaterialChangeOrder, action: str, operator: User, reason: str = '', detail: dict = None):
    AuditLog.objects.create(
        order=order,
        action=action,
        operator=operator,
        reason=reason,
        detail=detail or {}
    )


@api.get('/users', response=list[UserSchema], tags=['用户'])
def list_users(request, role: str = None):
    qs = User.objects.all()
    if role:
        qs = qs.filter(role=role)
    return qs


@api.get('/users/{user_id}', response=UserSchema, tags=['用户'])
def get_user(request, user_id: int):
    return _get_user(user_id)


@api.get('/orders', response=list[MaterialChangeOrderSchema], tags=['物料变更单'])
def list_orders(request, status: str = None, is_overdue: bool = None, q: str = None, role: str = None, user_id: int = None):
    qs = MaterialChangeOrder.objects.select_related(
        'registrar', 'supervisor', 'reviewer'
    ).prefetch_related('attachments', 'audit_logs')
    
    if status:
        status_list = status.split(',')
        qs = qs.filter(status__in=status_list)
    
    if is_overdue is not None:
        qs = qs.filter(is_overdue=is_overdue)
    
    if q:
        qs = qs.filter(
            Q(order_no__icontains=q) |
            Q(title__icontains=q) |
            Q(material_code__icontains=q) |
            Q(material_name__icontains=q)
        )
    
    if role and user_id:
        user = _get_user(user_id)
        if role == Role.REGISTRAR:
            qs = qs.filter(registrar=user)
        elif role == Role.SUPERVISOR:
            qs = qs.filter(supervisor=user)
        elif role == Role.REVIEWER:
            qs = qs.filter(reviewer=user)
    
    return qs


@api.get('/orders/{order_id}', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def get_order(request, order_id: int):
    return _get_order(order_id)


@api.post('/orders', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def create_order(request, payload: MaterialChangeOrderCreate):
    registrar = _get_user(payload.registrar_id)
    if registrar.role != Role.REGISTRAR:
        raise HttpError(400, '只有物料变更登记员可以创建变更单')
    
    if MaterialChangeOrder.objects.filter(order_no=payload.order_no).exists():
        raise HttpError(400, '变更单号已存在')
    
    order = MaterialChangeOrder.objects.create(
        order_no=payload.order_no,
        title=payload.title,
        material_code=payload.material_code,
        material_name=payload.material_name,
        change_type=payload.change_type,
        description=payload.description,
        registrar=registrar,
        status=ChangeOrderStatus.DRAFT
    )
    
    _create_audit(order, AuditAction.CREATED, registrar, detail={'order_no': payload.order_no})
    return _get_order(order.id)


@api.put('/orders/{order_id}', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def update_order(request, order_id: int, payload: MaterialChangeOrderUpdate):
    order = _get_order(order_id)
    if order.status not in [ChangeOrderStatus.DRAFT, ChangeOrderStatus.SUPPLEMENT_REQUIRED]:
        raise HttpError(400, '当前状态不可编辑')
    
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(order, k, v)
    order.save()
    return _get_order(order_id)


@api.post('/orders/{order_id}/submit', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def submit_order(request, order_id: int, payload: SubmitForReviewSchema):
    order = _get_order(order_id)
    if order.status != ChangeOrderStatus.DRAFT:
        raise HttpError(400, '只有草稿状态可以提交审核')
    
    if not order.attachments.exists():
        raise HttpError(400, '请先上传至少一个附件')
    
    supervisor = _get_user(payload.supervisor_id)
    if supervisor.role != Role.SUPERVISOR:
        raise HttpError(400, '审核主管角色不正确')
    
    order.status = ChangeOrderStatus.PENDING_REVIEW
    order.supervisor = supervisor
    order.deadline = timezone.now() + timedelta(days=payload.deadline_days)
    order.submitted_at = timezone.now()
    order.save()
    
    _create_audit(
        order, AuditAction.SUBMITTED, order.registrar,
        detail={'supervisor': supervisor.name, 'deadline_days': payload.deadline_days}
    )
    return _get_order(order_id)


@api.post('/orders/{order_id}/supervisor/approve', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def supervisor_approve(request, order_id: int, payload: ProcessSchema):
    order = _get_order(order_id)
    if order.status != ChangeOrderStatus.PENDING_REVIEW:
        raise HttpError(400, '当前状态不可审核通过')
    
    rejected_attachments = order.attachments.filter(status=AttachmentStatus.REJECTED)
    if rejected_attachments.exists():
        raise HttpError(400, '存在被驳回的附件，请先处理')
    
    pending_attachments = order.attachments.filter(status=AttachmentStatus.UPLOADED)
    for att in pending_attachments:
        att.status = AttachmentStatus.APPROVED
        att.save()
    
    reviewers = User.objects.filter(role=Role.REVIEWER)
    if not reviewers.exists():
        raise HttpError(400, '系统中没有复核负责人')
    
    order.status = ChangeOrderStatus.PENDING_FINAL
    order.reviewer = reviewers.first()
    order.audit_remark = payload.audit_remark or order.audit_remark
    order.save()
    
    _create_audit(
        order, AuditAction.APPROVED_SUPERVISOR, order.supervisor,
        reason=payload.reason, detail={'audit_remark': payload.audit_remark}
    )
    return _get_order(order_id)


@api.post('/orders/{order_id}/supervisor/return', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def supervisor_return(request, order_id: int, payload: ReturnSchema):
    order = _get_order(order_id)
    if order.status != ChangeOrderStatus.PENDING_REVIEW:
        raise HttpError(400, '当前状态不可退回')
    
    order.status = ChangeOrderStatus.SUPPLEMENT_REQUIRED
    order.return_reason = payload.reason
    order.audit_remark = payload.audit_remark or order.audit_remark
    order.save()
    
    _create_audit(
        order, AuditAction.REJECTED_SUPERVISOR, order.supervisor,
        reason=payload.reason, detail={'audit_remark': payload.audit_remark}
    )
    return _get_order(order_id)


@api.post('/orders/{order_id}/supplement', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def supplement_order(request, order_id: int, payload: SupplementSchema):
    order = _get_order(order_id)
    if order.status != ChangeOrderStatus.SUPPLEMENT_REQUIRED:
        raise HttpError(400, '当前状态不可补正')
    
    rejected_attachments = order.attachments.filter(status=AttachmentStatus.REJECTED)
    if rejected_attachments.exists():
        raise HttpError(400, '请先处理被驳回的附件（删除或重新上传）')
    
    all_approved = order.attachments.exists() and not order.attachments.filter(
        status__in=[AttachmentStatus.UPLOADED, AttachmentStatus.REJECTED]
    ).exists()
    has_new_attachments = order.attachments.filter(status=AttachmentStatus.UPLOADED).exists()
    
    if not (all_approved or has_new_attachments):
        raise HttpError(400, '请补齐附件后重新提交')
    
    order.status = ChangeOrderStatus.PENDING_REVIEW
    order.supplement_note = payload.supplement_note
    order.audit_remark = payload.audit_remark or order.audit_remark
    order.save()
    
    _create_audit(
        order, AuditAction.SUPPLEMENTED, order.registrar,
        reason=payload.supplement_note, detail={'audit_remark': payload.audit_remark}
    )
    return _get_order(order_id)


@api.post('/orders/{order_id}/reviewer/approve', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def reviewer_approve(request, order_id: int, payload: ProcessSchema):
    order = _get_order(order_id)
    if order.status != ChangeOrderStatus.PENDING_FINAL:
        raise HttpError(400, '当前状态不可复核归档')
    
    order.status = ChangeOrderStatus.ARCHIVED
    order.archived_at = timezone.now()
    order.audit_remark = payload.audit_remark or order.audit_remark
    order.save()
    
    _create_audit(
        order, AuditAction.APPROVED_FINAL, order.reviewer,
        reason=payload.reason, detail={'audit_remark': payload.audit_remark}
    )
    return _get_order(order_id)


@api.post('/orders/{order_id}/reviewer/return', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def reviewer_return(request, order_id: int, payload: ReturnSchema):
    order = _get_order(order_id)
    if order.status != ChangeOrderStatus.PENDING_FINAL:
        raise HttpError(400, '当前状态不可退回')
    
    order.status = ChangeOrderStatus.RETURNED
    order.return_reason = payload.reason
    order.audit_remark = payload.audit_remark or order.audit_remark
    order.save()
    
    _create_audit(
        order, AuditAction.REJECTED_FINAL, order.reviewer,
        reason=payload.reason, detail={'audit_remark': payload.audit_remark}
    )
    return _get_order(order_id)


@api.post('/orders/{order_id}/mark-overdue', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def mark_order_overdue(request, order_id: int, user_id: int):
    order = _get_order(order_id)
    user = _get_user(user_id)
    order.is_overdue = True
    if order.status == ChangeOrderStatus.PENDING_REVIEW:
        order.status = ChangeOrderStatus.OVERDUE
    order.save()
    
    _create_audit(order, AuditAction.MARKED_OVERDUE, user, reason='系统超时标记')
    return _get_order(order_id)


@api.post('/orders/{order_id}/attachments', response=AttachmentSchema, tags=['附件'])
def upload_attachment(request, order_id: int, file: UploadedFile = File(...), user_id: int = 0, file_name: str = ''):
    order = _get_order(order_id)
    if order.status not in [ChangeOrderStatus.DRAFT, ChangeOrderStatus.SUPPLEMENT_REQUIRED]:
        raise HttpError(400, '当前状态不可上传附件')
    
    user = _get_user(user_id)
    
    ext = os.path.splitext(file.name)[1] if '.' in file.name else ''
    unique_name = f'{uuid.uuid4().hex}{ext}'
    save_path = os.path.join(MEDIA_ROOT, unique_name)
    
    with open(save_path, 'wb') as f:
        f.write(file.read())
    
    attachment = Attachment.objects.create(
        order=order,
        file_name=file_name or file.name,
        file_path=f'/media/{unique_name}',
        file_type=file.content_type or '',
        file_size=file.size,
        uploaded_by=user,
        status=AttachmentStatus.UPLOADED
    )
    
    return attachment


@api.get('/orders/{order_id}/attachments', response=list[AttachmentSchema], tags=['附件'])
def list_attachments(request, order_id: int):
    order = _get_order(order_id)
    return order.attachments.all()


@api.delete('/attachments/{attachment_id}', tags=['附件'])
def delete_attachment(request, attachment_id: int):
    try:
        att = Attachment.objects.get(id=attachment_id)
    except Attachment.DoesNotExist:
        raise HttpError(404, '附件不存在')
    
    if att.order.status not in [ChangeOrderStatus.DRAFT, ChangeOrderStatus.SUPPLEMENT_REQUIRED]:
        raise HttpError(400, '当前状态不可删除附件')
    
    file_full_path = os.path.join(os.path.dirname(MEDIA_ROOT), att.file_path.lstrip('/'))
    if os.path.exists(file_full_path):
        os.remove(file_full_path)
    
    att.delete()
    return {'success': True}


@api.post('/attachments/{attachment_id}/reject', response=AttachmentSchema, tags=['附件'])
def reject_attachment(request, attachment_id: int, payload: RejectAttachmentSchema, user_id: int = 0):
    try:
        att = Attachment.objects.select_related('order', 'order__supervisor').get(id=attachment_id)
    except Attachment.DoesNotExist:
        raise HttpError(404, '附件不存在')
    
    user = _get_user(user_id)
    
    att.status = AttachmentStatus.REJECTED
    att.reject_reason = payload.reason
    att.rejected_by = user
    att.rejected_at = timezone.now()
    att.save()
    
    _create_audit(
        att.order, AuditAction.ATTACHMENT_REJECTED, user,
        reason=payload.reason, detail={'attachment': att.file_name}
    )
    
    return att


@api.get('/orders/{order_id}/audit-logs', response=list[AuditLogSchema], tags=['审计'])
def list_audit_logs(request, order_id: int):
    order = _get_order(order_id)
    return order.audit_logs.all()


@api.get('/roles', tags=['系统'])
def list_roles(request):
    return [{'value': k, 'label': v} for k, v in Role.choices]


@api.get('/statuses', tags=['系统'])
def list_statuses(request):
    return [{'value': k, 'label': v} for k, v in ChangeOrderStatus.choices]


@api.get('/stats', tags=['统计'])
def get_stats(request, user_id: int = None, role: str = None):
    base_qs = MaterialChangeOrder.objects.all()
    
    if user_id and role:
        user = _get_user(user_id)
        if role == Role.REGISTRAR:
            base_qs = base_qs.filter(registrar=user)
        elif role == Role.SUPERVISOR:
            base_qs = base_qs.filter(supervisor=user)
        elif role == Role.REVIEWER:
            base_qs = base_qs.filter(reviewer=user)
    
    return {
        'total': base_qs.count(),
        'draft': base_qs.filter(status=ChangeOrderStatus.DRAFT).count(),
        'pending_review': base_qs.filter(status=ChangeOrderStatus.PENDING_REVIEW).count(),
        'supplement_required': base_qs.filter(status=ChangeOrderStatus.SUPPLEMENT_REQUIRED).count(),
        'pending_final': base_qs.filter(status=ChangeOrderStatus.PENDING_FINAL).count(),
        'returned': base_qs.filter(status=ChangeOrderStatus.RETURNED).count(),
        'archived': base_qs.filter(status=ChangeOrderStatus.ARCHIVED).count(),
        'overdue': base_qs.filter(is_overdue=True).count(),
    }
