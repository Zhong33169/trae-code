from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from ..database import get_db
from ..auth import require_roles
from ..services import get_operation_logs


@require_roles(["DEPARTMENT_SECRETARY", "QUALITY_DOCTOR", "MEDICAL_DIRECTOR"])
async def get_logs(request: Request):
    user = request.state.user
    params = request.query_params
    db = next(get_db())

    order_id = params.get("order_id")
    order_id_int = int(order_id) if order_id else None

    skip = int(params.get("skip", 0))
    limit = int(params.get("limit", 100))

    result = get_operation_logs(db, order_id=order_id_int, user=user, skip=skip, limit=limit)
    return JSONResponse(result)


@require_roles(["DEPARTMENT_SECRETARY", "QUALITY_DOCTOR", "MEDICAL_DIRECTOR"])
async def get_order_logs(request: Request):
    user = request.state.user
    order_id = int(request.path_params["order_id"])
    params = request.query_params
    db = next(get_db())

    skip = int(params.get("skip", 0))
    limit = int(params.get("limit", 100))

    result = get_operation_logs(db, order_id=order_id, user=user, skip=skip, limit=limit)
    return JSONResponse(result)


app = Starlette(routes=[
    Route("/", get_logs, methods=["GET"]),
    Route("/order/{order_id:int}", get_order_logs, methods=["GET"]),
])
