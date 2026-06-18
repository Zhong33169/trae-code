from typing import Optional
from sqlalchemy.orm import Session

from app.models import User, RoleEnum
from app.utils.auth import hash_password, verify_password


def create_user(db: Session, username: str, password: str, full_name: str, role: RoleEnum) -> User:
    user = User(
        username=username,
        full_name=full_name,
        role=role,
        hashed_password=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = get_user_by_username(db, username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


def list_users(db: Session, role: str = None) -> list:
    query = db.query(User).filter(User.is_active == True)
    if role:
        query = query.filter(User.role == role)
    return query.all()
