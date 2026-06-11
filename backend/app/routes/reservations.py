from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from datetime import datetime
import json
from urllib.parse import unquote

from ..database import get_db
from ..models import MeetingReservation, AuditLog, BatchRecord
from ..schemas import (
    MeetingReservationCreate,
    MeetingReservationUpdate,
    MeetingReservationOut,
    MeetingReservationListOut,
    StatusUpdate,
)


def get_current_user(request: Request):
    return {
        "username": request.headers.get("X-User-Name", "registrar"),
        "name": unquote(request.headers.get("X-User-Real-Name", "张登记")),
        "role": request.headers.get("X-User-Role", "registrar"),
    }


async def list_reservations(request: Request):
    db = next(get_db())
    query = db.query(MeetingReservation)

    status = request.query_params.get("status")
    if status and status != "all":
        query = query.filter(MeetingReservation.status == status)

    exception = request.query_params.get("exception")
    if exception and exception != "all":
        if exception == "none":
            query = query.filter(MeetingReservation.exception_type.is_(None))
        else:
            query = query.filter(MeetingReservation.exception_type == exception)

    batch_no = request.query_params.get("batch_no")
    if batch_no:
        query = query.filter(MeetingReservation.batch_no == batch_no)

    keyword = request.query_params.get("keyword")
    if keyword:
        query = query.filter(
            (MeetingReservation.title.like(f"%{keyword}%") |
             MeetingReservation.reservation_no.like(f"%{keyword}%"))
        )

    page = int(request.query_params.get("page", 1))
    page_size = int(request.query_params.get("page_size", 20))

    total = query.count()
    items = query.order_by(MeetingReservation.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    result = [MeetingReservationOut.model_validate(item).model_dump(mode='json') for item in items]
    return JSONResponse({"total": total, "items": result, "page": page, "page_size": page_size})


async def get_reservation(request: Request):
    rid = int(request.path_params.get("id"))
    db = next(get_db())
    reservation = db.query(MeetingReservation).filter(MeetingReservation.id == rid).first()
    if not reservation:
        return JSONResponse({"detail": "预约单不存在"}, status_code=404)
    return JSONResponse(MeetingReservationOut.model_validate(reservation).model_dump(mode='json'))


async def create_reservation(request: Request):
    current = get_current_user(request)
    body = await request.json()
    db = next(get_db())

    data = MeetingReservationCreate(**body)

    existing_batch = db.query(BatchRecord).filter(BatchRecord.batch_no == data.batch_no).first()
    is_duplicate = existing_batch is not None

    max_id = db.query(MeetingReservation).count() + 1
    reservation_no = f"MR-{datetime.now().strftime('%Y%m%d')}-{max_id:03d}"

    reservation = MeetingReservation(
        reservation_no=reservation_no,
        batch_no=data.batch_no,
        title=data.title,
        meeting_room=data.meeting_room,
        meeting_date=data.meeting_date,
        start_time=data.start_time,
        end_time=data.end_time,
        participants=data.participants,
        organizer=data.organizer,
        organizer_dept=data.organizer_dept,
        contact_phone=data.contact_phone,
        equipment=data.equipment,
        attachment_names=data.attachment_names,
        offline_attachment_count=data.offline_attachment_count,
        status="draft",
        created_by=current["name"],
        updated_by=current["name"],
    )
    db.add(reservation)
    db.flush()

    log = AuditLog(
        reservation_id=reservation.id,
        action="create",
        status_from=None,
        status_to="draft",
        operator=current["name"],
        operator_role=current["role"],
        remark="创建预约单" + ("（批次重复警告）" if is_duplicate else ""),
    )
    db.add(log)

    if not existing_batch:
        batch = BatchRecord(
            batch_no=data.batch_no,
            total_count=1,
            processed_count=0,
            status="processing",
            created_by=current["name"],
        )
        db.add(batch)
    else:
        existing_batch.total_count += 1

    db.commit()
    db.refresh(reservation)

    result = MeetingReservationOut.model_validate(reservation).model_dump(mode='json')
    result["batch_warning"] = is_duplicate
    result["batch_warning_msg"] = "该批次号已存在，可能存在重复录入。线下台账批次号与线上已有批次重复，请确认是否为同一批数据。" if is_duplicate else None

    return JSONResponse(result, status_code=201)


async def update_reservation(request: Request):
    rid = int(request.path_params.get("id"))
    current = get_current_user(request)
    body = await request.json()
    db = next(get_db())

    reservation = db.query(MeetingReservation).filter(MeetingReservation.id == rid).first()
    if not reservation:
        return JSONResponse({"detail": "预约单不存在"}, status_code=404)

    if reservation.status not in ["draft", "returned"]:
        return JSONResponse({"detail": "当前状态不允许编辑"}, status_code=400)

    data = MeetingReservationUpdate(**body)
    update_data = data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(reservation, key, value)

    reservation.updated_by = current["name"]
    reservation.updated_at = datetime.now()

    log = AuditLog(
        reservation_id=reservation.id,
        action="update",
        status_from=reservation.status,
        status_to=reservation.status,
        operator=current["name"],
        operator_role=current["role"],
        remark="更新预约信息",
    )
    db.add(log)

    db.commit()
    db.refresh(reservation)
    return JSONResponse(MeetingReservationOut.model_validate(reservation).model_dump(mode='json'))


async def submit_reservation(request: Request):
    rid = int(request.path_params.get("id"))
    current = get_current_user(request)
    db = next(get_db())

    reservation = db.query(MeetingReservation).filter(MeetingReservation.id == rid).first()
    if not reservation:
        return JSONResponse({"detail": "预约单不存在"}, status_code=404)

    if reservation.status not in ["draft", "returned"]:
        return JSONResponse({"detail": "当前状态不允许提交"}, status_code=400)

    errors = []
    if not reservation.title:
        errors.append("会议主题不能为空")
    if not reservation.meeting_room:
        errors.append("会议室不能为空")
    if not reservation.meeting_date:
        errors.append("会议日期不能为空")
    if not reservation.start_time or not reservation.end_time:
        errors.append("会议时间不能为空")
    if reservation.offline_attachment_count > 0 and not reservation.attachment_names:
        errors.append("存在线下附件但未上传附件清单")
    if reservation.participants <= 0:
        errors.append("参会人数必须大于0")

    if errors:
        return JSONResponse({
            "detail": "提交失败，请检查以下问题",
            "errors": errors,
            "offline_check": "线下台账对应条目是否完整？请核对纸质材料。"
        }, status_code=400)

    old_status = reservation.status
    reservation.status = "pending_audit"
    reservation.submitted_at = datetime.now()
    reservation.updated_by = current["name"]
    reservation.updated_at = datetime.now()

    log = AuditLog(
        reservation_id=reservation.id,
        action="submit",
        status_from=old_status,
        status_to="pending_audit",
        operator=current["name"],
        operator_role=current["role"],
        remark="提交审核",
    )
    db.add(log)

    db.commit()
    db.refresh(reservation)
    return JSONResponse(MeetingReservationOut.model_validate(reservation).model_dump(mode='json'))


async def audit_reservation(request: Request):
    rid = int(request.path_params.get("id"))
    action = request.path_params.get("action")
    current = get_current_user(request)
    body = await request.json()
    db = next(get_db())

    reservation = db.query(MeetingReservation).filter(MeetingReservation.id == rid).first()
    if not reservation:
        return JSONResponse({"detail": "预约单不存在"}, status_code=404)

    if reservation.status != "pending_audit":
        return JSONResponse({"detail": "当前状态不允许审核"}, status_code=400)

    if current["role"] != "auditor":
        return JSONResponse({"detail": "无审核权限"}, status_code=403)

    old_status = reservation.status

    if action == "pass":
        reservation.status = "approved"
        reservation.audit_by = current["name"]
        reservation.audit_at = datetime.now()
        reservation.equipment_ready = True
        log_action = "audit_pass"
        log_remark = "审核通过"
    elif action == "return":
        reservation.status = "returned"
        reservation.return_reason = body.get("return_reason", "")
        reservation.exception_type = body.get("exception_type", "info_error")
        reservation.exception_desc = body.get("exception_desc", "")
        reservation.audit_by = current["name"]
        reservation.audit_at = datetime.now()
        log_action = "return"
        log_remark = body.get("return_reason", "审核退回")

        batch = db.query(BatchRecord).filter(BatchRecord.batch_no == reservation.batch_no).first()
        if batch:
            batch.status = "returned"
    else:
        return JSONResponse({"detail": "无效的审核操作"}, status_code=400)

    reservation.updated_by = current["name"]
    reservation.updated_at = datetime.now()

    log = AuditLog(
        reservation_id=reservation.id,
        action=log_action,
        status_from=old_status,
        status_to=reservation.status,
        operator=current["name"],
        operator_role=current["role"],
        remark=log_remark,
    )
    db.add(log)

    db.commit()
    db.refresh(reservation)
    return JSONResponse(MeetingReservationOut.model_validate(reservation).model_dump(mode='json'))


async def confirm_usage(request: Request):
    rid = int(request.path_params.get("id"))
    current = get_current_user(request)
    body = await request.json()
    db = next(get_db())

    reservation = db.query(MeetingReservation).filter(MeetingReservation.id == rid).first()
    if not reservation:
        return JSONResponse({"detail": "预约单不存在"}, status_code=404)

    if reservation.status != "approved":
        return JSONResponse({"detail": "当前状态不允许使用确认"}, status_code=400)

    old_status = reservation.status
    reservation.status = "usage_confirmed"
    reservation.usage_confirm = True
    reservation.usage_confirm_time = datetime.now()
    reservation.usage_confirm_user = current["name"]
    reservation.result = body.get("result", "")
    reservation.updated_by = current["name"]
    reservation.updated_at = datetime.now()

    log = AuditLog(
        reservation_id=reservation.id,
        action="usage_confirm",
        status_from=old_status,
        status_to="usage_confirmed",
        operator=current["name"],
        operator_role=current["role"],
        remark="使用确认完成",
    )
    db.add(log)

    db.commit()
    db.refresh(reservation)
    return JSONResponse(MeetingReservationOut.model_validate(reservation).model_dump(mode='json'))


async def review_reservation(request: Request):
    rid = int(request.path_params.get("id"))
    action = request.path_params.get("action")
    current = get_current_user(request)
    body = await request.json()
    db = next(get_db())

    reservation = db.query(MeetingReservation).filter(MeetingReservation.id == rid).first()
    if not reservation:
        return JSONResponse({"detail": "预约单不存在"}, status_code=404)

    if reservation.status != "usage_confirmed":
        return JSONResponse({"detail": "当前状态不允许复核"}, status_code=400)

    if current["role"] != "reviewer":
        return JSONResponse({"detail": "无复核权限"}, status_code=403)

    old_status = reservation.status

    if action == "pass":
        reservation.status = "archived"
        reservation.review_by = current["name"]
        reservation.review_at = datetime.now()
        reservation.archived_at = datetime.now()
        log_action = "archive"
        log_remark = "复核通过，已归档"

        batch = db.query(BatchRecord).filter(BatchRecord.batch_no == reservation.batch_no).first()
        if batch:
            batch.processed_count += 1
            if batch.processed_count >= batch.total_count:
                batch.status = "completed"
    elif action == "return":
        reservation.status = "returned"
        reservation.return_reason = body.get("return_reason", "")
        reservation.review_by = current["name"]
        reservation.review_at = datetime.now()
        log_action = "review_return"
        log_remark = body.get("return_reason", "复核退回")
    else:
        return JSONResponse({"detail": "无效的复核操作"}, status_code=400)

    reservation.updated_by = current["name"]
    reservation.updated_at = datetime.now()

    log = AuditLog(
        reservation_id=reservation.id,
        action=log_action,
        status_from=old_status,
        status_to=reservation.status,
        operator=current["name"],
        operator_role=current["role"],
        remark=log_remark,
    )
    db.add(log)

    db.commit()
    db.refresh(reservation)
    return JSONResponse(MeetingReservationOut.model_validate(reservation).model_dump(mode='json'))


async def delete_reservation(request: Request):
    rid = int(request.path_params.get("id"))
    current = get_current_user(request)
    db = next(get_db())

    reservation = db.query(MeetingReservation).filter(MeetingReservation.id == rid).first()
    if not reservation:
        return JSONResponse({"detail": "预约单不存在"}, status_code=404)

    if reservation.status not in ["draft", "returned"]:
        return JSONResponse({"detail": "当前状态不允许删除"}, status_code=400)

    db.delete(reservation)
    db.commit()

    return JSONResponse({"message": "删除成功"})


async def status_list(request: Request):
    statuses = [
        {"value": "all", "label": "全部状态"},
        {"value": "draft", "label": "草稿"},
        {"value": "pending_audit", "label": "待审核"},
        {"value": "approved", "label": "审核通过"},
        {"value": "usage_confirmed", "label": "使用确认"},
        {"value": "archived", "label": "已归档"},
        {"value": "returned", "label": "已退回"},
        {"value": "overdue", "label": "已超时"},
    ]
    return JSONResponse({"items": statuses})


async def exception_list(request: Request):
    exceptions = [
        {"value": "all", "label": "全部异常"},
        {"value": "none", "label": "无异常"},
        {"value": "missing_materials", "label": "材料缺失"},
        {"value": "info_error", "label": "信息错误"},
        {"value": "overdue", "label": "超时未处理"},
        {"value": "batch_mismatch", "label": "批次不一致"},
        {"value": "status_mismatch", "label": "状态不一致"},
    ]
    return JSONResponse({"items": exceptions})


routes = [
    Route("/", list_reservations, methods=["GET"]),
    Route("/statuses", status_list, methods=["GET"]),
    Route("/exceptions", exception_list, methods=["GET"]),
    Route("/", create_reservation, methods=["POST"]),
    Route("/{id:int}", get_reservation, methods=["GET"]),
    Route("/{id:int}", update_reservation, methods=["PUT"]),
    Route("/{id:int}", delete_reservation, methods=["DELETE"]),
    Route("/{id:int}/submit", submit_reservation, methods=["POST"]),
    Route("/{id:int}/audit/{action}", audit_reservation, methods=["POST"]),
    Route("/{id:int}/usage-confirm", confirm_usage, methods=["POST"]),
    Route("/{id:int}/review/{action}", review_reservation, methods=["POST"]),
]
