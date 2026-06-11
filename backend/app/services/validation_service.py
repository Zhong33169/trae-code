from app.models import User, Ticket, TicketLog, Evidence
from django.utils import timezone
from datetime import timedelta


class ValidationError(Exception):
    def __init__(self, message, code='validation_error'):
        self.message = message
        self.code = code
        super().__init__(message)


RISK_EVIDENCE_REQUIREMENTS = {
    'high': {'min_count': 3, 'required_types': ['doc', 'link']},
    'medium': {'min_count': 2, 'required_types': ['doc']},
    'low': {'min_count': 1, 'required_types': []},
}

STAGE_REQUIRED_EVIDENCES = {
    'confirm': True,
    'schedule': True,
    'acceptance': True,
}

ROLE_STAGE_ACTIONS = {
    'registrar': {
        'confirm': {'pending': ['submit'], 'returned': ['revise']},
        'schedule': {'returned': ['revise']},
        'acceptance': {'returned': ['revise']},
    },
    'auditor': {
        'confirm': {'pending': ['approve', 'reject', 'transfer', 'takeover'], 'overdue': ['approve', 'reject', 'transfer', 'takeover']},
        'schedule': {'pending': ['approve', 'reject', 'transfer', 'takeover'], 'overdue': ['approve', 'reject', 'transfer', 'takeover']},
    },
    'reviewer': {
        'acceptance': {'pending': ['archive', 'reject', 'transfer', 'takeover'], 'overdue': ['archive', 'reject', 'transfer', 'takeover']},
    },
}

STAGE_TRANSITIONS = {
    'confirm': {'next': 'schedule', 'prev': None},
    'schedule': {'next': 'acceptance', 'prev': 'confirm'},
    'acceptance': {'next': None, 'prev': 'schedule'},
}

HANDLER_ROLE_MAP = {
    'confirm': 'auditor',
    'schedule': 'auditor',
    'acceptance': 'reviewer',
}

ACTION_HANDLER_EXCEPTIONS = {
    'create': True,
    'submit': True,
    'revise': True,
}


def validate_ticket_action(ticket: Ticket, user: User, action: str, version: int, evidences: list) -> dict:
    if version != ticket.version:
        raise ValidationError(
            f'版本号不匹配（提交v{version}，当前v{ticket.version}），请刷新页面后重试',
            'version_conflict'
        )

    if not ACTION_HANDLER_EXCEPTIONS.get(action):
        if ticket.current_handler_id is not None and ticket.current_handler_id != user.id:
            handler_name = ticket.current_handler.name if ticket.current_handler else '未知'
            raise ValidationError(
                f'当前处理人为「{handler_name}」，您无权办理此需求交付单',
                'handler_mismatch'
            )

    role_actions = ROLE_STAGE_ACTIONS.get(user.role, {})
    stage_actions = role_actions.get(ticket.stage, {})
    allowed_actions = stage_actions.get(ticket.status, [])

    if action not in allowed_actions:
        role_label = {'registrar': '登记员', 'auditor': '审核主管', 'reviewer': '复核负责人'}.get(user.role, user.role)
        stage_label = {'confirm': '需求确认', 'schedule': '排期评估', 'acceptance': '交付验收'}.get(ticket.stage, ticket.stage)
        status_label = {'pending': '待处理', 'processing': '处理中', 'returned': '已退回', 'completed': '已完成', 'overdue': '已逾期'}.get(ticket.status, ticket.status)
        raise ValidationError(
            f'角色[{role_label}]在[{stage_label}]阶段[{status_label}]状态下不能执行[{action}]操作',
            'action_not_allowed'
        )

    if action in ['approve', 'revise', 'submit', 'archive']:
        req = RISK_EVIDENCE_REQUIREMENTS.get(ticket.risk_level, {})
        if STAGE_REQUIRED_EVIDENCES.get(ticket.stage, False):
            if len(evidences) < req.get('min_count', 0):
                risk_label = {'high': '高风险', 'medium': '中风险', 'low': '低风险'}.get(ticket.risk_level, ticket.risk_level)
                stage_label = {'confirm': '需求确认', 'schedule': '排期评估', 'acceptance': '交付验收'}.get(ticket.stage, ticket.stage)
                raise ValidationError(
                    f'{risk_label}需求在{stage_label}阶段至少需要{req.get("min_count", 0)}份证据材料，当前仅{len(evidences)}份',
                    'evidence_insufficient'
                )
            for req_type in req.get('required_types', []):
                if not any(e.get('type') == req_type for e in evidences):
                    type_label = {'doc': '文档', 'image': '图片', 'link': '链接', 'other': '其他'}
                    raise ValidationError(
                        f'需要包含{type_label.get(req_type, req_type)}类型的证据材料',
                        'evidence_type_missing'
                    )

    return {'valid': True}


def calculate_priority(risk_level: str, is_overdue: bool = False) -> int:
    base = {'high': 100, 'medium': 50, 'low': 10}.get(risk_level, 50)
    if is_overdue:
        base += 50
    return base


def get_stage_deadline(stage: str, risk_level: str, base_time=None) -> timezone.datetime:
    if base_time is None:
        base_time = timezone.now()
    days = {
        ('confirm', 'high'): 1,
        ('confirm', 'medium'): 2,
        ('confirm', 'low'): 3,
        ('schedule', 'high'): 2,
        ('schedule', 'medium'): 3,
        ('schedule', 'low'): 5,
        ('acceptance', 'high'): 1,
        ('acceptance', 'medium'): 2,
        ('acceptance', 'low'): 3,
    }.get((stage, risk_level), 2)
    return base_time + timedelta(days=days)


def get_handler_role_for_stage(stage: str) -> str:
    return HANDLER_ROLE_MAP.get(stage)


def find_user_by_role(role: str) -> User:
    return User.objects.filter(role=role).first()


def write_validate_fail_log(ticket: Ticket, user: User, action: str, comment: str):
    TicketLog.objects.create(
        ticket=ticket,
        action='validate_fail',
        from_stage=ticket.stage,
        to_stage=ticket.stage,
        from_status=ticket.status,
        to_status=ticket.status,
        operator=user,
        comment=f'校验失败（尝试{action}）：{comment}',
    )


def is_pending_takeover(ticket: Ticket, user: User = None) -> bool:
    if user is not None and ticket.current_handler_id != user.id:
        return False
    last_transfer = TicketLog.objects.filter(
        ticket=ticket,
        action='transfer',
    ).order_by('-created_at').first()
    if not last_transfer:
        return False
    last_takeover = TicketLog.objects.filter(
        ticket=ticket,
        action='takeover',
        created_at__gt=last_transfer.created_at,
    ).order_by('-created_at').first()
    return last_takeover is None


def validate_transfer(ticket: Ticket, user: User, target_user: User) -> dict:
    target_role = HANDLER_ROLE_MAP.get(ticket.stage)
    if target_user.role != target_role:
        role_label = {'auditor': '审核主管', 'reviewer': '复核负责人'}.get(target_role, target_role)
        raise ValidationError(
            f'当前阶段只能转交给{role_label}角色的用户',
            'transfer_role_mismatch'
        )
    if target_user.id == user.id:
        raise ValidationError(
            '不能转交给自己',
            'transfer_to_self'
        )
    return {'valid': True}


def validate_takeover(ticket: Ticket, user: User) -> dict:
    if not is_pending_takeover(ticket, user):
        raise ValidationError(
            '该需求交付单不在待接手状态',
            'not_pending_takeover'
        )
    return {'valid': True}
