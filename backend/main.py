from litestar import Litestar, get
from litestar.config.cors import CORSConfig
from litestar.openapi import OpenAPIConfig
from litestar.openapi.spec import Contact

from app.config import settings
from app.routers.auth import auth_router
from app.routers.orders import orders_router
from app.routers.attachments import attachments_router


cors_config = CORSConfig(
    allow_origins=[settings.frontend_url, "http://localhost:3107"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=True,
)


@get("/api/health")
async def health_check() -> dict:
    return {
        "status": "ok",
        "app": settings.app_name,
        "backend_port": settings.backend_port,
        "frontend_url": settings.frontend_url,
    }


@get("/api/meta")
async def get_meta() -> dict:
    from app.models import OrderStatus, UserRole, AttachmentType, AuditAction
    return {
        "statuses": {s.name: s.value for s in OrderStatus},
        "roles": {r.name: r.value for r in UserRole},
        "attachment_types": {t.name: t.value for t in AttachmentType},
        "audit_actions": {a.name: a.value for a in AuditAction},
        "status_labels": {
            "draft": "草稿",
            "pending_review": "待审核",
            "materials_missing": "附件缺失待补正",
            "resubmitted": "补正后重提",
            "approved_review": "审核通过待复核",
            "rejected": "已驳回",
            "reviewed": "复核通过待归档",
            "archived": "已归档",
        },
        "role_labels": {
            "registrar": "会员入会登记员",
            "supervisor": "会员入会审核主管",
            "reviewer": "社区健身房复核负责人",
        },
        "attachment_labels": {
            "id_card": "身份证复印件",
            "photo": "一寸免冠照片",
            "health_cert": "健康证明",
            "contract": "入会合同",
            "other": "其他材料",
        },
    }


app = Litestar(
    route_handlers=[health_check, get_meta, auth_router, orders_router, attachments_router],
    cors_config=cors_config,
    openapi_config=OpenAPIConfig(
        title=settings.app_name,
        version="1.0.0",
        description="社区健身房-附件缺失补正会员入会单系统 API",
        contact=Contact(name="系统管理员"),
    ),
)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=True,
    )
