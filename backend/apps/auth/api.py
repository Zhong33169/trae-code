from ninja import Router
from django.http import HttpResponse
from django.contrib.auth.hashers import check_password

from .models import User
from .schemas import LoginRequest, LoginResponse, UserInfo

router = Router()


def get_user_from_token(request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        user_id = int(auth_header.split("Bearer ")[1])
        return User.objects.get(id=user_id, is_active=True)
    except (User.DoesNotExist, ValueError):
        return None


@router.post("/login", response=LoginResponse)
def login(request, payload: LoginRequest):
    try:
        user = User.objects.get(username=payload.username, is_active=True)
    except User.DoesNotExist:
        return HttpResponse("用户名或密码错误", status=401)

    if not check_password(payload.password, user.password):
        return HttpResponse("用户名或密码错误", status=401)

    return LoginResponse(
        token=str(user.id),
        user=UserInfo(
            id=user.id,
            username=user.username,
            role=user.role,
            display_name=user.display_name,
            is_active=user.is_active,
        ),
    )


@router.get("/me", response=UserInfo)
def me(request):
    user = get_user_from_token(request)
    if not user:
        return HttpResponse("未授权", status=401)
    return UserInfo(
        id=user.id,
        username=user.username,
        role=user.role,
        display_name=user.display_name,
        is_active=user.is_active,
    )
