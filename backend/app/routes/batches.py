from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from datetime import datetime

from ..database import get_db
from ..models import BatchRecord, MeetingReservation


async def list_batches(request: Request):
    db = next(get_db())
    batches = db.query(BatchRecord).order_by(BatchRecord.created_at.desc()).all()
    result = []
    for b in batches:
        reservations = db.query(MeetingReservation).filter(
            MeetingReservation.batch_no == b.batch_no
        ).all()

        statuses = set(r.status for r in reservations)
        has_mismatch = len(statuses) > 1

        result.append({
            "id": b.id,
            "batch_no": b.batch_no,
            "total_count": b.total_count,
            "processed_count": b.processed_count,
            "status": b.status,
            "created_by": b.created_by,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "remark": b.remark,
            "reservation_count": len(reservations),
            "status_mismatch": has_mismatch,
            "statuses": list(statuses),
            "mismatch_warning": "该批次内会议预约单状态不一致，请核对线下台账后再继续处理。" if has_mismatch else None,
        })
    return JSONResponse({"items": result})


async def check_batch(request: Request):
    batch_no = request.query_params.get("batch_no", "")
    db = next(get_db())

    if not batch_no:
        return JSONResponse({"detail": "批次号不能为空"}, status_code=400)

    existing = db.query(BatchRecord).filter(BatchRecord.batch_no == batch_no).first()
    reservations = db.query(MeetingReservation).filter(
        MeetingReservation.batch_no == batch_no
    ).all()

    is_duplicate = existing is not None

    statuses = set(r.status for r in reservations)
    has_status_mismatch = len(statuses) > 1

    message = "批次号可用，可以继续录入"
    if is_duplicate:
        message = f"批次号 {batch_no} 已存在，当前有 {len(reservations)} 条预约单。线下台账批次号与线上数据重复，请确认是否为同一批数据。"
    if has_status_mismatch:
        message += f" 批次内状态不一致（{', '.join(statuses)}），请逐单核对线下台账状态。"

    mismatch_details = []
    if has_status_mismatch:
        for r in reservations:
            mismatch_details.append({
                "reservation_no": r.reservation_no,
                "title": r.title,
                "status": r.status,
                "suggestion": "请核对线下台账对应条目状态是否一致",
            })

    return JSONResponse({
        "batch_no": batch_no,
        "is_duplicate": is_duplicate,
        "is_status_mismatch": has_status_mismatch,
        "message": message,
        "existing_count": len(reservations),
        "statuses": list(statuses),
        "mismatch_details": mismatch_details,
    })


async def get_batch_reservations(request: Request):
    batch_no = request.path_params.get("batch_no")
    db = next(get_db())

    reservations = db.query(MeetingReservation).filter(
        MeetingReservation.batch_no == batch_no
    ).order_by(MeetingReservation.created_at.desc()).all()

    batch = db.query(BatchRecord).filter(BatchRecord.batch_no == batch_no).first()

    statuses = set(r.status for r in reservations)
    has_mismatch = len(statuses) > 1

    result = [
        {
            "id": r.id,
            "reservation_no": r.reservation_no,
            "title": r.title,
            "meeting_room": r.meeting_room,
            "meeting_date": r.meeting_date,
            "status": r.status,
            "exception_type": r.exception_type,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reservations
    ]

    return JSONResponse({
        "batch_no": batch_no,
        "batch_status": batch.status if batch else "unknown",
        "total": len(reservations),
        "status_mismatch": has_mismatch,
        "statuses": list(statuses),
        "warning": "批次内状态不一致，请逐单核对线下台账后再处理。" if has_mismatch else None,
        "items": result,
    })


async def batch_status_check(request: Request):
    body = await request.json()
    batch_no = body.get("batch_no", "")
    offline_count = body.get("offline_count", 0)
    offline_statuses = body.get("offline_statuses", [])

    db = next(get_db())

    reservations = db.query(MeetingReservation).filter(
        MeetingReservation.batch_no == batch_no
    ).all()

    issues = []

    if offline_count != len(reservations):
        issues.append({
            "type": "count_mismatch",
            "message": f"数量不一致：线下台账 {offline_count} 条，线上 {len(reservations)} 条",
            "offline": offline_count,
            "online": len(reservations),
        })

    online_statuses = set(r.status for r in reservations)
    offline_status_set = set(offline_statuses)

    if online_statuses != offline_status_set:
        issues.append({
            "type": "status_mismatch",
            "message": f"状态分布不一致：线下有 {', '.join(offline_status_set or ['未指定'])}，线上有 {', '.join(online_statuses)}",
            "offline_statuses": list(offline_status_set),
            "online_statuses": list(online_statuses),
        })

    return JSONResponse({
        "batch_no": batch_no,
        "is_consistent": len(issues) == 0,
        "issues": issues,
        "message": "批次核对一致" if len(issues) == 0 else "批次存在不一致，请处理后再继续",
    })


routes = [
    Route("/", list_batches, methods=["GET"]),
    Route("/check", check_batch, methods=["GET"]),
    Route("/status-check", batch_status_check, methods=["POST"]),
    Route("/{batch_no}", get_batch_reservations, methods=["GET"]),
]
