from datetime import timedelta
from typing import Optional, List
from pathlib import Path
import os

from django.contrib.auth import authenticate, login, logout
from django.http import HttpRequest
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from ninja import NinjaAPI, File, UploadedFile
from ninja.errors import HttpError
from ninja.security import django_auth

from .schema import *
from .booking.models import (
    User, RoleChoices, BookingApplication, BookingStatusChoices,
    LoadingStatusChoices, BlStatusChoices, ExceptionTypeChoices,
    ActionChoices, OperationLog, AuditLog, Attachment,
    OfflineLedgerRecord,
)
from .booking.signals import log_operation


api = NinjaAPI(
    title='订舱管理系统 API',
    version='1.0.0',
    description='订舱申请 / 装柜确认 / 提单回收 全流程管理',
)


ROLE_PERMISSIONS = {
    'registrar': {
        'allowed_actions': [
            'create', 'submit', 'correct', 'resubmit',
            'load_arrange', 'bl_issue', 'bl_collect',
            'offline_fill', 'upload_attach', 'audit_note',
        ],
        'allowed_view_statuses': list(dict(BookingStatusChoices.choices).keys()),
    },
    'supervisor': {
        'allowed_actions': [
            'review_pass', 'review_reject',
            'book_confirm', 'book_fail',
            'load_confirm', 'load_fail',
            'offline_fill', 'upload_attach', 'audit_note', 'batch_result',
        ],
        'allowed_view_statuses': list(dict(BookingStatusChoices.choices).keys()),
    },
    'reviewer': {
        'allowed_actions': ['review_archive', 'offline_fill', 'upload_attach', 'audit_note'],
        'allowed_view_statuses': list(dict(BookingStatusChoices.choices).keys()),
    },
}

STATUS_FLOW = {
    'create': {'from': None, 'to': BookingStatusChoices.DRAFT, 'action': ActionChoices.CREATE},
    'submit': {'from': [BookingStatusChoices.DRAFT, BookingStatusChoices.CORRECTING],
               'to': BookingStatusChoices.PENDING_REVIEW, 'action': ActionChoices.SUBMIT},
    'review_pass': {'from': [BookingStatusChoices.PENDING_REVIEW],
                    'to': BookingStatusChoices.REVIEW_PASSED, 'action': ActionChoices.REVIEW_PASS},
    'review_reject': {'from': [BookingStatusChoices.PENDING_REVIEW],
                      'to': BookingStatusChoices.RETURNED, 'action': ActionChoices.REVIEW_REJECT},
    'book_confirm': {'from': [BookingStatusChoices.REVIEW_PASSED],
                     'to': BookingStatusChoices.BOOKED, 'action': ActionChoices.BOOK_CONFIRM},
    'book_fail': {'from': [BookingStatusChoices.REVIEW_PASSED],
                  'to': BookingStatusChoices.BOOKING_FAILED, 'action': ActionChoices.BOOK_FAIL},
    'correct': {'from': [BookingStatusChoices.RETURNED, BookingStatusChoices.BOOKING_FAILED],
                'to': BookingStatusChoices.CORRECTING, 'action': ActionChoices.CORRECT},
    'resubmit': {'from': [BookingStatusChoices.CORRECTING],
                 'to': BookingStatusChoices.PENDING_REVIEW, 'action': ActionChoices.RESUBMIT},
    'review_archive': {'from': [BookingStatusChoices.BOOKED],
                       'to': BookingStatusChoices.ARCHIVED, 'action': ActionChoices.REVIEW_ARCHIVE},
}

LOADING_FLOW = {
    'load_arrange': {'from': [LoadingStatusChoices.NOT_ARRANGED],
                     'to': LoadingStatusChoices.PENDING_CONFIRM, 'action': ActionChoices.LOAD_ARRANGE},
    'load_confirm': {'from': [LoadingStatusChoices.PENDING_CONFIRM],
                     'to': LoadingStatusChoices.CONFIRMED, 'action': ActionChoices.LOAD_CONFIRM},
    'load_confirm_loaded': {'from': [LoadingStatusChoices.CONFIRMED],
                            'to': LoadingStatusChoices.LOADED, 'action': ActionChoices.LOAD_CONFIRM},
    'load_fail': {'from': [LoadingStatusChoices.PENDING_CONFIRM, LoadingStatusChoices.CONFIRMED],
                  'to': LoadingStatusChoices.LOAD_FAILED, 'action': ActionChoices.LOAD_FAIL},
}

BL_FLOW = {
    'bl_issue': {'from': [BlStatusChoices.NOT_ISSUED],
                 'to': BlStatusChoices.PENDING_COLLECT, 'action': ActionChoices.BL_ISSUE},
    'bl_collect': {'from': [BlStatusChoices.PENDING_COLLECT],
                   'to': BlStatusChoices.COLLECTED, 'action': ActionChoices.BL_COLLECT},
    'bl_archive': {'from': [BlStatusChoices.COLLECTED],
                   'to': BlStatusChoices.ARCHIVED, 'action': ActionChoices.REVIEW_ARCHIVE},
}

EXCEPTION_TRIGGERS = {
    'review_reject': ExceptionTypeChoices.REJECTED,
    'book_fail': ExceptionTypeChoices.REJECTED,
    'load_fail': ExceptionTypeChoices.REJECTED,
}

BOOKING_MODULE = 'booking'
LOADING_MODULE = 'loading'
BL_MODULE = 'bl'


def serialize_user(u: User) -> UserOut:
    return UserOut(
        id=u.id, username=u.username, real_name=u.real_name or u.username,
        role=u.role, role_label=u.get_role_display(), phone=u.phone or '',
    )


def check_role(user, required_role=None):
    if not user or not user.is_authenticated:
        return False, '未登录'
    if required_role and user.role != required_role:
        return False, f'需要{dict(RoleChoices.choices).get(required_role, required_role)}角色'
    return True, ''


def check_action_permission(user, action):
    ok, msg = check_role(user)
    if not ok:
        return False, msg
    perms = ROLE_PERMISSIONS.get(user.role, {})
    allowed = perms.get('allowed_actions', [])
    if action not in allowed:
        return False, (
            f'{serialize_user(user).role_label}无权执行此操作：'
            f'{dict(ActionChoices.choices).get(action, action)}'
        )
    return True, ''


def booking_to_out(b: BookingApplication) -> BookingApplicationOut:
    return BookingApplicationOut(
        id=b.id, form_no=b.form_no, batch_no=b.batch_no, customer=b.customer,
        forwarder=b.forwarder, port_of_loading=b.port_of_loading,
        port_of_discharge=b.port_of_discharge, container_type=b.container_type,
        container_qty=b.container_qty, cargo_desc=b.cargo_desc,
        weight=float(b.weight), volume=float(b.volume), etd=b.etd, eta=b.eta,
        bl_no=b.bl_no, vessel=b.vessel, so_no=b.so_no,
        booking_status=b.booking_status, booking_status_label=b.booking_status_label,
        loading_status=b.loading_status, loading_status_label=b.loading_status_label,
        bl_status=b.bl_status, bl_status_label=b.bl_status_label,
        is_exception=b.is_exception, exception_type=b.exception_type,
        exception_note=b.exception_note, status_mismatch=b.status_mismatch,
        return_reason=b.return_reason, audit_remark=b.audit_remark, result_note=b.result_note,
        offline_booking_status=b.offline_booking_status,
        offline_loading_status=b.offline_loading_status,
        offline_bl_status=b.offline_bl_status,
        deadline=b.deadline,
        submitter_name=b.submitter.real_name if b.submitter and b.submitter.real_name else (b.submitter.username if b.submitter else ''),
        reviewer_name=b.reviewer.real_name if b.reviewer and b.reviewer.real_name else (b.reviewer.username if b.reviewer else ''),
        archivist_name=b.archivist.real_name if b.archivist and b.archivist.real_name else (b.archivist.username if b.archivist else ''),
        submitted_at=b.submitted_at, reviewed_at=b.reviewed_at, archived_at=b.archived_at,
        created_at=b.created_at, updated_at=b.updated_at,
    )


def op_log_to_out(o: OperationLog) -> OperationLogOut:
    return OperationLogOut(
        id=o.id, action=o.action, action_label=o.action_label,
        operator_name=o.operator_name, role=o.role, role_label=o.role_label,
        from_status=o.from_status, to_status=o.to_status, remark=o.remark,
        field_changed=o.field_changed, old_value=o.old_value, new_value=o.new_value,
        created_at=o.created_at,
    )


def audit_log_to_out(a: AuditLog) -> AuditLogOut:
    return AuditLogOut(
        id=a.id, audit_type=a.audit_type,
        audit_type_label=dict(AuditLog.AuditTypeChoices.choices).get(a.audit_type, a.audit_type),
        auditor_name=a.auditor_name,
        result=a.result,
        result_label=dict(AuditLog.ResultChoices.choices).get(a.result, a.result),
        fail_reason=a.fail_reason, remark=a.remark, created_at=a.created_at,
    )


def attachment_to_out(a: Attachment, request: HttpRequest) -> AttachmentOut:
    url = ''
    if a.file:
        try:
            url = request.build_absolute_uri(a.file.url)
        except Exception:
            url = ''
    return AttachmentOut(
        id=a.id, category=a.category,
        category_label=dict(Attachment.CategoryChoices.choices).get(a.category, a.category),
        file_name=a.file_name, file_size=a.file_size,
        uploader_name=(a.uploader.real_name if a.uploader and a.uploader.real_name
                       else (a.uploader.username if a.uploader else '')),
        file_url=url, created_at=a.created_at,
    )


def offline_record_to_out(r: OfflineLedgerRecord) -> OfflineLedgerRecordOut:
    return OfflineLedgerRecordOut(
        id=r.id, field_name=r.field_name, field_label=r.field_label,
        old_value=r.old_value, new_value=r.new_value, source=r.source,
        operator_name=r.operator_name, remark=r.remark, created_at=r.created_at,
    )


def detect_timeout(b: BookingApplication):
    if b.deadline and timezone.now() > b.deadline:
        if b.booking_status not in (BookingStatusChoices.BOOKED, BookingStatusChoices.ARCHIVED):
            b.is_exception = True
            b.exception_type = ExceptionTypeChoices.TIMEOUT
            b.exception_note = f'办理时限已超期：{b.deadline.strftime("%Y-%m-%d %H:%M")}'


def check_duplicate_batch(batch_no: str, exclude_id=None):
    qs = BookingApplication.objects.filter(batch_no=batch_no)
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    return list(qs.values_list('form_no', flat=True))


def check_status_consistency(b: BookingApplication):
    errors = []
    if b.offline_booking_status and b.offline_booking_status != b.booking_status:
        errors.append(
            f'订舱状态不一致：线上【{b.booking_status_label}】 vs 离线台账【'
            f'{dict(BookingStatusChoices.choices).get(b.offline_booking_status, "")}】'
        )
    if b.offline_loading_status and b.offline_loading_status != b.loading_status:
        errors.append(
            f'装柜状态不一致：线上【{b.loading_status_label}】 vs 离线台账【'
            f'{dict(LoadingStatusChoices.choices).get(b.offline_loading_status, "")}】'
        )
    if b.offline_bl_status and b.offline_bl_status != b.bl_status:
        errors.append(
            f'提单状态不一致：线上【{b.bl_status_label}】 vs 离线台账【'
            f'{dict(BlStatusChoices.choices).get(b.offline_bl_status, "")}】'
        )
    return errors


def create_audit(booking, audit_type, result, auditor, fail_reason='', remark=''):
    return AuditLog.objects.create(
        booking=booking,
        audit_type=audit_type,
        auditor=auditor,
        auditor_name=auditor.real_name if auditor and auditor.real_name else (auditor.username if auditor else ''),
        result=result,
        fail_reason=fail_reason,
        remark=remark,
    )


# ================ Auth API ================
@api.post('/auth/login', response=LoginOut, tags=['认证'])
def auth_login(request: HttpRequest, payload: LoginIn):
    user = authenticate(request, username=payload.username, password=payload.password)
    if not user:
        return LoginOut(success=False, message='用户名或密码错误')
    login(request, user)
    token = f'token-{user.id}-{int(timezone.now().timestamp())}'
    return LoginOut(
        success=True, message='登录成功',
        user=serialize_user(user), token=token,
    )


@api.post('/auth/logout', response=MessageOut, tags=['认证'])
def auth_logout(request: HttpRequest):
    logout(request)
    return MessageOut(success=True, message='已退出登录')


@api.get('/auth/me', response=LoginOut, tags=['认证'])
def auth_me(request: HttpRequest):
    if not request.user.is_authenticated:
        return LoginOut(success=False, message='未登录')
    return LoginOut(success=True, user=serialize_user(request.user))


# ================ Booking API ================
@api.get('/bookings', response=BookingListOut, tags=['订舱申请'])
def list_bookings(
    request: HttpRequest,
    module: str = BOOKING_MODULE,
    keyword: str = '',
    booking_status: str = '',
    loading_status: str = '',
    bl_status: str = '',
    is_exception: Optional[bool] = None,
    exception_type: str = '',
    page: int = 1,
    size: int = 50,
):
    if not request.user.is_authenticated:
        return BookingListOut(total=0, items=[])
    qs = BookingApplication.objects.all()
    if module == LOADING_MODULE:
        qs = qs.exclude(loading_status=LoadingStatusChoices.NOT_ARRANGED)
    elif module == BL_MODULE:
        qs = qs.exclude(bl_status=BlStatusChoices.NOT_ISSUED)
    if keyword:
        qs = qs.filter(
            Q(form_no__icontains=keyword) | Q(batch_no__icontains=keyword)
            | Q(customer__icontains=keyword) | Q(bl_no__icontains=keyword)
        )
    if booking_status:
        qs = qs.filter(booking_status=booking_status)
    if loading_status:
        qs = qs.filter(loading_status=loading_status)
    if bl_status:
        qs = qs.filter(bl_status=bl_status)
    if is_exception is not None:
        qs = qs.filter(is_exception=is_exception)
    if exception_type:
        qs = qs.filter(exception_type=exception_type)
    for b in qs:
        detect_timeout(b)
    total = qs.count()
    start = max(0, (page - 1) * size)
    items = [booking_to_out(b) for b in qs[start:start + size]]
    return BookingListOut(total=total, items=items)


@api.get('/bookings/{booking_id}', response=BookingApplicationOut, tags=['订舱申请'])
def get_booking(request: HttpRequest, booking_id: int):
    if not request.user.is_authenticated:
        return None
    b = get_object_or_404(BookingApplication, id=booking_id)
    detect_timeout(b)
    return booking_to_out(b)


@api.post('/bookings', response=BookingApplicationOut, tags=['订舱申请'])
@transaction.atomic
def create_booking(request: HttpRequest, payload: BookingApplicationIn):
    ok, msg = check_action_permission(request.user, 'create')
    if not ok:
        raise HttpError(403, msg)
    dup = BookingApplication.objects.filter(form_no=payload.form_no).first()
    if dup:
        raise HttpError(400, f'订舱单号已存在：{payload.form_no}')
    dup_batch = check_duplicate_batch(payload.batch_no)
    if dup_batch:
        raise HttpError(400, f'批次号{payload.batch_no}已存在于订舱单：{", ".join(dup_batch)}，请确认是否重复录入')
    b = BookingApplication.objects.create(
        **payload.model_dump(exclude_none=True),
        booking_status=BookingStatusChoices.DRAFT,
        loading_status=LoadingStatusChoices.NOT_ARRANGED,
        bl_status=BlStatusChoices.NOT_ISSUED,
        submitter=request.user,
    )
    log_operation(b, ActionChoices.CREATE, operator=request.user,
                  to_status=b.booking_status, remark='订舱登记员发起订舱申请')
    return booking_to_out(b)


@api.put('/bookings/{booking_id}', response=BookingApplicationOut, tags=['订舱申请'])
@transaction.atomic
def update_booking(request: HttpRequest, booking_id: int, payload: BookingApplicationIn):
    if not request.user.is_authenticated:
        raise HttpError(403, '未登录')
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.booking_status not in (BookingStatusChoices.DRAFT, BookingStatusChoices.CORRECTING,
                                BookingStatusChoices.RETURNED, BookingStatusChoices.BOOKING_FAILED):
        raise HttpError(400, f'当前状态【{b.booking_status_label}】不允许编辑')
    if payload.form_no != b.form_no:
        if BookingApplication.objects.filter(form_no=payload.form_no).exclude(id=b.id).exists():
            raise HttpError(400, f'订舱单号已存在：{payload.form_no}')
    if payload.batch_no != b.batch_no:
        dup = check_duplicate_batch(payload.batch_no, exclude_id=b.id)
        if dup:
            raise HttpError(400, f'批次号{payload.batch_no}已存在于订舱单：{", ".join(dup)}，请确认是否重复录入')
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(b, k, v)
    b.save()
    detect_timeout(b)
    return booking_to_out(b)


@api.post('/bookings/validate', response=ValidateCheckOut, tags=['订舱申请'])
def validate_booking(request: HttpRequest, payload: ValidateCheckIn):
    errors = []
    warnings = []
    if payload.form_no:
        qs = BookingApplication.objects.filter(form_no=payload.form_no)
        if payload.exclude_id:
            qs = qs.exclude(id=payload.exclude_id)
        if qs.exists():
            errors.append(f'订舱单号【{payload.form_no}】已存在，请使用其他单号')
    if payload.batch_no:
        dup = check_duplicate_batch(payload.batch_no, exclude_id=payload.exclude_id)
        if dup:
            warnings.append(f'批次号【{payload.batch_no}】已存在于订舱单：{", ".join(dup)}，请确认是否重复批次')
    if payload.exclude_id:
        b = BookingApplication.objects.filter(id=payload.exclude_id).first()
        if b:
            mismatch = check_status_consistency(b)
            if mismatch:
                errors.extend(mismatch)
    return ValidateCheckOut(valid=len(errors) == 0, errors=errors, warnings=warnings)


# ================ Booking status flow ================
@api.post('/bookings/{booking_id}/submit', response=BookingApplicationOut, tags=['订舱流转'])
@transaction.atomic
def submit_booking(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'submit')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.booking_status not in STATUS_FLOW['submit']['from']:
        raise HttpError(400, f'当前状态【{b.booking_status_label}】不允许提交审核')
    mismatch = check_status_consistency(b)
    if mismatch:
        raise HttpError(400, '状态校验未通过，线上线下状态不一致：' + '；'.join(mismatch))
    if not b.customer or not b.forwarder:
        raise HttpError(400, '客户名称和货代/船公司为必填项')
    old_status = b.booking_status
    b.booking_status = STATUS_FLOW['submit']['to']
    b.submitted_at = timezone.now()
    if not b.submitter:
        b.submitter = request.user
    b.save()
    log_operation(b, ActionChoices.SUBMIT, operator=request.user,
                  from_status=old_status, to_status=b.booking_status,
                  remark=payload.remark or '订舱登记员提交审核')
    return booking_to_out(b)


@api.post('/bookings/{booking_id}/review-pass', response=BookingApplicationOut, tags=['订舱流转'])
@transaction.atomic
def review_pass_booking(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'review_pass')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.booking_status != BookingStatusChoices.PENDING_REVIEW:
        raise HttpError(400, f'当前状态【{b.booking_status_label}】不允许审核通过')
    old_status = b.booking_status
    b.booking_status = BookingStatusChoices.REVIEW_PASSED
    b.reviewer = request.user
    b.reviewed_at = timezone.now()
    b.is_exception = False
    b.exception_type = ExceptionTypeChoices.NONE
    b.save()
    log_operation(b, ActionChoices.REVIEW_PASS, operator=request.user,
                  from_status=old_status, to_status=b.booking_status,
                  remark=payload.remark or '订舱审核主管审核通过')
    create_audit(b, AuditLog.AuditTypeChoices.BOOKING, AuditLog.ResultChoices.PASS,
                 request.user, remark=payload.result_note)
    return booking_to_out(b)


@api.post('/bookings/{booking_id}/review-reject', response=BookingApplicationOut, tags=['订舱流转'])
@transaction.atomic
def review_reject_booking(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'review_reject')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.booking_status != BookingStatusChoices.PENDING_REVIEW:
        raise HttpError(400, f'当前状态【{b.booking_status_label}】不允许退回')
    if not payload.fail_reason:
        raise HttpError(400, '请填写退回原因')
    old_status = b.booking_status
    b.booking_status = BookingStatusChoices.RETURNED
    b.return_reason = payload.fail_reason
    b.reviewer = request.user
    b.reviewed_at = timezone.now()
    b.is_exception = True
    b.exception_type = ExceptionTypeChoices.REJECTED
    b.exception_note = f'审核退回：{payload.fail_reason}'
    b.save()
    log_operation(b, ActionChoices.REVIEW_REJECT, operator=request.user,
                  from_status=old_status, to_status=b.booking_status,
                  remark=f'退回原因：{payload.fail_reason}')
    create_audit(b, AuditLog.AuditTypeChoices.BOOKING, AuditLog.ResultChoices.RETURN,
                 request.user, fail_reason=payload.fail_reason, remark=payload.remark)
    return booking_to_out(b)


@api.post('/bookings/{booking_id}/book-confirm', response=BookingApplicationOut, tags=['订舱流转'])
@transaction.atomic
def book_confirm(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'book_confirm')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.booking_status != BookingStatusChoices.REVIEW_PASSED:
        raise HttpError(400, f'当前状态【{b.booking_status_label}】不允许订舱确认')
    if not b.so_no:
        raise HttpError(400, '订舱确认前请填写SO号')
    old_status = b.booking_status
    b.booking_status = BookingStatusChoices.BOOKED
    b.result_note = payload.result_note or '订舱成功'
    b.save()
    log_operation(b, ActionChoices.BOOK_CONFIRM, operator=request.user,
                  from_status=old_status, to_status=b.booking_status,
                  remark=payload.remark or '订舱确认成功')
    create_audit(b, AuditLog.AuditTypeChoices.BOOKING, AuditLog.ResultChoices.PASS,
                 request.user, remark=payload.result_note or '订舱成功')
    return booking_to_out(b)


@api.post('/bookings/{booking_id}/book-fail', response=BookingApplicationOut, tags=['订舱流转'])
@transaction.atomic
def book_fail(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'book_fail')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.booking_status != BookingStatusChoices.REVIEW_PASSED:
        raise HttpError(400, f'当前状态【{b.booking_status_label}】不允许标为订舱失败')
    if not payload.fail_reason:
        raise HttpError(400, '请填写订舱失败原因')
    old_status = b.booking_status
    b.booking_status = BookingStatusChoices.BOOKING_FAILED
    b.result_note = f'订舱失败：{payload.fail_reason}'
    b.is_exception = True
    b.exception_type = ExceptionTypeChoices.REJECTED
    b.exception_note = payload.fail_reason
    b.save()
    log_operation(b, ActionChoices.BOOK_FAIL, operator=request.user,
                  from_status=old_status, to_status=b.booking_status,
                  remark=f'失败原因：{payload.fail_reason}')
    create_audit(b, AuditLog.AuditTypeChoices.BOOKING, AuditLog.ResultChoices.FAIL,
                 request.user, fail_reason=payload.fail_reason, remark=payload.remark)
    return booking_to_out(b)


@api.post('/bookings/{booking_id}/correct', response=BookingApplicationOut, tags=['订舱流转'])
@transaction.atomic
def correct_booking(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'correct')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.booking_status not in (BookingStatusChoices.RETURNED, BookingStatusChoices.BOOKING_FAILED):
        raise HttpError(400, f'当前状态【{b.booking_status_label}】不允许补正')
    old_status = b.booking_status
    b.booking_status = BookingStatusChoices.CORRECTING
    b.is_exception = False
    b.exception_type = ExceptionTypeChoices.NONE
    b.save()
    log_operation(b, ActionChoices.CORRECT, operator=request.user,
                  from_status=old_status, to_status=b.booking_status,
                  remark=payload.remark or '订舱登记员开始补正资料')
    return booking_to_out(b)


@api.post('/bookings/{booking_id}/resubmit', response=BookingApplicationOut, tags=['订舱流转'])
@transaction.atomic
def resubmit_booking(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'resubmit')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.booking_status != BookingStatusChoices.CORRECTING:
        raise HttpError(400, f'当前状态【{b.booking_status_label}】不允许重新提交')
    mismatch = check_status_consistency(b)
    if mismatch:
        raise HttpError(400, '状态校验未通过，线上线下状态不一致：' + '；'.join(mismatch))
    old_status = b.booking_status
    b.booking_status = BookingStatusChoices.PENDING_REVIEW
    b.submitted_at = timezone.now()
    b.return_reason = ''
    b.save()
    log_operation(b, ActionChoices.RESUBMIT, operator=request.user,
                  from_status=old_status, to_status=b.booking_status,
                  remark=payload.remark or '订舱登记员补正后重新提交')
    return booking_to_out(b)


@api.post('/bookings/{booking_id}/review-archive', response=BookingApplicationOut, tags=['订舱流转'])
@transaction.atomic
def review_archive(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'review_archive')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.booking_status != BookingStatusChoices.BOOKED:
        raise HttpError(400, f'当前状态【{b.booking_status_label}】不允许复核归档（需已订舱）')
    if b.bl_status != BlStatusChoices.COLLECTED:
        raise HttpError(400, f'提单状态【{b.bl_status_label}】需为"已回收"才能归档')
    mismatch = check_status_consistency(b)
    if mismatch:
        raise HttpError(400, '状态校验未通过，线上线下状态不一致：' + '；'.join(mismatch))
    old_status = b.booking_status
    b.booking_status = BookingStatusChoices.ARCHIVED
    b.bl_status = BlStatusChoices.ARCHIVED
    b.archivist = request.user
    b.archived_at = timezone.now()
    b.is_exception = False
    b.exception_type = ExceptionTypeChoices.NONE
    b.save()
    log_operation(b, ActionChoices.REVIEW_ARCHIVE, operator=request.user,
                  from_status=old_status, to_status=b.booking_status,
                  remark=payload.remark or '外贸公司复核负责人复核归档')
    create_audit(b, AuditLog.AuditTypeChoices.FINAL, AuditLog.ResultChoices.PASS,
                 request.user, remark=payload.result_note or '复核归档通过')
    return booking_to_out(b)


# ================ Loading status flow ================
@api.post('/bookings/{booking_id}/loading/arrange', response=BookingApplicationOut, tags=['装柜确认'])
@transaction.atomic
def arrange_loading(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'load_arrange')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.loading_status != LoadingStatusChoices.NOT_ARRANGED:
        raise HttpError(400, f'当前装柜状态【{b.loading_status_label}】不允许安排装柜')
    old = b.loading_status
    b.loading_status = LoadingStatusChoices.PENDING_CONFIRM
    b.save()
    log_operation(b, ActionChoices.LOAD_ARRANGE, operator=request.user,
                  from_status=old, to_status=b.loading_status,
                  remark=payload.remark or '安排装柜，等待确认')
    return booking_to_out(b)


@api.post('/bookings/{booking_id}/loading/confirm', response=BookingApplicationOut, tags=['装柜确认'])
@transaction.atomic
def confirm_loading(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'load_confirm')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.loading_status not in (LoadingStatusChoices.PENDING_CONFIRM, LoadingStatusChoices.CONFIRMED):
        raise HttpError(400, f'当前装柜状态【{b.loading_status_label}】不允许确认')
    old = b.loading_status
    if b.loading_status == LoadingStatusChoices.PENDING_CONFIRM:
        b.loading_status = LoadingStatusChoices.CONFIRMED
        stage = '确认装柜信息'
    else:
        b.loading_status = LoadingStatusChoices.LOADED
        stage = '完成装柜'
    b.save()
    log_operation(b, ActionChoices.LOAD_CONFIRM, operator=request.user,
                  from_status=old, to_status=b.loading_status,
                  remark=payload.remark or stage)
    create_audit(b, AuditLog.AuditTypeChoices.LOADING, AuditLog.ResultChoices.PASS,
                 request.user, remark=payload.result_note or stage)
    return booking_to_out(b)


@api.post('/bookings/{booking_id}/loading/fail', response=BookingApplicationOut, tags=['装柜确认'])
@transaction.atomic
def fail_loading(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'load_fail')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.loading_status not in (LoadingStatusChoices.PENDING_CONFIRM, LoadingStatusChoices.CONFIRMED):
        raise HttpError(400, f'当前装柜状态【{b.loading_status_label}】不允许标失败')
    if not payload.fail_reason:
        raise HttpError(400, '请填写装柜失败原因')
    old = b.loading_status
    b.loading_status = LoadingStatusChoices.LOAD_FAILED
    b.is_exception = True
    existing_note = b.exception_note
    new_note = f'装柜失败：{payload.fail_reason}'
    b.exception_note = (existing_note + '；' + new_note) if existing_note else new_note
    if b.exception_type == ExceptionTypeChoices.NONE:
        b.exception_type = ExceptionTypeChoices.REJECTED
    b.save()
    log_operation(b, ActionChoices.LOAD_FAIL, operator=request.user,
                  from_status=old, to_status=b.loading_status,
                  remark=f'失败原因：{payload.fail_reason}')
    create_audit(b, AuditLog.AuditTypeChoices.LOADING, AuditLog.ResultChoices.FAIL,
                 request.user, fail_reason=payload.fail_reason, remark=payload.remark)
    return booking_to_out(b)


# ================ BL status flow ================
@api.post('/bookings/{booking_id}/bl/issue', response=BookingApplicationOut, tags=['提单回收'])
@transaction.atomic
def issue_bl(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'bl_issue')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.bl_status != BlStatusChoices.NOT_ISSUED:
        raise HttpError(400, f'当前提单状态【{b.bl_status_label}】不允许出单')
    if not b.bl_no:
        raise HttpError(400, '提单号未填写，无法出单')
    old = b.bl_status
    b.bl_status = BlStatusChoices.PENDING_COLLECT
    b.save()
    log_operation(b, ActionChoices.BL_ISSUE, operator=request.user,
                  from_status=old, to_status=b.bl_status,
                  remark=payload.remark or f'提单出单，提单号：{b.bl_no}')
    create_audit(b, AuditLog.AuditTypeChoices.BL, AuditLog.ResultChoices.PASS,
                 request.user, remark=f'提单出单：{b.bl_no}')
    return booking_to_out(b)


@api.post('/bookings/{booking_id}/bl/collect', response=BookingApplicationOut, tags=['提单回收'])
@transaction.atomic
def collect_bl(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'bl_collect')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if b.bl_status != BlStatusChoices.PENDING_COLLECT:
        raise HttpError(400, f'当前提单状态【{b.bl_status_label}】不允许回收')
    old = b.bl_status
    b.bl_status = BlStatusChoices.COLLECTED
    b.save()
    log_operation(b, ActionChoices.BL_COLLECT, operator=request.user,
                  from_status=old, to_status=b.bl_status,
                  remark=payload.remark or '提单已回收')
    create_audit(b, AuditLog.AuditTypeChoices.BL, AuditLog.ResultChoices.PASS,
                 request.user, remark=payload.result_note or '提单回收完成')
    return booking_to_out(b)


# ================ Offline ledger fill ================
@api.post('/bookings/{booking_id}/offline-fill', response=BookingApplicationOut, tags=['离线台账'])
@transaction.atomic
def offline_fill(request: HttpRequest, booking_id: int, payload: OfflineFillIn):
    ok, msg = check_action_permission(request.user, 'offline_fill')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    field_label_map = {
        'offline_booking_status': '离线台账-订舱状态',
        'offline_loading_status': '离线台账-装柜状态',
        'offline_bl_status': '离线台账-提单状态',
        'so_no': 'SO号', 'bl_no': '提单号', 'vessel': '船名航次',
        'etd': '预计开船日', 'eta': '预计到港日',
    }
    if payload.field_name not in field_label_map:
        raise HttpError(400, f'不支持回填的字段：{payload.field_name}')
    old_val = str(getattr(b, payload.field_name, ''))
    setattr(b, payload.field_name, payload.new_value)
    b.save()
    OfflineLedgerRecord.objects.create(
        booking=b, field_name=payload.field_name,
        field_label=field_label_map[payload.field_name],
        old_value=old_val, new_value=payload.new_value,
        source=payload.source, operator=request.user,
        operator_name=request.user.real_name or request.user.username,
        remark=payload.remark,
    )
    mismatches = check_status_consistency(b)
    if mismatches:
        b.is_exception = True
        b.exception_type = ExceptionTypeChoices.STATUS_MISMATCH
        b.exception_note = '；'.join(mismatches)
        b.save(update_fields=['is_exception', 'exception_type', 'exception_note'])
    return booking_to_out(b)


@api.get('/bookings/{booking_id}/offline-records', response=List[OfflineLedgerRecordOut], tags=['离线台账'])
def list_offline_records(request: HttpRequest, booking_id: int):
    if not request.user.is_authenticated:
        return []
    b = get_object_or_404(BookingApplication, id=booking_id)
    return [offline_record_to_out(r) for r in b.offline_records.all()]


# ================ Operation logs / Audit / Attachments ================
@api.get('/bookings/{booking_id}/operation-logs', response=List[OperationLogOut], tags=['操作记录'])
def list_operation_logs(request: HttpRequest, booking_id: int):
    if not request.user.is_authenticated:
        return []
    b = get_object_or_404(BookingApplication, id=booking_id)
    return [op_log_to_out(o) for o in b.operation_logs.all()]


@api.get('/bookings/{booking_id}/audit-logs', response=List[AuditLogOut], tags=['审计日志'])
def list_audit_logs(request: HttpRequest, booking_id: int):
    if not request.user.is_authenticated:
        return []
    b = get_object_or_404(BookingApplication, id=booking_id)
    return [audit_log_to_out(a) for a in b.audit_logs.all()]


@api.get('/bookings/{booking_id}/attachments', response=List[AttachmentOut], tags=['附件'])
def list_attachments(request: HttpRequest, booking_id: int):
    if not request.user.is_authenticated:
        return []
    b = get_object_or_404(BookingApplication, id=booking_id)
    return [attachment_to_out(a, request) for a in b.attachments.all()]


@api.post('/bookings/{booking_id}/attachments', response=AttachmentOut, tags=['附件'])
@transaction.atomic
def upload_attachment(
    request: HttpRequest, booking_id: int,
    file: UploadedFile = File(...),
    category: str = 'other',
):
    ok, msg = check_action_permission(request.user, 'upload_attach')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if category not in dict(Attachment.CategoryChoices.choices):
        category = 'other'
    att = Attachment.objects.create(
        booking=b, category=category, file=file,
        file_name=file.name, file_size=file.size, uploader=request.user,
    )
    log_operation(b, ActionChoices.UPLOAD_ATTACH, operator=request.user,
                  remark=f'上传附件：{file.name} ({dict(Attachment.CategoryChoices.choices).get(category, category)})')
    return attachment_to_out(att, request)


@api.delete('/bookings/{booking_id}/attachments/{attachment_id}', response=MessageOut, tags=['附件'])
@transaction.atomic
def delete_attachment(request: HttpRequest, booking_id: int, attachment_id: int):
    if not request.user.is_authenticated:
        return MessageOut(success=False, message='未登录')
    b = get_object_or_404(BookingApplication, id=booking_id)
    att = get_object_or_404(Attachment, id=attachment_id, booking=b)
    try:
        if att.file:
            att.file.delete(save=False)
    except Exception:
        pass
    att.delete()
    return MessageOut(success=True, message='附件已删除')


# ================ Audit note ================
@api.post('/bookings/{booking_id}/audit-note', response=BookingApplicationOut, tags=['审计备注'])
@transaction.atomic
def add_audit_note(request: HttpRequest, booking_id: int, payload: StatusChangeIn):
    ok, msg = check_action_permission(request.user, 'audit_note')
    if not ok:
        raise HttpError(403, msg)
    b = get_object_or_404(BookingApplication, id=booking_id)
    if payload.remark:
        existing = b.audit_remark
        ts = timezone.now().strftime('%Y-%m-%d %H:%M')
        who = request.user.real_name or request.user.username
        addition = f'[{ts}][{who}] {payload.remark}'
        b.audit_remark = (existing + '\n' + addition) if existing else addition
        b.save()
        log_operation(b, ActionChoices.AUDIT_NOTE, operator=request.user, remark=payload.remark)
    return booking_to_out(b)


# ================ Batch operation ================
@api.post('/bookings/batch', response=BatchActionOut, tags=['批量处理'])
@transaction.atomic
def batch_action(request: HttpRequest, payload: BatchActionIn):
    ok, msg = check_action_permission(request.user, payload.action)
    if not ok:
        raise HttpError(403, msg)
    results = []
    success_count = 0
    fail_count = 0
    for bid in payload.ids:
        b = BookingApplication.objects.filter(id=bid).first()
        if not b:
            results.append(BatchActionResult(id=bid, form_no='(未知)', success=False, message='订舱申请不存在'))
            fail_count += 1
            continue
        form_no = b.form_no
        try:
            p = StatusChangeIn(remark=payload.remark)
            if payload.action == 'review_pass':
                if b.booking_status == BookingStatusChoices.PENDING_REVIEW:
                    b.booking_status = BookingStatusChoices.REVIEW_PASSED
                    b.reviewer = request.user
                    b.reviewed_at = timezone.now()
                    b.is_exception = False
                    b.exception_type = ExceptionTypeChoices.NONE
                    b.save()
                    log_operation(b, ActionChoices.REVIEW_PASS, operator=request.user,
                                  to_status=b.booking_status, remark=payload.remark or '批量审核通过')
                    create_audit(b, AuditLog.AuditTypeChoices.BOOKING, AuditLog.ResultChoices.PASS, request.user)
                    results.append(BatchActionResult(id=bid, form_no=form_no, success=True, message='审核通过'))
                    success_count += 1
                else:
                    results.append(BatchActionResult(
                        id=bid, form_no=form_no, success=False,
                        message=f'状态【{b.booking_status_label}】不是待审核，跳过',
                    ))
                    fail_count += 1
            elif payload.action == 'book_confirm':
                if b.booking_status == BookingStatusChoices.REVIEW_PASSED and b.so_no:
                    b.booking_status = BookingStatusChoices.BOOKED
                    b.save()
                    log_operation(b, ActionChoices.BOOK_CONFIRM, operator=request.user,
                                  to_status=b.booking_status, remark=payload.remark or '批量订舱确认')
                    create_audit(b, AuditLog.AuditTypeChoices.BOOKING, AuditLog.ResultChoices.PASS, request.user)
                    results.append(BatchActionResult(id=bid, form_no=form_no, success=True, message='订舱确认'))
                    success_count += 1
                else:
                    miss = '' if b.so_no else '（缺少SO号）'
                    results.append(BatchActionResult(
                        id=bid, form_no=form_no, success=False,
                        message=f'状态【{b.booking_status_label}】不允许订舱确认{miss}，跳过',
                    ))
                    fail_count += 1
            else:
                results.append(BatchActionResult(
                    id=bid, form_no=form_no, success=False,
                    message=f'不支持的批量操作：{payload.action}',
                ))
                fail_count += 1
        except Exception as e:
            results.append(BatchActionResult(id=bid, form_no=form_no, success=False, message=f'处理异常：{e}'))
            fail_count += 1
    return BatchActionOut(results=results, success_count=success_count, fail_count=fail_count)


# ================ Enums for UI ================
@api.get('/meta/enums', tags=['元数据'])
def get_enums(request: HttpRequest):
    return {
        'roles': [{'value': k, 'label': v} for k, v in RoleChoices.choices],
        'booking_status': [{'value': k, 'label': v} for k, v in BookingStatusChoices.choices],
        'loading_status': [{'value': k, 'label': v} for k, v in LoadingStatusChoices.choices],
        'bl_status': [{'value': k, 'label': v} for k, v in BlStatusChoices.choices],
        'exception_types': [{'value': k, 'label': v} for k, v in ExceptionTypeChoices.choices],
        'action_types': [{'value': k, 'label': v} for k, v in ActionChoices.choices],
        'attachment_categories': [{'value': k, 'label': v} for k, v in Attachment.CategoryChoices.choices],
        'audit_types': [{'value': k, 'label': v} for k, v in AuditLog.AuditTypeChoices.choices],
        'audit_results': [{'value': k, 'label': v} for k, v in AuditLog.ResultChoices.choices],
    }
