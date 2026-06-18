from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp

from app.utils.auth import decode_token
from app.models import RoleEnum


PUBLIC_PATHS = ["/api/auth/login", "/api/health", "/docs", "/openapi.json"]


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(path.startswith(p) for p in PUBLIC_PATHS):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "未提供认证令牌"})

        token = auth_header[7:]
        payload = decode_token(token)
        if not payload:
            return JSONResponse(status_code=401, content={"detail": "令牌无效或已过期"})

        request.state.user_id = payload["user_id"]
        request.state.user_role = payload["role"]

        return await call_next(request)


def require_roles(allowed_roles: list):
    def decorator(func):
        async def wrapper(request: Request, *args, **kwargs):
            user_role = request.state.user_role
            if user_role not in [r.value if hasattr(r, 'value') else r for r in allowed_roles]:
                return JSONResponse(status_code=403, content={"detail": "权限不足"})
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator
