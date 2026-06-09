import uuid
from typing import List, Optional

from django.db import transaction
from django.db.models import Q
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
    ValidationResultSchema,
    CurrentUserSchema,
)
from .services import (
    OrderAuthorizationService,
    OrderValidationService,
    RoleUserMapping,
    ValidationResult,
)

router = Router(tags=['配镜订单'])

CURRENT_USER_HEADER = 'X-Current-User'
CURRENT_ROLE_HEADER = 'X-Current-Role'


def _authenticate_request(request):
    username = request.headers.get(CURRENT_USER_HEADER, '')
    role = request.headers.get(CURRENT_ROLE_HEADER, '')

    if not username or not role:
        return None, False

    user, is_authorized = OrderAuthorizationService.authenticate(username, role)
    return user, is_authorized


def _auth_response():
    return 403, {
        'detail': '身份认证失败：用户与角色不匹配或用户不存在',
        'code': 'unauthorized',
    }


def _add_audit_log(order, action, user, status_before='', status_after='',
                   reason='', detail='', is_failure=False, failure_reason=''):
    return AuditLog.objects.create(
        order=order,
        action=action,
        actor=user.name if isinstance(user, SystemUser) else str(user),
        actor_role=user.role if isinstance(user, SystemUser) else '',
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


@router.get('/me', response={200: CurrentUserSchema, 403: ErrorSchema}, summary='当前用户信息')
def get_current_user(request):
    user, is_authorized = _authenticate_request(request)
    if not is_authorized:
        return _auth_response()
    return 200, CurrentUserSchema.from_user(user)


@router.get('/users/by-role/{role}', response=List[UserSchema], summary='按角色获取用户列表')
def get_users_by_role(request, role: str):
    return RoleUserMapping.get_users_by_role(role)


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


@router.post('/orders/batch-submit', response=BatchOperationResult, summary='批量提交审核')
def batch_submit(request, order_ids: List[str]):
    user, is_authorized = _authenticate_request(request)
    if not is_authorized:
        return BatchOperationResult(
            total=len(order_ids),
            success_count=0,
            failure_count=len(order_ids),
            results=[
                BatchResultItem(order_id=oid, order_no='未知', success=False, message='身份认证失败')
                for oid in order_ids
            ],
        )

    results = []
    success_count = 0
    failure_count = 0

    for oid in order_ids:
        try:
            order = GlassesOrder.objects.get(id=oid)

            if not OrderAuthorizationService.can_submit_order(user, order):
                msg = f'状态「{order.get_status_display()}」不允许提交或权限不足'
                results.append(BatchResultItem(
                    order_id=order.id,
                    order_no=order.order_no,
                    success=False,
                    message=msg,
                    failure_type='permission',
                    blocking_errors=[msg],
                    warnings=[],
                ))
                failure_count += 1
                _add_audit_log(
                    order=order,
                    action='批量提交失败',
                    user=user,
                    is_failure=True,
                    failure_reason=msg,
                    detail='批量提交审核失败：权限不足',
                )
                continue

            validation = OrderValidationService.validate_submit(order)

            if not validation.passed:
                failure_msg = '；'.join(validation.blocking_errors)
                results.append(BatchResultItem(
                    order_id=order.id,
                    order_no=order.order_no,
                    success=False,
                    message=f'拦截：{failure_msg}',
                    failure_type='validation',
                    blocking_errors=validation.blocking_errors,
                    warnings=validation.warnings,
                ))
                failure_count += 1
                _add_audit_log(
                    order=order,
                    action='批量提交失败',
                    user=user,
                    is_failure=True,
                    failure_reason=failure_msg,
                    detail=f'批量提交审核被拦截：{failure_msg}',
                )
                continue

            with transaction.atomic():
                status_before = order.status
                order.status = OrderStatus.PENDING_REVIEW
                order.registered_by = user.name
                order.registered_at = timezone.now()
                _detect_and_save_anomalies(order)

                detail = '批量提交审核成功'
                if validation.warnings:
                    detail += '（提示：' + '；'.join(validation.warnings) + '）'

                _add_audit_log(
                    order=order,
                    action='批量提交审核',
                    user=user,
                    status_before=status_before,
                    status_after=OrderStatus.PENDING_REVIEW,
                    detail=detail,
                )

            results.append(BatchResultItem(
                order_id=order.id,
                order_no=order.order_no,
                success=True,
                message='提交成功' + ('（有警告提示）' if validation.warnings else ''),
                failure_type='',
                blocking_errors=[],
                warnings=validation.warnings,
            ))
            success_count += 1
        except Exception as e:
            results.append(BatchResultItem(
                order_id=oid,
                order_no='未知',
                success=False,
                message=str(e),
                failure_type='error',
                blocking_errors=[str(e)],
                warnings=[],
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
    user, is_authorized = _authenticate_request(request)
    if not is_authorized:
        return BatchOperationResult(
            total=len(order_ids),
            success_count=0,
            failure_count=len(order_ids),
            results=[
                BatchResultItem(order_id=oid, order_no='未知', success=False, message='身份认证失败')
                for oid in order_ids
            ],
        )

    results = []
    success_count = 0
    failure_count = 0

    for oid in order_ids:
        try:
            order = GlassesOrder.objects.get(id=oid)

            if not OrderAuthorizationService.can_review_order(user, order):
                msg = f'状态「{order.get_status_display()}」不允许审核或权限不足'
                results.append(BatchResultItem(
                    order_id=order.id,
                    order_no=order.order_no,
                    success=False,
                    message=msg,
                    failure_type='permission',
                    blocking_errors=[msg],
                    warnings=[],
                ))
                failure_count += 1
                _add_audit_log(
                    order=order,
                    action='批量审核失败',
                    user=user,
                    is_failure=True,
                    failure_reason=msg,
                    detail='批量审核失败：权限不足',
                )
                continue

            validation = OrderValidationService.validate_review(order)

            if not validation.passed:
                failure_msg = '；'.join(validation.blocking_errors)
                results.append(BatchResultItem(
                    order_id=order.id,
                    order_no=order.order_no,
                    success=False,
                    message=f'拦截：{failure_msg}',
                    failure_type='validation',
                    blocking_errors=validation.blocking_errors,
                    warnings=validation.warnings,
                ))
                failure_count += 1
                _add_audit_log(
                    order=order,
                    action='批量审核失败',
                    user=user,
                    is_failure=True,
                    failure_reason=failure_msg,
                    detail=f'批量审核被拦截：{failure_msg}',
                )
                continue

            with transaction.atomic():
                status_before = order.status
                order.status = OrderStatus.PENDING_FINAL
                order.reviewed_by = user.name
                order.reviewed_at = timezone.now()
                _detect_and_save_anomalies(order)

                detail = '批量审核通过'
                if validation.warnings:
                    detail += '（提示：' + '；'.join(validation.warnings) + '）'

                _add_audit_log(
                    order=order,
                    action='批量审核通过',
                    user=user,
                    status_before=status_before,
                    status_after=OrderStatus.PENDING_FINAL,
                    detail=detail,
                )

            results.append(BatchResultItem(
                order_id=order.id,
                order_no=order.order_no,
                success=True,
                message='审核通过' + ('（有警告提示）' if validation.warnings else ''),
                failure_type='',
                blocking_errors=[],
                warnings=validation.warnings,
            ))
            success_count += 1
        except Exception as e:
            results.append(BatchResultItem(
                order_id=oid,
                order_no='未知',
                success=False,
                message=str(e),
                failure_type='error',
                blocking_errors=[str(e)],
                warnings=[],
            ))
            failure_count += 1

    return BatchOperationResult(
        total=len(order_ids),
        success_count=success_count,
        failure_count=failure_count,
        results=results,
    )


@router.get('/orders/{order_id}', response={200: OrderDetailSchema, 403: ErrorSchema}, summary='订单详情')
def get_order_detail(request, order_id: str):
    user, is_authorized = _authenticate_request(request)
    order = GlassesOrder.objects.get(id=order_id)
    order.detect_anomalies()
    order.save()
    return 200, order


@router.get(
    '/orders/{order_id}/validate/{action}',
    response={200: ValidationResultSchema, 403: ErrorSchema},
    summary='订单操作预检'
)
def validate_order_action(request, order_id: str, action: str):
    user, is_authorized = _authenticate_request(request)
    if not is_authorized:
        return _auth_response()

    order = GlassesOrder.objects.get(id=order_id)

    if action == 'submit':
        if not OrderAuthorizationService.can_submit_order(user, order):
            return 403, {'detail': '无权限提交审核', 'code': 'permission_denied'}
        result = OrderValidationService.validate_submit(order)
    elif action == 'review':
        if not OrderAuthorizationService.can_review_order(user, order):
            return 403, {'detail': '无权限审核', 'code': 'permission_denied'}
        result = OrderValidationService.validate_review(order)
    elif action == 'finalize':
        if not OrderAuthorizationService.can_finalize_order(user, order):
            return 403, {'detail': '无权限复核', 'code': 'permission_denied'}
        result = OrderValidationService.validate_finalize(order)
    else:
        return 400, {'detail': '不支持的操作类型', 'code': 'invalid_action'}

    return 200, result


@router.post('/orders', response={201: OrderDetailSchema, 403: ErrorSchema}, summary='创建订单')
def create_order(request, payload: OrderCreateSchema):
    user, is_authorized = _authenticate_request(request)
    if not is_authorized:
        return _auth_response()

    if not OrderAuthorizationService.can_create_order(user):
        return 403, {'detail': '无权限创建订单', 'code': 'permission_denied'}

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
            status_after=OrderStatus.PENDING_REGISTRATION,
            detail=f'创建配镜订单 {order_no}，患者：{payload.patient_name}',
        )

    return 201, order


@router.put(
    '/orders/{order_id}',
    response={200: OrderDetailSchema, 400: ErrorSchema, 403: ErrorSchema},
    summary='更新订单'
)
def update_order(request, order_id: str, payload: OrderUpdateSchema):
    user, is_authorized = _authenticate_request(request)
    if not is_authorized:
        return _auth_response()

    order = GlassesOrder.objects.get(id=order_id)

    if not OrderAuthorizationService.can_edit_order(user, order):
        return 403, {'detail': '无权限编辑此订单', 'code': 'permission_denied'}

    data = payload.dict(exclude_unset=True)
    changed_fields = []
    for field, value in data.items():
        if hasattr(order, field) and value is not None and getattr(order, field) != value:
            setattr(order, field, value)
            changed_fields.append(field)

    _detect_and_save_anomalies(order)

    _add_audit_log(
        order=order,
        action='更新订单',
        user=user,
        detail=f'更新订单信息：{", ".join(changed_fields) if changed_fields else "无实际变更"}',
    )

    return 200, order


@router.post(
    '/orders/{order_id}/submit',
    response={200: OrderDetailSchema, 400: ErrorSchema, 403: ErrorSchema},
    summary='提交审核'
)
def submit_order(request, order_id: str):
    user, is_authorized = _authenticate_request(request)
    if not is_authorized:
        return _auth_response()

    order = GlassesOrder.objects.get(id=order_id)

    if not OrderAuthorizationService.can_submit_order(user, order):
        _add_audit_log(
            order=order,
            action='提交失败',
            user=user,
            is_failure=True,
            failure_reason=f'权限不足或状态错误：当前状态{order.get_status_display()}',
            detail='提交审核失败：无权限或状态不允许',
        )
        return 403, {
            'detail': '无权限提交审核或当前状态不允许提交',
            'code': 'permission_denied',
        }

    validation = OrderValidationService.validate_submit(order)

    if not validation.passed:
        failure_reason = '；'.join(validation.blocking_errors)
        _add_audit_log(
            order=order,
            action='提交失败',
            user=user,
            is_failure=True,
            failure_reason=failure_reason,
            detail=f'提交审核被拦截：{failure_reason}',
        )
        return 400, {
            'detail': '提交失败：' + '；'.join(validation.blocking_errors),
            'code': 'validation_failed',
        }

    warning_msg = ''
    if validation.warnings:
        warning_msg = '（提示：' + '；'.join(validation.warnings) + '）'

    with transaction.atomic():
        status_before = order.status
        order.status = OrderStatus.PENDING_REVIEW
        order.registered_by = user.name
        order.registered_at = timezone.now()
        _detect_and_save_anomalies(order)

        detail = '登记完成，提交审核进入待审核状态'
        if warning_msg:
            detail += warning_msg

        _add_audit_log(
            order=order,
            action='提交审核',
            user=user,
            status_before=status_before,
            status_after=OrderStatus.PENDING_REVIEW,
            detail=detail,
        )

    return 200, order


@router.post(
    '/orders/{order_id}/review-pass',
    response={200: OrderDetailSchema, 400: ErrorSchema, 403: ErrorSchema},
    summary='审核通过'
)
def review_pass(request, order_id: str, payload: OrderReviewSchema):
    user, is_authorized = _authenticate_request(request)
    if not is_authorized:
        return _auth_response()

    order = GlassesOrder.objects.get(id=order_id)

    if not OrderAuthorizationService.can_review_order(user, order):
        _add_audit_log(
            order=order,
            action='审核失败',
            user=user,
            is_failure=True,
            failure_reason=f'权限不足或状态错误：当前状态{order.get_status_display()}',
            detail='审核操作失败：无权限或状态不允许',
        )
        return 403, {
            'detail': '无权限审核或当前状态不允许审核',
            'code': 'permission_denied',
        }

    validation = OrderValidationService.validate_review(order)

    if not validation.passed:
        failure_reason = '；'.join(validation.blocking_errors)
        _add_audit_log(
            order=order,
            action='审核失败',
            user=user,
            is_failure=True,
            failure_reason=failure_reason,
            detail=f'审核被拦截：{failure_reason}',
        )
        return 400, {
            'detail': '审核不通过：' + '；'.join(validation.blocking_errors),
            'code': 'validation_failed',
        }

    warning_msg = ''
    if validation.warnings:
        warning_msg = '（提示：' + '；'.join(validation.warnings) + '）'

    with transaction.atomic():
        status_before = order.status
        order.status = OrderStatus.PENDING_FINAL
        order.reviewed_by = user.name
        order.reviewed_at = timezone.now()
        if payload.result_remark:
            order.result_remark = payload.result_remark
        if payload.audit_remark:
            order.audit_remark = (order.audit_remark + ' ' + payload.audit_remark).strip()
        _detect_and_save_anomalies(order)

        detail = '审核通过，提交复核'
        if payload.result_remark:
            detail += f'；审核意见：{payload.result_remark}'
        if warning_msg:
            detail += warning_msg

        _add_audit_log(
            order=order,
            action='审核通过',
            user=user,
            status_before=status_before,
            status_after=OrderStatus.PENDING_FINAL,
            detail=detail,
        )

    return 200, order


@router.post(
    '/orders/{order_id}/review-return',
    response={200: OrderDetailSchema, 400: ErrorSchema, 403: ErrorSchema},
    summary='审核退回'
)
def review_return(request, order_id: str, payload: OrderReturnSchema):
    user, is_authorized = _authenticate_request(request)
    if not is_authorized:
        return _auth_response()

    order = GlassesOrder.objects.get(id=order_id)

    if not OrderAuthorizationService.can_review_order(user, order):
        _add_audit_log(
            order=order,
            action='审核退回失败',
            user=user,
            is_failure=True,
            failure_reason=f'权限不足或状态错误：当前状态{order.get_status_display()}',
            detail='审核退回操作失败：无权限或状态不允许',
        )
        return 403, {
            'detail': '无权限审核或当前状态不允许退回',
            'code': 'permission_denied',
        }

    if not payload.reason.strip():
        _add_audit_log(
            order=order,
            action='审核退回失败',
            user=user,
            is_failure=True,
            failure_reason='退回原因不能为空',
            detail='审核退回操作失败：未填写退回原因',
        )
        return 400, {'detail': '退回原因不能为空', 'code': 'empty_reason'}

    with transaction.atomic():
        status_before = order.status
        order.status = OrderStatus.RETURNED
        order.return_reason = payload.reason
        order.return_by = user.name
        order.return_at = timezone.now()
        if payload.audit_remark:
            order.audit_remark = (order.audit_remark + ' ' + payload.audit_remark).strip()
        _detect_and_save_anomalies(order)

        detail = f'审核退回，原因：{payload.reason}'
        if payload.audit_remark:
            detail += f'；审计备注：{payload.audit_remark}'

        _add_audit_log(
            order=order,
            action='审核退回',
            user=user,
            status_before=status_before,
            status_after=OrderStatus.RETURNED,
            reason=payload.reason,
            detail=detail,
        )

    return 200, order


@router.post(
    '/orders/{order_id}/final-pass',
    response={200: OrderDetailSchema, 400: ErrorSchema, 403: ErrorSchema},
    summary='复核通过归档'
)
def final_pass(request, order_id: str, payload: OrderReviewSchema):
    user, is_authorized = _authenticate_request(request)
    if not is_authorized:
        return _auth_response()

    order = GlassesOrder.objects.get(id=order_id)

    if not OrderAuthorizationService.can_finalize_order(user, order):
        _add_audit_log(
            order=order,
            action='复核失败',
            user=user,
            is_failure=True,
            failure_reason=f'权限不足或状态错误：当前状态{order.get_status_display()}',
            detail='复核操作失败：无权限或状态不允许',
        )
        return 403, {
            'detail': '无权限复核或当前状态不允许复核',
            'code': 'permission_denied',
        }

    validation = OrderValidationService.validate_finalize(order)

    if not validation.passed:
        failure_reason = '；'.join(validation.blocking_errors)
        _add_audit_log(
            order=order,
            action='复核失败',
            user=user,
            is_failure=True,
            failure_reason=failure_reason,
            detail=f'复核归档被拦截：{failure_reason}',
        )
        return 400, {
            'detail': '复核不通过：' + '；'.join(validation.blocking_errors),
            'code': 'validation_failed',
        }

    warning_msg = ''
    if validation.warnings:
        warning_msg = '（提示：' + '；'.join(validation.warnings) + '）'

    with transaction.atomic():
        status_before = order.status
        order.status = OrderStatus.ARCHIVED
        order.finalized_by = user.name
        order.finalized_at = timezone.now()
        if payload.result_remark:
            order.result_remark = (order.result_remark + ' ' + payload.result_remark).strip()
        if payload.audit_remark:
            order.audit_remark = (order.audit_remark + ' ' + payload.audit_remark).strip()
        _detect_and_save_anomalies(order)

        detail = '复核通过，订单已归档'
        if payload.result_remark:
            detail += f'；复核意见：{payload.result_remark}'
        if warning_msg:
            detail += warning_msg

        _add_audit_log(
            order=order,
            action='复核归档',
            user=user,
            status_before=status_before,
            status_after=OrderStatus.ARCHIVED,
            detail=detail,
        )

    return 200, order


@router.post(
    '/orders/{order_id}/final-return',
    response={200: OrderDetailSchema, 400: ErrorSchema, 403: ErrorSchema},
    summary='复核退回'
)
def final_return(request, order_id: str, payload: OrderReturnSchema):
    user, is_authorized = _authenticate_request(request)
    if not is_authorized:
        return _auth_response()

    order = GlassesOrder.objects.get(id=order_id)

    if not OrderAuthorizationService.can_finalize_order(user, order):
        _add_audit_log(
            order=order,
            action='复核退回失败',
            user=user,
            is_failure=True,
            failure_reason=f'权限不足或状态错误：当前状态{order.get_status_display()}',
            detail='复核退回操作失败：无权限或状态不允许',
        )
        return 403, {
            'detail': '无权限复核或当前状态不允许退回',
            'code': 'permission_denied',
        }

    if not payload.reason.strip():
        _add_audit_log(
            order=order,
            action='复核退回失败',
            user=user,
            is_failure=True,
            failure_reason='退回原因不能为空',
            detail='复核退回操作失败：未填写退回原因',
        )
        return 400, {'detail': '退回原因不能为空', 'code': 'empty_reason'}

    with transaction.atomic():
        status_before = order.status
        order.status = OrderStatus.RETURNED
        order.return_reason = payload.reason
        order.return_by = user.name
        order.return_at = timezone.now()
        if payload.audit_remark:
            order.audit_remark = (order.audit_remark + ' ' + payload.audit_remark).strip()
        _detect_and_save_anomalies(order)

        detail = f'复核退回，原因：{payload.reason}'
        if payload.audit_remark:
            detail += f'；审计备注：{payload.audit_remark}'

        _add_audit_log(
            order=order,
            action='复核退回',
            user=user,
            status_before=status_before,
            status_after=OrderStatus.RETURNED,
            reason=payload.reason,
            detail=detail,
        )

    return 200, order


@router.get('/orders/{order_id}/attachments', response=List[AttachmentSchema], summary='订单附件列表')
def list_attachments(request, order_id: str):
    order = GlassesOrder.objects.get(id=order_id)
    return list(order.attachments.all())


@router.post(
    '/orders/{order_id}/attachments',
    response={201: AttachmentSchema, 403: ErrorSchema},
    summary='上传附件'
)
def create_attachment(request, order_id: str, payload: AttachmentCreateSchema):
    user, is_authorized = _authenticate_request(request)
    if not is_authorized:
        return _auth_response()

    order = GlassesOrder.objects.get(id=order_id)

    if not OrderAuthorizationService.can_manage_attachments(user, order):
        return 403, {'detail': '无权限上传附件', 'code': 'permission_denied'}

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
        detail=f'上传附件：{payload.file_name}，类型：{payload.file_type}',
    )

    return 201, attachment


@router.delete(
    '/orders/{order_id}/attachments/{attachment_id}',
    response={200: dict, 403: ErrorSchema},
    summary='删除附件'
)
def delete_attachment(request, order_id: str, attachment_id: str):
    user, is_authorized = _authenticate_request(request)
    if not is_authorized:
        return _auth_response()

    attachment = OrderAttachment.objects.get(id=attachment_id, order_id=order_id)
    order = attachment.order

    if not OrderAuthorizationService.can_manage_attachments(user, order):
        return 403, {'detail': '无权限删除附件', 'code': 'permission_denied'}

    file_name = attachment.file_name
    attachment.delete()

    _add_audit_log(
        order=order,
        action='删除附件',
        user=user,
        detail=f'删除附件：{file_name}',
    )

    return 200, {'detail': '删除成功'}


@router.get('/orders/{order_id}/audit-logs', response=List[AuditLogSchema], summary='审计日志')
def list_audit_logs(request, order_id: str):
    order = GlassesOrder.objects.get(id=order_id)
    return list(order.audit_logs.all().order_by('-created_at'))


@router.get('/audit-logs', response=List[AuditLogSchema], summary='全局审计日志')
def list_all_audit_logs(
    request,
    is_failure: Optional[bool] = Query(None),
    actor_role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    qs = AuditLog.objects.all().order_by('-created_at')
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
