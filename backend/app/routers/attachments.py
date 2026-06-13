from datetime import datetime
from typing import Optional
from litestar import Router, get, post, delete, status_codes, Request
from litestar.connection import ASGIConnection
from litestar.params import Parameter
from litestar.exceptions import HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user, require_registrar
from app.models import (
    Attachment, AttachmentType, RequiredAttachment,
    AuditLog, AuditAction, User, MembershipOrder, OrderStatus
)
from app.schemas import AttachmentSchema, MembershipOrderSchema, RequiredAttachmentSchema, AttachmentUpload, AuditLogSchema


def _get_operator(db: Session, operator_id: int = 1):
    user = db.query(User).filter(User.id == operator_id).first()
    if not user:
        user = db.query(User).first()
    return user


def _serialize_order(db, order):
    from app.routers.orders import _add_audit
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


@get("/orders/{order_id:int}/attachments")
async def list_attachments(order_id: int) -> list[AttachmentSchema]:
    db: Session = next(get_db())
    items = db.query(Attachment).filter(Attachment.order_id == order_id).order_by(Attachment.uploaded_at.desc()).all()
    return [AttachmentSchema.model_validate(a) for a in items]


@get("/orders/{order_id:int}/required-attachments")
async def list_required_attachments(order_id: int) -> list[RequiredAttachmentSchema]:
    db: Session = next(get_db())
    items = db.query(RequiredAttachment).filter(RequiredAttachment.order_id == order_id).order_by(RequiredAttachment.id).all()
    return [RequiredAttachmentSchema.model_validate(a) for a in items]


@post("/orders/{order_id:int}/attachments", guards=[require_registrar])
async def upload_attachment(
    order_id: int,
    data: AttachmentUpload,
    request: Request,
) -> dict:
    db: Session = next(get_db())
    operator = get_current_user(request)

    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    if order.status not in {OrderStatus.DRAFT, OrderStatus.MATERIALS_MISSING}:
        raise HTTPException(
            status_code=400,
            detail=f"登记员【{operator.name}】上传失败：当前状态【{order.status.value}】下不能上传附件，"
                   f"只有草稿或附件缺失待补正状态可以上传"
        )

    required_attachment_id = data.required_attachment_id
    file_type = data.file_type
    file_name = data.file_name
    file_size = data.file_size or 0

    if isinstance(file_type, str):
        file_type = AttachmentType(file_type)

    attachment = Attachment(
        order_id=order_id,
        required_attachment_id=required_attachment_id,
        file_name=file_name,
        file_type=file_type,
        file_size=file_size,
        stored_name=f"upload_{order_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        uploaded_by=operator.id,
    )
    db.add(attachment)
    db.flush()

    if required_attachment_id:
        req = db.query(RequiredAttachment).filter(RequiredAttachment.id == required_attachment_id).first()
        if req and req.order_id == order_id:
            req.is_provided = True

    order.updated_at = datetime.utcnow()

    from app.routers.orders import _add_audit
    _add_audit(
        db, order_id, operator.id, AuditAction.UPLOAD_ATTACHMENT,
        remark=f"登记员【{operator.name}】上传附件：{file_name}"
    )
    db.commit()
    db.refresh(attachment)
    db.refresh(order)

    return {
        "attachment": AttachmentSchema.model_validate(attachment).model_dump(),
        "order": _serialize_order(db, order).model_dump(),
    }


@delete("/orders/{order_id:int}/attachments/{attachment_id:int}",
        status_code=status_codes.HTTP_200_OK,
        guards=[require_registrar])
async def delete_attachment(
    order_id: int,
    attachment_id: int,
    request: Request,
) -> dict:
    db: Session = next(get_db())
    operator = get_current_user(request)

    attachment = db.query(Attachment).filter(
        Attachment.id == attachment_id,
        Attachment.order_id == order_id,
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")

    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if order.status in {OrderStatus.ARCHIVED, OrderStatus.REVIEWED, OrderStatus.APPROVED_REVIEW}:
        raise HTTPException(
            status_code=400,
            detail=f"登记员【{operator.name}】删除失败：当前状态【{order.status.value}】下不能删除附件"
        )
    if order.status not in {OrderStatus.DRAFT, OrderStatus.MATERIALS_MISSING}:
        raise HTTPException(
            status_code=400,
            detail=f"登记员【{operator.name}】删除失败：只有草稿或附件缺失待补正状态可以删除附件"
        )

    req_id = attachment.required_attachment_id
    file_name = attachment.file_name
    db.delete(attachment)

    if req_id:
        req = db.query(RequiredAttachment).filter(RequiredAttachment.id == req_id).first()
        if req:
            req.is_provided = False

    order.updated_at = datetime.utcnow()

    from app.routers.orders import _add_audit
    _add_audit(
        db, order_id, operator.id, AuditAction.DELETE_ATTACHMENT,
        remark=f"登记员【{operator.name}】删除附件：{file_name}"
    )
    db.commit()
    db.refresh(order)

    return {
        "message": "附件已删除",
        "order": _serialize_order(db, order).model_dump(),
    }


attachments_router = Router(path="/api", route_handlers=[
    list_attachments, list_required_attachments,
    upload_attachment, delete_attachment,
])
