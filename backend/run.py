"""统一环境变量驱动的后端启动入口。

端口由 backend/.env 中的 BACKEND_PORT 控制（默认 8001），
CORS 允许来源则读取 FRONTEND_PORT（默认 3001）。

用法：
    cd backend
    python run.py                 # 使用 .env 中的端口
    BACKEND_PORT=8002 python run.py   # 临时覆盖端口
"""
import uvicorn

from app.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    print(f"启动后端：端口 {settings.BACKEND_PORT}，前端端口 {settings.FRONTEND_PORT}")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.BACKEND_PORT,
        reload=True,
    )
