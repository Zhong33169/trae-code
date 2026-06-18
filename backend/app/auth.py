from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from starlette.requests import Request
from starlette.responses import JSONResponse
from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from .database import get_db
from .models import User
from sqlalchemy.orm import Session

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(request: Request) -> User:
    credentials_exception = Exception("认证失败，请重新登录")
    setattr(credentials_exception, "status_code", 401)

    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        raise credentials_exception

    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    db = next(get_db())
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user


def require_roles(allowed_roles: list):
    def decorator(func):
        async def wrapper(request: Request):
            user = await get_current_user(request)
            if user.role not in allowed_roles:
                exc = Exception("权限不足，无法执行此操作")
                setattr(exc, "status_code", 403)
                raise exc
            request.state.user = user
            return await func(request)
        return wrapper
    return decorator
