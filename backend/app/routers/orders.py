from datetime import datetime
from typing import Optional
from litestar import Router, get, post, put, delete
from litestar.params import Parameter
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    MembershipOrder, OrderStatus, RequiredAttachment, Attachment, AttachmentType,
    AuditLog, AuditAction, User
)
from app.schemas import (
    MembershipOrderSchema, MembershipOrderCreate, OrderQueryParams,
    RequiredAttachmentSchema, AttachmentSchema, AuditLogSchema,
    ReviewAction, SupplementRequest, ContractConfirm, CardActivate
)


def _get_operator(db: Session, operator_id: int = 1):
    user = db.query(User).filter(User.id == operator_id).first()
    if not user:
        user = db.query(User).first()
    return user


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
        logs.append(log_dict)
    data.audit_logs = logs
    return data


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
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=404, detail="会员入会单不存在")
    return _serialize_order(db, order)


@post("/orders")
async def create_order(data: MembershipOrderCreate) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator = _get_operator(db, 1)
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
               to_status=OrderStatus.DRAFT, remark="创建会员入会单")
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@post("/orders/{order_id:int}/submit")
async def submit_order(order_id: int, data: dict = {}) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator_id = data.get("operator_id", 1)
    operator = _get_operator(db, operator_id)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    allowed = {OrderStatus.DRAFT, OrderStatus.MATERIALS_MISSING}
    if order.status not in allowed:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=400, detail=f"当前状态[{order.status.value}]不能提交")

    missing = db.query(RequiredAttachment).filter(
        RequiredAttachment.order_id == order_id,
        RequiredAttachment.is_provided == False,
    ).all()

    from_status = order.status
    if from_status == OrderStatus.MATERIALS_MISSING:
        if missing:
            from litestar.exceptions import HTTPException
            missing_names = "、".join([m.attachment_name for m in missing])
            raise HTTPException(
                status_code=400,
                detail=f"仍有缺失附件未补正：{missing_names}，请补齐后再提交"
            )
        order.status = OrderStatus.RESUBMITTED
        action = AuditAction.RESUBMIT
        remark = data.get("remark") or "附件补齐后重新提交审核"
    else:
        order.status = OrderStatus.PENDING_REVIEW
        action = AuditAction.SUBMIT
        remark = data.get("remark") or "提交会员入会单进入审核"

    order.is_overdue = False
    order.reject_reason = None
    order.updated_at = datetime.utcnow()

    _add_audit(db, order.id, operator.id, action,
               from_status=from_status, to_status=order.status, remark=remark)
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@post("/orders/{order_id:int}/approve")
async def approve_order(order_id: int, data: ReviewAction) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator_id = 2
    operator = _get_operator(db, operator_id)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    allowed = {OrderStatus.PENDING_REVIEW, OrderStatus.RESUBMITTED}
    if order.status not in allowed:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=400, detail=f"当前状态[{order.status.value}]审核主管不能办理通过")

    from_status = order.status
    order.status = OrderStatus.APPROVED_REVIEW
    order.contract_confirmed = True
    order.updated_at = datetime.utcnow()

    _add_audit(db, order.id, operator.id, AuditAction.APPROVE,
               from_status=from_status, to_status=order.status,
               remark=data.remark or "审核主管办理通过，材料齐全有效")
    _add_audit(db, order.id, operator.id, AuditAction.CONFIRM_CONTRACT,
               remark="合同已确认签署")
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@post("/orders/{order_id:int}/request-supplement")
async def request_supplement(order_id: int, data: SupplementRequest) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator_id = 2
    operator = _get_operator(db, operator_id)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    allowed = {OrderStatus.PENDING_REVIEW, OrderStatus.RESUBMITTED}
    if order.status not in allowed:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=400, detail=f"当前状态[{order.status.value}]不能退回补正")

    for req_id in data.required_attachment_ids:
        req = db.query(RequiredAttachment).filter(RequiredAttachment.id == req_id).first()
        if req and req.order_id == order_id:
            req.is_provided = False
            if not req.missing_reason:
                req.missing_reason = "审核退回，需要补正"

    missing_list = db.query(RequiredAttachment).filter(
        RequiredAttachment.order_id == order_id,
        RequiredAttachment.is_provided == False,
    ).all()
    missing_names = "、".join([m.attachment_name for m in missing_list]) if missing_list else ""

    from_status = order.status
    order.status = OrderStatus.MATERIALS_MISSING
    order.reject_reason = f"附件缺失/不合格：{missing_names}，请补正后重新提交"
    if data.remark:
        order.reject_reason += f"。备注：{data.remark}"
    order.updated_at = datetime.utcnow()

    _add_audit(
        db, order.id, operator.id, AuditAction.REQUEST_SUPPLEMENT,
        from_status=from_status, to_status=order.status,
        remark=data.remark or f"退回补正，需补充：{missing_names}",
        failure_reason=f"附件缺失或不合格：{missing_names}，不满足审核条件"
    )
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@post("/orders/{order_id:int}/reject")
async def reject_order(order_id: int, data: ReviewAction) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator_id = 2
    operator = _get_operator(db, operator_id)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    allowed = {OrderStatus.PENDING_REVIEW, OrderStatus.RESUBMITTED}
    if order.status not in allowed:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=400, detail=f"当前状态[{order.status.value}]不能驳回")

    from_status = order.status
    order.status = OrderStatus.REJECTED
    order.reject_reason = data.reject_reason or "材料审核不通过，予以驳回"
    order.updated_at = datetime.utcnow()

    _add_audit(
        db, order.id, operator.id, AuditAction.REJECT,
        from_status=from_status, to_status=order.status,
        remark=data.remark or "审核驳回",
        failure_reason=data.reject_reason or "会员入会申请材料不满足审核标准，予以驳回"
    )
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@post("/orders/{order_id:int}/review")
async def review_order(order_id: int, data: ReviewAction) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator_id = 3
    operator = _get_operator(db, operator_id)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    if order.status != OrderStatus.APPROVED_REVIEW:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=400, detail=f"当前状态[{order.status.value}]不能复核")

    from_status = order.status
    order.status = OrderStatus.REVIEWED
    order.updated_at = datetime.utcnow()

    _add_audit(db, order.id, operator.id, AuditAction.REVIEW,
               from_status=from_status, to_status=order.status,
               remark=data.remark or "复核通过，信息核实无误")
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@post("/orders/{order_id:int}/archive")
async def archive_order(order_id: int, data: ReviewAction) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator_id = 3
    operator = _get_operator(db, operator_id)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    if order.status != OrderStatus.REVIEWED:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=400, detail=f"当前状态[{order.status.value}]不能归档")

    from_status = order.status
    order.status = OrderStatus.ARCHIVED
    order.card_activated = True
    order.updated_at = datetime.utcnow()

    _add_audit(db, order.id, operator.id, AuditAction.ACTIVATE_CARD,
               remark="会员卡权益已启用")
    _add_audit(db, order.id, operator.id, AuditAction.ARCHIVE,
               from_status=from_status, to_status=order.status,
               remark=data.remark or "入会单复核归档完成")
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@put("/orders/{order_id:int}/contract")
async def confirm_contract(order_id: int, data: ContractConfirm) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator = _get_operator(db, 2)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    order.contract_confirmed = data.confirmed
    order.updated_at = datetime.utcnow()
    _add_audit(db, order.id, operator.id, AuditAction.CONFIRM_CONTRACT,
               remark="合同确认状态已更新")
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@put("/orders/{order_id:int}/card")
async def activate_card(order_id: int, data: CardActivate) -> MembershipOrderSchema:
    db: Session = next(get_db())
    operator = _get_operator(db, 3)
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        from litestar.exceptions import HTTPException
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    order.card_activated = data.activated
    order.updated_at = datetime.utcnow()
    _add_audit(db, order.id, operator.id, AuditAction.ACTIVATE_CARD,
               remark="卡权益启用状态已更新")
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


orders_router = Router(path="/api", route_handlers=[
    list_orders, get_order, create_order, submit_order,
    approve_order, request_supplement, reject_order,
    review_order, archive_order, confirm_contract, activate_card
])
