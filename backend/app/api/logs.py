from ninja import Router
from app.schemas import LogListResponse
from app.services import ticket_service
from app.services.validation_service import ValidationError
from app.api import get_user_from_request

router = Router(tags=['操作记录'])


def require_auth(request):
    user = get_user_from_request(request)
    if not user:
        raise ValidationError('未登录或登录已过期', 'unauthorized')
    return user


@router.get('', response=LogListResponse)
def list_logs(
    request,
    ticket_id: int = None,
    action: str = None,
    operator_id: int = None,
    page: int = 1,
    page_size: int = 50,
):
    user = require_auth(request)
    filters = {
        'ticket_id': ticket_id,
        'action': action,
        'operator_id': operator_id,
    }
    return ticket_service.get_log_list(filters, page, page_size, user)
