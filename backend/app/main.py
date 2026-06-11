from litestar import Litestar
from litestar.config.cors import CORSConfig
from litestar.openapi import OpenAPIConfig
from app.routers.api import AuthController, OrderController, BatchController, AuditController
from app.services.seed_service import reset_and_seed


cors_config = CORSConfig(
    allow_origins=["http://localhost:3003"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    allow_credentials=True,
)


reset_and_seed()


app = Litestar(
    route_handlers=[AuthController, OrderController, BatchController, AuditController],
    cors_config=cors_config,
    openapi_config=OpenAPIConfig(
        title="运输订单管理系统 API",
        version="1.0.0",
        description="货运物流公司批量变更复核运输订单系统",
    ),
)
