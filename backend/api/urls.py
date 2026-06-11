import os
import uuid
import traceback
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
    ReturnSchema, SupplementSchema, RejectAttachmentSchema,
    DeleteAttachmentSchema
)

api = NinjaAPI(title='电子元器件工厂-附件缺失补正物料变更单系统', version='1.0.0')

MEDIA_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'media')
os.makedirs(MEDIA_ROOT, exist_ok=True)


def _get_user(user_id: int) -> User:
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        raise HttpError(404, f'用户不存在: {user_id}')


def _get_order(order_id: int) -> MaterialChangeOrder:
    try:
        return MaterialChangeOrder.objects.select_related(
            'registrar', 'supervisor', 'reviewer'
        ).prefetch_related(
            'attachments', 'audit_logs', 'audit_logs__operator'
        ).get(id=order_id)
    except MaterialChangeOrder.DoesNotExist:
        raise HttpError(404, f'物料变更单不存在: {order_id}')


def _get_attachment(attachment_id: int) -> Attachment:
    try:
        return Attachment.objects.select_related('order', 'order__registrar', 'order__supervisor').get(id=attachment_id)
    except Attachment.DoesNotExist:
        raise HttpError(404, f'附件不存在: {attachment_id}')


def _create_audit(order: MaterialChangeOrder, action: str, operator: User, reason: str = '', detail: dict = None):
    AuditLog.objects.create(
        order=order,
        action=action,
        operator=operator,
        reason=reason,
        detail=detail or {}
    )


def _validate_role(user: User, expected_role: str, role_label: str):
    if user.role != expected_role:
        raise HttpError(403, f'权限不足：只有{role_label}可以执行此操作')


def _validate_assignment_supervisor(order: MaterialChangeOrder, supervisor: User):
    if order.supervisor_id != supervisor.id:
        raise HttpError(403, f'该单据分配给 {order.supervisor.name if order.supervisor else "未指定"} 办理，您无权操作')


def _validate_assignment_reviewer(order: MaterialChangeOrder, reviewer: User):
    if order.reviewer_id != reviewer.id:
        raise HttpError(403, f'该单据分配给 {order.reviewer.name if order.reviewer else "未指定"} 复核，您无权操作')


def _validate_assignment_registrar(order: MaterialChangeOrder, registrar: User):
    if order.registrar_id != registrar.id:
        raise HttpError(403, f'该单据由 {order.registrar.name} 创建，只有创建人可以操作')


def _validate_status(order: MaterialChangeOrder, allowed_statuses: list, action_label: str):
    if order.status not in allowed_statuses:
        status_labels = [dict(ChangeOrderStatus.choices).get(s, s) for s in allowed_statuses]
        current_label = dict(ChangeOrderStatus.choices).get(order.status, order.status)
        raise HttpError(400, f'{action_label}失败：当前状态「{current_label}」不允许此操作，允许的状态：{", ".join(status_labels)}')


def _safe_operation(order: MaterialChangeOrder, operator: User, action_name: str, func):
    try:
        return func()
    except HttpError as e:
        _create_audit(
            order, AuditAction.OPERATION_FAILED, operator,
            reason=f'{action_name}失败: {str(e)}',
            detail={'error': str(e), 'action': action_name}
        )
        raise
    except Exception as e:
        _create_audit(
            order, AuditAction.OPERATION_FAILED, operator,
            reason=f'{action_name}异常: {str(e)}',
            detail={'error': str(e), 'traceback': traceback.format_exc(), 'action': action_name}
        )
        raise HttpError(500, f'{action_name}异常: {str(e)}')


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
    _validate_role(registrar, Role.REGISTRAR, '物料变更登记员')
    
    if MaterialChangeOrder.objects.filter(order_no=payload.order_no).exists():
        raise HttpError(400, f'变更单号 {payload.order_no} 已存在')
    
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
    
    _create_audit(
        order, AuditAction.CREATED, registrar,
        reason='登记员创建物料变更单',
        detail={'order_no': payload.order_no}
    )
    return _get_order(order.id)


@api.put('/orders/{order_id}', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def update_order(request, order_id: int, payload: MaterialChangeOrderUpdate):
    order = _get_order(order_id)
    operator = _get_user(payload.operator_id)
    
    def do_update():
        _validate_role(operator, Role.REGISTRAR, '物料变更登记员')
        _validate_assignment_registrar(order, operator)
        _validate_status(order, [ChangeOrderStatus.DRAFT, ChangeOrderStatus.SUPPLEMENT_REQUIRED], '更新单据')
        
        changes = {}
        for k, v in payload.dict(exclude_unset=True).items():
            if k == 'operator_id':
                continue
            old_val = getattr(order, k)
            if old_val != v:
                changes[k] = {'old': str(old_val), 'new': str(v)}
                setattr(order, k, v)
        
        order.save()
        
        if changes:
            _create_audit(
                order, AuditAction.UPDATED, operator,
                reason=f'更新了 {len(changes)} 个字段',
                detail={'changes': changes}
            )
        
        return _get_order(order_id)
    
    return _safe_operation(order, operator, '更新单据', do_update)


@api.post('/orders/{order_id}/submit', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def submit_order(request, order_id: int, payload: SubmitForReviewSchema):
    order = _get_order(order_id)
    operator = _get_user(payload.operator_id)
    
    def do_submit():
        _validate_role(operator, Role.REGISTRAR, '物料变更登记员')
        _validate_assignment_registrar(order, operator)
        _validate_status(order, [ChangeOrderStatus.DRAFT], '提交审核')
        
        if not order.attachments.exists():
            raise HttpError(400, '请先上传至少一个附件')
        
        supervisor = _get_user(payload.supervisor_id)
        _validate_role(supervisor, Role.SUPERVISOR, '物料变更审核主管')
        
        order.status = ChangeOrderStatus.PENDING_REVIEW
        order.supervisor = supervisor
        order.deadline = timezone.now() + timedelta(days=payload.deadline_days)
        order.submitted_at = timezone.now()
        order.save()
        
        _create_audit(
            order, AuditAction.SUBMITTED, operator,
            reason=f'提交给 {supervisor.name} 审核办理，时限 {payload.deadline_days} 天',
            detail={'supervisor': supervisor.name, 'deadline_days': payload.deadline_days}
        )
        return _get_order(order_id)
    
    return _safe_operation(order, operator, '提交审核', do_submit)


@api.post('/orders/{order_id}/supervisor/approve', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def supervisor_approve(request, order_id: int, payload: ProcessSchema):
    order = _get_order(order_id)
    operator = _get_user(payload.operator_id)
    
    def do_approve():
        _validate_role(operator, Role.SUPERVISOR, '物料变更审核主管')
        _validate_assignment_supervisor(order, operator)
        _validate_status(order, [ChangeOrderStatus.PENDING_REVIEW], '审核通过')
        
        rejected_attachments = order.attachments.filter(status=AttachmentStatus.REJECTED)
        if rejected_attachments.exists():
            reject_list = [att.file_name for att in rejected_attachments]
            raise HttpError(400, f'存在 {len(reject_list)} 个被驳回的附件：{", ".join(reject_list)}，请先处理')
        
        approved_count = 0
        pending_attachments = order.attachments.filter(status=AttachmentStatus.UPLOADED)
        for att in pending_attachments:
            att.status = AttachmentStatus.APPROVED
            att.save()
            approved_count += 1
            _create_audit(
                order, AuditAction.ATTACHMENT_APPROVED, operator,
                reason=f'附件「{att.file_name}」核验通过',
                detail={'attachment': att.file_name}
            )
        
        reviewers = User.objects.filter(role=Role.REVIEWER)
        if not reviewers.exists():
            raise HttpError(400, '系统中没有复核负责人')
        
        reviewer = reviewers.first()
        order.status = ChangeOrderStatus.PENDING_FINAL
        order.reviewer = reviewer
        if payload.audit_remark:
            order.audit_remark = payload.audit_remark
        order.save()
        
        _create_audit(
            order, AuditAction.APPROVED_SUPERVISOR, operator,
            reason=payload.reason or f'审核通过，共通过 {approved_count + order.attachments.filter(status=AttachmentStatus.APPROVED).count() - approved_count} 个附件，已提交给 {reviewer.name} 复核',
            detail={'audit_remark': payload.audit_remark, 'reviewer': reviewer.name, 'approved_count': approved_count}
        )
        return _get_order(order_id)
    
    return _safe_operation(order, operator, '审核通过', do_approve)


@api.post('/orders/{order_id}/supervisor/return', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def supervisor_return(request, order_id: int, payload: ReturnSchema):
    order = _get_order(order_id)
    operator = _get_user(payload.operator_id)
    
    def do_return():
        _validate_role(operator, Role.SUPERVISOR, '物料变更审核主管')
        _validate_assignment_supervisor(order, operator)
        _validate_status(order, [ChangeOrderStatus.PENDING_REVIEW], '审核退回')
        
        if not payload.reason.strip():
            raise HttpError(400, '退回原因不能为空')
        
        order.status = ChangeOrderStatus.SUPPLEMENT_REQUIRED
        order.return_reason = payload.reason
        if payload.audit_remark:
            order.audit_remark = payload.audit_remark
        order.save()
        
        _create_audit(
            order, AuditAction.REJECTED_SUPERVISOR, operator,
            reason=payload.reason,
            detail={'audit_remark': payload.audit_remark}
        )
        return _get_order(order_id)
    
    return _safe_operation(order, operator, '审核退回', do_return)


@api.post('/orders/{order_id}/supplement', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def supplement_order(request, order_id: int, payload: SupplementSchema):
    order = _get_order(order_id)
    operator = _get_user(payload.operator_id)
    
    def do_supplement():
        _validate_role(operator, Role.REGISTRAR, '物料变更登记员')
        _validate_assignment_registrar(order, operator)
        _validate_status(order, [ChangeOrderStatus.SUPPLEMENT_REQUIRED], '补正后重提')
        
        rejected_attachments = order.attachments.filter(status=AttachmentStatus.REJECTED)
        if rejected_attachments.exists():
            reject_list = [att.file_name for att in rejected_attachments]
            raise HttpError(400, f'存在 {len(reject_list)} 个被驳回的附件：{", ".join(reject_list)}，请删除后重新上传')
        
        all_approved = order.attachments.exists() and not order.attachments.filter(
            status__in=[AttachmentStatus.UPLOADED, AttachmentStatus.REJECTED]
        ).exists()
        has_new_attachments = order.attachments.filter(status=AttachmentStatus.UPLOADED).exists()
        
        if not (all_approved or has_new_attachments):
            raise HttpError(400, '请补齐附件后重新提交')
        
        if not order.supervisor:
            supervisors = User.objects.filter(role=Role.SUPERVISOR)
            if supervisors.exists():
                order.supervisor = supervisors.first()
        
        order.status = ChangeOrderStatus.PENDING_REVIEW
        order.supplement_note = payload.supplement_note
        if payload.audit_remark:
            order.audit_remark = payload.audit_remark
        order.save()
        
        _create_audit(
            order, AuditAction.SUPPLEMENTED, operator,
            reason=payload.supplement_note or f'已补正附件，当前共 {order.attachments.count()} 个附件',
            detail={'audit_remark': payload.audit_remark, 'attachment_count': order.attachments.count()}
        )
        return _get_order(order_id)
    
    return _safe_operation(order, operator, '补正重提', do_supplement)


@api.post('/orders/{order_id}/reviewer/approve', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def reviewer_approve(request, order_id: int, payload: ProcessSchema):
    order = _get_order(order_id)
    operator = _get_user(payload.operator_id)
    
    def do_approve():
        _validate_role(operator, Role.REVIEWER, '电子元器件工厂复核负责人')
        _validate_assignment_reviewer(order, operator)
        _validate_status(order, [ChangeOrderStatus.PENDING_FINAL], '复核归档')
        
        order.status = ChangeOrderStatus.ARCHIVED
        order.archived_at = timezone.now()
        if payload.audit_remark:
            order.audit_remark = payload.audit_remark
        order.save()
        
        _create_audit(
            order, AuditAction.APPROVED_FINAL, operator,
            reason=payload.reason or '复核通过，物料变更单已正式归档',
            detail={'audit_remark': payload.audit_remark}
        )
        return _get_order(order_id)
    
    return _safe_operation(order, operator, '复核归档', do_approve)


@api.post('/orders/{order_id}/reviewer/return', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def reviewer_return(request, order_id: int, payload: ReturnSchema):
    order = _get_order(order_id)
    operator = _get_user(payload.operator_id)
    
    def do_return():
        _validate_role(operator, Role.REVIEWER, '电子元器件工厂复核负责人')
        _validate_assignment_reviewer(order, operator)
        _validate_status(order, [ChangeOrderStatus.PENDING_FINAL], '复核退回')
        
        if not payload.reason.strip():
            raise HttpError(400, '退回原因不能为空')
        
        order.status = ChangeOrderStatus.RETURNED
        order.return_reason = payload.reason
        if payload.audit_remark:
            order.audit_remark = payload.audit_remark
        order.save()
        
        _create_audit(
            order, AuditAction.REJECTED_FINAL, operator,
            reason=payload.reason,
            detail={'audit_remark': payload.audit_remark}
        )
        return _get_order(order_id)
    
    return _safe_operation(order, operator, '复核退回', do_return)


@api.post('/orders/{order_id}/mark-overdue', response=MaterialChangeOrderSchema, tags=['物料变更单'])
def mark_order_overdue(request, order_id: int, user_id: int):
    order = _get_order(order_id)
    user = _get_user(user_id)
    
    order.is_overdue = True
    prev_status = order.status
    if order.status == ChangeOrderStatus.PENDING_REVIEW:
        order.status = ChangeOrderStatus.OVERDUE
    order.save()
    
    _create_audit(
        order, AuditAction.MARKED_OVERDUE, user,
        reason=f'处理超时，原状态: {dict(ChangeOrderStatus.choices).get(prev_status, prev_status)}',
        detail={'previous_status': prev_status}
    )
    return _get_order(order_id)


@api.post('/orders/{order_id}/attachments', response=AttachmentSchema, tags=['附件'])
def upload_attachment(request, order_id: int, file: UploadedFile = File(...), user_id: int = 0, file_name: str = ''):
    order = _get_order(order_id)
    operator = _get_user(user_id)
    
    def do_upload():
        _validate_role(operator, Role.REGISTRAR, '物料变更登记员')
        _validate_assignment_registrar(order, operator)
        _validate_status(order, [ChangeOrderStatus.DRAFT, ChangeOrderStatus.SUPPLEMENT_REQUIRED], '上传附件')
        
        ext = os.path.splitext(file.name)[1] if '.' in file.name else ''
        unique_name = f'{uuid.uuid4().hex}{ext}'
        save_path = os.path.join(MEDIA_ROOT, unique_name)
        
        with open(save_path, 'wb') as f:
            f.write(file.read())
        
        actual_file_name = file_name or file.name
        attachment = Attachment.objects.create(
            order=order,
            file_name=actual_file_name,
            file_path=f'/media/{unique_name}',
            file_type=file.content_type or '',
            file_size=file.size,
            uploaded_by=operator,
            status=AttachmentStatus.UPLOADED
        )
        
        _create_audit(
            order, AuditAction.ATTACHMENT_UPLOADED, operator,
            reason=f'上传附件「{actual_file_name}」',
            detail={'attachment': actual_file_name, 'file_size': file.size, 'file_type': file.content_type}
        )
        return attachment
    
    return _safe_operation(order, operator, '上传附件', do_upload)


@api.get('/orders/{order_id}/attachments', response=list[AttachmentSchema], tags=['附件'])
def list_attachments(request, order_id: int):
    order = _get_order(order_id)
    return order.attachments.all()


@api.delete('/attachments/{attachment_id}', tags=['附件'])
def delete_attachment(request, attachment_id: int, operator_id: int):
    att = _get_attachment(attachment_id)
    order = att.order
    operator = _get_user(operator_id)
    
    def do_delete():
        _validate_role(operator, Role.REGISTRAR, '物料变更登记员')
        _validate_assignment_registrar(order, operator)
        _validate_status(order, [ChangeOrderStatus.DRAFT, ChangeOrderStatus.SUPPLEMENT_REQUIRED], '删除附件')
        
        if att.uploaded_by_id != operator.id:
            raise HttpError(403, '只能删除您自己上传的附件')
        
        file_full_path = os.path.join(os.path.dirname(MEDIA_ROOT), att.file_path.lstrip('/'))
        if os.path.exists(file_full_path):
            os.remove(file_full_path)
        
        file_name = att.file_name
        att.delete()
        
        _create_audit(
            order, AuditAction.ATTACHMENT_DELETED, operator,
            reason=f'删除附件「{file_name}」，状态: {dict(AttachmentStatus.choices).get(att.status, att.status)}',
            detail={'attachment': file_name, 'attachment_status': att.status, 'reject_reason': att.reject_reason}
        )
        return {'success': True, 'message': f'附件「{file_name}」已删除'}
    
    return _safe_operation(order, operator, '删除附件', do_delete)


@api.post('/attachments/{attachment_id}/reject', response=AttachmentSchema, tags=['附件'])
def reject_attachment(request, attachment_id: int, payload: RejectAttachmentSchema, user_id: int = 0):
    att = _get_attachment(attachment_id)
    order = att.order
    operator = _get_user(user_id)
    
    def do_reject():
        _validate_role(operator, Role.SUPERVISOR, '物料变更审核主管')
        _validate_assignment_supervisor(order, operator)
        _validate_status(order, [ChangeOrderStatus.PENDING_REVIEW], '驳回附件')
        
        if not payload.reason.strip():
            raise HttpError(400, '驳回原因不能为空')
        
        if att.status == AttachmentStatus.REJECTED:
            raise HttpError(400, '该附件已被驳回')
        
        att.status = AttachmentStatus.REJECTED
        att.reject_reason = payload.reason
        att.rejected_by = operator
        att.rejected_at = timezone.now()
        att.save()
        
        _create_audit(
            order, AuditAction.ATTACHMENT_REJECTED, operator,
            reason=f'附件「{att.file_name}」被驳回: {payload.reason}',
            detail={'attachment': att.file_name, 'reject_reason': payload.reason}
        )
        return att
    
    return _safe_operation(order, operator, '驳回附件', do_reject)


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
