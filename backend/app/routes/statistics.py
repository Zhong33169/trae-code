from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from ..database import get_db
from ..auth import require_roles
from ..services import get_statistics


@require_roles(["DEPARTMENT_SECRETARY", "QUALITY_DOCTOR", "MEDICAL_DIRECTOR"])
async def get_overview(request: Request):
    user = request.state.user
    db = next(get_db())

    stats = get_statistics(db, user)
    return JSONResponse(stats)


@require_roles(["QUALITY_DOCTOR", "MEDICAL_DIRECTOR"])
async def get_by_department(request: Request):
    user = request.state.user
    db = next(get_db())

    from sqlalchemy import func
    from ..models import RectificationOrder, NodeRecord

    query = db.query(RectificationOrder)
    if user.role == "DEPARTMENT_SECRETARY":
        query = query.filter(RectificationOrder.department == user.department)

    dept_stats = db.query(
        RectificationOrder.department,
        RectificationOrder.status,
        func.count(RectificationOrder.id)
    ).group_by(RectificationOrder.department, RectificationOrder.status).all()

    result = {}
    for dept, status, count in dept_stats:
        if dept not in result:
            result[dept] = {}
        result[dept][status] = count
        result[dept]["total"] = result[dept].get("total", 0) + count

    return JSONResponse(result)


@require_roles(["QUALITY_DOCTOR", "MEDICAL_DIRECTOR"])
async def get_overdue_report(request: Request):
    user = request.state.user
    db = next(get_db())

    from ..models import RectificationOrder, NodeRecord, User
    from ..config import STATUS, NODE_NAMES_CN

    overdue_nodes = db.query(NodeRecord).filter(
        NodeRecord.is_overdue == True,
        NodeRecord.status == "IN_PROGRESS"
    ).all()

    result = []
    for node in overdue_nodes:
        order = db.query(RectificationOrder).filter(RectificationOrder.id == node.order_id).first()
        if not order:
            continue

        if user.role == "DEPARTMENT_SECRETARY" and order.department != user.department:
            continue

        handler = db.query(User).filter(User.id == node.handler_id).first() if node.handler_id else None

        result.append({
            "order_id": order.id,
            "order_no": order.order_no,
            "patient_name": order.patient_name,
            "department": order.department,
            "status": order.status,
            "status_cn": STATUS.get(order.status, order.status),
            "overdue_node": node.node_name,
            "overdue_node_cn": NODE_NAMES_CN.get(node.node_name, node.node_name),
            "deadline": node.deadline.isoformat() if node.deadline else None,
            "overdue_reason": node.overdue_reason,
            "follow_up_action": node.follow_up_action,
            "handler_name": handler.name if handler else None,
        })

    return JSONResponse({
        "total": len(result),
        "items": result,
    })


app = Starlette(routes=[
    Route("/overview", get_overview, methods=["GET"]),
    Route("/by-department", get_by_department, methods=["GET"]),
    Route("/overdue-report", get_overdue_report, methods=["GET"]),
])
