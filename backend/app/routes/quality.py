from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from datetime import datetime
from ..database import get_db
from ..models import QualityControl, RectificationNotice, ReviewArchive, RectificationOrder
from ..auth import require_roles
from ..services import update_order_status, serialize_order


@require_roles(["QUALITY_DOCTOR"])
async def create_quality_control(request: Request):
    user = request.state.user
    order_id = int(request.path_params["order_id"])
    body = await request.json()
    db = next(get_db())

    order = db.query(RectificationOrder).filter(RectificationOrder.id == order_id).first()
    if not order:
        return JSONResponse({"detail": "整改单不存在", "code": 404}, status_code=404)

    qc = QualityControl(
        order_id=order_id,
        quality_doctor_id=user.id,
        problems_found=body.get("problems_found", ""),
        quality_score=body.get("quality_score"),
        check_result=body.get("check_result", "PENDING"),
    )
    db.add(qc)
    db.flush()

    order.quality_control = qc
    db.commit()

    return JSONResponse({
        "id": qc.id,
        "order_id": order_id,
        "status": "success",
        "message": "质控记录已创建",
    })


@require_roles(["QUALITY_DOCTOR"])
async def submit_quality_control(request: Request):
    user = request.state.user
    order_id = int(request.path_params["order_id"])
    body = await request.json()
    db = next(get_db())

    order = db.query(RectificationOrder).filter(RectificationOrder.id == order_id).first()
    if not order:
        return JSONResponse({"detail": "整改单不存在", "code": 404}, status_code=404)

    action = "APPROVE_QUALITY" if body.get("check_result") == "PASS" else "REJECT"

    result = update_order_status(
        db, order, action, user,
        remark=body.get("remark"),
        extra_data={"quality_data": body},
    )

    db.commit()
    db.refresh(order)

    updated = serialize_order(db, order, user, include_details=True)
    result["order"] = updated
    result["quality_control_id"] = order.quality_control.id if order.quality_control else None

    return JSONResponse(result)


@require_roles(["QUALITY_DOCTOR"])
async def send_notice(request: Request):
    user = request.state.user
    order_id = int(request.path_params["order_id"])
    body = await request.json()
    db = next(get_db())

    order = db.query(RectificationOrder).filter(RectificationOrder.id == order_id).first()
    if not order:
        return JSONResponse({"detail": "整改单不存在", "code": 404}, status_code=404)

    result = update_order_status(
        db, order, "SEND_NOTICE", user,
        remark=body.get("remark"),
        extra_data={"notice_data": body},
    )

    db.commit()
    db.refresh(order)

    updated = serialize_order(db, order, user, include_details=True)
    result["order"] = updated
    result["notice_id"] = order.rectification_notice.id if order.rectification_notice else None

    return JSONResponse(result)


@require_roles(["QUALITY_DOCTOR"])
async def review_archive(request: Request):
    user = request.state.user
    order_id = int(request.path_params["order_id"])
    body = await request.json()
    db = next(get_db())

    order = db.query(RectificationOrder).filter(RectificationOrder.id == order_id).first()
    if not order:
        return JSONResponse({"detail": "整改单不存在", "code": 404}, status_code=404)

    action = "APPROVE_ARCHIVE" if body.get("review_result") == "PASS" else "REJECT_RECTIFICATION"

    result = update_order_status(
        db, order, action, user,
        remark=body.get("remark"),
        extra_data={"review_data": body},
    )

    db.commit()
    db.refresh(order)

    updated = serialize_order(db, order, user, include_details=True)
    result["order"] = updated
    result["review_archive_id"] = order.review_archive.id if order.review_archive else None

    return JSONResponse(result)


@require_roles(["QUALITY_DOCTOR", "DEPARTMENT_SECRETARY", "MEDICAL_DIRECTOR"])
async def get_linked_entities(request: Request):
    user = request.state.user
    order_id = int(request.path_params["order_id"])
    db = next(get_db())

    order = db.query(RectificationOrder).filter(RectificationOrder.id == order_id).first()
    if not order:
        return JSONResponse({"detail": "整改单不存在", "code": 404}, status_code=404)

    result = {}

    if order.quality_control:
        qc = order.quality_control
        result["quality_control"] = {
            "id": qc.id,
            "problems_found": qc.problems_found,
            "quality_score": qc.quality_score,
            "check_result": qc.check_result,
            "checked_at": qc.checked_at,
            "status": qc.status,
        }

    if order.rectification_notice:
        notice = order.rectification_notice
        result["rectification_notice"] = {
            "id": notice.id,
            "notice_title": notice.notice_title,
            "notice_content": notice.notice_content,
            "deadline": notice.deadline,
            "sent_at": notice.sent_at,
            "recipient_department": notice.recipient_department,
            "status": notice.status,
        }

    if order.review_archive:
        ra = order.review_archive
        result["review_archive"] = {
            "id": ra.id,
            "review_opinion": ra.review_opinion,
            "review_result": ra.review_result,
            "archived_at": ra.archived_at,
            "archive_location": ra.archive_location,
            "status": ra.status,
        }

    return JSONResponse(result)


app = Starlette(routes=[
    Route("/{order_id:int}/quality", create_quality_control, methods=["POST"]),
    Route("/{order_id:int}/quality/submit", submit_quality_control, methods=["POST"]),
    Route("/{order_id:int}/notice", send_notice, methods=["POST"]),
    Route("/{order_id:int}/review", review_archive, methods=["POST"]),
    Route("/{order_id:int}/linked", get_linked_entities, methods=["GET"]),
])
