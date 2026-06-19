from litestar import Controller, get
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import User
from app import service


class UsersController(Controller):
    path = "/api/users"
    dependencies = {"session": get_session}

    @get()
    async def get_users(self, session: AsyncSession) -> list[User]:
        return await service.get_users(session)
