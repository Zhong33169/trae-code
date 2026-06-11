from ninja import Router
from app.models import User
from app.schemas import LoginSchema, LoginResponse, UserSchema
from app.api import get_user_from_request
import secrets

router = Router(tags=['认证'])


@router.post('/login', response=LoginResponse)
def login(request, data: LoginSchema):
    user = User.objects.get(username=data.username)
    if not user.verify_password(data.password):
        from app.services.validation_service import ValidationError
        raise ValidationError('密码错误')

    user.token = secrets.token_hex(32)
    user.save()

    return {
        'token': user.token,
        'user': user.to_dict(),
    }


@router.get('/me', response=UserSchema)
def get_me(request):
    user = get_user_from_request(request)
    if not user:
        from app.services.validation_service import ValidationError
        raise ValidationError('未登录或登录已过期', 'unauthorized')
    return user.to_dict()
