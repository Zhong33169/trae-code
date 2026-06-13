from datetime import datetime
from typing import Optional
from litestar import Router, get, post, Request
from litestar.params import Parameter
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole
from app.schemas import UserSchema


@get("/users")
async def list_users(
    request: Request,
    role: Optional[UserRole] = Parameter(default=None),
) -> list[UserSchema]:
    db: Session = next(get_db())
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    users = query.order_by(User.id).all()
    return [UserSchema.model_validate(u) for u in users]


@get("/users/{user_id:int}")
async def get_user(user_id: int) -> UserSchema:
    db: Session = next(get_db())
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=404, detail="用户不存在")
    return UserSchema.model_validate(user)


@post("/auth/login")
async def login(data: dict) -> dict:
    db: Session = next(get_db())
    username = data.get("username")
    if not username:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=400, detail="请提供用户名")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=404, detail="用户不存在")
    return {
        "token": f"mock_token_{user.id}_{int(datetime.utcnow().timestamp())}",
        "user": UserSchema.model_validate(user).model_dump(),
    }


auth_router = Router(path="/api", route_handlers=[list_users, get_user, login])
