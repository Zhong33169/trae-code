from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.exceptions import HTTPException
import traceback

from app.config import FRONTEND_ORIGIN
from app.routes import routes
from app.database import init_db
import app.seed_data as seed_data

app = Starlette(debug=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:3002", "http://127.0.0.1:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for route in routes:
    app.routes.append(route)

@app.on_event("startup")
async def startup():
    await init_db()
    await seed_data.seed_all()

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        {"detail": exc.detail},
        status_code=exc.status_code
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    traceback.print_exc()
    return JSONResponse(
        {"detail": str(exc)},
        status_code=500
    )

@app.route("/api/health")
async def health(request):
    return JSONResponse({"status": "ok", "message": "K12培训课程服务单系统运行中"})
