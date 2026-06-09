from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware

from .config import FRONTEND_ORIGIN
from .routes import routes


def create_app():
    app = Starlette(routes=routes)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[FRONTEND_ORIGIN],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    return app


app = create_app()
