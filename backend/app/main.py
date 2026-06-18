from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route
from .config import CORS_ORIGINS
from .database import engine, Base
from .routes import auth, rectification, quality, statistics, logs

Base.metadata.create_all(bind=engine)

app = Starlette(
    routes=[
        Route("/health", lambda r: JSONResponse({"status": "ok"})),
        Mount("/api/auth", app=auth.app),
        Mount("/api/rectification", app=rectification.app),
        Mount("/api/quality", app=quality.app),
        Mount("/api/statistics", app=statistics.app),
        Mount("/api/logs", app=logs.app),
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def exception_handler(request, exc):
    return JSONResponse(
        {"detail": str(exc), "code": getattr(exc, "status_code", 500)},
        status_code=getattr(exc, "status_code", 500),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
