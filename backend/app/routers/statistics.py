from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Router

from app.database import get_db
from app.services.application_service import get_statistics

router = Router()


async def get_stats(request: Request):
    db = next(get_db())
    try:
        stats = get_statistics(db)
        return JSONResponse(stats)
    finally:
        db.close()


router.add_route("/", get_stats, methods=["GET"])
