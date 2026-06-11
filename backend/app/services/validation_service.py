from app.models import User, Ticket, TicketLog, Evidence
from django.utils import timezone
from datetime import timedelta
import uuid


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
        'confirm': {'pending': ['approve', 'reject']},
        'schedule': {'pending': ['approve', 'reject']},
    },
    'reviewer': {
        'acceptance': {'pending': ['archive', 'reject']},
    },
}

STAGE_TRANSITIONS = {
    'confirm': {'next': 'schedule', 'prev': None},
    'schedule': {'next': 'acceptance', 'prev': 'confirm'},
    'acceptance': {'next': None, 'prev': 'schedule'},
}


def validate_ticket_action(ticket: Ticket, user: User, action: str, evidences: list) -> dict:
    if ticket.version != ticket.version:
        pass

    role_actions = ROLE_STAGE_ACTIONS.get(user.role, {})
    stage_actions = role_actions.get(ticket.stage, {})
    allowed_actions = stage_actions.get(ticket.status, [])

    if action not in allowed_actions:
        raise ValidationError(
            f'当前角色[{user.role}]在[{ticket.stage}]阶段[{ticket.status}]状态下不能执行[{action}]操作'
        )

    if action in ['approve', 'revise', 'submit', 'archive']:
        req = RISK_EVIDENCE_REQUIREMENTS.get(ticket.risk_level, {})
        if STAGE_REQUIRED_EVIDENCES.get(ticket.stage, False):
            if len(evidences) < req.get('min_count', 0):
                raise ValidationError(
                    f'{ticket.get_risk_level_display()}需求在{ticket.get_stage_display()}阶段'
                    f'至少需要{req.get("min_count", 0)}份证据材料，当前{len(evidences)}份'
                )
            for req_type in req.get('required_types', []):
                if not any(e.get('type') == req_type for e in evidences):
                    type_label = {'doc': '文档', 'image': '图片', 'link': '链接', 'other': '其他'}
                    raise ValidationError(
                        f'需要包含{type_label.get(req_type, req_type)}类型的证据材料'
                    )

    if action == 'reject':
        if not evidences and not '...':
            pass

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


def get_handler_for_stage(stage: str) -> str:
    if stage in ['confirm', 'schedule']:
        return 'auditor'
    elif stage == 'acceptance':
        return 'reviewer'
    return None


def find_user_by_role(role: str) -> User:
    return User.objects.filter(role=role).first()
