import uuid
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.contrib.auth.models import User

from apps.loan.models import (
    ExtensionApplication,
    RepaymentPlan,
    Material,
)
from apps.loan.services import auth_service
from apps.loan.services.audit_service import log_action


REQUIRED_MATERIALS = [
    {'type': Material.MATERIAL_TYPE_ID_CARD, 'name': '借款人身份证'},
    {'type': Material.MATERIAL_TYPE_LOAN_CONTRACT, 'name': '原借款合同'},
    {'type': Material.MATERIAL_TYPE_EXTENSION_AGREEMENT, 'name': '展期协议'},
    {'type': Material.MATERIAL_TYPE_INCOME_PROOF, 'name': '收入证明'},
    {'type': Material.MATERIAL_TYPE_SITE_PHOTO, 'name': '现场核验照片'},
]


def generate_application_no():
    now = timezone.now()
    return f'EA{now.strftime("%Y%m%d%H%M%S")}{uuid.uuid4().hex[:6].upper()}'


def generate_qr_code():
    return f'QR{uuid.uuid4().hex[:16].upper()}'


def serialize_application(app):
    reviewer_name = ''
    if app.reviewer:
        reviewer_name = app.reviewer.username

    final_reviewer_name = ''
    if app.final_reviewer:
        final_reviewer_name = app.final_reviewer.username

    return {
        'id': app.id,
        'application_no': app.application_no,
        'qr_code': app.qr_code,
        'borrower_name': app.borrower_name,
        'borrower_id_card': app.borrower_id_card,
        'borrower_phone': app.borrower_phone,
        'loan_contract_no': app.loan_contract_no,
        'original_principal': app.original_principal,
        'original_interest_rate': app.original_interest_rate,
        'original_due_date': app.original_due_date,
        'extension_days': app.extension_days,
        'extension_reason': app.extension_reason,
        'new_due_date': app.new_due_date,
        'new_interest_rate': app.new_interest_rate,
        'status': app.status,
        'status_display': app.get_status_display(),
        'current_handler_role': app.current_handler_role,
        'registrar_name': app.registrar.username,
        'reviewer_name': reviewer_name,
        'final_reviewer_name': final_reviewer_name,
        'review_opinion': app.review_opinion or '',
        'final_review_opinion': app.final_review_opinion or '',
        'is_urgent': app.is_urgent,
        'deadline': app.deadline,
        'created_at': app.created_at,
        'updated_at': app.updated_at,
        'version': app.version,
    }


def serialize_application_detail(app):
    data = serialize_application(app)

    repayment_plans = []
    for plan in app.repayment_plans.all():
        repayment_plans.append({
            'id': plan.id,
            'plan_no': plan.plan_no,
            'due_date': plan.due_date,
            'principal': plan.principal,
            'interest': plan.interest,
            'total_amount': plan.total_amount,
            'is_extension_period': plan.is_extension_period,
        })
    data['repayment_plans'] = repayment_plans

    materials = []
    for mat in app.materials.all():
        materials.append({
            'id': mat.id,
            'material_type': mat.material_type,
            'material_type_display': mat.get_material_type_display(),
            'material_name': mat.material_name,
            'is_required': mat.is_required,
            'is_verified': mat.is_verified,
            'upload_time': mat.upload_time,
        })
    data['materials'] = materials

    return data


def get_application_list(user, status=None, keyword=None, is_urgent=None, page=1, page_size=20):
    queryset = ExtensionApplication.objects.all()

    user_role = auth_service.get_user_role(user)

    if user_role == auth_service.ROLE_REGISTRAR:
        pass
    elif user_role == auth_service.ROLE_REVIEWER:
        queryset = queryset.filter(status__in=[
            ExtensionApplication.STATUS_PENDING_REVIEW,
        ])
    elif user_role == auth_service.ROLE_FINAL_REVIEWER:
        queryset = queryset.filter(status__in=[
            ExtensionApplication.STATUS_REVIEW_APPROVED,
            ExtensionApplication.STATUS_FINAL_APPROVED,
        ])

    if status:
        queryset = queryset.filter(status=status)

    if keyword:
        queryset = queryset.filter(
            models.Q(application_no__contains=keyword)
            | models.Q(borrower_name__contains=keyword)
            | models.Q(borrower_id_card__contains=keyword)
            | models.Q(loan_contract_no__contains=keyword)
        )

    if is_urgent is not None:
        queryset = queryset.filter(is_urgent=is_urgent)

    total = queryset.count()
    start = (page - 1) * page_size
    end = start + page_size
    apps = queryset[start:end]

    items = [serialize_application(app) for app in apps]

    return {
        'items': items,
        'page': page,
        'page_size': page_size,
        'total': total,
    }


def get_application_detail(user, application_id):
    try:
        app = ExtensionApplication.objects.get(id=application_id)
    except ExtensionApplication.DoesNotExist:
        raise ValueError('展期申请不存在')

    return serialize_application_detail(app)


def calculate_repayment_plan(principal, annual_rate, due_date, extension_days):
    principal = Decimal(str(principal))
    annual_rate = Decimal(str(annual_rate))
    daily_rate = annual_rate / Decimal('360') / Decimal('100')

    total_interest = principal * daily_rate * Decimal(extension_days)

    plans = []
    plan = {
        'plan_no': 1,
        'due_date': due_date + timedelta(days=extension_days),
        'principal': principal,
        'interest': total_interest,
        'total_amount': principal + total_interest,
        'is_extension_period': True,
    }
    plans.append(plan)

    return plans


@transaction.atomic
def create_application(user, data):
    if not auth_service.has_role(user, [auth_service.ROLE_REGISTRAR, auth_service.ROLE_ADMIN]):
        raise PermissionError('无权创建展期申请')

    new_due_date = data['original_due_date'] + timedelta(days=data['extension_days'])

    app = ExtensionApplication.objects.create(
        application_no=generate_application_no(),
        qr_code=generate_qr_code(),
        borrower_name=data['borrower_name'],
        borrower_id_card=data['borrower_id_card'],
        borrower_phone=data['borrower_phone'],
        loan_contract_no=data['loan_contract_no'],
        original_principal=data['original_principal'],
        original_interest_rate=data['original_interest_rate'],
        original_due_date=data['original_due_date'],
        extension_days=data['extension_days'],
        extension_reason=data['extension_reason'],
        new_due_date=new_due_date,
        status=ExtensionApplication.STATUS_DRAFT,
        current_handler_role=auth_service.ROLE_REGISTRAR,
        registrar=user,
        is_urgent=data.get('is_urgent', False),
    )

    plans_data = calculate_repayment_plan(
        data['original_principal'],
        data['original_interest_rate'],
        data['original_due_date'],
        data['extension_days'],
    )
    for plan_data in plans_data:
        RepaymentPlan.objects.create(
            application=app,
            plan_no=plan_data['plan_no'],
            due_date=plan_data['due_date'],
            principal=plan_data['principal'],
            interest=plan_data['interest'],
            total_amount=plan_data['total_amount'],
            is_extension_period=plan_data['is_extension_period'],
        )

    for mat_info in REQUIRED_MATERIALS:
        Material.objects.create(
            application=app,
            material_type=mat_info['type'],
            material_name=mat_info['name'],
            is_required=True,
            is_verified=False,
        )

    log_action(
        user,
        application=app,
        action='create',
        action_detail='创建展期申请',
        old_status='',
        new_status=ExtensionApplication.STATUS_DRAFT,
    )

    return serialize_application_detail(app)


@transaction.atomic
def submit_application(user, application_id):
    if not auth_service.has_role(user, [auth_service.ROLE_REGISTRAR, auth_service.ROLE_ADMIN]):
        raise PermissionError('无权提交展期申请')

    try:
        app = ExtensionApplication.objects.select_for_update().get(id=application_id)
    except ExtensionApplication.DoesNotExist:
        raise ValueError('展期申请不存在')

    if app.status not in [ExtensionApplication.STATUS_DRAFT, ExtensionApplication.STATUS_RETURNED_FOR_CORRECTION]:
        raise ValueError(f'当前状态「{app.get_status_display()}」不允许提交')

    if app.registrar_id != user.id and not auth_service.has_role(user, [auth_service.ROLE_ADMIN]):
        raise PermissionError('只能提交自己创建的申请')

    required_materials = app.materials.filter(is_required=True, is_verified=False)
    if required_materials.exists():
        raise ValueError(f'还有 {required_materials.count()} 项必填材料未核验，无法提交')

    old_status = app.status
    app.status = ExtensionApplication.STATUS_PENDING_REVIEW
    app.current_handler_role = auth_service.ROLE_REVIEWER
    app.version += 1
    app.save()

    log_action(
        user,
        application=app,
        action='submit',
        action_detail='提交审核',
        old_status=old_status,
        new_status=ExtensionApplication.STATUS_PENDING_REVIEW,
    )

    return serialize_application_detail(app)


@transaction.atomic
def review_application(user, application_id, approved, opinion, new_interest_rate=None):
    if not auth_service.has_role(user, [auth_service.ROLE_REVIEWER, auth_service.ROLE_ADMIN]):
        raise PermissionError('无权审核展期申请')

    try:
        app = ExtensionApplication.objects.select_for_update().get(id=application_id)
    except ExtensionApplication.DoesNotExist:
        raise ValueError('展期申请不存在')

    if app.status != ExtensionApplication.STATUS_PENDING_REVIEW:
        raise ValueError(f'当前状态「{app.get_status_display()}」不允许审核')

    old_status = app.status
    app.reviewer = user
    app.review_opinion = opinion
    app.version += 1

    if approved:
        if new_interest_rate:
            app.new_interest_rate = new_interest_rate
        else:
            app.new_interest_rate = app.original_interest_rate

        app.status = ExtensionApplication.STATUS_REVIEW_APPROVED
        app.current_handler_role = auth_service.ROLE_FINAL_REVIEWER
        action = 'review'
        action_detail = '审核通过'
    else:
        app.status = ExtensionApplication.STATUS_RETURNED_FOR_CORRECTION
        app.current_handler_role = auth_service.ROLE_REGISTRAR
        action = 'review'
        action_detail = '审核退回'

    app.save()

    log_action(
        user,
        application=app,
        action=action,
        action_detail=action_detail,
        old_status=old_status,
        new_status=app.status,
        remark=opinion,
    )

    return serialize_application_detail(app)


@transaction.atomic
def correct_application(user, application_id, data):
    if not auth_service.has_role(user, [auth_service.ROLE_REGISTRAR, auth_service.ROLE_ADMIN]):
        raise PermissionError('无权补正展期申请')

    try:
        app = ExtensionApplication.objects.select_for_update().get(id=application_id)
    except ExtensionApplication.DoesNotExist:
        raise ValueError('展期申请不存在')

    if app.status != ExtensionApplication.STATUS_RETURNED_FOR_CORRECTION:
        raise ValueError(f'当前状态「{app.get_status_display()}」不允许补正')

    if app.registrar_id != user.id and not auth_service.has_role(user, [auth_service.ROLE_ADMIN]):
        raise PermissionError('只能补正自己创建的申请')

    old_status = app.status

    if 'extension_days' in data and data['extension_days']:
        app.extension_days = data['extension_days']
        app.new_due_date = app.original_due_date + timedelta(days=data['extension_days'])

        app.repayment_plans.filter(is_extension_period=True).delete()
        plans_data = calculate_repayment_plan(
            app.original_principal,
            app.original_interest_rate,
            app.original_due_date,
            data['extension_days'],
        )
        for plan_data in plans_data:
            RepaymentPlan.objects.create(
                application=app,
                plan_no=plan_data['plan_no'],
                due_date=plan_data['due_date'],
                principal=plan_data['principal'],
                interest=plan_data['interest'],
                total_amount=plan_data['total_amount'],
                is_extension_period=plan_data['is_extension_period'],
            )

    if 'extension_reason' in data and data['extension_reason']:
        app.extension_reason = data['extension_reason']
    if 'borrower_phone' in data and data['borrower_phone']:
        app.borrower_phone = data['borrower_phone']
    if 'is_urgent' in data and data['is_urgent'] is not None:
        app.is_urgent = data['is_urgent']

    app.version += 1
    app.save()

    log_action(
        user,
        application=app,
        action='correct',
        action_detail='补正申请信息',
        old_status=old_status,
        new_status=app.status,
    )

    return serialize_application_detail(app)


@transaction.atomic
def final_review_application(user, application_id, approved, opinion):
    if not auth_service.has_role(user, [auth_service.ROLE_FINAL_REVIEWER, auth_service.ROLE_ADMIN]):
        raise PermissionError('无权复核展期申请')

    try:
        app = ExtensionApplication.objects.select_for_update().get(id=application_id)
    except ExtensionApplication.DoesNotExist:
        raise ValueError('展期申请不存在')

    if app.status != ExtensionApplication.STATUS_REVIEW_APPROVED:
        raise ValueError(f'当前状态「{app.get_status_display()}」不允许复核')

    old_status = app.status
    app.final_reviewer = user
    app.final_review_opinion = opinion
    app.version += 1

    if approved:
        app.status = ExtensionApplication.STATUS_FINAL_APPROVED
        app.current_handler_role = auth_service.ROLE_FINAL_REVIEWER
        action_detail = '复核通过'
    else:
        app.status = ExtensionApplication.STATUS_REJECTED
        app.current_handler_role = ''
        action_detail = '复核拒绝'

    app.save()

    log_action(
        user,
        application=app,
        action='final_review',
        action_detail=action_detail,
        old_status=old_status,
        new_status=app.status,
        remark=opinion,
    )

    return serialize_application_detail(app)


@transaction.atomic
def archive_application(user, application_id):
    if not auth_service.has_role(user, [auth_service.ROLE_FINAL_REVIEWER, auth_service.ROLE_ADMIN]):
        raise PermissionError('无权归档展期申请')

    try:
        app = ExtensionApplication.objects.select_for_update().get(id=application_id)
    except ExtensionApplication.DoesNotExist:
        raise ValueError('展期申请不存在')

    if app.status != ExtensionApplication.STATUS_FINAL_APPROVED:
        raise ValueError(f'当前状态「{app.get_status_display()}」不允许归档')

    old_status = app.status
    app.status = ExtensionApplication.STATUS_ARCHIVED
    app.current_handler_role = ''
    app.version += 1
    app.save()

    log_action(
        user,
        application=app,
        action='archive',
        action_detail='归档完成',
        old_status=old_status,
        new_status=ExtensionApplication.STATUS_ARCHIVED,
    )

    return serialize_application_detail(app)


@transaction.atomic
def verify_material(user, material_id, verified):
    try:
        material = Material.objects.select_for_update().get(id=material_id)
    except Material.DoesNotExist:
        raise ValueError('材料不存在')

    app = material.application

    if app.status not in [ExtensionApplication.STATUS_DRAFT, ExtensionApplication.STATUS_RETURNED_FOR_CORRECTION]:
        raise ValueError('当前状态不允许核验材料')

    user_role = auth_service.get_user_role(user)
    if user_role not in [auth_service.ROLE_REGISTRAR, auth_service.ROLE_ADMIN]:
        raise PermissionError('无权核验材料')

    material.is_verified = verified
    material.verified_by = user
    material.verified_at = timezone.now()
    material.save()

    log_action(
        user,
        application=app,
        action='material_verify',
        action_detail=f"核验材料：{material.material_name} - {'通过' if verified else '不通过'}",
        old_status=app.status,
        new_status=app.status,
    )

    return {
        'id': material.id,
        'material_type': material.material_type,
        'material_type_display': material.get_material_type_display(),
        'material_name': material.material_name,
        'is_required': material.is_required,
        'is_verified': material.is_verified,
        'upload_time': material.upload_time,
    }


def get_dashboard_stats(user):
    user_role = auth_service.get_user_role(user)

    total = ExtensionApplication.objects.count()
    pending = ExtensionApplication.objects.filter(
        status__in=[
            ExtensionApplication.STATUS_PENDING_REVIEW,
            ExtensionApplication.STATUS_REVIEW_APPROVED,
            ExtensionApplication.STATUS_RETURNED_FOR_CORRECTION,
        ]
    ).count()

    my_pending = 0
    if user_role == auth_service.ROLE_REGISTRAR:
        my_pending = ExtensionApplication.objects.filter(
            status=ExtensionApplication.STATUS_RETURNED_FOR_CORRECTION,
            registrar=user,
        ).count()
    elif user_role == auth_service.ROLE_REVIEWER:
        my_pending = ExtensionApplication.objects.filter(
            status=ExtensionApplication.STATUS_PENDING_REVIEW,
        ).count()
    elif user_role == auth_service.ROLE_FINAL_REVIEWER:
        my_pending = ExtensionApplication.objects.filter(
            status=ExtensionApplication.STATUS_REVIEW_APPROVED,
        ).count()

    approved = ExtensionApplication.objects.filter(
        status__in=[ExtensionApplication.STATUS_ARCHIVED, ExtensionApplication.STATUS_FINAL_APPROVED]
    ).count()
    rejected = ExtensionApplication.objects.filter(status=ExtensionApplication.STATUS_REJECTED).count()
    urgent = ExtensionApplication.objects.filter(is_urgent=True).exclude(status=ExtensionApplication.STATUS_ARCHIVED).count()
    returned = ExtensionApplication.objects.filter(status=ExtensionApplication.STATUS_RETURNED_FOR_CORRECTION).count()

    return {
        'total_count': total,
        'pending_count': pending,
        'my_pending_count': my_pending,
        'approved_count': approved,
        'rejected_count': rejected,
        'urgent_count': urgent,
        'returned_count': returned,
    }


from django.db import models
