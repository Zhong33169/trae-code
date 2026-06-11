from ninja import NinjaAPI
from app.models import User
from app.services.validation_service import ValidationError
import secrets

api = NinjaAPI(
    title='软件外包项目组风险分级处置需求交付单系统',
    version='1.0.0',
    description='需求交付单全生命周期管理系统',
)


def get_user_from_request(request):
    token = request.headers.get('X-Token') or request.GET.get('token')
    if not token:
        return None
    try:
        return User.objects.get(token=token)
    except User.DoesNotExist:
        return None


@api.exception_handler(ValidationError)
def validation_error_handler(request, exc):
    return api.create_response(
        request,
        {'code': exc.code, 'message': exc.message, 'detail': str(exc)},
        status=400,
    )


@api.exception_handler(User.DoesNotExist)
def user_not_found_handler(request, exc):
    return api.create_response(
        request,
        {'code': 'not_found', 'message': '用户不存在'},
        status=404,
    )


from app.api.auth import router as auth_router
from app.api.tickets import router as tickets_router
from app.api.stats import router as stats_router
from app.api.logs import router as logs_router

api.add_router('/auth', auth_router)
api.add_router('/tickets', tickets_router)
api.add_router('/stats', stats_router)
api.add_router('/logs', logs_router)
