from datetime import datetime
from typing import Optional
from litestar import Router, get, post, delete, status_codes
from litestar.params import Parameter
from litestar.exceptions import HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Attachment, AttachmentType, RequiredAttachment,
    AuditLog, AuditAction, User, MembershipOrder, OrderStatus
)
from app.schemas import AttachmentSchema, MembershipOrderSchema, RequiredAttachmentSchema


def _get_operator(db: Session, operator_id: int = 1):
    user = db.query(User).filter(User.id == operator_id).first()
    if not user:
        user = db.query(User).first()
    return user


def _serialize_order(db, order):
    from app.routers.orders import _serialize_order as so
    return so(db, order)


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


@post("/orders/{order_id:int}/attachments")
async def upload_attachment(order_id: int, data: dict) -> dict:
    db: Session = next(get_db())
    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="会员入会单不存在")

    operator_id = data.get("operator_id", 1)
    operator = _get_operator(db, operator_id)

    required_attachment_id = data.get("required_attachment_id")
    file_type = data.get("file_type", AttachmentType.OTHER)
    file_name = data.get("file_name", "未命名文件")
    file_size = data.get("file_size", 0)

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
            req.missing_reason = None
            req.reject_reason = None

    order.updated_at = datetime.utcnow()

    from app.routers.orders import _add_audit
    _add_audit(
        db, order_id, operator.id, AuditAction.UPLOAD_ATTACHMENT,
        remark=f"上传附件：{file_name}"
    )
    db.commit()
    db.refresh(attachment)

    return {
        "attachment": AttachmentSchema.model_validate(attachment).model_dump(),
        "order": _serialize_order(db, order).model_dump(),
    }


@delete("/orders/{order_id:int}/attachments/{attachment_id:int}", status_code=status_codes.HTTP_200_OK)
async def delete_attachment(
    order_id: int,
    attachment_id: int,
    operator_id: Optional[int] = Parameter(default=None, query=True),
) -> dict:
    db: Session = next(get_db())
    attachment = db.query(Attachment).filter(
        Attachment.id == attachment_id,
        Attachment.order_id == order_id,
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")

    order = db.query(MembershipOrder).filter(MembershipOrder.id == order_id).first()
    if order.status in {OrderStatus.ARCHIVED, OrderStatus.REVIEWED}:
        raise HTTPException(status_code=400, detail="已归档/已复核的单据不能删除附件")

    operator = _get_operator(db, operator_id or 1)

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
        remark=f"删除附件：{file_name}"
    )
    db.commit()
    db.refresh(order)

    return {
        "message": "附件已删除",
        "order": _serialize_order(db, order).model_dump(),
    }


@post("/orders/{order_id:int}/required-attachments/{req_id:int}/mark-reject")
async def mark_required_reject(order_id: int, req_id: int, data: dict) -> RequiredAttachmentSchema:
    db: Session = next(get_db())
    req = db.query(RequiredAttachment).filter(
        RequiredAttachment.id == req_id,
        RequiredAttachment.order_id == order_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="必需附件项不存在")

    req.reject_reason = data.get("reject_reason", "材料不合格")
    req.is_provided = False
    req.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(req)
    return RequiredAttachmentSchema.model_validate(req)


attachments_router = Router(path="/api", route_handlers=[
    list_attachments, list_required_attachments,
    upload_attachment, delete_attachment, mark_required_reject
])
