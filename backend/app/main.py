from __future__ import annotations

import os
from typing import Any

from litestar import Litestar, get
from litestar.config.cors import CORSConfig
from litestar.status_codes import HTTP_500_INTERNAL_SERVER_ERROR
from litestar.exceptions import HTTPException, ValidationException
from litestar.response import Response

from .config import settings
from .controllers import ContractController
from .store import seed_demo_data


def plain_text_exception_handler(request: Any, exc: Exception) -> Response:
    status_code = HTTP_500_INTERNAL_SERVER_ERROR
    detail = str(exc)
    if isinstance(exc, HTTPException):
        status_code = exc.status_code
        detail = exc.detail
    elif isinstance(exc, ValidationException):
        status_code = 400
        detail = str(exc)
    return Response(
        content={"error": detail, "detail": detail},
        status_code=status_code,
    )


@get("/api/health")
async def health_check() -> dict:
    return {"status": "ok", "app": settings.app_name}


@get("/api/roles")
async def list_roles() -> dict:
    return {
        "data": [
            {"value": "registrar", "label": "售电合同登记员"},
            {"value": "auditor", "label": "售电合同审核主管"},
            {"value": "reviewer", "label": "售电公司复核负责人"},
        ]
    }


cors_origins_env = os.environ.get("CORS_ORIGINS", "")
if cors_origins_env:
    cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
else:
    cors_origins = settings.get_cors_origins_list()

cors_config = CORSConfig(
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=True,
)


def create_app() -> Litestar:
    seed_demo_data()
    return Litestar(
        route_handlers=[health_check, list_roles, ContractController],
        cors_config=cors_config,
        exception_handlers={
            HTTPException: plain_text_exception_handler,
            ValidationException: plain_text_exception_handler,
            Exception: plain_text_exception_handler,
        },
    )


app = create_app()
