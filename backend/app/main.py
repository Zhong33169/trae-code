from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import Mount, Route
from starlette.responses import JSONResponse

from app.config import settings
from app.database import engine, Base
from app.middleware.auth import AuthMiddleware
from app.routers import auth, applications, statistics


async def health_check(request):
    return JSONResponse({"status": "ok", "message": "Exhibitor Application API is running"})


def create_app():
    Base.metadata.create_all(bind=engine)

    middleware = [
        Middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        ),
        Middleware(AuthMiddleware),
    ]

    routes = [
        Route("/api/health", health_check, methods=["GET"]),
        Mount("/api/auth", app=auth.router),
        Mount("/api/applications", app=applications.router),
        Mount("/api/statistics", app=statistics.router),
    ]

    app = Starlette(
        debug=settings.DEBUG,
        routes=routes,
        middleware=middleware,
    )

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.DEBUG,
    )
