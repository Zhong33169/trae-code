from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from datetime import timedelta
from ..database import get_db
from ..models import User
from ..config import ACCESS_TOKEN_EXPIRE_MINUTES, ROLES
from ..auth import verify_password, create_access_token, get_current_user
from ..services import init_database


async def login(request: Request):
    body = await request.json()
    username = body.get("username")
    password = body.get("password")

    if not username or not password:
        return JSONResponse(
            {"detail": "用户名和密码不能为空", "code": 400},
            status_code=400,
        )

    db = next(get_db())
    user = db.query(User).filter(User.username == username).first()

    if not user or not verify_password(password, user.hashed_password):
        return JSONResponse(
            {"detail": "用户名或密码错误", "code": 401},
            status_code=401,
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires,
    )

    return JSONResponse({
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "name": user.name,
            "role": user.role,
            "role_cn": ROLES.get(user.role, user.role),
            "department": user.department,
        },
    })


async def get_me(request: Request):
    user = await get_current_user(request)
    return JSONResponse({
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "role": user.role,
        "role_cn": ROLES.get(user.role, user.role),
        "department": user.department,
    })


async def init_db(request: Request):
    db = next(get_db())
    init_database(db)
    return JSONResponse({"message": "数据库初始化完成，已创建测试用户和样例数据"})


app = Starlette(routes=[
    Route("/login", login, methods=["POST"]),
    Route("/me", get_me, methods=["GET"]),
    Route("/init", init_db, methods=["POST"]),
])
