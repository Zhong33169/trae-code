from litestar import Litestar
from litestar.config.cors import CORSConfig
from litestar.openapi import OpenAPIConfig

from app.auth import jwt_auth
from app.routers import auth_router, bills_router, meter_router, payment_router
from app.database import get_db

cors_config = CORSConfig(
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
    max_age=3600,
)

openapi_config = OpenAPIConfig(
    title="能耗账单管理系统 API",
    version="1.0.0",
    description="""
# 能耗账单管理系统后端API

## 岗位分工
- **能耗账登记员** (registrar): 发起/补正账单、录入抄表、生成账单、登记缴费
- **能耗账审核主管** (auditor): 审核办理、通过/驳回
- **产业园物业复核负责人** (property): 复核归档、缴费核销

## 流程节点超时
- 登记节点: 24小时
- 审核节点: 48小时
- 复核节点: 24小时

## 测试账号
- registrar / 123456 (登记员)
- auditor / 123456 (审核主管)
- property / 123456 (物业负责人)
    """,
    path="/schema",
)

app = Litestar(
    route_handlers=[auth_router, bills_router, meter_router, payment_router],
    on_app_init=[jwt_auth.on_app_init],
    dependencies={"db": get_db},
    cors_config=cors_config,
    openapi_config=openapi_config,
    debug=True,
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True
    )
