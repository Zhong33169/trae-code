from django.contrib.auth.models import User
from django.utils.crypto import get_random_string
from apps.loan.models import Role, UserProfile


ROLE_REGISTRAR = 'registrar'
ROLE_REVIEWER = 'reviewer'
ROLE_FINAL_REVIEWER = 'final_reviewer'
ROLE_ADMIN = 'admin'

TOKEN_STORE = {}


def get_role_by_code(code: str):
    try:
        return Role.objects.get(code=code)
    except Role.DoesNotExist:
        return None


def get_user_role(user: User) -> str:
    try:
        return user.profile.role.code
    except UserProfile.DoesNotExist:
        return ''


def get_user_profile(user: User) -> dict:
    try:
        profile = user.profile
        return {
            'id': user.id,
            'username': user.username,
            'role_code': profile.role.code,
            'role_name': profile.role.name,
            'department': profile.department or '',
        }
    except UserProfile.DoesNotExist:
        return {
            'id': user.id,
            'username': user.username,
            'role_code': '',
            'role_name': '',
            'department': '',
        }


def login(username: str) -> dict:
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        raise ValueError('用户不存在')

    token = get_random_string(32)
    TOKEN_STORE[token] = user.id

    return {
        'token': token,
        'user': get_user_profile(user),
    }


def get_user_by_token(token: str):
    user_id = TOKEN_STORE.get(token)
    if not user_id:
        return None
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None


def has_role(user, role_codes):
    user_role = get_user_role(user)
    return user_role in role_codes


def require_roles(role_codes):
    def decorator(func):
        def wrapper(request, *args, **kwargs):
            user = getattr(request, 'user', None)
            if not user or not user.is_authenticated:
                from ninja import errors
                raise errors.AuthenticationError('未登录')
            if not has_role(user, role_codes):
                raise PermissionError('权限不足')
            return func(request, *args, **kwargs)
        return wrapper
    return decorator
