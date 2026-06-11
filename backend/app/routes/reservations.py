from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from datetime import datetime
import json
from urllib.parse import unquote

from ..database import get_db
from ..models import MeetingReservation, AuditLog, BatchRecord, BlockLog
from ..schemas import (
    MeetingReservationCreate,
    MeetingReservationUpdate,
    MeetingReservationOut,
    MeetingReservationListOut,
)
from ..permissions import (
    check_permission,
    get_next_status,
    validate_required_fields,
    reconcile_offline_online,
    run_batch_reconcile,
    build_offline_statuses_for_batch,
    build_reconcile_detail,
    apply_reconcile_result,
    STATUS_LABELS,
)


def get_current_user(request: Request):
    return {
        "username": request.headers.get("X-User-Name", "registrar"),
        "name": unquote(request.headers.get("X-User-Real-Name", "张登记")),
        "role": request.headers.get("X-User-Role", "registrar"),
    }


def add_audit_log(db, reservation_id, batch_no, action, status_from, status_to,
                 operator, operator_role, remark=None, item_results=None,
                 reconcile=None, reservation_no=None):
    detail = None
    if reconcile is not None:
        detail = build_reconcile_detail(
            reconcile,
            reservation_no=reservation_no,
            batch_no=batch_no,
            operator_role=operator_role,
        )
    log = AuditLog(
        reservation_id=reservation_id,
        batch_no=batch_no,
        action=action,
        status_from=status_from,
        status_to=status_to,
        operator=operator,
        operator_role=operator_role,
        remark=remark,
        item_results=item_results,
    )
    db.add(log)
    return log


def add_block_log(db, reservation_id, batch_no, block_type, reason, operator,
                  operator_role, detail=None, item_results=None,
                  reconcile=None, reservation_no=None):
    if reconcile is not None and detail is None:
        detail = build_reconcile_detail(
            reconcile,
            reservation_no=reservation_no,
            batch_no=batch_no,
            operator_role=operator_role,
        )
    log = BlockLog(
        reservation_id=reservation_id,
        batch_no=batch_no,
        block_type=block_type,
        reason=reason,
        detail=detail,
        operator=operator,
        operator_role=operator_role,
        item_results=item_results,
    )
    db.add(log)
    return log


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

    result = MeetingReservationOut.model_validate(reservation).model_dump(mode='json')

    if reservation.batch_no:
        batch_items = db.query(MeetingReservation).filter(
            MeetingReservation.batch_no == reservation.batch_no
        ).all()
        reconcile = run_batch_reconcile(batch_items, None, [])
        result["batch_reconcile"] = reconcile

    return JSONResponse(result)


async def create_reservation(request: Request):
    current = get_current_user(request)
    if current["role"] != "registrar":
        return JSONResponse({"detail": "仅登记员可创建预约单"}, status_code=403)

    body = await request.json()
    db = next(get_db())

    if isinstance(body.get("offline_attachment_list"), str):
        body["offline_attachment_list"] = [a.strip() for a in body["offline_attachment_list"].split(",") if a.strip()]

    try:
        data = MeetingReservationCreate(**body)
    except Exception as e:
        return JSONResponse({"detail": f"参数校验失败: {str(e)}"}, status_code=400)

    is_valid, errors = validate_required_fields(data.model_dump())
    if not is_valid:
        return JSONResponse({
            "detail": "校验失败",
            "errors": errors,
        }, status_code=400)

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
        offline_count=data.offline_count,
        offline_status=data.offline_status,
        offline_attachment_list=data.offline_attachment_list or [],
        status="draft",
        created_by=current["name"],
        updated_by=current["name"],
    )
    db.add(reservation)
    db.flush()

    existing_batch = db.query(BatchRecord).filter(BatchRecord.batch_no == data.batch_no).first()
    if not existing_batch:
        batch = BatchRecord(
            batch_no=data.batch_no,
            total_count=1,
            offline_count=data.offline_count or 1,
            processed_count=0,
            status="processing",
            check_status="unchecked",
            created_by=current["name"],
        )
        db.add(batch)
    else:
        existing_batch.total_count += 1
        existing_batch.offline_count += (data.offline_count or 1)

    db.flush()
    db.refresh(reservation)

    add_audit_log(
        db, reservation.id, data.batch_no, "create",
        None, "draft", current["name"], current["role"],
        remark="创建预约单草稿",
    )

    existing_batch = db.query(BatchRecord).filter(BatchRecord.batch_no == data.batch_no).first()
    batch_items = db.query(MeetingReservation).filter(
        MeetingReservation.batch_no == data.batch_no
    ).all()
    is_duplicate = existing_batch is not None and existing_batch.total_count > 1

    reconcile = None
    if is_duplicate:
        new_entry = {
            "reservation_no": reservation_no,
            "status": data.offline_status or "draft",
            "attachments": data.offline_attachment_list or [a.strip() for a in (data.attachment_names or "").split(",") if a.strip()],
        }
        count, statuses = build_offline_statuses_for_batch(batch_items, data.offline_count, [new_entry])
        reconcile = reconcile_offline_online(batch_items, count, statuses)

        apply_result = apply_reconcile_result(
            db, batch_items, reconcile, count, current,
            reservation=reservation, action="create", force_submit=data.force_submit,
        )

        if apply_result["blocked"]:
            add_audit_log(
                db, reservation.id, data.batch_no, "create_blocked",
                "draft", "draft", current["name"], current["role"],
                remark="批次差异阻断，草稿已保存",
                reconcile=reconcile,
                reservation_no=reservation_no,
            )
            db.commit()
            result = MeetingReservationOut.model_validate(reservation).model_dump(mode='json')
            result["batch_warning"] = True
            result["batch_warning_msg"] = reconcile["message"]
            result["blocked"] = True
            result["block_type"] = "batch_mismatch"
            result["can_force_submit"] = True
            result["reconcile"] = reconcile
            return JSONResponse(result, status_code=409)

    add_audit_log(
        db, reservation.id, data.batch_no, "create",
        "draft", "draft", current["name"], current["role"],
        remark="创建预约单" + ("（强制录入重复批次）" if is_duplicate and data.force_submit else ""),
        reconcile=reconcile,
        reservation_no=reservation_no,
    )

    db.commit()
    db.refresh(reservation)

    result = MeetingReservationOut.model_validate(reservation).model_dump(mode='json')
    result["batch_warning"] = is_duplicate
    if is_duplicate:
        result["batch_warning_msg"] = f"批次号已存在，当前有 {len(batch_items)} 条预约单。线下台账批次号与线上数据重复。"
    if reconcile and not reconcile["is_consistent"]:
        result["reconcile"] = reconcile

    return JSONResponse(result, status_code=201)


async def update_reservation(request: Request):
    rid = int(request.path_params.get("id"))
    current = get_current_user(request)
    body = await request.json()
    db = next(get_db())

    reservation = db.query(MeetingReservation).filter(MeetingReservation.id == rid).first()
    if not reservation:
        return JSONResponse({"detail": "预约单不存在"}, status_code=404)

    ok, err = check_permission(reservation.status, current["role"], "update")
    if not ok:
        add_block_log(
            db, rid, reservation.batch_no, "permission_denied",
            err, current["name"], current["role"],
        )
        db.commit()
        return JSONResponse({"detail": err}, status_code=403)

    try:
        if isinstance(body.get("offline_attachment_list"), str):
            body["offline_attachment_list"] = [a.strip() for a in body["offline_attachment_list"].split(",") if a.strip()]
        data = MeetingReservationUpdate(**body)
    except Exception as e:
        return JSONResponse({"detail": f"参数校验失败: {str(e)}"}, status_code=400)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(reservation, key, value)

    reservation.updated_by = current["name"]
    reservation.updated_at = datetime.now()

    add_audit_log(
        db, reservation.id, reservation.batch_no, "update",
        reservation.status, reservation.status,
        current["name"], current["role"],
        remark="更新预约信息" + ("（补正退回内容）" if reservation.status == "returned" else ""),
    )

    db.commit()
    db.refresh(reservation)
    return JSONResponse(MeetingReservationOut.model_validate(reservation).model_dump(mode='json'))


async def submit_reservation(request: Request):
    rid = int(request.path_params.get("id"))
    current = get_current_user(request)
    body = await request.json()
    db = next(get_db())

    reservation = db.query(MeetingReservation).filter(MeetingReservation.id == rid).first()
    if not reservation:
        return JSONResponse({"detail": "预约单不存在"}, status_code=404)

    ok, err = check_permission(reservation.status, current["role"], "submit")
    if not ok:
        add_block_log(
            db, rid, reservation.batch_no, "permission_denied",
            err, current["name"], current["role"],
        )
        db.commit()
        return JSONResponse({"detail": err}, status_code=403)

    batch_items = db.query(MeetingReservation).filter(
        MeetingReservation.batch_no == reservation.batch_no
    ).all()

    offline_count = body.get("offline_count")
    offline_statuses = body.get("offline_statuses", [])
    offline_attachments = body.get("offline_attachments", [])
    force_submit = body.get("force_submit", False)

    reconcile = run_batch_reconcile(batch_items, offline_count, offline_statuses, offline_attachments)

    apply_result = apply_reconcile_result(
        db, batch_items, reconcile, offline_count, current,
        reservation=reservation, action="submit", force_submit=force_submit,
    )

    if apply_result["blocked"]:
        db.commit()
        return JSONResponse({
            "detail": reconcile["message"],
            "blocked": True,
            "block_type": "batch_mismatch",
            "reconcile": reconcile,
            "can_force_submit": True,
        }, status_code=409)

    is_valid, errors = validate_required_fields({
        "title": reservation.title,
        "meeting_room": reservation.meeting_room,
        "meeting_date": reservation.meeting_date,
        "start_time": reservation.start_time,
        "end_time": reservation.end_time,
        "participants": reservation.participants,
        "attachment_names": reservation.attachment_names,
        "offline_attachment_count": reservation.offline_attachment_count,
    })

    if not is_valid:
        add_block_log(
            db, rid, reservation.batch_no, "missing_fields",
            "；".join(errors), current["name"], current["role"],
            detail={"errors": errors},
        )
        db.commit()
        return JSONResponse({
            "detail": "提交失败，请检查以下问题",
            "errors": errors,
            "offline_check": "线下台账对应条目是否完整？请核对纸质材料。",
        }, status_code=400)

    old_status = reservation.status
    reservation.status = "pending_audit"
    reservation.submitted_at = datetime.now()
    reservation.updated_by = current["name"]
    reservation.updated_at = datetime.now()

    add_audit_log(
        db, reservation.id, reservation.batch_no, "submit",
        old_status, "pending_audit", current["name"], current["role"],
        remark="提交审核" + ("（强制提交，存在批次差异）" if not reconcile["is_consistent"] else ""),
        reconcile=reconcile,
        reservation_no=reservation.reservation_no,
    )

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

    permission_action = "audit_pass" if action == "pass" else "return"
    ok, err = check_permission(reservation.status, current["role"], permission_action)
    if not ok:
        add_block_log(
            db, rid, reservation.batch_no, "permission_denied",
            err, current["name"], current["role"],
        )
        db.commit()
        return JSONResponse({"detail": err}, status_code=403)

    old_status = reservation.status
    item_results = None

    if action == "pass":
        reservation.status = "approved"
        reservation.audit_by = current["name"]
        reservation.audit_at = datetime.now()
        reservation.equipment_ready = True
        log_action = "audit_pass"
        log_remark = "审核通过"
    elif action == "return":
        return_reason = body.get("return_reason", "")
        if not return_reason.strip():
            add_block_log(
                db, rid, reservation.batch_no, "missing_reason",
                "退回必须填写原因", current["name"], current["role"],
            )
            db.commit()
            return JSONResponse({"detail": "退回必须填写原因"}, status_code=400)

        reservation.status = "returned"
        reservation.return_reason = return_reason
        reservation.exception_type = body.get("exception_type", "info_error")
        reservation.exception_desc = body.get("exception_desc", "")
        reservation.audit_by = current["name"]
        reservation.audit_at = datetime.now()
        log_action = "return"
        log_remark = return_reason

        batch = db.query(BatchRecord).filter(BatchRecord.batch_no == reservation.batch_no).first()
        if batch:
            batch.status = "returned"
    else:
        return JSONResponse({"detail": "无效的审核操作"}, status_code=400)

    reservation.updated_by = current["name"]
    reservation.updated_at = datetime.now()

    add_audit_log(
        db, reservation.id, reservation.batch_no, log_action,
        old_status, reservation.status,
        current["name"], current["role"],
        remark=log_remark,
        item_results=item_results,
    )

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

    ok, err = check_permission(reservation.status, current["role"], "usage_confirm")
    if not ok:
        add_block_log(
            db, rid, reservation.batch_no, "permission_denied",
            err, current["name"], current["role"],
        )
        db.commit()
        return JSONResponse({"detail": err}, status_code=403)

    result = body.get("result", "")
    if not result.strip():
        add_block_log(
            db, rid, reservation.batch_no, "missing_result",
            "使用确认必须填写结果", current["name"], current["role"],
        )
        db.commit()
        return JSONResponse({"detail": "使用确认必须填写结果"}, status_code=400)

    old_status = reservation.status
    reservation.status = "usage_confirmed"
    reservation.usage_confirm = True
    reservation.usage_confirm_time = datetime.now()
    reservation.usage_confirm_user = current["name"]
    reservation.result = result
    reservation.updated_by = current["name"]
    reservation.updated_at = datetime.now()

    add_audit_log(
        db, reservation.id, reservation.batch_no, "usage_confirm",
        old_status, "usage_confirmed",
        current["name"], current["role"],
        remark=f"使用确认完成：{result}",
    )

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

    permission_action = "review_pass" if action == "pass" else "return"
    ok, err = check_permission(reservation.status, current["role"], permission_action)
    if not ok:
        add_block_log(
            db, rid, reservation.batch_no, "permission_denied",
            err, current["name"], current["role"],
        )
        db.commit()
        return JSONResponse({"detail": err}, status_code=403)

    old_status = reservation.status
    batch = db.query(BatchRecord).filter(BatchRecord.batch_no == reservation.batch_no).first()

    if action == "pass":
        batch_items = db.query(MeetingReservation).filter(
            MeetingReservation.batch_no == reservation.batch_no
        ).all()
        offline_count = body.get("offline_count")
        offline_statuses = body.get("offline_statuses", [])
        offline_attachments = body.get("offline_attachments", [])
        reconcile = run_batch_reconcile(batch_items, offline_count, offline_statuses, offline_attachments)

        apply_result = apply_reconcile_result(
            db, batch_items, reconcile, offline_count, current,
            reservation=reservation, action="review_pass",
        )

        if apply_result["blocked"]:
            db.commit()
            return JSONResponse({
                "detail": reconcile["message"],
                "blocked": True,
                "block_type": "batch_mismatch",
                "reconcile": reconcile,
            }, status_code=409)

        reservation.status = "archived"
        reservation.review_by = current["name"]
        reservation.review_at = datetime.now()
        reservation.archived_at = datetime.now()
        log_action = "archive"
        log_remark = "复核通过，已归档"

        if batch:
            batch.processed_count += 1
            batch.status = "completed" if batch.processed_count >= batch.total_count else batch.status

    elif action == "return":
        return_reason = body.get("return_reason", "")
        if not return_reason.strip():
            add_block_log(
                db, rid, reservation.batch_no, "missing_reason",
                "退回必须填写原因", current["name"], current["role"],
            )
            db.commit()
            return JSONResponse({"detail": "退回必须填写原因"}, status_code=400)

        reservation.status = "returned"
        reservation.return_reason = return_reason
        reservation.review_by = current["name"]
        reservation.review_at = datetime.now()
        log_action = "review_return"
        log_remark = return_reason

        if batch:
            batch.status = "returned"
    else:
        return JSONResponse({"detail": "无效的复核操作"}, status_code=400)

    reservation.updated_by = current["name"]
    reservation.updated_at = datetime.now()

    add_audit_log(
        db, reservation.id, reservation.batch_no, log_action,
        old_status, reservation.status,
        current["name"], current["role"],
        remark=log_remark,
        reconcile=reconcile if action == "pass" else None,
        reservation_no=reservation.reservation_no,
    )

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

    ok, err = check_permission(reservation.status, current["role"], "delete")
    if not ok:
        add_block_log(
            db, rid, reservation.batch_no, "permission_denied",
            err, current["name"], current["role"],
        )
        db.commit()
        return JSONResponse({"detail": err}, status_code=403)

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


async def reconcile_reservation(request: Request):
    rid = int(request.path_params.get("id"))
    current = get_current_user(request)
    body = await request.json()
    db = next(get_db())

    reservation = db.query(MeetingReservation).filter(MeetingReservation.id == rid).first()
    if not reservation:
        return JSONResponse({"detail": "预约单不存在"}, status_code=404)

    batch_items = db.query(MeetingReservation).filter(
        MeetingReservation.batch_no == reservation.batch_no
    ).all()

    offline_count = body.get("offline_count")
    offline_statuses = body.get("offline_statuses", [])
    offline_attachments = body.get("offline_attachments", [])

    reconcile = run_batch_reconcile(batch_items, offline_count, offline_statuses, offline_attachments)

    if body.get("offline_status"):
        reservation.offline_status = body["offline_status"]
    offline_att_list = body.get("offline_attachment_list")
    if offline_att_list is not None:
        if isinstance(offline_att_list, str):
            offline_att_list = [a.strip() for a in offline_att_list.split(",") if a.strip()]
        reservation.offline_attachment_list = offline_att_list
    if body.get("offline_count"):
        reservation.offline_count = offline_count

    apply_reconcile_result(
        db, batch_items, reconcile, offline_count, current,
        reservation=reservation, action="reconcile",
    )

    add_audit_log(
        db, reservation.id, reservation.batch_no, "reconcile",
        reservation.status, reservation.status,
        current["name"], current["role"],
        remark="离线台账核对，" + reconcile["message"],
        reconcile=reconcile,
        reservation_no=reservation.reservation_no,
    )

    db.commit()
    return JSONResponse(reconcile)


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
    Route("/{id:int}/reconcile", reconcile_reservation, methods=["POST"]),
]
