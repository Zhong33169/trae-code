from datetime import datetime
from typing import List, Optional

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from django.http import HttpRequest
from django.utils import timezone

from ninja import NinjaAPI, Router, Query
from ninja.security import HttpBasicAuth, APIKeyHeader

from .models import (
    UserProfile,
    LabReservation,
    Evidence,
    SupplementaryRecord,
    AuditLog,
)
from .schemas import (
    LoginIn,
    LoginOut,
    UserProfileOut,
    LabReservationListItem,
    LabReservationDetail,
    EvidenceOut,
    SupplementaryRecordOut,
    AuditLogOut,
    ReservationCreateIn,
    ReservationUpdateIn,
    SubmitIn,
    ReviewIn,
    CollegeConfirmIn,
    SupplementEvidenceIn,
    BatchOperationIn,
    ApiError,
    ReservationListResponse,
)


api = NinjaAPI(
    title='高校实验室移动补录校验系统 API',
    version='1.0.0',
    description='实验预约单移动补录校验系统后端接口',
)


class DevAuth(APIKeyHeader):
    param_name = 'X-User-ID'

    def authenticate(self, request, key):
        try:
            user_id = int(key)
            user = User.objects.get(id=user_id)
            request.user = user
            return user
        except (ValueError, User.DoesNotExist):
            return None


dev_auth = DevAuth()


def get_user_from_request(request):
    return request.user


def user_to_profile_out(user: User) -> UserProfileOut:
    profile = user.profile
    return UserProfileOut(
        id=user.id,
        username=user.username,
        role=profile.role,
        role_display=profile.get_role_display(),
        department=profile.department,
    )


def _get_detailed_errors(reservation, user, check_type):
    """获取详细的错误原因列表"""
    errors = []
    role = user.profile.role

    if check_type == 'submit':
        if role != UserProfile.ROLE_TA:
            errors.append(f'角色不符：当前为{user.profile.get_role_display()}，需实验助教')
        if reservation.applicant_id != user.id:
            errors.append('只能提交自己创建的预约单')
        if reservation.status not in [
            LabReservation.STATUS_DRAFT,
            LabReservation.STATUS_LAB_REJECTED,
            LabReservation.STATUS_COLLEGE_REJECTED,
        ]:
            errors.append(f'状态不符：当前为{reservation.get_status_display()}')
        missing = reservation.get_missing_evidence()
        if missing:
            labels = {'experiment_plan': '实验预约方案', 'material_application': '耗材申领单', 'safety_confirmation': '安全确认书'}
            errors.append(f'缺少证据：{"、".join(labels.get(m, m) for m in missing)}')

    elif check_type == 'lab_review':
        if role != UserProfile.ROLE_LAB_ADMIN:
            errors.append(f'角色不符：当前为{user.profile.get_role_display()}，需实验室管理员')
        if reservation.status != LabReservation.STATUS_SUBMITTED:
            errors.append(f'状态不符：当前为{reservation.get_status_display()}，需已提交状态')
        missing = reservation.get_missing_evidence()
        if missing:
            labels = {'experiment_plan': '实验预约方案', 'material_application': '耗材申领单', 'safety_confirmation': '安全确认书'}
            errors.append(f'证据不足：缺少{"、".join(labels.get(m, m) for m in missing)}')

    elif check_type == 'college_confirm':
        if role != UserProfile.ROLE_COLLEGE_HEAD:
            errors.append(f'角色不符：当前为{user.profile.get_role_display()}，需学院负责人')
        if reservation.status == LabReservation.STATUS_SUBMITTED:
            errors.append('流程错误：必须先由实验室管理员审核，学院不能跳过实验室审核')
        elif reservation.status != LabReservation.STATUS_LAB_REVIEWED:
            errors.append(f'状态不符：当前为{reservation.get_status_display()}，需实验室审核通过状态')

    elif check_type == 'supplement':
        if role != UserProfile.ROLE_TA:
            errors.append(f'角色不符：当前为{user.profile.get_role_display()}，需实验助教')
        if reservation.applicant_id != user.id:
            errors.append('只能补录自己创建的预约单')
        if reservation.status in [LabReservation.STATUS_CONFIRMED]:
            errors.append('已确认的预约单不能再补录')
        if reservation.status not in [
            LabReservation.STATUS_DRAFT,
            LabReservation.STATUS_SUBMITTED,
            LabReservation.STATUS_LAB_REJECTED,
            LabReservation.STATUS_COLLEGE_REJECTED,
            LabReservation.STATUS_LAB_REVIEWED,
        ]:
            errors.append(f'状态不符：当前为{reservation.get_status_display()}')

    return errors


def _get_flow_steps(reservation):
    """获取流程步骤状态"""
    steps = []

    steps.append({
        'key': 'submit',
        'label': '实验助教提交',
        'status': 'done' if reservation.submitted_at else 'pending',
        'actor': reservation.applicant.username if reservation.submitted_at else '',
        'time': reservation.submitted_at.isoformat() if reservation.submitted_at else '',
    })

    if reservation.status == LabReservation.STATUS_LAB_REJECTED:
        steps.append({
            'key': 'lab_review',
            'label': '实验室审核',
            'status': 'rejected',
            'actor': reservation.rejected_by.username if reservation.rejected_by else '',
            'time': reservation.rejected_at.isoformat() if reservation.rejected_at else '',
            'comment': reservation.rejection_reason,
        })
    elif reservation.lab_reviewed_at:
        steps.append({
            'key': 'lab_review',
            'label': '实验室审核通过',
            'status': 'done',
            'actor': reservation.lab_reviewer.username if reservation.lab_reviewer else '',
            'time': reservation.lab_reviewed_at.isoformat() if reservation.lab_reviewed_at else '',
            'comment': reservation.lab_review_comment,
        })
    elif reservation.submitted_at:
        steps.append({
            'key': 'lab_review',
            'label': '实验室审核',
            'status': 'current',
            'actor': '',
            'time': '',
        })
    else:
        steps.append({
            'key': 'lab_review',
            'label': '实验室审核',
            'status': 'pending',
            'actor': '',
            'time': '',
        })

    if reservation.status == LabReservation.STATUS_COLLEGE_REJECTED:
        steps.append({
            'key': 'college_confirm',
            'label': '学院确认',
            'status': 'rejected',
            'actor': reservation.rejected_by.username if reservation.rejected_by else '',
            'time': reservation.rejected_at.isoformat() if reservation.rejected_at else '',
            'comment': reservation.rejection_reason,
        })
    elif reservation.confirmed_at:
        steps.append({
            'key': 'college_confirm',
            'label': '学院确认通过',
            'status': 'done',
            'actor': reservation.confirmer.username if reservation.confirmer else '',
            'time': reservation.confirmed_at.isoformat() if reservation.confirmed_at else '',
            'comment': reservation.confirm_comment,
        })
    elif reservation.lab_reviewed_at and reservation.status == LabReservation.STATUS_LAB_REVIEWED:
        steps.append({
            'key': 'college_confirm',
            'label': '学院确认',
            'status': 'current',
            'actor': '',
            'time': '',
        })
    else:
        steps.append({
            'key': 'college_confirm',
            'label': '学院确认',
            'status': 'pending',
            'actor': '',
            'time': '',
        })

    return steps


def _get_next_action(reservation):
    """获取下一动作和角色"""
    status = reservation.status
    if status in [LabReservation.STATUS_DRAFT, LabReservation.STATUS_LAB_REJECTED, LabReservation.STATUS_COLLEGE_REJECTED]:
        return 'submit', UserProfile.ROLE_TA, '提交审核'
    elif status == LabReservation.STATUS_SUBMITTED:
        return 'lab_review', UserProfile.ROLE_LAB_ADMIN, '实验室审核'
    elif status == LabReservation.STATUS_LAB_REVIEWED:
        return 'college_confirm', UserProfile.ROLE_COLLEGE_HEAD, '学院确认'
    elif status == LabReservation.STATUS_CONFIRMED:
        return 'done', '', '已完成'
    return '', '', ''


def reservation_to_list_item(reservation: LabReservation, user: User = None) -> LabReservationListItem:
    can_submit = False
    can_lab_review = False
    can_college_confirm = False
    can_supplement = False
    primary_action = ''
    primary_action_label = ''
    disabled_reason = ''

    if user:
        can_submit, submit_error = reservation.can_submit(user)
        can_lab_review, lab_review_error = reservation.can_lab_review(user)
        can_college_confirm, college_confirm_error = reservation.can_college_confirm(user)
        can_supplement, supplement_error = reservation.can_supplement(user)

        if can_submit:
            primary_action = 'submit'
            primary_action_label = '提交'
        elif can_lab_review:
            primary_action = 'lab_review'
            primary_action_label = '审核'
        elif can_college_confirm:
            primary_action = 'college_confirm'
            primary_action_label = '确认'
        else:
            if reservation.status == LabReservation.STATUS_DRAFT:
                disabled_reason = submit_error if submit_error else '草稿状态'
            elif reservation.status == LabReservation.STATUS_SUBMITTED:
                disabled_reason = lab_review_error if lab_review_error and user.profile.role == UserProfile.ROLE_LAB_ADMIN else '待实验室审核'
            elif reservation.status == LabReservation.STATUS_LAB_REVIEWED:
                disabled_reason = college_confirm_error if college_confirm_error and user.profile.role == UserProfile.ROLE_COLLEGE_HEAD else '待学院确认'
            elif reservation.status == LabReservation.STATUS_CONFIRMED:
                disabled_reason = '流程已完成'
            elif reservation.status in [LabReservation.STATUS_LAB_REJECTED, LabReservation.STATUS_COLLEGE_REJECTED]:
                disabled_reason = '已退回，请补录后重新提交'

    return LabReservationListItem(
        id=reservation.id,
        reservation_no=reservation.reservation_no,
        title=reservation.title,
        lab_name=reservation.lab_name,
        experiment_name=reservation.experiment_name,
        applicant=reservation.applicant.username,
        department=reservation.department,
        status=reservation.status,
        status_display=reservation.get_status_display(),
        version=reservation.version,
        start_time=reservation.start_time,
        end_time=reservation.end_time,
        student_count=reservation.student_count,
        has_experiment_plan=reservation.has_experiment_plan,
        has_material_application=reservation.has_material_application,
        has_safety_confirmation=reservation.has_safety_confirmation,
        created_at=reservation.created_at,
        updated_at=reservation.updated_at,
        rejection_reason=reservation.rejection_reason,
        supplementary_count=reservation.supplementary_records.count(),
        can_submit=can_submit,
        can_lab_review=can_lab_review,
        can_college_confirm=can_college_confirm,
        can_supplement=can_supplement,
        primary_action=primary_action,
        primary_action_label=primary_action_label,
        disabled_reason=disabled_reason,
        missing_evidence=reservation.get_missing_evidence(),
    )


def reservation_to_detail(reservation: LabReservation, user: User) -> LabReservationDetail:
    can_submit, submit_error = reservation.can_submit(user)
    can_lab_review, lab_review_error = reservation.can_lab_review(user)
    can_college_confirm, college_confirm_error = reservation.can_college_confirm(user)
    can_supplement, supplement_error = reservation.can_supplement(user)

    submit_errors = _get_detailed_errors(reservation, user, 'submit')
    lab_review_errors = _get_detailed_errors(reservation, user, 'lab_review')
    college_confirm_errors = _get_detailed_errors(reservation, user, 'college_confirm')
    supplement_errors = _get_detailed_errors(reservation, user, 'supplement')

    flow_steps = _get_flow_steps(reservation)
    next_action, next_role, next_label = _get_next_action(reservation)

    version_history_count = reservation.audit_logs.count()

    return LabReservationDetail(
        id=reservation.id,
        reservation_no=reservation.reservation_no,
        title=reservation.title,
        lab_name=reservation.lab_name,
        course_name=reservation.course_name,
        experiment_name=reservation.experiment_name,
        applicant=reservation.applicant.username,
        department=reservation.department,
        status=reservation.status,
        status_display=reservation.get_status_display(),
        version=reservation.version,
        version_history_count=version_history_count,
        start_time=reservation.start_time,
        end_time=reservation.end_time,
        student_count=reservation.student_count,
        has_experiment_plan=reservation.has_experiment_plan,
        has_material_application=reservation.has_material_application,
        has_safety_confirmation=reservation.has_safety_confirmation,
        missing_evidence=reservation.get_missing_evidence(),
        created_at=reservation.created_at,
        updated_at=reservation.updated_at,
        submitted_at=reservation.submitted_at,
        lab_reviewed_at=reservation.lab_reviewed_at,
        lab_reviewer=reservation.lab_reviewer.username if reservation.lab_reviewer else None,
        lab_review_comment=reservation.lab_review_comment,
        confirmed_at=reservation.confirmed_at,
        confirmer=reservation.confirmer.username if reservation.confirmer else None,
        confirm_comment=reservation.confirm_comment,
        rejection_reason=reservation.rejection_reason,
        rejected_by=reservation.rejected_by.username if reservation.rejected_by else None,
        rejected_at=reservation.rejected_at,
        can_submit=can_submit,
        can_lab_review=can_lab_review,
        can_college_confirm=can_college_confirm,
        can_supplement=can_supplement,
        submit_error=submit_error,
        lab_review_error=lab_review_error,
        college_confirm_error=college_confirm_error,
        supplement_error=supplement_error,
        submit_errors=submit_errors,
        lab_review_errors=lab_review_errors,
        college_confirm_errors=college_confirm_errors,
        supplement_errors=supplement_errors,
        flow_steps=flow_steps,
        next_action=next_action,
        next_actor_role=next_role,
    )


def evidence_to_out(evidence: Evidence) -> EvidenceOut:
    return EvidenceOut(
        id=evidence.id,
        evidence_type=evidence.evidence_type,
        evidence_type_display=evidence.get_evidence_type_display(),
        title=evidence.title,
        description=evidence.description,
        uploaded_by=evidence.uploaded_by.username,
        uploaded_at=evidence.uploaded_at,
        version=evidence.version,
        is_supplementary=evidence.is_supplementary,
    )


def supplementary_to_out(record: SupplementaryRecord) -> SupplementaryRecordOut:
    return SupplementaryRecordOut(
        id=record.id,
        action=record.action,
        action_display=record.get_action_display(),
        description=record.description,
        supplementer=record.supplementer.username,
        supplementary_at=record.supplementary_at,
        previous_status=record.previous_status,
        new_status=record.new_status,
        related_evidence_id=record.related_evidence_id,
    )


def audit_log_to_out(log: AuditLog) -> AuditLogOut:
    return AuditLogOut(
        id=log.id,
        action=log.action,
        action_display=log.get_action_display(),
        actor=log.actor.username,
        action_time=log.action_time,
        comment=log.comment,
        previous_status=log.previous_status,
        new_status=log.new_status,
        reason=log.reason,
    )


@api.post('/auth/login', response=LoginOut, tags=['认证'])
def login(request, payload: LoginIn):
    user = authenticate(username=payload.username, password=payload.password)
    if not user:
        return api.create_response(
            request,
            {'detail': '用户名或密码错误', 'code': 'invalid_credentials'},
            status=401,
        )
    if not hasattr(user, 'profile'):
        return api.create_response(
            request,
            {'detail': '用户未配置角色信息', 'code': 'no_profile'},
            status=403,
        )
    return LoginOut(
        user=user_to_profile_out(user),
        message='登录成功',
    )


@api.get('/auth/me', response=UserProfileOut, auth=dev_auth, tags=['认证'])
def get_current_user(request):
    user = get_user_from_request(request)
    return user_to_profile_out(user)


@api.get('/users', response=List[UserProfileOut], auth=dev_auth, tags=['用户'])
def list_users(request, role: Optional[str] = None):
    users = User.objects.select_related('profile').all()
    if role:
        users = users.filter(profile__role=role)
    return [user_to_profile_out(u) for u in users]


@api.get('/reservations', response=ReservationListResponse, auth=dev_auth, tags=['预约单'])
def list_reservations(
    request,
    status: Optional[str] = None,
    role_view: Optional[str] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    mine_only: bool = False,
):
    user = get_user_from_request(request)
    queryset = LabReservation.objects.select_related('applicant', 'applicant__profile')

    if mine_only:
        queryset = queryset.filter(applicant=user)

    if status:
        status_list = status.split(',')
        queryset = queryset.filter(status__in=status_list)

    if role_view:
        if role_view == UserProfile.ROLE_TA:
            queryset = queryset.filter(applicant__profile__role=UserProfile.ROLE_TA)
        elif role_view == UserProfile.ROLE_LAB_ADMIN:
            queryset = queryset.filter(status=LabReservation.STATUS_SUBMITTED)
        elif role_view == UserProfile.ROLE_COLLEGE_HEAD:
            queryset = queryset.filter(status=LabReservation.STATUS_LAB_REVIEWED)

    if keyword:
        queryset = queryset.filter(
            models.Q(title__icontains=keyword)
            | models.Q(reservation_no__icontains=keyword)
            | models.Q(experiment_name__icontains=keyword)
        )

    total = queryset.count()

    start = (page - 1) * page_size
    end = start + page_size
    items = queryset[start:end]

    return ReservationListResponse(
        items=[reservation_to_list_item(r, user) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@api.post('/reservations/batch', response=dict, auth=dev_auth, tags=['批量操作'])
def batch_operation(request, payload: BatchOperationIn):
    user = get_user_from_request(request)
    results = []
    success_count = 0
    fail_count = 0

    if len(payload.ids) != len(payload.expected_versions):
        return api.create_response(
            request,
            {
                'detail': 'ID列表和版本号列表长度不一致',
                'code': 'invalid_input',
            },
            status=400,
        )



    valid_operations = ['lab_review_pass', 'lab_reject', 'college_confirm_pass', 'college_reject']
    if payload.operation not in valid_operations:
        return api.create_response(
            request,
            {
                'detail': f'不支持的批量操作：{payload.operation}',
                'code': 'invalid_operation',
                'errors': [f'支持的操作：{", ".join(valid_operations)}'],
            },
            status=400,
        )

    for idx, (res_id, expected_ver) in enumerate(zip(payload.ids, payload.expected_versions)):
        try:
            reservation = LabReservation.objects.get(id=res_id)
        except LabReservation.DoesNotExist:
            fail_count += 1
            results.append({
                'id': res_id,
                'success': False,
                'error': '预约单不存在',
                'code': 'not_found',
            })
            continue

        if reservation.version != expected_ver:
            fail_count += 1
            missing = reservation.get_missing_evidence()
            results.append({
                'id': res_id,
                'reservation_no': reservation.reservation_no,
                'success': False,
                'error': '版本号不匹配',
                'code': 'version_conflict',
                'errors': [
                    f'当前版本为 {reservation.version}，你提交的版本为 {expected_ver}',
                    '可能有其他人已修改此预约单，请刷新页面获取最新版本'
                ],
                'previous_status': reservation.status,
                'current_version': reservation.version,
                'expected_version': expected_ver,
                'missing_evidence': missing,
            })
            continue

        if payload.operation == 'lab_review_pass':
            can_op, err = reservation.can_lab_review(user)
            if not can_op:
                fail_count += 1
                detailed_errors = _get_detailed_errors(reservation, user, 'lab_review')
                missing = reservation.get_missing_evidence()
                results.append({
                    'id': res_id,
                    'reservation_no': reservation.reservation_no,
                    'success': False,
                    'error': err,
                    'code': 'cannot_operate',
                    'errors': detailed_errors,
                    'previous_status': reservation.status,
                    'current_version': reservation.version,
                    'missing_evidence': missing,
                })
                continue
            missing = reservation.get_missing_evidence()
            if missing:
                fail_count += 1
                labels = {'experiment_plan': '实验预约方案', 'material_application': '耗材申领单', 'safety_confirmation': '安全确认书'}
                missing_labels = [labels.get(m, m) for m in missing]
                results.append({
                    'id': res_id,
                    'reservation_no': reservation.reservation_no,
                    'success': False,
                    'error': f'证据不完整：缺少{"、".join(missing_labels)}',
                    'code': 'insufficient_evidence',
                    'errors': [f'缺少证据：{"、".join(missing_labels)}'],
                    'previous_status': reservation.status,
                    'current_version': reservation.version,
                    'missing_evidence': missing,
                })
                continue

            with transaction.atomic():
                previous_status = reservation.status
                reservation.status = LabReservation.STATUS_LAB_REVIEWED
                reservation.lab_reviewed_at = timezone.now()
                reservation.lab_reviewer = user
                reservation.lab_review_comment = payload.comment
                reservation.version += 1
                reservation.save()

                AuditLog.objects.create(
                    reservation=reservation,
                    action=AuditLog.ACTION_LAB_REVIEW_PASS,
                    actor=user,
                    comment=payload.comment,
                    previous_status=previous_status,
                    new_status=LabReservation.STATUS_LAB_REVIEWED,
                    reason='批量审核通过',
                )

            success_count += 1
            results.append({
                'id': res_id,
                'reservation_no': reservation.reservation_no,
                'success': True,
                'action': 'lab_review_pass',
                'previous_status': previous_status,
                'new_status': LabReservation.STATUS_LAB_REVIEWED,
                'previous_version': expected_ver,
                'new_version': reservation.version,
                'comment': payload.comment,
            })

        elif payload.operation == 'lab_reject':
            can_op, err = reservation.can_lab_review(user)
            if not can_op:
                fail_count += 1
                detailed_errors = _get_detailed_errors(reservation, user, 'lab_review')
                missing = reservation.get_missing_evidence()
                results.append({
                    'id': res_id,
                    'reservation_no': reservation.reservation_no,
                    'success': False,
                    'error': err,
                    'code': 'cannot_operate',
                    'errors': detailed_errors,
                    'previous_status': reservation.status,
                    'current_version': reservation.version,
                    'missing_evidence': missing,
                })
                continue

            with transaction.atomic():
                previous_status = reservation.status
                reservation.status = LabReservation.STATUS_LAB_REJECTED
                reservation.rejection_reason = payload.comment
                reservation.rejected_by = user
                reservation.rejected_at = timezone.now()
                reservation.version += 1
                reservation.save()

                AuditLog.objects.create(
                    reservation=reservation,
                    action=AuditLog.ACTION_LAB_REJECT,
                    actor=user,
                    comment=payload.comment,
                    previous_status=previous_status,
                    new_status=LabReservation.STATUS_LAB_REJECTED,
                    reason=payload.comment,
                )

            success_count += 1
            results.append({
                'id': res_id,
                'reservation_no': reservation.reservation_no,
                'success': True,
                'action': 'lab_reject',
                'previous_status': previous_status,
                'new_status': LabReservation.STATUS_LAB_REJECTED,
                'previous_version': expected_ver,
                'new_version': reservation.version,
                'comment': payload.comment,
            })

        elif payload.operation == 'college_confirm_pass':
            can_op, err = reservation.can_college_confirm(user)
            if not can_op:
                fail_count += 1
                detailed_errors = _get_detailed_errors(reservation, user, 'college_confirm')
                missing = reservation.get_missing_evidence()
                results.append({
                    'id': res_id,
                    'reservation_no': reservation.reservation_no,
                    'success': False,
                    'error': err,
                    'code': 'cannot_operate',
                    'errors': detailed_errors,
                    'previous_status': reservation.status,
                    'current_version': reservation.version,
                    'missing_evidence': missing,
                })
                continue

            with transaction.atomic():
                previous_status = reservation.status
                reservation.status = LabReservation.STATUS_CONFIRMED
                reservation.confirmed_at = timezone.now()
                reservation.confirmer = user
                reservation.confirm_comment = payload.comment
                reservation.version += 1
                reservation.save()

                AuditLog.objects.create(
                    reservation=reservation,
                    action=AuditLog.ACTION_COLLEGE_CONFIRM,
                    actor=user,
                    comment=payload.comment,
                    previous_status=previous_status,
                    new_status=LabReservation.STATUS_CONFIRMED,
                    reason='批量确认通过',
                )

            success_count += 1
            results.append({
                'id': res_id,
                'reservation_no': reservation.reservation_no,
                'success': True,
                'action': 'college_confirm_pass',
                'previous_status': previous_status,
                'new_status': LabReservation.STATUS_CONFIRMED,
                'previous_version': expected_ver,
                'new_version': reservation.version,
                'comment': payload.comment,
            })

        elif payload.operation == 'college_reject':
            can_op, err = reservation.can_college_confirm(user)
            if not can_op:
                fail_count += 1
                detailed_errors = _get_detailed_errors(reservation, user, 'college_confirm')
                missing = reservation.get_missing_evidence()
                results.append({
                    'id': res_id,
                    'reservation_no': reservation.reservation_no,
                    'success': False,
                    'error': err,
                    'code': 'cannot_operate',
                    'errors': detailed_errors,
                    'previous_status': reservation.status,
                    'current_version': reservation.version,
                    'missing_evidence': missing,
                })
                continue

            with transaction.atomic():
                previous_status = reservation.status
                reservation.status = LabReservation.STATUS_COLLEGE_REJECTED
                reservation.rejection_reason = payload.comment
                reservation.rejected_by = user
                reservation.rejected_at = timezone.now()
                reservation.version += 1
                reservation.save()

                AuditLog.objects.create(
                    reservation=reservation,
                    action=AuditLog.ACTION_COLLEGE_REJECT,
                    actor=user,
                    comment=payload.comment,
                    previous_status=previous_status,
                    new_status=LabReservation.STATUS_COLLEGE_REJECTED,
                    reason=payload.comment,
                )

            success_count += 1
            results.append({
                'id': res_id,
                'reservation_no': reservation.reservation_no,
                'success': True,
                'action': 'college_reject',
                'previous_status': previous_status,
                'new_status': LabReservation.STATUS_COLLEGE_REJECTED,
                'previous_version': expected_ver,
                'new_version': reservation.version,
                'comment': payload.comment,
            })

    return {
        'success_count': success_count,
        'fail_count': fail_count,
        'total': len(payload.ids),
        'results': results,
    }


@api.get('/reservations/{reservation_id}', response=LabReservationDetail, auth=dev_auth, tags=['预约单'])
def get_reservation(request, reservation_id: int):
    user = get_user_from_request(request)
    try:
        reservation = LabReservation.objects.select_related(
            'applicant', 'applicant__profile',
            'lab_reviewer', 'confirmer', 'rejected_by'
        ).get(id=reservation_id)
    except LabReservation.DoesNotExist:
        return api.create_response(
            request,
            {'detail': '预约单不存在', 'code': 'not_found'},
            status=404,
        )
    return reservation_to_detail(reservation, user)


@api.get('/reservations/{reservation_id}/evidences', response=List[EvidenceOut], auth=dev_auth, tags=['预约单'])
def list_reservation_evidences(request, reservation_id: int):
    try:
        reservation = LabReservation.objects.get(id=reservation_id)
    except LabReservation.DoesNotExist:
        return api.create_response(
            request,
            {'detail': '预约单不存在', 'code': 'not_found'},
            status=404,
        )
    evidences = reservation.evidences.select_related('uploaded_by').all()
    return [evidence_to_out(e) for e in evidences]


@api.get('/reservations/{reservation_id}/supplementary-records', response=List[SupplementaryRecordOut], auth=dev_auth, tags=['预约单'])
def list_supplementary_records(request, reservation_id: int):
    try:
        reservation = LabReservation.objects.get(id=reservation_id)
    except LabReservation.DoesNotExist:
        return api.create_response(
            request,
            {'detail': '预约单不存在', 'code': 'not_found'},
            status=404,
        )
    records = reservation.supplementary_records.select_related('supplementer').all()
    return [supplementary_to_out(r) for r in records]


@api.get('/reservations/{reservation_id}/audit-logs', response=List[AuditLogOut], auth=dev_auth, tags=['预约单'])
def list_audit_logs(request, reservation_id: int):
    try:
        reservation = LabReservation.objects.get(id=reservation_id)
    except LabReservation.DoesNotExist:
        return api.create_response(
            request,
            {'detail': '预约单不存在', 'code': 'not_found'},
            status=404,
        )
    logs = reservation.audit_logs.select_related('actor').all()
    return [audit_log_to_out(l) for l in logs]


@api.post('/reservations', response=LabReservationDetail, auth=dev_auth, tags=['预约单'])
def create_reservation(request, payload: ReservationCreateIn):
    user = get_user_from_request(request)

    if user.profile.role != UserProfile.ROLE_TA:
        return api.create_response(
            request,
            {'detail': '只有实验助教可以创建预约单', 'code': 'permission_denied', 'errors': ['当前用户角色无创建权限']},
            status=403,
        )

    with transaction.atomic():
        now = timezone.now()
        reservation_no = f'LAB{now.strftime("%Y%m%d")}{LabReservation.objects.count() + 1:04d}'

        reservation = LabReservation.objects.create(
            reservation_no=reservation_no,
            title=payload.title,
            lab_name=payload.lab_name,
            course_name=payload.course_name,
            experiment_name=payload.experiment_name,
            applicant=user,
            department=payload.department,
            start_time=payload.start_time,
            end_time=payload.end_time,
            student_count=payload.student_count,
            status=LabReservation.STATUS_DRAFT,
            version=1,
        )

        AuditLog.objects.create(
            reservation=reservation,
            action=AuditLog.ACTION_CREATE,
            actor=user,
            comment='创建预约单',
            previous_status='',
            new_status=LabReservation.STATUS_DRAFT,
        )

    return reservation_to_detail(reservation, user)


@api.put('/reservations/{reservation_id}', response=LabReservationDetail, auth=dev_auth, tags=['预约单'])
def update_reservation(request, reservation_id: int, payload: ReservationUpdateIn):
    user = get_user_from_request(request)

    try:
        reservation = LabReservation.objects.get(id=reservation_id)
    except LabReservation.DoesNotExist:
        return api.create_response(
            request,
            {'detail': '预约单不存在', 'code': 'not_found'},
            status=404,
        )

    if reservation.version != payload.expected_version:
        return api.create_response(
            request,
            {
                'detail': '版本号不匹配，请刷新后重试',
                'code': 'version_conflict',
                'errors': [
                    f'当前版本为 {reservation.version}，你提交的版本为 {payload.expected_version}',
                    '可能有其他人已修改此预约单，请刷新页面获取最新版本'
                ]
            },
            status=409,
        )

    if reservation.applicant_id != user.id:
        return api.create_response(
            request,
            {'detail': '只能修改自己创建的预约单', 'code': 'permission_denied', 'errors': ['不是预约单创建者']},
            status=403,
        )

    if reservation.status not in [
        LabReservation.STATUS_DRAFT,
        LabReservation.STATUS_LAB_REJECTED,
        LabReservation.STATUS_COLLEGE_REJECTED,
    ]:
        return api.create_response(
            request,
            {
                'detail': f'当前状态「{reservation.get_status_display()}」不能修改',
                'code': 'invalid_status',
                'errors': ['已提交或已确认的预约单不能直接修改，请通过补录方式更新']
            },
            status=400,
        )

    with transaction.atomic():
        update_data = payload.model_dump(exclude_unset=True, exclude={'expected_version'})
        for field, value in update_data.items():
            setattr(reservation, field, value)

        reservation.version += 1
        reservation.save()

        AuditLog.objects.create(
            reservation=reservation,
            action=AuditLog.ACTION_UPDATE,
            actor=user,
            comment=f'更新预约单信息：{", ".join(update_data.keys())}',
            previous_status=reservation.status,
            new_status=reservation.status,
        )

    return reservation_to_detail(reservation, user)


@api.post('/reservations/{reservation_id}/submit', response=LabReservationDetail, auth=dev_auth, tags=['预约单'])
def submit_reservation(request, reservation_id: int, payload: SubmitIn):
    user = get_user_from_request(request)

    try:
        reservation = LabReservation.objects.get(id=reservation_id)
    except LabReservation.DoesNotExist:
        return api.create_response(
            request,
            {'detail': '预约单不存在', 'code': 'not_found'},
            status=404,
        )

    if reservation.version != payload.expected_version:
        return api.create_response(
            request,
            {
                'detail': '版本号不匹配，请刷新后重试',
                'code': 'version_conflict',
                'errors': [
                    f'当前版本为 {reservation.version}，你提交的版本为 {payload.expected_version}',
                    '可能有其他人已修改此预约单，请刷新页面获取最新版本'
                ]
            },
            status=409,
        )

    can_submit, error_msg = reservation.can_submit(user)
    if not can_submit:
        errors = [error_msg]
        if user.profile.role != UserProfile.ROLE_TA:
            errors.append(f'当前角色：{user.profile.get_role_display()}')
            errors.append('需要角色：实验助教')
        if reservation.applicant_id != user.id:
            errors.append('不是预约单创建者')
        missing = reservation.get_missing_evidence()
        if missing:
            errors.append(f'缺少证据：{", ".join(missing)}')

        return api.create_response(
            request,
            {
                'detail': error_msg,
                'code': 'cannot_submit',
                'errors': errors,
            },
            status=400,
        )

    with transaction.atomic():
        previous_status = reservation.status
        reservation.status = LabReservation.STATUS_SUBMITTED
        reservation.submitted_at = timezone.now()
        reservation.version += 1
        reservation.rejection_reason = ''
        reservation.rejected_by = None
        reservation.rejected_at = None
        reservation.save()

        AuditLog.objects.create(
            reservation=reservation,
            action=AuditLog.ACTION_SUBMIT,
            actor=user,
            comment='提交预约单',
            previous_status=previous_status,
            new_status=LabReservation.STATUS_SUBMITTED,
        )

    return reservation_to_detail(reservation, user)


@api.post('/reservations/{reservation_id}/lab-review', response=LabReservationDetail, auth=dev_auth, tags=['预约单'])
def lab_review_reservation(request, reservation_id: int, payload: ReviewIn):
    user = get_user_from_request(request)

    try:
        reservation = LabReservation.objects.get(id=reservation_id)
    except LabReservation.DoesNotExist:
        return api.create_response(
            request,
            {'detail': '预约单不存在', 'code': 'not_found'},
            status=404,
        )

    if reservation.version != payload.expected_version:
        return api.create_response(
            request,
            {
                'detail': '版本号不匹配，请刷新后重试',
                'code': 'version_conflict',
                'errors': [
                    f'当前版本为 {reservation.version}，你提交的版本为 {payload.expected_version}',
                    '可能有其他人已修改此预约单，请刷新页面获取最新版本'
                ]
            },
            status=409,
        )

    can_review, error_msg = reservation.can_lab_review(user)
    if not can_review:
        errors = [error_msg]
        if user.profile.role != UserProfile.ROLE_LAB_ADMIN:
            errors.append(f'当前角色：{user.profile.get_role_display()}')
            errors.append('需要角色：实验室管理员')
        if reservation.status != LabReservation.STATUS_SUBMITTED:
            errors.append(f'当前状态：{reservation.get_status_display()}')
            errors.append('需要状态：已提交（待实验室审核）')

        return api.create_response(
            request,
            {
                'detail': error_msg,
                'code': 'cannot_lab_review',
                'errors': errors,
            },
            status=400,
        )

    with transaction.atomic():
        previous_status = reservation.status

        if payload.pass_:
            missing = reservation.get_missing_evidence()
            if missing:
                return api.create_response(
                    request,
                    {
                        'detail': f'证据不完整，不能通过审核。缺少：{", ".join(missing)}',
                        'code': 'insufficient_evidence',
                        'errors': [
                            '实验预约方案：' + ('已提交' if reservation.has_experiment_plan else '未提交'),
                            '耗材申领单：' + ('已提交' if reservation.has_material_application else '未提交'),
                            '安全确认书：' + ('已提交' if reservation.has_safety_confirmation else '未提交'),
                        ],
                    },
                    status=400,
                )

            reservation.status = LabReservation.STATUS_LAB_REVIEWED
            reservation.lab_reviewed_at = timezone.now()
            reservation.lab_reviewer = user
            reservation.lab_review_comment = payload.comment
            reservation.version += 1
            reservation.save()

            AuditLog.objects.create(
                reservation=reservation,
                action=AuditLog.ACTION_LAB_REVIEW_PASS,
                actor=user,
                comment=payload.comment,
                previous_status=previous_status,
                new_status=LabReservation.STATUS_LAB_REVIEWED,
                reason='证据材料齐全，实验方案合理',
            )
        else:
            reservation.status = LabReservation.STATUS_LAB_REJECTED
            reservation.rejection_reason = payload.comment
            reservation.rejected_by = user
            reservation.rejected_at = timezone.now()
            reservation.version += 1
            reservation.save()

            AuditLog.objects.create(
                reservation=reservation,
                action=AuditLog.ACTION_LAB_REJECT,
                actor=user,
                comment=payload.comment,
                previous_status=previous_status,
                new_status=LabReservation.STATUS_LAB_REJECTED,
                reason=payload.comment,
            )

    return reservation_to_detail(reservation, user)


@api.post('/reservations/{reservation_id}/college-confirm', response=LabReservationDetail, auth=dev_auth, tags=['预约单'])
def college_confirm_reservation(request, reservation_id: int, payload: CollegeConfirmIn):
    user = get_user_from_request(request)

    try:
        reservation = LabReservation.objects.get(id=reservation_id)
    except LabReservation.DoesNotExist:
        return api.create_response(
            request,
            {'detail': '预约单不存在', 'code': 'not_found'},
            status=404,
        )

    if reservation.version != payload.expected_version:
        return api.create_response(
            request,
            {
                'detail': '版本号不匹配，请刷新后重试',
                'code': 'version_conflict',
                'errors': [
                    f'当前版本为 {reservation.version}，你提交的版本为 {payload.expected_version}',
                    '可能有其他人已修改此预约单，请刷新页面获取最新版本'
                ]
            },
            status=409,
        )

    can_confirm, error_msg = reservation.can_college_confirm(user)
    if not can_confirm:
        errors = [error_msg]
        if user.profile.role != UserProfile.ROLE_COLLEGE_HEAD:
            errors.append(f'当前角色：{user.profile.get_role_display()}')
            errors.append('需要角色：学院负责人')
        if reservation.status != LabReservation.STATUS_LAB_REVIEWED:
            errors.append(f'当前状态：{reservation.get_status_display()}')
            errors.append('需要状态：实验室审核通过（待学院确认）')
            if reservation.status == LabReservation.STATUS_SUBMITTED:
                errors.append('注意：必须先由实验室管理员审核通过，学院负责人不能跳过实验室审核')

        return api.create_response(
            request,
            {
                'detail': error_msg,
                'code': 'cannot_college_confirm',
                'errors': errors,
            },
            status=400,
        )

    with transaction.atomic():
        previous_status = reservation.status

        if payload.pass_:
            reservation.status = LabReservation.STATUS_CONFIRMED
            reservation.confirmed_at = timezone.now()
            reservation.confirmer = user
            reservation.confirm_comment = payload.comment
            reservation.version += 1
            reservation.save()

            AuditLog.objects.create(
                reservation=reservation,
                action=AuditLog.ACTION_COLLEGE_CONFIRM,
                actor=user,
                comment=payload.comment,
                previous_status=previous_status,
                new_status=LabReservation.STATUS_CONFIRMED,
                reason='学院审核通过，同意预约',
            )
        else:
            reservation.status = LabReservation.STATUS_COLLEGE_REJECTED
            reservation.rejection_reason = payload.comment
            reservation.rejected_by = user
            reservation.rejected_at = timezone.now()
            reservation.version += 1
            reservation.save()

            AuditLog.objects.create(
                reservation=reservation,
                action=AuditLog.ACTION_COLLEGE_REJECT,
                actor=user,
                comment=payload.comment,
                previous_status=previous_status,
                new_status=LabReservation.STATUS_COLLEGE_REJECTED,
                reason=payload.comment,
            )

    return reservation_to_detail(reservation, user)


@api.post('/reservations/{reservation_id}/supplement-evidence', response=LabReservationDetail, auth=dev_auth, tags=['补录'])
def supplement_evidence(request, reservation_id: int, payload: SupplementEvidenceIn):
    user = get_user_from_request(request)

    try:
        reservation = LabReservation.objects.get(id=reservation_id)
    except LabReservation.DoesNotExist:
        return api.create_response(
            request,
            {'detail': '预约单不存在', 'code': 'not_found'},
            status=404,
        )

    if reservation.version != payload.expected_version:
        return api.create_response(
            request,
            {
                'detail': '版本号不匹配，请刷新后重试',
                'code': 'version_conflict',
                'errors': [
                    f'当前版本为 {reservation.version}，你提交的版本为 {payload.expected_version}',
                    '可能有其他人已修改此预约单，请刷新页面获取最新版本'
                ]
            },
            status=409,
        )

    can_supplement, error_msg = reservation.can_supplement(user)
    if not can_supplement:
        errors = [error_msg]
        if user.profile.role != UserProfile.ROLE_TA:
            errors.append(f'当前角色：{user.profile.get_role_display()}')
            errors.append('需要角色：实验助教')
        if reservation.applicant_id != user.id:
            errors.append('不是预约单创建者，不能补录')
        errors.append(f'当前状态：{reservation.get_status_display()}')

        return api.create_response(
            request,
            {
                'detail': error_msg,
                'code': 'cannot_supplement',
                'errors': errors,
            },
            status=400,
        )

    valid_types = [
        Evidence.TYPE_EXPERIMENT_PLAN,
        Evidence.TYPE_MATERIAL_APPLICATION,
        Evidence.TYPE_SAFETY_CONFIRMATION,
    ]
    if payload.evidence_type not in valid_types:
        return api.create_response(
            request,
            {
                'detail': f'无效的证据类型：{payload.evidence_type}',
                'code': 'invalid_evidence_type',
                'errors': [f'支持的类型：{", ".join(valid_types)}'],
            },
            status=400,
        )

    existing_evidence = reservation.evidences.filter(
        evidence_type=payload.evidence_type
    ).order_by('-version').first()

    with transaction.atomic():
        evidence = Evidence.objects.create(
            reservation=reservation,
            evidence_type=payload.evidence_type,
            title=payload.title,
            description=payload.description,
            uploaded_by=user,
            version=(existing_evidence.version + 1) if existing_evidence else 1,
            is_supplementary=True,
        )

        if payload.evidence_type == Evidence.TYPE_EXPERIMENT_PLAN:
            reservation.has_experiment_plan = True
        elif payload.evidence_type == Evidence.TYPE_MATERIAL_APPLICATION:
            reservation.has_material_application = True
        elif payload.evidence_type == Evidence.TYPE_SAFETY_CONFIRMATION:
            reservation.has_safety_confirmation = True

        reservation.version += 1
        reservation.save()

        supplementary = SupplementaryRecord.objects.create(
            reservation=reservation,
            action=SupplementaryRecord.ACTION_ADD_EVIDENCE,
            description=f'补充{evidence.get_evidence_type_display()}：{payload.title}',
            supplementer=user,
            previous_status=reservation.status,
            new_status=reservation.status,
            related_evidence=evidence,
        )

        AuditLog.objects.create(
            reservation=reservation,
            action=AuditLog.ACTION_SUPPLEMENT,
            actor=user,
            comment=f'补录{evidence.get_evidence_type_display()}',
            previous_status=reservation.status,
            new_status=reservation.status,
            reason=f'补充证据材料：{payload.title}',
        )

    return reservation_to_detail(reservation, user)




from django.db import models
