from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.routing import Route, Mount
from starlette.requests import Request

from .routes import reservations, users, audit, batches
from .seed import init_db


def create_app():
    init_db()

    app = Starlette(
        debug=True,
        routes=[
            Mount("/api/users", routes=users.routes),
            Mount("/api/reservations", routes=reservations.routes),
            Mount("/api/audit", routes=audit.routes),
            Mount("/api/batches", routes=batches.routes),
            Route("/api/health", health_check, methods=["GET"]),
        ],
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3008"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app


async def health_check(request: Request):
    return JSONResponse({"status": "ok", "service": "meeting-reservation-api"})


app = create_app()
