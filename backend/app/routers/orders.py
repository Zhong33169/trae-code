from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from litestar import Router, get, post, put, Request
from litestar.connection import ASGIConnection
from litestar.params import Parameter
from litestar.exceptions import HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user, require_registrar, require_supervisor, require_reviewer
from app.models import (
    MembershipOrder, OrderStatus, RequiredAttachment, Attachment, AttachmentType,
    AuditLog, AuditAction, User, UserRole
)
from app.schemas import (
    MembershipOrderSchema, MembershipOrderCreate,
    RequiredAttachmentSchema, AttachmentSchema, AuditLogSchema,
    ReviewAction, BatchRequest, BatchRejectRequest, BatchResponse, BatchItemResult,
)


class AttachmentSupplementItem(BaseModel):
    required_attachment_id: int
    reject_reason: Optional[str] = None


class SupplementRequestV2(BaseModel):
    items: List[AttachmentSupplementItem]
    remark: Optional[str] = None


def _add_audit(
    db: Session,
    order_id: int,
    operator_id: int,
    action: AuditAction,
    from_status: Optional[OrderStatus] = None,
    to_status: Optional[OrderStatus] = None,
    remark: Optional[str] = None,
    failure_reason: Optional[str] = None,
):
    log = AuditLog(
        order_id=order_id,
        operator_id=operator_id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        remark=remark,
        failure_reason=failure_reason,
    )
    db.add(log)


def _serialize_order(db: Session, order: MembershipOrder) -> MembershipOrderSchema:
    data = MembershipOrderSchema.model_validate(order)
    logs = []
    for log in order.audit_logs:
        op = db.query(User).filter(User.id == log.operator_id).first()
        log_dict = AuditLogSchema.model_validate(log).model_dump()
        log_dict["operator_name"] = op.name if op else "未知"
        log_dict["operator_role"] = op.role.value if op else None
        logs.append(log_dict)
    data.audit_logs = logs
    return data


def _assert_status(order: MembershipOrder, allowed: set, action_name: str, user: User):
    if order.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"操作【{action_name}】失败："
                   f"当前角色【{user.role.value}】在状态【{order.status.value}】下无权限执行此操作"
        )


@get("/orders")
async def list_orders(
    status: Optional[OrderStatus] = Parameter(default=None),
    is_overdue: Optional[bool] = Parameter(default=None),
    keyword: Optional[str] = Parameter(default=None),
    skip: int = Parameter(default=0),
    limit: int = Parameter(default=50),
) -> dict:
    db: Session = next(get_db())
    query = db.query(MembershipOrder)
    if status:
        query = query.filter(MembershipOrder.status == status)
    if is_overdue is not None:
        query = query.filter(MembershipOrder.is_overdue == is_overdue)
    if keyword:
        like = f"%{keyword}%"
        query = query.filter(
            (MembershipOrder.order_no.like(like)) |
            (MembershipOrder.member_name.like(like)) |
            (MembershipOrder.member_phone.like(like))
        )
    total = query.count()
    orders = query.order_by(MembershipOrder.created_at.desc()).offset(skip).limit(limit).all()
    items = [_serialize_order(db, o) for o in orders]
    return {"total": total, "items": items, "skip": skip, "limit": limit}


@get("/orders/{order_id:int}")
async def get_order(order_id: int) -> MembershipOrderSchema:
    db: Session = next(get_db())
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="会员入会单不存在")
    return _serialize_order(db, order)


@post("/orders", guards=[require_registrar])
async def create_order(
    data: MembershipOrderCreate,
    request: Request,
) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator = get_current_user(request)
    now = datetime.utcnow()
    order_no = f"HY{now.strftime('%Y%m%d%H%M%S')}"

    order = MembershipOrder(
        order_no=order_no,
        member_name=data.member_name,
        member_phone=data.member_phone,
        member_id_no=data.member_id_no,
        membership_type=data.membership_type,
        membership_duration=data.membership_duration,
        amount=data.amount,
        status=OrderStatus.DRAFT,
        created_by=operator.id,
    )
    db.add(order)
    db.flush()

    defaults = [
        (AttachmentType.ID_CARD, "身份证复印件"),
        (AttachmentType.PHOTO, "一寸免冠照片"),
        (AttachmentType.HEALTH_CERT, "健康证明"),
        (AttachmentType.CONTRACT, "入会合同"),
    ]
    for atype, aname in defaults:
        db.add(RequiredAttachment(
            order_id=order.id,
            attachment_type=atype,
            attachment_name=aname,
            is_provided=False,
        ))
    db.flush()

    _add_audit(db, order.id, operator.id, AuditAction.CREATE,
               to_status=OrderStatus.DRAFT,
               remark=f"登记员【{operator.name}】创建会员入会单")
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@post("/orders/{order_id:int}/submit", guards=[require_registrar])
async def submit_order(
    order_id: int,
    data: dict = {},
    request: Request = None,
) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator = get_current_user(request)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    allowed = {OrderStatus.DRAFT, OrderStatus.MATERIALS_MISSING}
    _assert_status(order, allowed, "提交审核", operator)

    missing = db.query(RequiredAttachment).filter(
        RequiredAttachment.order_id == order_id,
        RequiredAttachment.is_provided == False,
    ).all()

    from_status = order.status
    if from_status == OrderStatus.MATERIALS_MISSING:
        if missing:
            missing_names = "、".join([m.attachment_name for m in missing])
            raise HTTPException(
                status_code=400,
                detail=f"登记员【{operator.name}】提交失败：仍有缺失附件未补正（{missing_names}），"
                       f"请补齐全部 {len(order.required_attachments)} 份附件后再重新提交"
            )
        order.status = OrderStatus.RESUBMITTED
        action = AuditAction.RESUBMIT
        remark = data.get("remark") or f"登记员【{operator.name}】补齐附件后重新提交审核"
    else:
        order.status = OrderStatus.PENDING_REVIEW
        action = AuditAction.SUBMIT
        remark = data.get("remark") or f"登记员【{operator.name}】提交会员入会单进入审核"

    order.is_overdue = False
    order.reject_reason = None
    order.updated_at = datetime.utcnow()

    _add_audit(db, order.id, operator.id, action,
               from_status=from_status, to_status=order.status, remark=remark)
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@post("/orders/{order_id:int}/approve", guards=[require_supervisor])
async def approve_order(
    order_id: int,
    data: ReviewAction,
    request: Request,
) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator = get_current_user(request)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    allowed = {OrderStatus.PENDING_REVIEW, OrderStatus.RESUBMITTED}
    _assert_status(order, allowed, "审核通过", operator)

    missing = db.query(RequiredAttachment).filter(
        RequiredAttachment.order_id == order_id,
        RequiredAttachment.is_provided == False,
    ).all()
    if missing:
        missing_names = "、".join([m.attachment_name for m in missing])
        raise HTTPException(
            status_code=400,
            detail=f"审核主管【{operator.name}】办理失败：仍有 {len(missing)} 份附件缺失（{missing_names}），"
                   f"材料不齐全不能审核通过"
        )

    from_status = order.status
    order.status = OrderStatus.APPROVED_REVIEW
    order.contract_confirmed = True
    order.updated_at = datetime.utcnow()

    _add_audit(
        db, order.id, operator.id, AuditAction.APPROVE,
        from_status=from_status, to_status=order.status,
        remark=f"审核主管【{operator.name}】办理通过" +
               (f"，备注：{data.remark}" if data.remark else "") +
               "，材料齐全有效",
    )
    _add_audit(
        db, order.id, operator.id, AuditAction.CONFIRM_CONTRACT,
        remark=f"审核主管【{operator.name}】确认合同已签署",
    )
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@post("/orders/{order_id:int}/request-supplement", guards=[require_supervisor])
async def request_supplement(
    order_id: int,
    data: SupplementRequestV2,
    request: Request,
) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator = get_current_user(request)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    allowed = {OrderStatus.PENDING_REVIEW, OrderStatus.RESUBMITTED}
    _assert_status(order, allowed, "退回补正", operator)

    if not data.items:
        raise HTTPException(
            status_code=400,
            detail=f"审核主管【{operator.name}】退回失败：请至少选择一项需补正的附件"
        )

    supplement_details = []
    for item in data.items:
        req = db.query(RequiredAttachment).filter(
            RequiredAttachment.id == item.required_attachment_id,
            RequiredAttachment.order_id == order_id,
        ).first()
        if not req:
            continue
        req.is_provided = False
        old_reason = req.reject_reason or ""
        new_reason = item.reject_reason or "材料不合格，需补正"
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
        if old_reason:
            req.reject_reason = f"[{timestamp} 审核主管{operator.name}] {new_reason}\n{old_reason}"
        else:
            req.reject_reason = f"[{timestamp} 审核主管{operator.name}] {new_reason}"
        if not req.missing_reason:
            req.missing_reason = new_reason
        supplement_details.append(f"{req.attachment_name}：{new_reason}")

    missing_list = db.query(RequiredAttachment).filter(
        RequiredAttachment.order_id == order_id,
        RequiredAttachment.is_provided == False,
    ).all()
    missing_names = "、".join([m.attachment_name for m in missing_list]) if missing_list else ""

    from_status = order.status
    order.status = OrderStatus.MATERIALS_MISSING
    order.reject_reason = (
        f"审核主管【{operator.name}】退回补正（共{len(data.items)}项）：{missing_names}。"
        f"请补正后重新提交。"
    )
    if data.remark:
        order.reject_reason += f" 备注：{data.remark}"
    order.updated_at = datetime.utcnow()

    failure_detail = "；".join(supplement_details) if supplement_details else "附件材料不合格"
    _add_audit(
        db, order.id, operator.id, AuditAction.REQUEST_SUPPLEMENT,
        from_status=from_status, to_status=order.status,
        remark=f"审核主管【{operator.name}】退回补正，需补充：{missing_names}" +
               (f"，备注：{data.remark}" if data.remark else ""),
        failure_reason=f"共 {len(data.items)} 项附件需要补正：{failure_detail}",
    )
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@post("/orders/{order_id:int}/reject", guards=[require_supervisor])
async def reject_order(
    order_id: int,
    data: ReviewAction,
    request: Request,
) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator = get_current_user(request)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    allowed = {OrderStatus.PENDING_REVIEW, OrderStatus.RESUBMITTED}
    _assert_status(order, allowed, "驳回申请", operator)

    if not data.reject_reason or not data.reject_reason.strip():
        raise HTTPException(
            status_code=400,
            detail=f"审核主管【{operator.name}】驳回失败：请填写驳回原因"
        )

    for req in order.required_attachments:
        if not req.is_provided:
            old_reason = req.reject_reason or ""
            timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
            new_line = f"[{timestamp} 最终驳回-{operator.name}] 整体驳回：{data.reject_reason}"
            req.reject_reason = f"{new_line}\n{old_reason}" if old_reason else new_line

    from_status = order.status
    order.status = OrderStatus.REJECTED
    order.reject_reason = data.reject_reason
    order.updated_at = datetime.utcnow()

    _add_audit(
        db, order.id, operator.id, AuditAction.REJECT,
        from_status=from_status, to_status=order.status,
        remark=f"审核主管【{operator.name}】予以驳回" +
               (f"，备注：{data.remark}" if data.remark else ""),
        failure_reason=data.reject_reason,
    )
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@post("/orders/{order_id:int}/review", guards=[require_reviewer])
async def review_order(
    order_id: int,
    data: ReviewAction,
    request: Request,
) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator = get_current_user(request)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    allowed = {OrderStatus.APPROVED_REVIEW}
    _assert_status(order, allowed, "复核通过", operator)

    if not order.contract_confirmed:
        raise HTTPException(
            status_code=400,
            detail=f"复核负责人【{operator.name}】复核失败：合同尚未确认，不能复核"
        )

    missing = db.query(RequiredAttachment).filter(
        RequiredAttachment.order_id == order_id,
        RequiredAttachment.is_provided == False,
    ).all()
    if missing:
        missing_names = "、".join([m.attachment_name for m in missing])
        raise HTTPException(
            status_code=400,
            detail=f"复核负责人【{operator.name}】复核失败：仍有 {len(missing)} 份附件缺失（{missing_names}）"
        )

    from_status = order.status
    order.status = OrderStatus.REVIEWED
    order.updated_at = datetime.utcnow()

    _add_audit(
        db, order.id, operator.id, AuditAction.REVIEW,
        from_status=from_status, to_status=order.status,
        remark=f"复核负责人【{operator.name}】复核通过，信息核实无误" +
               (f"，备注：{data.remark}" if data.remark else ""),
    )
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@post("/orders/{order_id:int}/archive", guards=[require_reviewer])
async def archive_order(
    order_id: int,
    data: ReviewAction,
    request: Request,
) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator = get_current_user(request)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    allowed = {OrderStatus.REVIEWED}
    _assert_status(order, allowed, "归档", operator)

    from_status = order.status
    order.status = OrderStatus.ARCHIVED
    order.card_activated = True
    order.updated_at = datetime.utcnow()

    _add_audit(
        db, order.id, operator.id, AuditAction.ACTIVATE_CARD,
        remark=f"复核负责人【{operator.name}】启用会员卡权益",
    )
    _add_audit(
        db, order.id, operator.id, AuditAction.ARCHIVE,
        from_status=from_status, to_status=order.status,
        remark=f"复核负责人【{operator.name}】完成入会单归档" +
               (f"，备注：{data.remark}" if data.remark else ""),
    )
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


def _make_batch_result(
    order: Optional[MembershipOrder],
    success: bool,
    audit_log_id: Optional[int] = None,
    reject_reason: Optional[str] = None,
) -> BatchItemResult:
    if order:
        return BatchItemResult(
            order_id=order.id,
            order_no=order.order_no,
            member_name=order.member_name,
            success=success,
            status=order.status.value if success else None,
            audit_log_id=audit_log_id,
            reject_reason=reject_reason,
            contract_confirmed=order.contract_confirmed if success else None,
            card_activated=order.card_activated if success else None,
            attachment_details=[
                {
                    "required_attachment_id": req.id,
                    "attachment_name": req.attachment_name,
                    "is_provided": req.is_provided,
                    "reject_reason": req.reject_reason,
                }
                for req in (order.required_attachments if order else [])
            ] if success else None,
        )
    return BatchItemResult(
        order_id=0,
        success=False,
        reject_reason=reject_reason or "入会单不存在",
    )


@post("/orders/batch/submit", guards=[require_registrar])
async def batch_submit_orders(
    data: BatchRequest,
    request: Request,
) -> BatchResponse:
    db: Session = next(get_db())
    operator = get_current_user(request)
    results = []
    for order_id in data.order_ids:
        try:
            order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
            if not order:
                results.append(BatchItemResult(order_id=order_id, success=False, reject_reason="入会单不存在"))
                continue

            allowed = {OrderStatus.DRAFT, OrderStatus.MATERIALS_MISSING}
            if order.status not in allowed:
                results.append(_make_batch_result(
                    order, False,
                    reject_reason=f"当前状态【{order.status.value}】下不能提交，仅草稿或附件缺失待补正可提交"
                ))
                continue

            missing = db.query(RequiredAttachment).filter(
                RequiredAttachment.order_id == order_id,
                RequiredAttachment.is_provided == False,
            ).all()
            from_status = order.status
            if from_status == OrderStatus.MATERIALS_MISSING and missing:
                missing_names = "、".join([m.attachment_name for m in missing])
                results.append(_make_batch_result(
                    order, False,
                    reject_reason=f"仍有缺失附件未补正（{missing_names}），请补齐全部附件后再重新提交"
                ))
                continue

            if from_status == OrderStatus.MATERIALS_MISSING:
                order.status = OrderStatus.RESUBMITTED
                action = AuditAction.RESUBMIT
                remark = data.remark or f"登记员【{operator.name}】补齐附件后重新提交审核"
            else:
                order.status = OrderStatus.PENDING_REVIEW
                action = AuditAction.SUBMIT
                remark = data.remark or f"登记员【{operator.name}】提交会员入会单进入审核"

            order.is_overdue = False
            order.reject_reason = None
            order.updated_at = datetime.utcnow()

            log = AuditLog(
                order_id=order.id, operator_id=operator.id, action=action,
                from_status=from_status, to_status=order.status, remark=remark,
            )
            db.add(log)
            db.flush()
            db.commit()
            db.refresh(order)
            db.refresh(log)
            results.append(_make_batch_result(order, True, audit_log_id=log.id))
        except Exception as e:
            db.rollback()
            order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
            results.append(_make_batch_result(order, False, reject_reason=str(e)))

    success_count = sum(1 for r in results if r.success)
    return BatchResponse(
        total=len(results), success_count=success_count,
        fail_count=len(results) - success_count, results=results,
    )


@post("/orders/batch/approve", guards=[require_supervisor])
async def batch_approve_orders(
    data: BatchRequest,
    request: Request,
) -> BatchResponse:
    db: Session = next(get_db())
    operator = get_current_user(request)
    results = []
    for order_id in data.order_ids:
        try:
            order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
            if not order:
                results.append(BatchItemResult(order_id=order_id, success=False, reject_reason="入会单不存在"))
                continue

            allowed = {OrderStatus.PENDING_REVIEW, OrderStatus.RESUBMITTED}
            if order.status not in allowed:
                results.append(_make_batch_result(
                    order, False,
                    reject_reason=f"当前状态【{order.status.value}】下不能审核通过，仅待审核或补正后重提可审核"
                ))
                continue

            missing = db.query(RequiredAttachment).filter(
                RequiredAttachment.order_id == order_id,
                RequiredAttachment.is_provided == False,
            ).all()
            if missing:
                missing_names = "、".join([m.attachment_name for m in missing])
                results.append(_make_batch_result(
                    order, False,
                    reject_reason=f"仍有 {len(missing)} 份附件缺失（{missing_names}），材料不齐全不能审核通过"
                ))
                continue

            from_status = order.status
            order.status = OrderStatus.APPROVED_REVIEW
            order.contract_confirmed = True
            order.updated_at = datetime.utcnow()

            log1 = AuditLog(
                order_id=order.id, operator_id=operator.id, action=AuditAction.APPROVE,
                from_status=from_status, to_status=order.status,
                remark=f"审核主管【{operator.name}】办理通过，材料齐全有效" +
                       (f"，备注：{data.remark}" if data.remark else ""),
            )
            log2 = AuditLog(
                order_id=order.id, operator_id=operator.id, action=AuditAction.CONFIRM_CONTRACT,
                remark=f"审核主管【{operator.name}】确认合同已签署",
            )
            db.add(log1)
            db.add(log2)
            db.flush()
            db.commit()
            db.refresh(order)
            db.refresh(log1)
            results.append(_make_batch_result(order, True, audit_log_id=log1.id))
        except Exception as e:
            db.rollback()
            order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
            results.append(_make_batch_result(order, False, reject_reason=str(e)))

    success_count = sum(1 for r in results if r.success)
    return BatchResponse(
        total=len(results), success_count=success_count,
        fail_count=len(results) - success_count, results=results,
    )


@post("/orders/batch/reject", guards=[require_supervisor])
async def batch_reject_orders(
    data: BatchRejectRequest,
    request: Request,
) -> BatchResponse:
    db: Session = next(get_db())
    operator = get_current_user(request)
    results = []
    if not data.reject_reason or not data.reject_reason.strip():
        return BatchResponse(total=0, success_count=0, fail_count=0, results=[
            BatchItemResult(order_id=0, success=False, reject_reason="请填写驳回原因")
        ])
    for order_id in data.order_ids:
        try:
            order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
            if not order:
                results.append(BatchItemResult(order_id=order_id, success=False, reject_reason="入会单不存在"))
                continue

            allowed = {OrderStatus.PENDING_REVIEW, OrderStatus.RESUBMITTED}
            if order.status not in allowed:
                results.append(_make_batch_result(
                    order, False,
                    reject_reason=f"当前状态【{order.status.value}】下不能驳回，仅待审核或补正后重提可驳回"
                ))
                continue

            for req in order.required_attachments:
                if not req.is_provided:
                    old_reason = req.reject_reason or ""
                    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
                    new_line = f"[{timestamp} 最终驳回-{operator.name}] 整体驳回：{data.reject_reason}"
                    req.reject_reason = f"{new_line}\n{old_reason}" if old_reason else new_line

            from_status = order.status
            order.status = OrderStatus.REJECTED
            order.reject_reason = data.reject_reason
            order.updated_at = datetime.utcnow()

            log = AuditLog(
                order_id=order.id, operator_id=operator.id, action=AuditAction.REJECT,
                from_status=from_status, to_status=order.status,
                remark=f"审核主管【{operator.name}】予以驳回" +
                       (f"，备注：{data.remark}" if data.remark else ""),
                failure_reason=data.reject_reason,
            )
            db.add(log)
            db.flush()
            db.commit()
            db.refresh(order)
            db.refresh(log)
            results.append(_make_batch_result(order, True, audit_log_id=log.id))
        except Exception as e:
            db.rollback()
            order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
            results.append(_make_batch_result(order, False, reject_reason=str(e)))

    success_count = sum(1 for r in results if r.success)
    return BatchResponse(
        total=len(results), success_count=success_count,
        fail_count=len(results) - success_count, results=results,
    )


@post("/orders/batch/review", guards=[require_reviewer])
async def batch_review_orders(
    data: BatchRequest,
    request: Request,
) -> BatchResponse:
    db: Session = next(get_db())
    operator = get_current_user(request)
    results = []
    for order_id in data.order_ids:
        try:
            order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
            if not order:
                results.append(BatchItemResult(order_id=order_id, success=False, reject_reason="入会单不存在"))
                continue

            if order.status != OrderStatus.APPROVED_REVIEW:
                results.append(_make_batch_result(
                    order, False,
                    reject_reason=f"当前状态【{order.status.value}】下不能复核，仅审核通过待复核可复核"
                ))
                continue

            if not order.contract_confirmed:
                results.append(_make_batch_result(order, False, reject_reason="合同尚未确认，不能复核"))
                continue

            missing = db.query(RequiredAttachment).filter(
                RequiredAttachment.order_id == order_id,
                RequiredAttachment.is_provided == False,
            ).all()
            if missing:
                missing_names = "、".join([m.attachment_name for m in missing])
                results.append(_make_batch_result(
                    order, False,
                    reject_reason=f"仍有 {len(missing)} 份附件缺失（{missing_names}）"
                ))
                continue

            from_status = order.status
            order.status = OrderStatus.REVIEWED
            order.updated_at = datetime.utcnow()

            log = AuditLog(
                order_id=order.id, operator_id=operator.id, action=AuditAction.REVIEW,
                from_status=from_status, to_status=order.status,
                remark=f"复核负责人【{operator.name}】复核通过，信息核实无误" +
                       (f"，备注：{data.remark}" if data.remark else ""),
            )
            db.add(log)
            db.flush()
            db.commit()
            db.refresh(order)
            db.refresh(log)
            results.append(_make_batch_result(order, True, audit_log_id=log.id))
        except Exception as e:
            db.rollback()
            order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
            results.append(_make_batch_result(order, False, reject_reason=str(e)))

    success_count = sum(1 for r in results if r.success)
    return BatchResponse(
        total=len(results), success_count=success_count,
        fail_count=len(results) - success_count, results=results,
    )


@post("/orders/batch/archive", guards=[require_reviewer])
async def batch_archive_orders(
    data: BatchRequest,
    request: Request,
) -> BatchResponse:
    db: Session = next(get_db())
    operator = get_current_user(request)
    results = []
    for order_id in data.order_ids:
        try:
            order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
            if not order:
                results.append(BatchItemResult(order_id=order_id, success=False, reject_reason="入会单不存在"))
                continue

            if order.status != OrderStatus.REVIEWED:
                results.append(_make_batch_result(
                    order, False,
                    reject_reason=f"当前状态【{order.status.value}】下不能归档，仅复核通过待归档可归档"
                ))
                continue

            from_status = order.status
            order.status = OrderStatus.ARCHIVED
            order.card_activated = True
            order.updated_at = datetime.utcnow()

            log1 = AuditLog(
                order_id=order.id, operator_id=operator.id, action=AuditAction.ACTIVATE_CARD,
                remark=f"复核负责人【{operator.name}】启用会员卡权益",
            )
            log2 = AuditLog(
                order_id=order.id, operator_id=operator.id, action=AuditAction.ARCHIVE,
                from_status=from_status, to_status=order.status,
                remark=f"复核负责人【{operator.name}】完成入会单归档" +
                       (f"，备注：{data.remark}" if data.remark else ""),
            )
            db.add(log1)
            db.add(log2)
            db.flush()
            db.commit()
            db.refresh(order)
            db.refresh(log2)
            results.append(_make_batch_result(order, True, audit_log_id=log2.id))
        except Exception as e:
            db.rollback()
            order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
            results.append(_make_batch_result(order, False, reject_reason=str(e)))

    success_count = sum(1 for r in results if r.success)
    return BatchResponse(
        total=len(results), success_count=success_count,
        fail_count=len(results) - success_count, results=results,
    )


orders_router = Router(path="/api", route_handlers=[
    list_orders, get_order, create_order, submit_order,
    approve_order, request_supplement, reject_order,
    review_order, archive_order,
    batch_submit_orders, batch_approve_orders, batch_reject_orders,
    batch_review_orders, batch_archive_orders,
])
