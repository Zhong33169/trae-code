from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from datetime import datetime
from urllib.parse import unquote

from ..database import get_db
from ..models import BatchRecord, MeetingReservation, AuditLog, BlockLog
from ..permissions import reconcile_offline_online, STATUS_LABELS, check_permission


def get_current_user(request: Request):
    return {
        "username": request.headers.get("X-User-Name", "registrar"),
        "name": unquote(request.headers.get("X-User-Real-Name", "张登记")),
        "role": request.headers.get("X-User-Role", "registrar"),
    }


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
            "offline_count": b.offline_count,
            "processed_count": b.processed_count,
            "status": b.status,
            "check_status": b.check_status,
            "check_diff": b.check_diff,
            "created_by": b.created_by,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "checked_at": b.checked_at.isoformat() if b.checked_at else None,
            "checked_by": b.checked_by,
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
    is_blocked = has_status_mismatch

    message = "批次号可用，可以继续录入"
    if is_duplicate:
        message = f"批次号 {batch_no} 已存在，当前有 {len(reservations)} 条预约单。线下台账批次号与线上数据重复，请确认是否为同一批数据。"
    if has_status_mismatch:
        message = f"批次 {batch_no} 内存在不同状态：{', '.join(STATUS_LABELS.get(s, s) for s in statuses)}，不允许继续提交。请逐单核对线下台账状态。"

    mismatch_details = []
    offline_statuses = []
    for r in reservations:
        att_list = r.offline_attachment_list if isinstance(r.offline_attachment_list, list) else []
        online_att = [a.strip() for a in (r.attachment_names or "").split(",") if a.strip()]
        mismatch_details.append({
            "reservation_no": r.reservation_no,
            "title": r.title,
            "status": r.status,
            "status_label": STATUS_LABELS.get(r.status, r.status),
            "offline_status": r.offline_status,
            "offline_count": r.offline_count,
            "online_attachments": r.attachment_names or "",
            "offline_attachments": att_list,
            "suggestion": "请核对线下台账对应条目状态是否一致" if has_status_mismatch else "",
        })
        offline_statuses.append({
            "reservation_no": r.reservation_no,
            "status": r.offline_status or r.status,
            "attachments": att_list if att_list else online_att,
        })

    offline_count = existing.offline_count if existing else len(reservations)
    reconcile = reconcile_offline_online(reservations, offline_count, offline_statuses)
    if reconcile["is_blocked"]:
        is_blocked = True
        message = reconcile["message"]

    return JSONResponse({
        "batch_no": batch_no,
        "is_duplicate": is_duplicate,
        "is_blocked": is_blocked,
        "is_status_mismatch": has_status_mismatch,
        "message": message,
        "existing_count": len(reservations),
        "statuses": list(statuses),
        "mismatch_details": mismatch_details,
        "reconcile": reconcile,
    })


async def reconcile_batch(request: Request):
    current = get_current_user(request)
    body = await request.json()
    batch_no = body.get("batch_no", "")
    offline_count = body.get("offline_count", 0)
    offline_statuses = body.get("offline_statuses", [])
    offline_attachments = body.get("offline_attachments", [])

    db = next(get_db())

    if not batch_no:
        return JSONResponse({"detail": "批次号不能为空"}, status_code=400)

    reservations = db.query(MeetingReservation).filter(
        MeetingReservation.batch_no == batch_no
    ).all()

    if not reservations:
        return JSONResponse({"detail": "批次不存在"}, status_code=404)

    if not offline_statuses:
        for r in reservations:
            entry = {"reservation_no": r.reservation_no, "status": r.offline_status or r.status}
            att_list = r.offline_attachment_list if isinstance(r.offline_attachment_list, list) else []
            entry["attachments"] = att_list if att_list else [a.strip() for a in (r.attachment_names or "").split(",") if a.strip()]
            offline_statuses.append(entry)

    reconcile = reconcile_offline_online(
        reservations, offline_count or len(reservations), offline_statuses, offline_attachments
    )

    batch = db.query(BatchRecord).filter(BatchRecord.batch_no == batch_no).first()
    if batch:
        batch.offline_count = offline_count
        batch.check_status = "checked" if reconcile["is_consistent"] else ("has_diff" if not reconcile["is_blocked"] else "blocked")
        batch.check_diff = reconcile
        batch.checked_at = datetime.now()
        batch.checked_by = current["name"]

    for r in reservations:
        r.offline_check_diff = reconcile
        r.offline_checked = True
        r.offline_checked_at = datetime.now()
        r.offline_checked_by = current["name"]
        if offline_count:
            r.offline_count = offline_count

    audit = AuditLog(
        batch_no=batch_no,
        action="batch_reconcile",
        operator=current["name"],
        operator_role=current["role"],
        remark="批次离线台账核对，" + reconcile["message"],
        item_results=reconcile["item_results"],
    )
    db.add(audit)

    if reconcile["is_blocked"]:
        block = BlockLog(
            batch_no=batch_no,
            block_type="batch_mismatch",
            reason=reconcile["message"],
            detail=reconcile["diffs"],
            operator=current["name"],
            operator_role=current["role"],
            item_results=reconcile["item_results"],
        )
        db.add(block)

    db.commit()
    return JSONResponse(reconcile)


async def get_batch_reservations(request: Request):
    batch_no = request.path_params.get("batch_no")
    db = next(get_db())

    reservations = db.query(MeetingReservation).filter(
        MeetingReservation.batch_no == batch_no
    ).order_by(MeetingReservation.created_at.desc()).all()

    batch = db.query(BatchRecord).filter(BatchRecord.batch_no == batch_no).first()

    statuses = set(r.status for r in reservations)
    has_mismatch = len(statuses) > 1

    offline_count = batch.offline_count if batch else len(reservations)
    offline_statuses = []
    for r in reservations:
        entry = {"reservation_no": r.reservation_no, "status": r.offline_status or r.status}
        att_list = r.offline_attachment_list if isinstance(r.offline_attachment_list, list) else []
        entry["attachments"] = att_list if att_list else [a.strip() for a in (r.attachment_names or "").split(",") if a.strip()]
        offline_statuses.append(entry)

    reconcile = reconcile_offline_online(reservations, offline_count, offline_statuses)

    result = [
        {
            "id": r.id,
            "reservation_no": r.reservation_no,
            "title": r.title,
            "meeting_room": r.meeting_room,
            "meeting_date": r.meeting_date,
            "start_time": r.start_time,
            "end_time": r.end_time,
            "status": r.status,
            "status_label": STATUS_LABELS.get(r.status, r.status),
            "exception_type": r.exception_type,
            "exception_desc": r.exception_desc,
            "attachment_names": r.attachment_names or "",
            "offline_attachment_count": r.offline_attachment_count,
            "offline_count": r.offline_count,
            "offline_status": r.offline_status,
            "offline_attachment_list": r.offline_attachment_list if isinstance(r.offline_attachment_list, list) else [],
            "offline_checked": r.offline_checked,
            "offline_check_diff": r.offline_check_diff,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reservations
    ]

    return JSONResponse({
        "batch_no": batch_no,
        "batch_status": batch.status if batch else "unknown",
        "check_status": batch.check_status if batch else "unchecked",
        "total_online": len(reservations),
        "total_offline": offline_count,
        "status_mismatch": has_mismatch,
        "statuses": list(statuses),
        "warning": reconcile["message"] if not reconcile["is_consistent"] else None,
        "blocked": reconcile["is_blocked"],
        "reconcile": reconcile,
        "items": result,
    })


async def batch_status_check(request: Request):
    current = get_current_user(request)
    body = await request.json()
    batch_no = body.get("batch_no", "")
    offline_count = body.get("offline_count", 0)
    offline_statuses = body.get("offline_statuses", [])
    offline_attachments = body.get("offline_attachments", [])

    db = next(get_db())

    reservations = db.query(MeetingReservation).filter(
        MeetingReservation.batch_no == batch_no
    ).all()

    if not reservations:
        return JSONResponse({"detail": "批次不存在"}, status_code=404)

    if not offline_statuses:
        for r in reservations:
            entry = {"reservation_no": r.reservation_no, "status": r.offline_status or r.status}
            att_list = r.offline_attachment_list if isinstance(r.offline_attachment_list, list) else []
            entry["attachments"] = att_list if att_list else [a.strip() for a in (r.attachment_names or "").split(",") if a.strip()]
            offline_statuses.append(entry)

    reconcile = reconcile_offline_online(
        reservations, offline_count or len(reservations), offline_statuses, offline_attachments
    )

    return JSONResponse(reconcile)


routes = [
    Route("/", list_batches, methods=["GET"]),
    Route("/check", check_batch, methods=["GET"]),
    Route("/reconcile", reconcile_batch, methods=["POST"]),
    Route("/status-check", batch_status_check, methods=["POST"]),
    Route("/{batch_no}", get_batch_reservations, methods=["GET"]),
]
