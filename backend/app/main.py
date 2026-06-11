from starlette.applications import Starlette
from starlette.routing import Route, Mount
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from .config import settings
from .api.endpoints import (
    health_check,
    list_applications,
    get_application,
    get_operations,
    get_risk_logs,
    submit_operation,
    stats_overview,
    list_users,
    create_new_application,
)


async def not_found(request, exc):
    return JSONResponse(
        {"code": 404, "message": "Not Found"},
        status_code=404
    )


async def server_error(request, exc):
    return JSONResponse(
        {"code": 500, "message": "Internal Server Error"},
        status_code=500
    )


exception_handlers = {
    404: not_found,
    500: server_error,
}


routes = [
    Route("/health", health_check, methods=["GET"]),
    Route("/api/health", health_check, methods=["GET"]),
    Route("/api/applications", list_applications, methods=["GET"]),
    Route("/api/applications", create_new_application, methods=["POST"]),
    Route("/api/applications/{id:int}", get_application, methods=["GET"]),
    Route("/api/applications/{id:int}/operations", get_operations, methods=["GET"]),
    Route("/api/applications/{id:int}/risk-logs", get_risk_logs, methods=["GET"]),
    Route("/api/applications/operation", submit_operation, methods=["POST"]),
    Route("/api/statistics", stats_overview, methods=["GET"]),
    Route("/api/users", list_users, methods=["GET"]),
]


middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    )
]


app = Starlette(
    debug=True,
    routes=routes,
    middleware=middleware,
    exception_handlers=exception_handlers,
)


@app.on_event("startup")
async def startup():
    print(f"✓ {settings.APP_NAME} 后端服务启动")
    print(f"  端口: {settings.PORT}")
    print(f"  数据库: {settings.DATABASE_URL}")


@app.on_event("shutdown")
async def shutdown():
    print("✓ 后端服务已关闭")
