from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from datetime import datetime

from ..database import get_db
from ..models import AuditLog, MeetingReservation, BlockLog
from ..schemas import AuditLogOut, BlockLogOut


async def list_audit_logs(request: Request):
    db = next(get_db())
    reservation_id = request.query_params.get("reservation_id")
    batch_no = request.query_params.get("batch_no")
    action = request.query_params.get("action")
    operator = request.query_params.get("operator")

    query = db.query(AuditLog)
    if reservation_id:
        query = query.filter(AuditLog.reservation_id == int(reservation_id))
    if batch_no:
        query = query.filter(AuditLog.batch_no == batch_no)
    if action and action != "all":
        query = query.filter(AuditLog.action == action)
    if operator:
        query = query.filter(AuditLog.operator.like(f"%{operator}%"))

    logs = query.order_by(AuditLog.created_at.desc()).all()
    result = [AuditLogOut.model_validate(log).model_dump(mode='json') for log in logs]

    for item in result:
        if item["reservation_id"]:
            reservation = db.query(MeetingReservation).filter(
                MeetingReservation.id == item["reservation_id"]
            ).first()
            if reservation:
                item["reservation_no"] = reservation.reservation_no
                item["reservation_title"] = reservation.title

    return JSONResponse({"items": result})


async def list_block_logs(request: Request):
    db = next(get_db())
    reservation_id = request.query_params.get("reservation_id")
    batch_no = request.query_params.get("batch_no")
    block_type = request.query_params.get("block_type")
    operator = request.query_params.get("operator")

    query = db.query(BlockLog)
    if reservation_id:
        query = query.filter(BlockLog.reservation_id == int(reservation_id))
    if batch_no:
        query = query.filter(BlockLog.batch_no == batch_no)
    if block_type and block_type != "all":
        query = query.filter(BlockLog.block_type == block_type)
    if operator:
        query = query.filter(BlockLog.operator.like(f"%{operator}%"))

    logs = query.order_by(BlockLog.created_at.desc()).all()
    result = [BlockLogOut.model_validate(log).model_dump(mode='json') for log in logs]

    for item in result:
        if item["reservation_id"]:
            reservation = db.query(MeetingReservation).filter(
                MeetingReservation.id == item["reservation_id"]
            ).first()
            if reservation:
                item["reservation_no"] = reservation.reservation_no
                item["reservation_title"] = reservation.title

    return JSONResponse({"items": result})


async def get_failure_audits(request: Request):
    db = next(get_db())

    batch_no = request.query_params.get("batch_no")
    reservation_id = request.query_params.get("reservation_id")

    query = db.query(AuditLog).filter(
        AuditLog.action.in_(["return", "review_return", "reject", "create_block", "submit_fail"])
    )

    if batch_no:
        query = query.filter(AuditLog.batch_no == batch_no)
    if reservation_id:
        query = query.filter(AuditLog.reservation_id == int(reservation_id))

    query = query.order_by(AuditLog.created_at.desc())

    page = int(request.query_params.get("page", 1))
    page_size = int(request.query_params.get("page_size", 50))
    total = query.count()
    logs = query.offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for log in logs:
        log_dict = AuditLogOut.model_validate(log).model_dump(mode='json')
        reservation = db.query(MeetingReservation).filter(
            MeetingReservation.id == log.reservation_id
        ).first()
        if reservation:
            log_dict["reservation_no"] = reservation.reservation_no
            log_dict["reservation_title"] = reservation.title
            log_dict["current_status"] = reservation.status
        result.append(log_dict)

    return JSONResponse({"total": total, "items": result, "page": page, "page_size": page_size})


async def trace_reservation(request: Request):
    rid = int(request.path_params.get("id"))
    db = next(get_db())

    reservation = db.query(MeetingReservation).filter(MeetingReservation.id == rid).first()
    if not reservation:
        return JSONResponse({"detail": "预约单不存在"}, status_code=404)

    audit_logs = db.query(AuditLog).filter(
        (AuditLog.reservation_id == rid) | (AuditLog.batch_no == reservation.batch_no)
    ).order_by(AuditLog.created_at.asc()).all()

    block_logs = db.query(BlockLog).filter(
        (BlockLog.reservation_id == rid) | (BlockLog.batch_no == reservation.batch_no)
    ).order_by(BlockLog.created_at.asc()).all()

    audit_result = [AuditLogOut.model_validate(log).model_dump(mode='json') for log in audit_logs]
    block_result = [BlockLogOut.model_validate(log).model_dump(mode='json') for log in block_logs]

    timeline = []
    for log in audit_logs:
        timeline.append({
            "type": "audit",
            "time": log.created_at.isoformat() if log.created_at else None,
            "operator": log.operator,
            "operator_role": log.operator_role,
            "action": log.action,
            "status_from": log.status_from,
            "status_to": log.status_to,
            "remark": log.remark,
            "item_results": log.item_results,
        })
    for log in block_logs:
        timeline.append({
            "type": "block",
            "time": log.created_at.isoformat() if log.created_at else None,
            "operator": log.operator,
            "operator_role": log.operator_role,
            "block_type": log.block_type,
            "reason": log.reason,
            "detail": log.detail,
            "item_results": log.item_results,
        })

    timeline.sort(key=lambda x: x["time"] or "")

    return JSONResponse({
        "reservation_no": reservation.reservation_no,
        "batch_no": reservation.batch_no,
        "current_status": reservation.status,
        "audit_logs": audit_result,
        "block_logs": block_result,
        "timeline": timeline,
    })


async def trace_batch(request: Request):
    batch_no = request.path_params.get("batch_no")
    db = next(get_db())

    reservations = db.query(MeetingReservation).filter(
        MeetingReservation.batch_no == batch_no
    ).all()

    if not reservations:
        return JSONResponse({"detail": "批次不存在"}, status_code=404)

    audit_logs = db.query(AuditLog).filter(
        AuditLog.batch_no == batch_no
    ).order_by(AuditLog.created_at.asc()).all()

    block_logs = db.query(BlockLog).filter(
        BlockLog.batch_no == batch_no
    ).order_by(BlockLog.created_at.asc()).all()

    audit_result = [AuditLogOut.model_validate(log).model_dump(mode='json') for log in audit_logs]
    block_result = [BlockLogOut.model_validate(log).model_dump(mode='json') for log in block_logs]

    reservation_map = {r.id: r for r in reservations}
    for log in audit_result:
        if log.get("reservation_id") and log["reservation_id"] in reservation_map:
            log["reservation_no"] = reservation_map[log["reservation_id"]].reservation_no
            log["reservation_title"] = reservation_map[log["reservation_id"]].title
    for log in block_result:
        if log.get("reservation_id") and log["reservation_id"] in reservation_map:
            log["reservation_no"] = reservation_map[log["reservation_id"]].reservation_no
            log["reservation_title"] = reservation_map[log["reservation_id"]].title

    batch_statuses = set(r.status for r in reservations)

    return JSONResponse({
        "batch_no": batch_no,
        "reservation_count": len(reservations),
        "statuses": list(batch_statuses),
        "reservations": [
            {
                "id": r.id,
                "reservation_no": r.reservation_no,
                "title": r.title,
                "status": r.status,
                "exception_type": r.exception_type,
            }
            for r in reservations
        ],
        "audit_logs": audit_result,
        "block_logs": block_result,
    })


routes = [
    Route("/", list_audit_logs, methods=["GET"]),
    Route("/blocks", list_block_logs, methods=["GET"]),
    Route("/failures", get_failure_audits, methods=["GET"]),
    Route("/reservation/{id:int}", trace_reservation, methods=["GET"]),
    Route("/batch/{batch_no}", trace_batch, methods=["GET"]),
]
