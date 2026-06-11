from ninja import Router
from app.schemas import DashboardStatsSchema
from app.services import ticket_service
from app.services.validation_service import ValidationError
from app.api import get_user_from_request

router = Router(tags=['统计'])


def require_auth(request):
    user = get_user_from_request(request)
    if not user:
        raise ValidationError('未登录或登录已过期', 'unauthorized')
    return user


@router.get('/dashboard', response=DashboardStatsSchema)
def dashboard_stats(request):
    user = require_auth(request)
    return ticket_service.get_dashboard_stats(user)
