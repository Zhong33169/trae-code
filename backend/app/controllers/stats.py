from litestar import Controller, get
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import StatsResponse
from app import service


class StatsController(Controller):
    path = "/api/stats"
    dependencies = {"session": get_session}

    @get()
    async def get_stats(self, session: AsyncSession) -> StatsResponse:
        return await service.get_stats(session)
