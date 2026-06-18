from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from ..database import get_db
from ..models import RectificationOrder
from ..auth import get_current_user, require_roles
from ..services import (
    serialize_order, get_order_list, update_order_status,
    batch_update_status, create_order, check_overdue, get_allowed_actions
)


@require_roles(["DEPARTMENT_SECRETARY", "QUALITY_DOCTOR", "MEDICAL_DIRECTOR"])
async def list_orders(request: Request):
    user = request.state.user
    params = request.query_params
    db = next(get_db())

    status = params.get("status")
    department = params.get("department")
    is_overdue = params.get("is_overdue")
    is_overdue_bool = None
    if is_overdue is not None:
        is_overdue_bool = is_overdue.lower() == "true"

    skip = int(params.get("skip", 0))
    limit = int(params.get("limit", 50))

    result = get_order_list(
        db, user,
        status=status,
        department=department,
        is_overdue=is_overdue_bool,
        skip=skip,
        limit=limit,
    )
    return JSONResponse(result)


@require_roles(["DEPARTMENT_SECRETARY"])
async def create_order_handler(request: Request):
    user = request.state.user
    body = await request.json()
    db = next(get_db())

    required = ["patient_name", "medical_record_no"]
    for field in required:
        if not body.get(field):
            return JSONResponse(
                {"detail": f"缺少必填字段: {field}", "code": 400},
                status_code=400,
            )

    result = create_order(db, body, user)
    return JSONResponse(result, status_code=201)


@require_roles(["DEPARTMENT_SECRETARY", "QUALITY_DOCTOR", "MEDICAL_DIRECTOR"])
async def get_order(request: Request):
    user = request.state.user
    order_id = int(request.path_params["order_id"])
    db = next(get_db())

    order = db.query(RectificationOrder).filter(RectificationOrder.id == order_id).first()
    if not order:
        return JSONResponse(
            {"detail": "整改单不存在", "code": 404},
            status_code=404,
        )

    result = serialize_order(db, order, user, include_details=True)
    return JSONResponse(result)


@require_roles(["DEPARTMENT_SECRETARY", "QUALITY_DOCTOR", "MEDICAL_DIRECTOR"])
async def update_status(request: Request):
    user = request.state.user
    order_id = int(request.path_params["order_id"])
    body = await request.json()
    db = next(get_db())

    order = db.query(RectificationOrder).filter(RectificationOrder.id == order_id).first()
    if not order:
        return JSONResponse(
            {"detail": "整改单不存在", "code": 404},
            status_code=404,
        )

    action = body.get("action")
    if not action:
        return JSONResponse(
            {"detail": "缺少操作类型 action", "code": 400},
            status_code=400,
        )

    try:
        result = update_order_status(
            db, order, action, user,
            remark=body.get("remark"),
            overdue_reason=body.get("overdue_reason"),
            follow_up_action=body.get("follow_up_action"),
            extra_data=body.get("extra_data"),
        )

        db.commit()

        updated = serialize_order(db, order, user, include_details=True)
        result["order"] = updated

        return JSONResponse(result)
    except Exception as e:
        db.rollback()
        status_code = getattr(e, "status_code", 400)
        return JSONResponse(
            {"detail": str(e), "code": status_code, "success": False},
            status_code=status_code,
        )


@require_roles(["DEPARTMENT_SECRETARY", "QUALITY_DOCTOR", "MEDICAL_DIRECTOR"])
async def batch_operation(request: Request):
    user = request.state.user
    body = await request.json()
    db = next(get_db())

    order_ids = body.get("order_ids", [])
    action = body.get("action")

    if not order_ids:
        return JSONResponse(
            {"detail": "请选择要操作的整改单", "code": 400},
            status_code=400,
        )
    if not action:
        return JSONResponse(
            {"detail": "缺少操作类型 action", "code": 400},
            status_code=400,
        )

    result = batch_update_status(
        db, order_ids, action, user,
        remark=body.get("remark"),
        data=body.get("data"),
    )

    return JSONResponse(result)


@require_roles(["DEPARTMENT_SECRETARY", "QUALITY_DOCTOR", "MEDICAL_DIRECTOR"])
async def check_overdue_status(request: Request):
    user = request.state.user
    order_id = int(request.path_params["order_id"])
    db = next(get_db())

    order = db.query(RectificationOrder).filter(RectificationOrder.id == order_id).first()
    if not order:
        return JSONResponse(
            {"detail": "整改单不存在", "code": 404},
            status_code=404,
        )

    result = check_overdue(db, order)
    allowed = get_allowed_actions(db, order, user)

    return JSONResponse({
        "order_id": order_id,
        "is_overdue": result["is_overdue"],
        "remaining_hours": result.get("remaining_hours", 0),
        "current_node": result["current_node"].node_name if result["current_node"] else None,
        "current_node_cn": result["current_node"].node_name_cn if result["current_node"] else None,
        "deadline": result["current_node"].deadline.isoformat() if result["current_node"] else None,
        "allowed_actions": allowed,
    })


app = Starlette(routes=[
    Route("/", list_orders, methods=["GET"]),
    Route("/", create_order_handler, methods=["POST"]),
    Route("/batch", batch_operation, methods=["POST"]),
    Route("/{order_id:int}", get_order, methods=["GET"]),
    Route("/{order_id:int}/status", update_status, methods=["PATCH"]),
    Route("/{order_id:int}/overdue", check_overdue_status, methods=["GET"]),
])
