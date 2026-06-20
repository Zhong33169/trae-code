from __future__ import annotations

from typing import Optional, Generator

from sqlalchemy.orm import Session
from litestar.di import Provide

from .database import SessionLocal
from .models import User, UserRole
from .services.inspection_service import get_user


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session,
    user_id: Optional[int] = None,
) -> Optional[User]:
    if user_id:
        return get_user(db, user_id)
    return None


def require_role(required_role: UserRole):
    def _require_role(
        db: Session,
        current_user: Optional[User] = None,
    ) -> Optional[User]:
        if not current_user:
            return None
        if current_user.role != required_role:
            return None
        return current_user
    return _require_role


def provide_current_user(user_id: int = 1):
    def _provide_current_user(db: Session) -> Optional[User]:
        return get_user(db, user_id)
    return _provide_current_user


DEPENDENCIES = {
    "db": Provide(get_db),
}
