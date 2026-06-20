from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from litestar import Request
from litestar.exceptions import HTTPException, NotAuthorizedException
from litestar.security.jwt import JWTAuth, Token

from .models import User, Role
from .database import get_db

SECRET_KEY = "energy-bill-secret-key-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_user_from_token(token: str) -> Optional[User]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None

    db = next(get_db())
    user = db.query(User).filter(User.username == username).first()
    db.close()
    return user


async def retrieve_user_handler(token: Token, connection) -> Optional[User]:
    return get_user_from_token(token.token)


jwt_auth = JWTAuth[User](
    retrieve_user_handler=retrieve_user_handler,
    token_secret=SECRET_KEY,
    algorithm=ALGORITHM,
    exclude=["/schema", "/login", "/health"],
)


def require_roles(allowed_roles: list):
    def decorator(handler):
        async def wrapper(request: Request, *args, **kwargs):
            user = request.user
            if not user:
                raise NotAuthorizedException("未登录")
            if user.role not in allowed_roles:
                raise HTTPException(status_code=403, detail=f"无权限操作，需要角色: {[r.value for r in allowed_roles]}")
            return await handler(request, *args, **kwargs)
        wrapper.__name__ = handler.__name__
        return wrapper
    return decorator


class RoleRequired:
    def __init__(self, roles: list):
        self.allowed_roles = roles

    def __call__(self, request: Request, *args, **kwargs):
        user = request.user
        if not user:
            raise NotAuthorizedException("未登录")
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": 403,
                    "message": f"无权限操作",
                    "required_roles": [r.value for r in self.allowed_roles],
                    "current_role": user.role.value
                }
            )
