from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta
from typing import List

from database import get_db
from deps import get_current_user, allow_all_authenticated
from models.user import User, UserRole
from schemas.user import UserLogin, UserResponse, Token
from utils import create_access_token, verify_password, get_password_hash, get_role_label

router = APIRouter()


async def init_test_users(db: AsyncSession):
    test_users = [
        {
            "username": "registrar",
            "password": "123456",
            "full_name": "张登记",
            "role": UserRole.REGISTRAR,
            "station_code": "ST001"
        },
        {
            "username": "supervisor",
            "password": "123456",
            "full_name": "李审核",
            "role": UserRole.SUPERVISOR,
            "station_code": "ST001"
        },
        {
            "username": "reviewer",
            "password": "123456",
            "full_name": "王复核",
            "role": UserRole.REVIEWER,
            "station_code": "ST001"
        }
    ]

    for user_data in test_users:
        result = await db.execute(
            select(User).where(User.username == user_data["username"])
        )
        existing_user = result.scalar_one_or_none()
        if not existing_user:
            hashed_password = get_password_hash(user_data["password"])
            user = User(
                username=user_data["username"],
                full_name=user_data["full_name"],
                hashed_password=hashed_password,
                role=user_data["role"],
                station_code=user_data["station_code"]
            )
            db.add(user)

    await db.commit()


@router.post("/login", response_model=Token, summary="用户登录", description="使用用户名密码登录，返回访问令牌和用户信息")
async def login(
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    await init_test_users(db)

    result = await db.execute(
        select(User).where(User.username == login_data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )

    access_token_expires = timedelta(minutes=480)
    access_token = create_access_token(
        data={
            "sub": user.username,
            "user_id": user.id,
            "role": user.role.value
        },
        expires_delta=access_token_expires
    )

    user_response = UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        role_label=user.role_label(),
        station_code=user.station_code,
        is_active=user.is_active,
        created_at=user.created_at
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response,
        expires_in=480 * 60
    )


@router.get("/me", response_model=UserResponse, summary="获取当前用户信息", description="获取当前登录用户的详细信息")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role,
        role_label=current_user.role_label(),
        station_code=current_user.station_code,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )


@router.get("/users", response_model=List[UserResponse], summary="获取所有用户列表", description="获取系统中所有用户的列表")
async def get_all_users(
    current_user: User = Depends(allow_all_authenticated),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()

    return [
        UserResponse(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            role_label=user.role_label(),
            station_code=user.station_code,
            is_active=user.is_active,
            created_at=user.created_at
        )
        for user in users
    ]
