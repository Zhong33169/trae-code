import uuid
from datetime import timedelta
from typing import List, Optional

from django.db import transaction
from django.db.models import Q, Count
from django.utils import timezone
from ninja import Router, Query

from .models import (
    GlassesOrder,
    OrderAttachment,
    AuditLog,
    SystemUser,
    OrderStatus,
    Role,
    AnomalyType,
    OfflineStatus,
)
from .schemas import (
    OrderListSchema,
    OrderDetailSchema,
    OrderCreateSchema,
    OrderUpdateSchema,
    OrderReviewSchema,
    OrderReturnSchema,
    BatchOperationResult,
    BatchResultItem,
    QueueStatsSchema,
    FilterOptionsSchema,
    AttachmentSchema,
    AttachmentCreateSchema,
    AuditLogSchema,
    UserSchema,
    ErrorSchema,
)

router = Router(tags=['配镜订单'])

CURRENT_USER_HEADER = 'X-Current-User'
CURRENT_ROLE_HEADER = 'X-Current-Role'


def _get_current_user(request):
    username = request.headers.get(CURRENT_USER_HEADER, 'admin')
    role = request.headers.get(CURRENT_ROLE_HEADER, Role.REGISTRAR)
    user, _ = SystemUser.objects.get_or_create(
        username=username,
        defaults={'name': username, 'role': role},
    )
    return user


def _add_audit_log(order, action, user, role, status_before='', status_after='',
                   reason='', detail='', is_failure=False, failure_reason=''):
    return AuditLog.objects.create(
        order=order,
        action=action,
        actor=user.name if isinstance(user, SystemUser) else str(user),
        actor_role=role,
        status_before=status_before,
        status_after=status_after,
        reason=reason,
        detail=detail,
        is_failure=is_failure,
        failure_reason=failure_reason,
    )


def _detect_and_save_anomalies(order: GlassesOrder):
    order.detect_anomalies()
    order.save()
    return order


@router.get('/queue-stats', response=QueueStatsSchema, summary='队列统计')
def get_queue_stats(request):
    qs = GlassesOrder.objects.all()
    orders = list(qs)
    for order in orders:
        order.detect_anomalies()
    abnormal_count = sum(1 for o in orders if o.anomaly_types and len(o.anomaly_types) > 0)
    overdue_count = sum(1 for o in orders if o.is_overdue)
    return QueueStatsSchema(
        total=len(orders),
        pending_registration=sum(1 for o in orders if o.status == OrderStatus.PENDING_REGISTRATION),
        pending_review=sum(1 for o in orders if o.status == OrderStatus.PENDING_REVIEW),
        pending_final=sum(1 for o in orders if o.status == OrderStatus.PENDING_FINAL),
        returned=sum(1 for o in orders if o.status == OrderStatus.RETURNED),
        abnormal=abnormal_count,
        overdue=overdue_count,
    )


@router.get('/filter-options', response=FilterOptionsSchema, summary='筛选选项')
def get_filter_options(request):
    return FilterOptionsSchema.build()


@router.get('/users', response=List[UserSchema], summary='用户列表')
def list_users(request):
    return list(SystemUser.objects.all())


@router.get('/orders', response=List[OrderListSchema], summary='订单列表')
def list_orders(
    request,
    status: Optional[str] = Query(None),
    anomaly_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    is_overdue: Optional[bool] = Query(None),
    role_view: Optional[str] = Query(None),
):
    qs = GlassesOrder.objects.all()

    if status:
        qs = qs.filter(status=status)

    if is_overdue is not None:
        qs = qs.filter(is_overdue=is_overdue)

    if search:
        qs = qs.filter(
            Q(order_no__icontains=search)
            | Q(batch_no__icontains=search)
            | Q(patient_name__icontains=search)
        )

    if role_view == Role.REGISTRAR:
        qs = qs.filter(
            Q(status=OrderStatus.PENDING_REGISTRATION)
            | Q(status=OrderStatus.RETURNED)
        )
    elif role_view == Role.SUPERVISOR:
        qs = qs.filter(status=OrderStatus.PENDING_REVIEW)
    elif role_view == Role.REVIEWER:
        qs = qs.filter(status=OrderStatus.PENDING_FINAL)

    orders = list(qs)
    for order in orders:
        order.detect_anomalies()

    if anomaly_type:
        orders = [o for o in orders if anomaly_type in (o.anomaly_types or [])]

    return orders


@router.get('/orders/{order_id}', response=OrderDetailSchema, summary='订单详情')
def get_order_detail(request, order_id: str):
    order = GlassesOrder.objects.get(id=order_id)
    order.detect_anomalies()
    order.save()
    return order


@router.post('/orders', response={201: OrderDetailSchema, 400: ErrorSchema}, summary='创建订单')
def create_order(request, payload: OrderCreateSchema):
    user = _get_current_user(request)

    if user.role not in [Role.REGISTRAR, Role.SUPERVISOR]:
        return 400, {'detail': '只有配镜登记员可以创建订单', 'code': 'permission_denied'}

    order_no = 'GZ' + timezone.now().strftime('%Y%m%d') + str(uuid.uuid4())[:4].upper()

    with transaction.atomic():
        order = GlassesOrder.objects.create(
            order_no=order_no,
            batch_no=payload.batch_no,
            patient_name=payload.patient_name,
            patient_id_card=payload.patient_id_card,
            lens_type=payload.lens_type,
            lens_power=payload.lens_power,
            frame_model=payload.frame_model,
            prescription_no=payload.prescription_no,
            has_prescription=payload.has_prescription,
            has_insurance=payload.has_insurance,
            has_id_copy=payload.has_id_copy,
            has_receipt=payload.has_receipt,
            offline_status=payload.offline_status,
            registered_by=user.name,
            registered_at=timezone.now(),
            status=OrderStatus.PENDING_REGISTRATION,
        )

        _detect_and_save_anomalies(order)

        _add_audit_log(
            order=order,
            action='创建订单',
            user=user,
            role=user.role,
            status_after=OrderStatus.PENDING_REGISTRATION,
            detail=f'创建配镜订单 {order_no}',
        )

    return 201, order


@router.put('/orders/{order_id}', response={200: OrderDetailSchema, 400: ErrorSchema}, summary='更新订单')
def update_order(request, order_id: str, payload: OrderUpdateSchema):
    user = _get_current_user(request)
    order = GlassesOrder.objects.get(id=order_id)

    if user.role not in [Role.REGISTRAR, Role.SUPERVISOR]:
        return 400, {'detail': '无权限更新订单', 'code': 'permission_denied'}

    if order.status not in [OrderStatus.PENDING_REGISTRATION, OrderStatus.RETURNED]:
        return 400, {'detail': '当前状态不可编辑', 'code': 'invalid_status'}

    data = payload.dict(exclude_unset=True)
    for field, value in data.items():
        if hasattr(order, field) and value is not None:
            setattr(order, field, value)

    _detect_and_save_anomalies(order)

    _add_audit_log(
        order=order,
        action='更新订单',
        user=user,
        role=user.role,
        detail=f'更新订单信息：{", ".join(data.keys())}',
    )

    return 200, order


@router.post('/orders/{order_id}/submit', response={200: OrderDetailSchema, 400: ErrorSchema}, summary='提交审核')
def submit_order(request, order_id: str):
    user = _get_current_user(request)
    order = GlassesOrder.objects.get(id=order_id)

    if user.role != Role.REGISTRAR:
        return 400, {'detail': '只有配镜登记员可以提交审核', 'code': 'permission_denied'}

    if order.status not in [OrderStatus.PENDING_REGISTRATION, OrderStatus.RETURNED]:
        return 400, {'detail': '当前状态不可提交审核', 'code': 'invalid_status'}

    anomalies = order.detect_anomalies()
    critical_anomalies = [a for a in anomalies if a in [AnomalyType.MISSING_MATERIALS]]
    if critical_anomalies:
        _add_audit_log(
            order=order,
            action='提交失败',
            user=user,
            role=user.role,
            is_failure=True,
            failure_reason=f'材料缺失：{order.anomaly_remark}',
            detail=f'提交审核失败，{order.anomaly_remark}',
        )
        _detect_and_save_anomalies(order)
        return 400, {
            'detail': f'提交失败：{order.anomaly_remark}',
            'code': 'material_missing',
        }

    status_before = order.status
    order.status = OrderStatus.PENDING_REVIEW
    order.registered_by = user.name
    order.registered_at = timezone.now()
    _detect_and_save_anomalies(order)

    _add_audit_log(
        order=order,
        action='提交审核',
        user=user,
        role=user.role,
        status_before=status_before,
        status_after=OrderStatus.PENDING_REVIEW,
        detail='登记完成，提交审核',
    )

    return 200, order


@router.post('/orders/{order_id}/review-pass', response={200: OrderDetailSchema, 400: ErrorSchema}, summary='审核通过')
def review_pass(request, order_id: str, payload: OrderReviewSchema):
    user = _get_current_user(request)
    order = GlassesOrder.objects.get(id=order_id)

    if user.role != Role.SUPERVISOR:
        return 400, {'detail': '只有配镜审核主管可以审核', 'code': 'permission_denied'}

    if order.status != OrderStatus.PENDING_REVIEW:
        return 400, {'detail': '当前状态不可审核', 'code': 'invalid_status'}

    anomalies = order.detect_anomalies()
    status_before = order.status
    order.status = OrderStatus.PENDING_FINAL
    order.reviewed_by = user.name
    order.reviewed_at = timezone.now()
    if payload.result_remark:
        order.result_remark = payload.result_remark
    if payload.audit_remark:
        order.audit_remark = (order.audit_remark + ' ' + payload.audit_remark).strip()
    _detect_and_save_anomalies(order)

    _add_audit_log(
        order=order,
        action='审核通过',
        user=user,
        role=user.role,
        status_before=status_before,
        status_after=OrderStatus.PENDING_FINAL,
        detail=payload.result_remark or '审核通过，提交复核',
    )

    return 200, order


@router.post('/orders/{order_id}/review-return', response={200: OrderDetailSchema, 400: ErrorSchema}, summary='审核退回')
def review_return(request, order_id: str, payload: OrderReturnSchema):
    user = _get_current_user(request)
    order = GlassesOrder.objects.get(id=order_id)

    if user.role != Role.SUPERVISOR:
        return 400, {'detail': '只有配镜审核主管可以退回', 'code': 'permission_denied'}

    if order.status != OrderStatus.PENDING_REVIEW:
        return 400, {'detail': '当前状态不可退回', 'code': 'invalid_status'}

    status_before = order.status
    order.status = OrderStatus.RETURNED
    order.return_reason = payload.reason
    order.return_by = user.name
    order.return_at = timezone.now()
    if payload.audit_remark:
        order.audit_remark = (order.audit_remark + ' ' + payload.audit_remark).strip()
    _detect_and_save_anomalies(order)

    _add_audit_log(
        order=order,
        action='审核退回',
        user=user,
        role=user.role,
        status_before=status_before,
        status_after=OrderStatus.RETURNED,
        reason=payload.reason,
        detail=f'审核退回，原因：{payload.reason}',
    )

    return 200, order


@router.post('/orders/{order_id}/final-pass', response={200: OrderDetailSchema, 400: ErrorSchema}, summary='复核通过归档')
def final_pass(request, order_id: str, payload: OrderReviewSchema):
    user = _get_current_user(request)
    order = GlassesOrder.objects.get(id=order_id)

    if user.role != Role.REVIEWER:
        return 400, {'detail': '只有复核负责人可以复核', 'code': 'permission_denied'}

    if order.status != OrderStatus.PENDING_FINAL:
        return 400, {'detail': '当前状态不可复核', 'code': 'invalid_status'}

    anomalies = order.detect_anomalies()
    status_before = order.status
    order.status = OrderStatus.ARCHIVED
    order.finalized_by = user.name
    order.finalized_at = timezone.now()
    if payload.result_remark:
        order.result_remark = (order.result_remark + ' ' + payload.result_remark).strip()
    if payload.audit_remark:
        order.audit_remark = (order.audit_remark + ' ' + payload.audit_remark).strip()
    _detect_and_save_anomalies(order)

    _add_audit_log(
        order=order,
        action='复核归档',
        user=user,
        role=user.role,
        status_before=status_before,
        status_after=OrderStatus.ARCHIVED,
        detail=payload.result_remark or '复核通过，已归档',
    )

    return 200, order


@router.post('/orders/{order_id}/final-return', response={200: OrderDetailSchema, 400: ErrorSchema}, summary='复核退回')
def final_return(request, order_id: str, payload: OrderReturnSchema):
    user = _get_current_user(request)
    order = GlassesOrder.objects.get(id=order_id)

    if user.role != Role.REVIEWER:
        return 400, {'detail': '只有复核负责人可以退回', 'code': 'permission_denied'}

    if order.status != OrderStatus.PENDING_FINAL:
        return 400, {'detail': '当前状态不可退回', 'code': 'invalid_status'}

    status_before = order.status
    order.status = OrderStatus.RETURNED
    order.return_reason = payload.reason
    order.return_by = user.name
    order.return_at = timezone.now()
    if payload.audit_remark:
        order.audit_remark = (order.audit_remark + ' ' + payload.audit_remark).strip()
    _detect_and_save_anomalies(order)

    _add_audit_log(
        order=order,
        action='复核退回',
        user=user,
        role=user.role,
        status_before=status_before,
        status_after=OrderStatus.RETURNED,
        reason=payload.reason,
        detail=f'复核退回，原因：{payload.reason}',
    )

    return 200, order


@router.post('/orders/batch-submit', response=BatchOperationResult, summary='批量提交审核')
def batch_submit(request, order_ids: List[str]):
    user = _get_current_user(request)
    results = []
    success_count = 0
    failure_count = 0

    for oid in order_ids:
        try:
            order = GlassesOrder.objects.get(id=oid)
            if order.status not in [OrderStatus.PENDING_REGISTRATION, OrderStatus.RETURNED]:
                results.append(BatchResultItem(
                    order_id=order.id,
                    order_no=order.order_no,
                    success=False,
                    message=f'状态「{order.get_status_display()}」不可提交',
                ))
                failure_count += 1
                _add_audit_log(
                    order=order,
                    action='批量提交失败',
                    user=user,
                    role=user.role,
                    is_failure=True,
                    failure_reason=f'状态错误：{order.status}',
                    detail='批量提交审核失败',
                )
                continue

            anomalies = order.detect_anomalies()
            if AnomalyType.MISSING_MATERIALS in anomalies:
                results.append(BatchResultItem(
                    order_id=order.id,
                    order_no=order.order_no,
                    success=False,
                    message=f'材料缺失：{order.anomaly_remark}',
                ))
                failure_count += 1
                _add_audit_log(
                    order=order,
                    action='批量提交失败',
                    user=user,
                    role=user.role,
                    is_failure=True,
                    failure_reason=order.anomaly_remark,
                    detail='批量提交审核失败，材料缺失',
                )
                continue

            status_before = order.status
            order.status = OrderStatus.PENDING_REVIEW
            order.registered_by = user.name
            order.registered_at = timezone.now()
            _detect_and_save_anomalies(order)

            _add_audit_log(
                order=order,
                action='批量提交审核',
                user=user,
                role=user.role,
                status_before=status_before,
                status_after=OrderStatus.PENDING_REVIEW,
            )
            results.append(BatchResultItem(
                order_id=order.id,
                order_no=order.order_no,
                success=True,
                message='提交成功',
            ))
            success_count += 1
        except Exception as e:
            results.append(BatchResultItem(
                order_id=oid,
                order_no='未知',
                success=False,
                message=str(e),
            ))
            failure_count += 1

    return BatchOperationResult(
        total=len(order_ids),
        success_count=success_count,
        failure_count=failure_count,
        results=results,
    )


@router.post('/orders/batch-review', response=BatchOperationResult, summary='批量审核通过')
def batch_review(request, order_ids: List[str]):
    user = _get_current_user(request)
    results = []
    success_count = 0
    failure_count = 0

    for oid in order_ids:
        try:
            order = GlassesOrder.objects.get(id=oid)
            if order.status != OrderStatus.PENDING_REVIEW:
                results.append(BatchResultItem(
                    order_id=order.id,
                    order_no=order.order_no,
                    success=False,
                    message=f'状态「{order.get_status_display()}」不可审核',
                ))
                failure_count += 1
                continue

            status_before = order.status
            order.status = OrderStatus.PENDING_FINAL
            order.reviewed_by = user.name
            order.reviewed_at = timezone.now()
            _detect_and_save_anomalies(order)

            _add_audit_log(
                order=order,
                action='批量审核通过',
                user=user,
                role=user.role,
                status_before=status_before,
                status_after=OrderStatus.PENDING_FINAL,
            )
            results.append(BatchResultItem(
                order_id=order.id,
                order_no=order.order_no,
                success=True,
                message='审核通过',
            ))
            success_count += 1
        except Exception as e:
            results.append(BatchResultItem(
                order_id=oid,
                order_no='未知',
                success=False,
                message=str(e),
            ))
            failure_count += 1

    return BatchOperationResult(
        total=len(order_ids),
        success_count=success_count,
        failure_count=failure_count,
        results=results,
    )


@router.get('/orders/{order_id}/attachments', response=List[AttachmentSchema], summary='订单附件列表')
def list_attachments(request, order_id: str):
    order = GlassesOrder.objects.get(id=order_id)
    return list(order.attachments.all())


@router.post('/orders/{order_id}/attachments', response={201: AttachmentSchema, 400: ErrorSchema}, summary='上传附件')
def create_attachment(request, order_id: str, payload: AttachmentCreateSchema):
    user = _get_current_user(request)
    order = GlassesOrder.objects.get(id=order_id)

    attachment = OrderAttachment.objects.create(
        order=order,
        file_name=payload.file_name,
        file_type=payload.file_type,
        file_size=payload.file_size,
        file_url=payload.file_url,
        uploaded_by=user.name,
        remark=payload.remark,
    )

    _add_audit_log(
        order=order,
        action='上传附件',
        user=user,
        role=user.role,
        detail=f'上传附件：{payload.file_name}',
    )

    return 201, attachment


@router.delete('/orders/{order_id}/attachments/{attachment_id}', response={200: dict, 400: ErrorSchema}, summary='删除附件')
def delete_attachment(request, order_id: str, attachment_id: str):
    user = _get_current_user(request)
    attachment = OrderAttachment.objects.get(id=attachment_id, order_id=order_id)

    file_name = attachment.file_name
    order = attachment.order
    attachment.delete()

    _add_audit_log(
        order=order,
        action='删除附件',
        user=user,
        role=user.role,
        detail=f'删除附件：{file_name}',
    )

    return 200, {'detail': '删除成功'}


@router.get('/orders/{order_id}/audit-logs', response=List[AuditLogSchema], summary='审计日志')
def list_audit_logs(request, order_id: str):
    order = GlassesOrder.objects.get(id=order_id)
    return list(order.audit_logs.all())


@router.get('/audit-logs', response=List[AuditLogSchema], summary='全局审计日志')
def list_all_audit_logs(
    request,
    is_failure: Optional[bool] = Query(None),
    actor_role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    qs = AuditLog.objects.all()
    if is_failure is not None:
        qs = qs.filter(is_failure=is_failure)
    if actor_role:
        qs = qs.filter(actor_role=actor_role)
    if search:
        qs = qs.filter(
            Q(actor__icontains=search)
            | Q(detail__icontains=search)
            | Q(reason__icontains=search)
            | Q(failure_reason__icontains=search)
        )
    return list(qs[:200])


@router.get('/orders/{order_id}/anomalies/check', response=OrderDetailSchema, summary='异常检测')
def check_anomalies(request, order_id: str):
    order = GlassesOrder.objects.get(id=order_id)
    _detect_and_save_anomalies(order)
    return order
