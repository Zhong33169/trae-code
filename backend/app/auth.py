from typing import Optional
from litestar.connection import ASGIConnection
from litestar.exceptions import NotAuthorizedException, PermissionDeniedException
from litestar.handlers.base import BaseRouteHandler

from app.database import get_db
from app.models import User, UserRole


def _parse_user_from_token(token: str) -> Optional[int]:
    if not token or not token.startswith("mock_token_"):
        return None
    parts = token.split("_")
    if len(parts) >= 3:
        try:
            return int(parts[2])
        except (ValueError, IndexError):
            return None
    return None


def get_current_user(connection: ASGIConnection) -> User:
    db = next(get_db())
    auth_header = connection.headers.get("authorization", "")
    user_id = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        user_id = _parse_user_from_token(token)

    if not user_id:
        user_query = connection.query_params.get("user_id")
        if user_query:
            try:
                user_id = int(user_query)
            except ValueError:
                user_id = None

    if not user_id:
        raise NotAuthorizedException("未登录，请先登录")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotAuthorizedException("用户不存在或登录已失效")

    return user


def require_role(allowed_roles: list[UserRole]):
    def guard(connection: ASGIConnection, _: BaseRouteHandler) -> None:
        try:
            user = get_current_user(connection)
        except NotAuthorizedException:
            raise
        if user.role not in allowed_roles:
            raise PermissionDeniedException(
                f"当前角色【{user.role.value}】无权限执行此操作，"
                f"需要角色：{', '.join([r.value for r in allowed_roles])}"
            )
    return guard


def require_registrar(connection: ASGIConnection, handler: BaseRouteHandler) -> None:
    require_role([UserRole.REGISTRAR])(connection, handler)


def require_supervisor(connection: ASGIConnection, handler: BaseRouteHandler) -> None:
    require_role([UserRole.SUPERVISOR])(connection, handler)


def require_reviewer(connection: ASGIConnection, handler: BaseRouteHandler) -> None:
    require_role([UserRole.REVIEWER])(connection, handler)
