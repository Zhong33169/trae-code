from django.utils import timezone
from apps.loan.models import AuditLog


def log_action(user, application=None, action='', action_detail='', old_status='', new_status='', remark='', ip_address='', user_agent=''):
    AuditLog.objects.create(
        application=application,
        operator=user,
        action=action,
        action_detail=action_detail,
        old_status=old_status,
        new_status=new_status,
        remark=remark,
        ip_address=ip_address,
        user_agent=user_agent,
    )


def get_audit_logs(application_no=None, action=None, operator_id=None, start_date=None, end_date=None, page=1, page_size=20):
    queryset = AuditLog.objects.select_related('operator', 'application').all()

    if application_no:
        queryset = queryset.filter(application__application_no__contains=application_no)
    if action:
        queryset = queryset.filter(action=action)
    if operator_id:
        queryset = queryset.filter(operator_id=operator_id)
    if start_date:
        queryset = queryset.filter(created_at__date__gte=start_date)
    if end_date:
        queryset = queryset.filter(created_at__date__lte=end_date)

    total = queryset.count()
    start = (page - 1) * page_size
    end = start + page_size
    items = queryset[start:end]

    result = []
    for log in items:
        result.append({
            'id': log.id,
            'application_no': log.application.application_no if log.application else '',
            'operator_name': log.operator.username,
            'action': log.action,
            'action_display': log.get_action_display(),
            'action_detail': log.action_detail,
            'old_status': log.old_status,
            'new_status': log.new_status,
            'remark': log.remark,
            'created_at': log.created_at,
        })

    return {
        'items': result,
        'page': page,
        'page_size': page_size,
        'total': total,
    }
