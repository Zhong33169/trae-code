from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from starlette.requests import Request
from starlette.exceptions import HTTPException
from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(request: Request):
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(status_code=401, detail="未提供认证令牌")
    try:
        token = token.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        name: str = payload.get("name")
        if username is None:
            raise HTTPException(status_code=401, detail="无效的认证令牌")
    except JWTError:
        raise HTTPException(status_code=401, detail="认证令牌已过期或无效")
    return {"username": username, "role": role, "name": name}

def require_role(allowed_roles):
    def decorator(func):
        async def wrapper(request: Request, *args, **kwargs):
            user = await get_current_user(request)
            if user["role"] not in allowed_roles:
                raise HTTPException(status_code=403, detail=f"权限不足，需要角色: {', '.join(allowed_roles)}")
            request.state.user = user
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator
