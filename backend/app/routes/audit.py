from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..database import get_db
from ..models import AuditLog, MeetingReservation
from ..schemas import AuditLogOut


async def list_audit_logs(request: Request):
    db = next(get_db())
    reservation_id = request.query_params.get("reservation_id")

    query = db.query(AuditLog)
    if reservation_id:
        query = query.filter(AuditLog.reservation_id == int(reservation_id))

    logs = query.order_by(AuditLog.created_at.desc()).all()
    result = [AuditLogOut.model_validate(log).model_dump(mode='json') for log in logs]
    return JSONResponse({"items": result})


async def get_failure_audits(request: Request):
    db = next(get_db())
    query = db.query(AuditLog).filter(
        AuditLog.action.in_(["return", "review_return", "reject"])
    ).order_by(AuditLog.created_at.desc())

    page = int(request.query_params.get("page", 1))
    page_size = int(request.query_params.get("page_size", 20))
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


routes = [
    Route("/", list_audit_logs, methods=["GET"]),
    Route("/failures", get_failure_audits, methods=["GET"]),
]
