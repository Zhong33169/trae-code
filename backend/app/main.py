import os

from litestar import Litestar
from litestar.config.cors import CORSConfig

from app.database import engine
from app.models import Base
from app.controllers.appeals import AppealsController
from app.controllers.stats import StatsController
from app.controllers.users import UsersController

PORT = int(os.getenv("BACKEND_PORT", "8003"))


async def on_startup(app: Litestar) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


cors_config = CORSConfig(
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _encode_sqlalchemy_model(obj):
    return {c.key: getattr(obj, c.key) for c in obj.__table__.columns}


app = Litestar(
    route_handlers=[AppealsController, StatsController, UsersController],
    cors_config=cors_config,
    on_startup=[on_startup],
    type_encoders={Base: _encode_sqlalchemy_model},
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
