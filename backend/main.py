from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from config import settings
from database import init_db
from init_data import init_demo_data
from routers import auth, inspection, qr_scan, batch, audit, charging_pile


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await init_demo_data()
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(charging_pile.router, prefix="/api/charging-piles", tags=["充电桩"])
app.include_router(inspection.router, prefix="/api/inspections", tags=["巡检单"])
app.include_router(qr_scan.router, prefix="/api/qr-scan", tags=["扫码核验"])
app.include_router(batch.router, prefix="/api/batch", tags=["批量处理"])
app.include_router(audit.router, prefix="/api/audit", tags=["审计日志"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "app": settings.APP_NAME}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
