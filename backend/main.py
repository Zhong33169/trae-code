from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import (
    auth_router, release_router, rollback_router,
    review_router, handover_router, common_router
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="软件外包项目发布管理系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(release_router)
app.include_router(rollback_router)
app.include_router(review_router)
app.include_router(handover_router)
app.include_router(common_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "服务运行正常"}
