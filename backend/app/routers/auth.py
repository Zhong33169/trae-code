from datetime import timedelta
from litestar import Router, post, get, Request
from litestar.exceptions import HTTPException, NotAuthorizedException
from litestar.di import Provide
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import LoginRequest, TokenResponse, UserResponse
from ..auth import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_HOURS
from ..services import update_all_bills_overdue


@post("/login")
async def login(data: LoginRequest, db: Session = Provide(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail={
                "code": 401,
                "message": "用户名或密码错误",
                "hint": "请检查账号密码，测试账号: registrar/123456, auditor/123456, property/123456"
            }
        )

    access_token_expires = timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value},
        expires_delta=access_token_expires
    )

    user_response = UserResponse(
        id=user.id,
        username=user.username,
        real_name=user.real_name,
        role=user.role,
        created_at=user.created_at
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )


@get("/me")
async def get_current_user(request: Request) -> UserResponse:
    user = request.user
    if not user:
        raise NotAuthorizedException("未登录")
    return UserResponse(
        id=user.id,
        username=user.username,
        real_name=user.real_name,
        role=user.role,
        created_at=user.created_at
    )


@get("/health")
async def health_check() -> dict:
    return {"status": "ok", "service": "energy-bill-backend", "port": 8002}


@post("/refresh-overdue")
async def refresh_overdue(request: Request, db: Session = Provide(get_db)) -> dict:
    count = update_all_bills_overdue(db)
    return {
        "success": True,
        "message": f"更新了 {count} 条账单的超时状态",
        "updated_count": count
    }


auth_router = Router(
    path="/api",
    route_handlers=[login, get_current_user, health_check, refresh_overdue]
)
