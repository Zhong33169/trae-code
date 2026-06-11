from ninja import Router, Query
from app.models import Ticket, User
from app.schemas import (
    TicketSchema,
    TicketDetailSchema,
    TicketCreateSchema,
    TicketActionSchema,
    TicketListResponse,
)
from app.services import ticket_service
from app.services.validation_service import ValidationError
from app.api import get_user_from_request

router = Router(tags=['需求交付单'])


def require_auth(request):
    user = get_user_from_request(request)
    if not user:
        raise ValidationError('未登录或登录已过期', 'unauthorized')
    return user


@router.get('', response=TicketListResponse)
def list_tickets(
    request,
    stage: str = None,
    risk_level: str = None,
    status: str = None,
    keyword: str = None,
    handler_id: int = None,
    page: int = 1,
    page_size: int = 20,
):
    user = require_auth(request)
    filters = {
        'stage': stage,
        'risk_level': risk_level,
        'status': status,
        'keyword': keyword,
        'handler_id': handler_id,
    }
    return ticket_service.get_ticket_list(filters, page, page_size, user)


@router.get('/{ticket_id}', response=TicketDetailSchema)
def get_ticket(request, ticket_id: int):
    require_auth(request)
    return ticket_service.get_ticket_detail(ticket_id)


@router.post('', response=TicketDetailSchema)
def create_ticket(request, data: TicketCreateSchema):
    user = require_auth(request)
    if user.role != 'registrar':
        raise ValidationError('只有需求交付登记员可以发起需求交付单', 'permission_denied')

    ticket = ticket_service.create_ticket(user, data.dict())
    return ticket_service.get_ticket_detail(ticket.id)


@router.put('/{ticket_id}/action', response=TicketDetailSchema)
def action_ticket(request, ticket_id: int, data: TicketActionSchema):
    user = require_auth(request)
    ticket = Ticket.objects.get(id=ticket_id)
    result = ticket_service.execute_action(ticket, user, data.action, data.dict())
    return ticket_service.get_ticket_detail(result.id)
