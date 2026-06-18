import uuid
from django.utils import timezone
from django.db import transaction
from apps.loan.models import (
    ExtensionApplication,
    BatchTask,
    BatchTaskItem,
)
from apps.loan.services import auth_service
from apps.loan.services.application_service import (
    review_application,
    final_review_application,
    archive_application,
)


def generate_task_no():
    now = timezone.now()
    return f'BATCH{now.strftime("%Y%m%d%H%M%S")}{uuid.uuid4().hex[:6].upper()}'


def _get_action_display(action):
    action_map = {
        'review_approve': '批量审核通过',
        'review_reject': '批量审核退回',
        'final_approve': '批量复核通过',
        'final_reject': '批量复核拒绝',
        'archive': '批量归档',
    }
    return action_map.get(action, action)


def _can_perform_action(user, action, app):
    user_role = auth_service.get_user_role(user)

    action_permissions = {
        'review_approve': {
            'roles': [auth_service.ROLE_REVIEWER, auth_service.ROLE_ADMIN],
            'allowed_statuses': [ExtensionApplication.STATUS_PENDING_REVIEW],
            'error_code': 'NOT_REVIEWABLE',
            'error_message': '申请不在待审核状态',
        },
        'review_reject': {
            'roles': [auth_service.ROLE_REVIEWER, auth_service.ROLE_ADMIN],
            'allowed_statuses': [ExtensionApplication.STATUS_PENDING_REVIEW],
            'error_code': 'NOT_REVIEWABLE',
            'error_message': '申请不在待审核状态',
        },
        'final_approve': {
            'roles': [auth_service.ROLE_FINAL_REVIEWER, auth_service.ROLE_ADMIN],
            'allowed_statuses': [ExtensionApplication.STATUS_REVIEW_APPROVED],
            'error_code': 'NOT_FINAL_REVIEWABLE',
            'error_message': '申请不在待复核状态',
        },
        'final_reject': {
            'roles': [auth_service.ROLE_FINAL_REVIEWER, auth_service.ROLE_ADMIN],
            'allowed_statuses': [ExtensionApplication.STATUS_REVIEW_APPROVED],
            'error_code': 'NOT_FINAL_REVIEWABLE',
            'error_message': '申请不在待复核状态',
        },
        'archive': {
            'roles': [auth_service.ROLE_FINAL_REVIEWER, auth_service.ROLE_ADMIN],
            'allowed_statuses': [ExtensionApplication.STATUS_FINAL_APPROVED],
            'error_code': 'NOT_ARCHIVABLE',
            'error_message': '申请不在待归档状态',
        },
    }

    config = action_permissions.get(action)
    if not config:
        return False, 'INVALID_ACTION', '不支持的批量操作类型', ''

    if user_role not in config['roles']:
        return False, 'PERMISSION_DENIED', '您无权限执行此操作', '请联系管理员分配权限'

    if app.status not in config['allowed_statuses']:
        next_step = _get_next_step_suggestion(app.status, action)
        return False, config['error_code'], config['error_message'], next_step

    required_materials = app.materials.filter(is_required=True, is_verified=False)
    if required_materials.exists() and action in ['review_approve', 'final_approve']:
        return False, 'MATERIALS_MISSING', f'还有 {required_materials.count()} 项必填材料未核验', '请先核验所有必填材料'

    return True, '', '', ''


def _get_next_step_suggestion(current_status, action):
    status_flow = {
        ExtensionApplication.STATUS_DRAFT: '请先由登记员提交审核',
        ExtensionApplication.STATUS_PENDING_REVIEW: '请由审核主管进行审核',
        ExtensionApplication.STATUS_REVIEW_APPROVED: '请由复核负责人进行复核',
        ExtensionApplication.STATUS_RETURNED_FOR_CORRECTION: '请由登记员补正后重新提交',
        ExtensionApplication.STATUS_FINAL_APPROVED: '请由复核负责人进行归档',
        ExtensionApplication.STATUS_ARCHIVED: '申请已归档，无需再处理',
        ExtensionApplication.STATUS_REJECTED: '申请已拒绝，无需再处理',
    }
    return status_flow.get(current_status, '请检查申请状态后重试')


@transaction.atomic
def batch_process(user, application_ids, action, remark=''):
    user_role = auth_service.get_user_role(user)

    task = BatchTask.objects.create(
        task_no=generate_task_no(),
        operator=user,
        action=action,
        total_count=len(application_ids),
        success_count=0,
        failed_count=0,
        status=BatchTask.STATUS_PROCESSING,
        remark=remark,
    )

    success_count = 0
    failed_count = 0

    for app_id in application_ids:
        try:
            app = ExtensionApplication.objects.select_for_update().get(id=app_id)
        except ExtensionApplication.DoesNotExist:
            failed_count += 1
            BatchTaskItem.objects.create(
                batch_task=task,
                application_id=app_id,
                status=BatchTaskItem.STATUS_FAILED,
                error_code='NOT_FOUND',
                error_message='展期申请不存在',
                next_step='请检查申请编号是否正确',
                processed_at=timezone.now(),
            )
            continue

        can_do, error_code, error_msg, next_step = _can_perform_action(user, action, app)
        if not can_do:
            failed_count += 1
            BatchTaskItem.objects.create(
                batch_task=task,
                application=app,
                status=BatchTaskItem.STATUS_FAILED,
                error_code=error_code,
                error_message=error_msg,
                next_step=next_step,
                processed_at=timezone.now(),
            )
            continue

        try:
            if action == 'review_approve':
                review_application(user, app.id, approved=True, opinion=f'批量审核通过 - {remark}' if remark else '批量审核通过')
            elif action == 'review_reject':
                review_application(user, app.id, approved=False, opinion=f'批量审核退回 - {remark}' if remark else '批量审核退回')
            elif action == 'final_approve':
                final_review_application(user, app.id, approved=True, opinion=f'批量复核通过 - {remark}' if remark else '批量复核通过')
            elif action == 'final_reject':
                final_review_application(user, app.id, approved=False, opinion=f'批量复核拒绝 - {remark}' if remark else '批量复核拒绝')
            elif action == 'archive':
                archive_application(user, app.id)

            success_count += 1
            BatchTaskItem.objects.create(
                batch_task=task,
                application=app,
                status=BatchTaskItem.STATUS_SUCCESS,
                error_code='',
                error_message='',
                next_step='',
                processed_at=timezone.now(),
            )
        except Exception as e:
            failed_count += 1
            BatchTaskItem.objects.create(
                batch_task=task,
                application=app,
                status=BatchTaskItem.STATUS_FAILED,
                error_code='PROCESS_ERROR',
                error_message=f'处理失败：{str(e)}',
                next_step='请稍后重试或联系技术支持',
                processed_at=timezone.now(),
            )

    task.success_count = success_count
    task.failed_count = failed_count
    if failed_count == 0:
        task.status = BatchTask.STATUS_COMPLETED
    elif success_count == 0:
        task.status = BatchTask.STATUS_PARTIAL_FAILED
    else:
        task.status = BatchTask.STATUS_PARTIAL_FAILED
    task.completed_at = timezone.now()
    task.save()

    return get_batch_task_detail(task.id)


def get_batch_task_list(user, page=1, page_size=20):
    queryset = BatchTask.objects.select_related('operator').filter(operator=user).order_by('-created_at')

    total = queryset.count()
    start = (page - 1) * page_size
    end = start + page_size
    tasks = queryset[start:end]

    items = []
    for task in tasks:
        items.append({
            'id': task.id,
            'task_no': task.task_no,
            'action': task.action,
            'action_display': _get_action_display(task.action),
            'total_count': task.total_count,
            'success_count': task.success_count,
            'failed_count': task.failed_count,
            'status': task.status,
            'status_display': task.get_status_display(),
            'remark': task.remark,
            'created_at': task.created_at,
            'completed_at': task.completed_at,
        })

    return {
        'items': items,
        'page': page,
        'page_size': page_size,
        'total': total,
    }


def get_batch_task_detail(task_id):
    try:
        task = BatchTask.objects.select_related('operator').get(id=task_id)
    except BatchTask.DoesNotExist:
        raise ValueError('批量任务不存在')

    items = []
    for item in task.items.select_related('application').all():
        items.append({
            'id': item.id,
            'application_id': item.application_id,
            'application_no': item.application.application_no if item.application else '',
            'borrower_name': item.application.borrower_name if item.application else '',
            'status': item.status,
            'status_display': item.get_status_display(),
            'error_code': item.error_code,
            'error_message': item.error_message,
            'next_step': item.next_step,
            'processed_at': item.processed_at,
        })

    return {
        'id': task.id,
        'task_no': task.task_no,
        'action': task.action,
        'action_display': _get_action_display(task.action),
        'total_count': task.total_count,
        'success_count': task.success_count,
        'failed_count': task.failed_count,
        'status': task.status,
        'status_display': task.get_status_display(),
        'remark': task.remark,
        'created_at': task.created_at,
        'completed_at': task.completed_at,
        'items': items,
    }
