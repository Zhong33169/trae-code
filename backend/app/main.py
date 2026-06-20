from __future__ import annotations

import os
from dotenv import load_dotenv

from litestar import Litestar, get
from litestar.config.cors import CORSConfig
from litestar.openapi import OpenAPIConfig
from litestar.openapi.spec import Server

from .config import settings
from .database import init_db
from .routes.inspection_routes import inspection_router

load_dotenv()


@get("/health", tags=["System"])
async def health_check() -> dict:
    return {"status": "ok", "message": "器械巡检系统运行正常"}


@get("/api/health", tags=["System"])
async def api_health_check() -> dict:
    return {"status": "ok", "service": "inspection-api", "version": "1.0.0"}


cors_config = CORSConfig(
    allow_origins=[
        f"http://localhost:{settings.frontend_port}",
        f"http://127.0.0.1:{settings.frontend_port}",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
    ],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=True,
)

openapi_config = OpenAPIConfig(
    title="器械巡检系统 API",
    version="1.0.0",
    description="社区健身房器械巡检管理系统 API 文档",
    path="/docs",
    servers=[Server(url=f"http://localhost:{settings.backend_port}")],
)


def create_app() -> Litestar:
    init_db()

    app = Litestar(
        route_handlers=[health_check, api_health_check, inspection_router],
        cors_config=cors_config,
        openapi_config=openapi_config,
        debug=True,
    )
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=True,
    )
