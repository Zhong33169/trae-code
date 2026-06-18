from django.utils import timezone
from django.db import transaction
from apps.loan.models import ExtensionApplication, QrCodeRecord
from apps.loan.services import auth_service
from apps.loan.services.application_service import serialize_application_detail
from apps.loan.services.audit_service import log_action


def scan_qr_code(user, qr_code, location=''):
    result = {
        'success': False,
        'scan_result': '',
        'scan_result_display': '',
        'error_message': '',
        'application': None,
    }

    try:
        app = ExtensionApplication.objects.get(qr_code=qr_code)
    except ExtensionApplication.DoesNotExist:
        scan_record = QrCodeRecord.objects.create(
            qr_code=qr_code,
            scanner=user,
            scan_result=QrCodeRecord.SCAN_RESULT_INVALID,
            error_message='无效二维码：系统中不存在对应的展期申请',
            location=location,
        )
        result['scan_result'] = QrCodeRecord.SCAN_RESULT_INVALID
        result['scan_result_display'] = '无效码'
        result['error_message'] = '无效二维码：该二维码对应的展期申请不存在，请核对后重试。'

        log_action(
            user,
            application=None,
            action='scan',
            action_detail=f'扫码核验失败 - 无效码: {qr_code}',
            remark=result['error_message'],
        )
        return result

    user_role = auth_service.get_user_role(user)

    if app.current_handler_role and app.current_handler_role != user_role:
        scan_record = QrCodeRecord.objects.create(
            qr_code=qr_code,
            application=app,
            scanner=user,
            scan_result=QrCodeRecord.SCAN_RESULT_WRONG_HANDLER,
            error_message=f'非当前处理人：当前处理角色为{app.current_handler_role}，您的角色为{user_role}',
            location=location,
        )
        result['scan_result'] = QrCodeRecord.SCAN_RESULT_WRONG_HANDLER
        result['scan_result_display'] = '非当前处理人'
        result['error_message'] = f'该展期申请当前处理角色为「{_get_role_name(app.current_handler_role)}」，您的角色为「{_get_role_name(user_role)}」，无权处理此申请。'
        result['application'] = serialize_application_detail(app)

        log_action(
            user,
            application=app,
            action='scan',
            action_detail='扫码核验 - 非当前处理人',
            old_status=app.status,
            new_status=app.status,
            remark=result['error_message'],
        )
        return result

    if app.status in [ExtensionApplication.STATUS_ARCHIVED, ExtensionApplication.STATUS_REJECTED]:
        scan_record = QrCodeRecord.objects.create(
            qr_code=qr_code,
            application=app,
            scanner=user,
            scan_result=QrCodeRecord.SCAN_RESULT_WRONG_STATUS,
            error_message=f'状态不匹配：申请已{app.get_status_display()}',
            location=location,
        )
        result['scan_result'] = QrCodeRecord.SCAN_RESULT_WRONG_STATUS
        result['scan_result_display'] = '状态不匹配'
        result['error_message'] = f'该展期申请状态为「{app.get_status_display()}」，无需再次扫码核验。'
        result['application'] = serialize_application_detail(app)

        log_action(
            user,
            application=app,
            action='scan',
            action_detail='扫码核验 - 状态不匹配',
            old_status=app.status,
            new_status=app.status,
        )
        return result

    recent_scan = QrCodeRecord.objects.filter(
        qr_code=qr_code,
        scan_result=QrCodeRecord.SCAN_RESULT_SUCCESS,
        scan_time__gte=timezone.now() - timezone.timedelta(minutes=30),
    ).exclude(scanner=user).first()

    if recent_scan:
        scan_record = QrCodeRecord.objects.create(
            qr_code=qr_code,
            application=app,
            scanner=user,
            scan_result=QrCodeRecord.SCAN_RESULT_DUPLICATE,
            error_message=f'重复扫码：该码已在30分钟内由{recent_scan.scanner.username}扫码核验通过',
            location=location,
        )
        result['scan_result'] = QrCodeRecord.SCAN_RESULT_DUPLICATE
        result['scan_result_display'] = '重复扫码'
        result['error_message'] = f'该二维码已在 {recent_scan.scan_time.strftime("%Y-%m-%d %H:%M:%S")} 由「{recent_scan.scanner.username}」扫码核验通过，请勿重复扫码。'
        result['application'] = serialize_application_detail(app)

        log_action(
            user,
            application=app,
            action='scan',
            action_detail='扫码核验 - 重复扫码',
            old_status=app.status,
            new_status=app.status,
        )
        return result

    scan_record = QrCodeRecord.objects.create(
        qr_code=qr_code,
        application=app,
        scanner=user,
        scan_result=QrCodeRecord.SCAN_RESULT_SUCCESS,
        error_message='',
        location=location,
    )

    result['success'] = True
    result['scan_result'] = QrCodeRecord.SCAN_RESULT_SUCCESS
    result['scan_result_display'] = '核验通过'
    result['error_message'] = ''
    result['application'] = serialize_application_detail(app)

    log_action(
        user,
        application=app,
        action='scan',
        action_detail='扫码核验通过',
        old_status=app.status,
        new_status=app.status,
        remark=f'扫码位置：{location}' if location else '',
    )

    return result


def _get_role_name(role_code):
    role_map = {
        auth_service.ROLE_REGISTRAR: '展期登记员',
        auth_service.ROLE_REVIEWER: '展期审核主管',
        auth_service.ROLE_FINAL_REVIEWER: '小贷公司复核负责人',
        auth_service.ROLE_ADMIN: '系统管理员',
    }
    return role_map.get(role_code, role_code)


def get_scan_history(user, page=1, page_size=20):
    queryset = QrCodeRecord.objects.select_related('application', 'scanner').filter(scanner=user).order_by('-scan_time')

    total = queryset.count()
    start = (page - 1) * page_size
    end = start + page_size
    records = queryset[start:end]

    items = []
    for record in records:
        items.append({
            'id': record.id,
            'qr_code': record.qr_code,
            'application_no': record.application.application_no if record.application else '',
            'borrower_name': record.application.borrower_name if record.application else '',
            'scan_result': record.scan_result,
            'scan_result_display': record.get_scan_result_display(),
            'error_message': record.error_message,
            'scan_time': record.scan_time,
            'location': record.location,
        })

    return {
        'items': items,
        'page': page,
        'page_size': page_size,
        'total': total,
    }
