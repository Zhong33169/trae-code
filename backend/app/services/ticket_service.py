from app.models import User, Ticket, TicketLog, Evidence
from app.services.validation_service import (
    ValidationError,
    validate_ticket_action,
    get_stage_deadline,
    find_user_by_role,
    STAGE_TRANSITIONS,
    RISK_EVIDENCE_REQUIREMENTS,
)
from django.utils import timezone
from django.db import transaction
from django.db.models import Q, Count
import uuid


def create_ticket(user: User, data: dict) -> Ticket:
    with transaction.atomic():
        risk_level = data.get('risk_level', 'medium')

        ticket = Ticket.objects.create(
            title=data['title'],
            description=data['description'],
            risk_level=risk_level,
            stage='confirm',
            status='pending',
            version=1,
            creator=user,
            current_handler=None,
            deadline=get_stage_deadline('confirm', risk_level),
        )

        log = TicketLog.objects.create(
            ticket=ticket,
            action='create',
            from_stage='',
            to_stage='confirm',
            from_status='',
            to_status='pending',
            operator=user,
            comment='创建需求交付单',
        )

        evidence_data = data.get('evidences', [])
        for ev in evidence_data:
            Evidence.objects.create(
                ticket=ticket,
                log=log,
                name=ev.get('name', ''),
                type=ev.get('type', 'doc'),
                url=ev.get('url', ''),
            )

        return ticket


def submit_ticket(ticket: Ticket, user: User, data: dict) -> Ticket:
    with transaction.atomic():
        if ticket.version != data.get('version'):
            raise ValidationError('版本号不匹配，请刷新页面后重试', 'version_conflict')

        evidences = data.get('evidences', [])
        validate_ticket_action(ticket, user, 'submit', evidences)

        old_stage = ticket.stage
        old_status = ticket.status

        ticket.status = 'pending'
        ticket.current_handler = find_user_by_role('auditor') if ticket.stage in ['confirm', 'schedule'] else find_user_by_role('reviewer')
        ticket.version += 1
        ticket.save()

        log = TicketLog.objects.create(
            ticket=ticket,
            action='submit',
            from_stage=old_stage,
            to_stage=ticket.stage,
            from_status=old_status,
            to_status=ticket.status,
            operator=user,
            comment=data.get('comment', '提交审核'),
        )

        for ev in evidences:
            Evidence.objects.create(
                ticket=ticket,
                log=log,
                name=ev.get('name', ''),
                type=ev.get('type', 'doc'),
                url=ev.get('url', ''),
            )

        return ticket


def approve_ticket(ticket: Ticket, user: User, data: dict) -> Ticket:
    with transaction.atomic():
        if ticket.version != data.get('version'):
            raise ValidationError('版本号不匹配，请刷新页面后重试', 'version_conflict')

        evidences = data.get('evidences', [])
        validate_ticket_action(ticket, user, 'approve', evidences)

        old_stage = ticket.stage
        old_status = ticket.status

        transition = STAGE_TRANSITIONS.get(ticket.stage, {})
        next_stage = transition.get('next')

        if next_stage:
            ticket.stage = next_stage
            ticket.status = 'pending'
            ticket.current_handler = find_user_by_role('auditor') if next_stage == 'schedule' else find_user_by_role('reviewer')
            ticket.deadline = get_stage_deadline(next_stage, ticket.risk_level)
        else:
            ticket.status = 'completed'
            ticket.current_handler = None

        ticket.version += 1
        ticket.save()

        log = TicketLog.objects.create(
            ticket=ticket,
            action='approve',
            from_stage=old_stage,
            to_stage=ticket.stage,
            from_status=old_status,
            to_status=ticket.status,
            operator=user,
            comment=data.get('comment', '审核通过'),
        )

        for ev in evidences:
            Evidence.objects.create(
                ticket=ticket,
                log=log,
                name=ev.get('name', ''),
                type=ev.get('type', 'doc'),
                url=ev.get('url', ''),
            )

        return ticket


def reject_ticket(ticket: Ticket, user: User, data: dict) -> Ticket:
    with transaction.atomic():
        if ticket.version != data.get('version'):
            raise ValidationError('版本号不匹配，请刷新页面后重试', 'version_conflict')

        evidences = data.get('evidences', [])
        validate_ticket_action(ticket, user, 'reject', evidences)

        old_stage = ticket.stage
        old_status = ticket.status

        ticket.status = 'returned'
        ticket.current_handler = ticket.creator
        ticket.version += 1
        ticket.save()

        log = TicketLog.objects.create(
            ticket=ticket,
            action='reject',
            from_stage=old_stage,
            to_stage=ticket.stage,
            from_status=old_status,
            to_status=ticket.status,
            operator=user,
            comment=data.get('comment', '退回补正'),
        )

        for ev in evidences:
            Evidence.objects.create(
                ticket=ticket,
                log=log,
                name=ev.get('name', ''),
                type=ev.get('type', 'doc'),
                url=ev.get('url', ''),
            )

        return ticket


def revise_ticket(ticket: Ticket, user: User, data: dict) -> Ticket:
    return submit_ticket(ticket, user, data)


def archive_ticket(ticket: Ticket, user: User, data: dict) -> Ticket:
    with transaction.atomic():
        if ticket.version != data.get('version'):
            raise ValidationError('版本号不匹配，请刷新页面后重试', 'version_conflict')

        evidences = data.get('evidences', [])
        validate_ticket_action(ticket, user, 'archive', evidences)

        old_stage = ticket.stage
        old_status = ticket.status

        ticket.status = 'completed'
        ticket.current_handler = None
        ticket.version += 1
        ticket.save()

        log = TicketLog.objects.create(
            ticket=ticket,
            action='archive',
            from_stage=old_stage,
            to_stage=ticket.stage,
            from_status=old_status,
            to_status=ticket.status,
            operator=user,
            comment=data.get('comment', '复核归档'),
        )

        for ev in evidences:
            Evidence.objects.create(
                ticket=ticket,
                log=log,
                name=ev.get('name', ''),
                type=ev.get('type', 'doc'),
                url=ev.get('url', ''),
            )

        return ticket


def execute_action(ticket: Ticket, user: User, action: str, data: dict) -> Ticket:
    actions = {
        'submit': submit_ticket,
        'approve': approve_ticket,
        'reject': reject_ticket,
        'revise': revise_ticket,
        'archive': archive_ticket,
    }

    handler = actions.get(action)
    if not handler:
        raise ValidationError(f'不支持的操作: {action}')

    return handler(ticket, user, data)


def get_ticket_list(filters: dict, page: int = 1, page_size: int = 20, user: User = None) -> dict:
    queryset = Ticket.objects.all()

    if user and user.role == 'registrar':
        queryset = queryset.filter(creator=user)

    if filters.get('stage'):
        queryset = queryset.filter(stage=filters['stage'])

    if filters.get('risk_level'):
        queryset = queryset.filter(risk_level=filters['risk_level'])

    if filters.get('status'):
        queryset = queryset.filter(status=filters['status'])

    if filters.get('keyword'):
        keyword = filters['keyword']
        queryset = queryset.filter(Q(title__icontains=keyword) | Q(description__icontains=keyword))

    if filters.get('handler_id'):
        queryset = queryset.filter(current_handler_id=filters['handler_id'])

    total = queryset.count()

    queryset = queryset.order_by('-priority', '-created_at')
    start = (page - 1) * page_size
    items = queryset[start:start + page_size]

    return {
        'total': total,
        'items': [t.to_dict() for t in items],
        'page': page,
        'page_size': page_size,
    }


def get_ticket_detail(ticket_id: int) -> dict:
    ticket = Ticket.objects.get(id=ticket_id)
    data = ticket.to_dict()

    logs = TicketLog.objects.filter(ticket=ticket).order_by('created_at')
    log_list = []
    for log in logs:
        log_data = log.to_dict()
        log_evidences = Evidence.objects.filter(log=log)
        log_data['evidences'] = [e.to_dict() for e in log_evidences]
        log_list.append(log_data)

    data['logs'] = log_list

    all_evidences = Evidence.objects.filter(ticket=ticket)
    data['evidences'] = [e.to_dict() for e in all_evidences]

    return data


def get_dashboard_stats(user: User) -> dict:
    queryset = Ticket.objects.all()

    if user.role == 'registrar':
        queryset = queryset.filter(creator=user)

    total_pending = queryset.filter(status__in=['pending', 'processing']).count()

    stage_counts = queryset.values('stage').annotate(count=Count('id'))
    stage_dict = {item['stage']: item['count'] for item in stage_counts}

    risk_counts = queryset.values('risk_level').annotate(count=Count('id'))
    risk_dict = {item['risk_level']: item['count'] for item in risk_counts}

    overdue_count = queryset.filter(status='overdue').count()

    my_todo = Ticket.objects.filter(current_handler=user, status='pending').count()

    return {
        'total_pending': total_pending,
        'stage_counts': stage_dict,
        'risk_counts': risk_dict,
        'overdue_count': overdue_count,
        'my_todo_count': my_todo,
    }


def get_log_list(filters: dict, page: int = 1, page_size: int = 50, user: User = None) -> dict:
    queryset = TicketLog.objects.all()

    if filters.get('ticket_id'):
        queryset = queryset.filter(ticket_id=filters['ticket_id'])

    if filters.get('action'):
        queryset = queryset.filter(action=filters['action'])

    if filters.get('operator_id'):
        queryset = queryset.filter(operator_id=filters['operator_id'])

    total = queryset.count()
    queryset = queryset.order_by('-created_at')
    start = (page - 1) * page_size
    items = queryset[start:start + page_size]

    log_list = []
    for log in items:
        log_data = log.to_dict()
        log_evidences = Evidence.objects.filter(log=log)
        log_data['evidences'] = [e.to_dict() for e in log_evidences]
        log_list.append(log_data)

    return {
        'total': total,
        'items': log_list,
        'page': page,
        'page_size': page_size,
    }


def check_and_update_overdue():
    now = timezone.now()
    overdue_tickets = Ticket.objects.filter(
        deadline__lt=now,
        status__in=['pending', 'processing']
    )
    for ticket in overdue_tickets:
        old_status = ticket.status
        ticket.status = 'overdue'
        ticket.save()

        TicketLog.objects.create(
            ticket=ticket,
            action='validate_fail',
            from_stage=ticket.stage,
            to_stage=ticket.stage,
            from_status=old_status,
            to_status='overdue',
            operator=None,
            comment='系统自动标记逾期',
        )
