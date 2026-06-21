from jose import jwt, JWTError
from starlette.requests import Request
from starlette.responses import JSONResponse
from .config import JWT_SECRET, JWT_ALGORITHM, ROLE_LABELS

def create_token(user_id: int, username: str, role: str, name: str = "") -> str:
    payload = {"sub": str(user_id), "username": username, "role": role, "name": name}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    payload = decode_token(token)
    if not payload:
        return None
    return {
        "id": int(payload["sub"]),
        "username": payload["username"],
        "role": payload["role"],
        "name": payload.get("name", ""),
    }

async def require_auth(request: Request):
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "未登录或登录已过期"}, status_code=401)
    return user

async def require_role(request: Request, *roles):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    if user["role"] not in roles:
        return JSONResponse(
            {"error": f"越权操作：当前角色为{ROLE_LABELS.get(user['role'], user['role'])}，无权执行此操作"},
            status_code=403,
        )
    return user
