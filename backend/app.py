import json
import os
from datetime import datetime
from typing import Optional
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.routing import Route, Mount
from starlette.requests import Request
from sqlalchemy.orm import Session

from config import settings
from database import get_db, Base, engine
from models import (
    Role, User, RepairTicket, Attachment, WorkOrderLog, AuditLog,
    RoleEnum, TicketStatusEnum, AttachmentTypeEnum
)
from schemas import (
    LoginRequest, RepairTicketCreate, RepairTicketUpdate,
    TicketActionRequest, AttachmentUpdate, RepairTicketResponse,
    AttachmentResponse, WorkOrderLogResponse, AuditLogResponse
)
from security import verify_password, create_access_token, decode_token


def serialize(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, "__dict__"):
        return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    return str(obj)


def ticket_to_dict(ticket: RepairTicket, db: Session) -> dict:
    data = {
        "id": ticket.id,
        "ticket_no": ticket.ticket_no,
        "title": ticket.title,
        "owner_name": ticket.owner_name,
        "owner_phone": ticket.owner_phone,
        "address": ticket.address,
        "repair_type": ticket.repair_type,
        "priority": ticket.priority,
        "description": ticket.description,
        "status": ticket.status.value if ticket.status else None,
        "is_overdue": ticket.is_overdue or False,
        "deadline_at": ticket.deadline_at.isoformat() if ticket.deadline_at else None,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
        "assigned_at": ticket.assigned_at.isoformat() if ticket.assigned_at else None,
        "completed_at": ticket.completed_at.isoformat() if ticket.completed_at else None,
        "archived_at": ticket.archived_at.isoformat() if ticket.archived_at else None,
        "created_by_id": ticket.created_by_id,
        "created_by_name": ticket.created_by.full_name if ticket.created_by else None,
        "handled_by_id": ticket.handled_by_id,
        "handled_by_name": ticket.handled_by.full_name if ticket.handled_by else None,
        "reviewed_by_id": ticket.reviewed_by_id,
        "reviewed_by_name": ticket.reviewed_by.full_name if ticket.reviewed_by else None,
        "repair_result": ticket.repair_result,
        "reject_reason": ticket.reject_reason,
        "review_note": ticket.review_note,
        "visit_feedback": ticket.visit_feedback,
        "visit_remark": ticket.visit_remark,
        "attachments": [attachment_to_dict(a) for a in ticket.attachments],
        "work_logs": [worklog_to_dict(w) for w in ticket.work_logs],
    }
    return data


def attachment_to_dict(a: Attachment) -> dict:
    return {
        "id": a.id,
        "ticket_id": a.ticket_id,
        "file_name": a.file_name,
        "file_path": a.file_path,
        "file_size": a.file_size,
        "mime_type": a.mime_type,
        "attachment_type": a.attachment_type.value if a.attachment_type else None,
        "is_required": a.is_required or False,
        "is_supplementary": a.is_supplementary or False,
        "is_rejected": a.is_rejected or False,
        "reject_reason": a.reject_reason,
        "review_note": a.review_note,
        "uploaded_by_id": a.uploaded_by_id,
        "uploaded_by_name": a.uploaded_by.full_name if a.uploaded_by else None,
        "uploaded_at": a.uploaded_at.isoformat() if a.uploaded_at else None,
    }


def worklog_to_dict(w: WorkOrderLog) -> dict:
    return {
        "id": w.id,
        "ticket_id": w.ticket_id,
        "from_status": w.from_status,
        "to_status": w.to_status,
        "action": w.action,
        "remark": w.remark,
        "operator_id": w.operator_id,
        "operator_name": w.operator_name,
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }


def auditlog_to_dict(a: AuditLog) -> dict:
    return {
        "id": a.id,
        "ticket_id": a.ticket_id,
        "user_id": a.user_id,
        "user_name": a.user_name,
        "action": a.action,
        "module": a.module,
        "detail": a.detail,
        "failure_reason": a.failure_reason,
        "is_success": a.is_success,
        "ip_address": a.ip_address,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def user_to_dict(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "phone": u.phone,
        "role_code": u.role.code,
        "role_name": u.role.name,
        "role": u.role.code,
    }


async def parse_json_body(request: Request):
    try:
        return await request.json()
    except Exception:
        return None


def get_current_user(request: Request, db: Session) -> Optional[User]:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("user_id")
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    return user


def add_work_log(db: Session, ticket: RepairTicket, action: str, operator_id: int,
                 operator_name: str, remark: str = None, from_status: str = None, to_status: str = None):
    log = WorkOrderLog(
        ticket_id=ticket.id,
        from_status=from_status,
        to_status=to_status,
        action=action,
        remark=remark,
        operator_id=operator_id,
        operator_name=operator_name,
        created_at=datetime.utcnow(),
    )
    db.add(log)


def add_audit_log(db: Session, user: User, action: str, module: str,
                  ticket_id: int = None, detail: str = None,
                  failure_reason: str = None, is_success: bool = True,
                  ip_address: str = None):
    log = AuditLog(
        ticket_id=ticket_id,
        user_id=user.id,
        user_name=user.full_name,
        action=action,
        module=module,
        detail=detail,
        failure_reason=failure_reason,
        is_success=is_success,
        ip_address=ip_address,
        created_at=datetime.utcnow(),
    )
    db.add(log)


STATUS_LABELS = {
    "draft": "草稿",
    "pending_review": "待审核",
    "review_passed": "审核通过",
    "assigned": "已派单",
    "in_progress": "维修中",
    "completed": "待复核",
    "revision_required": "待补正",
    "archived": "已归档",
    "rejected": "已驳回",
}

PRIORITY_LABELS = {
    "low": "低",
    "normal": "普通",
    "high": "高",
    "urgent": "紧急",
}


# ==================== API Handlers ====================

async def health_check(request):
    return JSONResponse({"status": "ok", "time": datetime.utcnow().isoformat()})


async def login(request: Request):
    db = next(get_db())
    try:
        body = await parse_json_body(request)
        if not body:
            return JSONResponse({"detail": "请求体格式错误"}, status_code=400)

        username = body.get("username")
        password = body.get("password")
        role_code = body.get("role")

        if not all([username, password, role_code]):
            return JSONResponse({"detail": "缺少必要参数"}, status_code=400)

        user = db.query(User).filter(User.username == username).first()
        if not user:
            add_audit_log(db, User(id=0, full_name="未知"), "登录失败", "认证",
                          detail=f"用户名不存在: {username}",
                          failure_reason="用户不存在", is_success=False,
                          ip_address=request.client.host if request.client else None)
            db.commit()
            return JSONResponse({"detail": "用户名或密码错误"}, status_code=401)

        if user.role.code != role_code:
            add_audit_log(db, user, "登录失败", "认证", ticket_id=None,
                          detail=f"用户选择角色不匹配: 期望{user.role.code}, 选择{role_code}",
                          failure_reason="角色不匹配", is_success=False,
                          ip_address=request.client.host if request.client else None)
            db.commit()
            return JSONResponse({
                "detail": f"该用户角色为「{user.role.name}」，与所选角色不匹配"
            }, status_code=403)

        if not verify_password(password, user.password_hash):
            add_audit_log(db, user, "登录失败", "认证",
                          detail="密码验证失败",
                          failure_reason="密码错误", is_success=False,
                          ip_address=request.client.host if request.client else None)
            db.commit()
            return JSONResponse({"detail": "用户名或密码错误"}, status_code=401)

        token = create_access_token({"user_id": user.id, "role": user.role.code})

        add_audit_log(db, user, "登录成功", "认证",
                      detail=f"角色: {user.role.name}",
                      is_success=True,
                      ip_address=request.client.host if request.client else None)
        db.commit()

        return JSONResponse({
            "access_token": token,
            "token_type": "bearer",
            "user": user_to_dict(user),
        })
    except Exception as e:
        db.rollback()
        return JSONResponse({"detail": f"服务器错误: {str(e)}"}, status_code=500)
    finally:
        db.close()


async def get_roles(request: Request):
    db = next(get_db())
    try:
        roles = db.query(Role).all()
        return JSONResponse([{
            "id": r.id, "name": r.name, "code": r.code, "description": r.description
        } for r in roles])
    finally:
        db.close()


async def get_users_by_role(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)
        role_code = request.path_params.get("role_code")
        role = db.query(Role).filter(Role.code == role_code).first()
        if not role:
            return JSONResponse({"detail": "角色不存在"}, status_code=404)
        users = db.query(User).filter(User.role_id == role.id, User.is_active == True).all()
        return JSONResponse([user_to_dict(u) for u in users])
    finally:
        db.close()


async def get_current_user_info(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)
        return JSONResponse(user_to_dict(user))
    finally:
        db.close()


async def list_tickets(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)

        qp = request.query_params
        status = qp.get("status")
        is_overdue = qp.get("is_overdue")
        priority = qp.get("priority")
        repair_type = qp.get("repair_type")
        keyword = qp.get("keyword")
        page = int(qp.get("page", 1))
        size = int(qp.get("size", 20))

        query = db.query(RepairTicket)

        if status:
            try:
                query = query.filter(RepairTicket.status == TicketStatusEnum(status))
            except ValueError:
                pass

        if is_overdue is not None and is_overdue != "":
            query = query.filter(RepairTicket.is_overdue == (is_overdue.lower() == "true"))

        if priority:
            query = query.filter(RepairTicket.priority == priority)

        if repair_type:
            query = query.filter(RepairTicket.repair_type == repair_type)

        if keyword:
            like = f"%{keyword}%"
            query = query.filter(
                (RepairTicket.ticket_no.like(like)) |
                (RepairTicket.title.like(like)) |
                (RepairTicket.owner_name.like(like)) |
                (RepairTicket.address.like(like))
            )

        total = query.count()
        tickets = query.order_by(RepairTicket.created_at.desc()).offset((page - 1) * size).limit(size).all()

        return JSONResponse({
            "total": total,
            "page": page,
            "size": size,
            "items": [ticket_to_dict(t, db) for t in tickets]
        })
    finally:
        db.close()


async def get_ticket(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)

        return JSONResponse(ticket_to_dict(ticket, db))
    finally:
        db.close()


async def create_ticket(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)
        if user.role.code != RoleEnum.REGISTRAR.value:
            return JSONResponse({"detail": "只有报修登记员可以创建工单"}, status_code=403)

        body = await parse_json_body(request)
        if not body:
            return JSONResponse({"detail": "请求体格式错误"}, status_code=400)

        required_fields = ["title", "owner_name", "owner_phone", "address", "repair_type", "description"]
        for f in required_fields:
            if not body.get(f):
                return JSONResponse({"detail": f"缺少字段: {f}"}, status_code=400)

        seq = db.query(RepairTicket).count() + 1
        ticket_no = f"RP{datetime.utcnow().strftime('%Y%m%d')}{seq:04d}"

        ticket = RepairTicket(
            ticket_no=ticket_no,
            title=body["title"],
            owner_name=body["owner_name"],
            owner_phone=body["owner_phone"],
            address=body["address"],
            repair_type=body["repair_type"],
            priority=body.get("priority", "normal"),
            description=body["description"],
            status=TicketStatusEnum.DRAFT,
            deadline_at=datetime.fromisoformat(body["deadline_at"]) if body.get("deadline_at") else None,
            created_by_id=user.id,
        )
        db.add(ticket)
        db.flush()

        add_work_log(db, ticket, "创建工单", user.id, user.full_name,
                     remark="报修登记员新建工单草稿",
                     from_status=None, to_status="draft")
        add_audit_log(db, user, "创建工单", "报修登记", ticket_id=ticket.id,
                      detail=f"新建工单: {ticket.title}", is_success=True)

        attachments_data = body.get("attachments", [])
        for att_data in attachments_data:
            att = Attachment(
                ticket_id=ticket.id,
                file_name=att_data.get("file_name", "unnamed"),
                file_path=att_data.get("file_path", "/uploads/"),
                file_size=att_data.get("file_size"),
                mime_type=att_data.get("mime_type"),
                attachment_type=AttachmentTypeEnum(att_data.get("attachment_type", "required")),
                is_required=att_data.get("is_required", True),
                is_supplementary=att_data.get("is_supplementary", False),
                uploaded_by_id=user.id,
            )
            db.add(att)

        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db), status_code=201)
    except Exception as e:
        db.rollback()
        return JSONResponse({"detail": f"创建失败: {str(e)}"}, status_code=500)
    finally:
        db.close()


async def submit_for_review(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)
        if user.role.code != RoleEnum.REGISTRAR.value:
            return JSONResponse({"detail": "只有报修登记员可以提交审核"}, status_code=403)

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)

        if ticket.status not in [TicketStatusEnum.DRAFT, TicketStatusEnum.REVISION_REQUIRED]:
            return JSONResponse({"detail": f"当前状态 {ticket.status.value} 不允许提交审核"}, status_code=400)

        required_atts = [a for a in ticket.attachments if a.is_required and not a.is_rejected]
        if len(required_atts) == 0:
            add_audit_log(db, user, "提交审核失败", "报修登记", ticket_id=ticket.id,
                          detail="尝试提交但缺少必填附件",
                          failure_reason="缺少至少1个必填附件(非驳回状态)", is_success=False)
            db.commit()
            return JSONResponse({"detail": "请至少上传1个必填附件后再提交"}, status_code=400)

        body = await parse_json_body(request) or {}
        remark = body.get("remark", "提交审核")

        old_status = ticket.status.value
        ticket.status = TicketStatusEnum.PENDING_REVIEW
        ticket.reject_reason = None

        add_work_log(db, ticket, "提交审核", user.id, user.full_name,
                     remark=remark, from_status=old_status, to_status="pending_review")
        add_audit_log(db, user, "提交审核", "报修登记", ticket_id=ticket.id,
                      detail=remark, is_success=True)
        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return JSONResponse({"detail": f"提交失败: {str(e)}"}, status_code=500)
    finally:
        db.close()


async def approve_ticket(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)
        if user.role.code != RoleEnum.SUPERVISOR.value:
            return JSONResponse({"detail": "只有报修审核主管可以审核工单"}, status_code=403)

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)
        if ticket.status != TicketStatusEnum.PENDING_REVIEW:
            return JSONResponse({"detail": f"当前状态不允许审核通过"}, status_code=400)

        body = await parse_json_body(request) or {}
        remark = body.get("remark", "审核通过")

        old_status = ticket.status.value
        ticket.status = TicketStatusEnum.REVIEW_PASSED
        ticket.handled_by_id = user.id

        add_work_log(db, ticket, "审核通过", user.id, user.full_name,
                     remark=remark, from_status=old_status, to_status="review_passed")
        add_audit_log(db, user, "审核通过", "工单审核", ticket_id=ticket.id,
                      detail=remark, is_success=True)
        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return JSONResponse({"detail": f"审核失败: {str(e)}"}, status_code=500)
    finally:
        db.close()


async def reject_or_return(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)
        if user.role.code != RoleEnum.SUPERVISOR.value:
            return JSONResponse({"detail": "只有报修审核主管可以操作"}, status_code=403)

        ticket_id = int(request.path_params["ticket_id"])
        action = request.path_params["action"]
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)

        if ticket.status != TicketStatusEnum.PENDING_REVIEW:
            return JSONResponse({"detail": "当前状态不允许该操作"}, status_code=400)

        body = await parse_json_body(request) or {}
        reject_reason = body.get("reject_reason")
        remark = body.get("remark", reject_reason)

        if not reject_reason:
            add_audit_log(db, user, f"{action}失败", "工单审核", ticket_id=ticket.id,
                          detail="未提供原因",
                          failure_reason="必须说明退回/驳回原因", is_success=False)
            db.commit()
            return JSONResponse({"detail": "必须提供原因"}, status_code=400)

        old_status = ticket.status.value
        if action == "return":
            ticket.status = TicketStatusEnum.REVISION_REQUIRED
            action_label = "退回补正"
        elif action == "reject":
            ticket.status = TicketStatusEnum.REJECTED
            action_label = "驳回工单"
        else:
            return JSONResponse({"detail": "无效操作"}, status_code=400)

        ticket.reject_reason = reject_reason
        ticket.handled_by_id = user.id

        add_work_log(db, ticket, action_label, user.id, user.full_name,
                     remark=remark, from_status=old_status, to_status=ticket.status.value)
        add_audit_log(db, user, action_label, "工单审核", ticket_id=ticket.id,
                      detail=remark, failure_reason=reject_reason, is_success=False)
        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return JSONResponse({"detail": f"操作失败: {str(e)}"}, status_code=500)
    finally:
        db.close()


async def assign_ticket(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)
        if user.role.code != RoleEnum.SUPERVISOR.value:
            return JSONResponse({"detail": "只有报修审核主管可以派单"}, status_code=403)

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)
        if ticket.status != TicketStatusEnum.REVIEW_PASSED:
            return JSONResponse({"detail": "当前状态不允许派单"}, status_code=400)

        body = await parse_json_body(request) or {}
        remark = body.get("remark", "派单处理")

        old_status = ticket.status.value
        ticket.status = TicketStatusEnum.ASSIGNED
        ticket.assigned_at = datetime.utcnow()

        add_work_log(db, ticket, "派单处理", user.id, user.full_name,
                     remark=remark, from_status=old_status, to_status="assigned")
        add_audit_log(db, user, "派单处理", "工单审核", ticket_id=ticket.id,
                      detail=remark, is_success=True)
        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return JSONResponse({"detail": f"派单失败: {str(e)}"}, status_code=500)
    finally:
        db.close()


async def start_repair(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)
        if user.role.code != RoleEnum.SUPERVISOR.value:
            return JSONResponse({"detail": "只有报修审核主管可以操作"}, status_code=403)

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)
        if ticket.status != TicketStatusEnum.ASSIGNED:
            return JSONResponse({"detail": "当前状态不允许该操作"}, status_code=400)

        body = await parse_json_body(request) or {}
        remark = body.get("remark", "维修人员已到场，开始处理")

        old_status = ticket.status.value
        ticket.status = TicketStatusEnum.IN_PROGRESS

        add_work_log(db, ticket, "开始维修", user.id, user.full_name,
                     remark=remark, from_status=old_status, to_status="in_progress")
        add_audit_log(db, user, "开始维修", "工单处理", ticket_id=ticket.id,
                      detail=remark, is_success=True)
        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return JSONResponse({"detail": f"操作失败: {str(e)}"}, status_code=500)
    finally:
        db.close()


async def complete_repair(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)
        if user.role.code != RoleEnum.SUPERVISOR.value:
            return JSONResponse({"detail": "只有报修审核主管可以登记完工"}, status_code=403)

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)
        if ticket.status != TicketStatusEnum.IN_PROGRESS:
            return JSONResponse({"detail": "当前状态不允许登记完工"}, status_code=400)

        body = await parse_json_body(request) or {}
        repair_result = body.get("repair_result")
        if not repair_result:
            add_audit_log(db, user, "完工登记失败", "工单处理", ticket_id=ticket.id,
                          detail="缺少维修结果",
                          failure_reason="必须填写维修结果说明", is_success=False)
            db.commit()
            return JSONResponse({"detail": "必须填写维修结果"}, status_code=400)

        remark = body.get("remark", repair_result)

        old_status = ticket.status.value
        ticket.status = TicketStatusEnum.COMPLETED
        ticket.repair_result = repair_result
        ticket.completed_at = datetime.utcnow()

        if ticket.deadline_at and ticket.completed_at > ticket.deadline_at:
            ticket.is_overdue = True

        add_work_log(db, ticket, "完工登记", user.id, user.full_name,
                     remark=remark, from_status=old_status, to_status="completed")
        add_audit_log(db, user, "完工登记", "工单处理", ticket_id=ticket.id,
                      detail=repair_result, is_success=True)
        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return JSONResponse({"detail": f"操作失败: {str(e)}"}, status_code=500)
    finally:
        db.close()


async def review_complete(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)
        if user.role.code != RoleEnum.REVIEWER.value:
            return JSONResponse({"detail": "只有复核负责人可以操作"}, status_code=403)

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)
        if ticket.status != TicketStatusEnum.COMPLETED:
            return JSONResponse({"detail": "当前状态不允许该操作"}, status_code=400)

        body = await parse_json_body(request) or {}
        review_note = body.get("review_note")
        visit_feedback = body.get("visit_feedback")
        visit_remark = body.get("visit_remark")

        if not review_note or not visit_feedback:
            add_audit_log(db, user, "复核失败", "中心复核", ticket_id=ticket.id,
                          detail="缺少复核意见或回访评价",
                          failure_reason="必须填写复核意见和回访评价", is_success=False)
            db.commit()
            return JSONResponse({"detail": "必须填写复核意见和回访评价"}, status_code=400)

        old_status = ticket.status.value
        ticket.status = TicketStatusEnum.ARCHIVED
        ticket.review_note = review_note
        ticket.visit_feedback = visit_feedback
        ticket.visit_remark = visit_remark
        ticket.reviewed_by_id = user.id
        ticket.archived_at = datetime.utcnow()

        add_work_log(db, ticket, "复核归档", user.id, user.full_name,
                     remark=f"复核: {review_note} | 回访评价: {visit_feedback}",
                     from_status=old_status, to_status="archived")
        add_audit_log(db, user, "复核归档", "中心复核", ticket_id=ticket.id,
                      detail=f"复核意见: {review_note}; 回访: {visit_feedback} - {visit_remark or ''}",
                      is_success=True)
        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return JSONResponse({"detail": f"操作失败: {str(e)}"}, status_code=500)
    finally:
        db.close()


async def update_attachment(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)

        att_id = int(request.path_params["att_id"])
        att = db.query(Attachment).filter(Attachment.id == att_id).first()
        if not att:
            return JSONResponse({"detail": "附件不存在"}, status_code=404)

        ticket = db.query(RepairTicket).filter(RepairTicket.id == att.ticket_id).first()

        body = await parse_json_body(request) or {}

        if body.get("attachment_type"):
            att.attachment_type = AttachmentTypeEnum(body["attachment_type"])

        if "is_required" in body:
            att.is_required = body["is_required"]
        if "is_supplementary" in body:
            att.is_supplementary = body["is_supplementary"]
        if "is_rejected" in body:
            att.is_rejected = body["is_rejected"]
            if body["is_rejected"] and user.role.code == RoleEnum.SUPERVISOR.value:
                att.attachment_type = AttachmentTypeEnum.REJECTED
        if body.get("reject_reason"):
            att.reject_reason = body["reject_reason"]
        if body.get("review_note"):
            att.review_note = body["review_note"]

        detail = f"修改附件[{att.file_name}]:"
        changes = []
        if "is_rejected" in body:
            changes.append(f"驳回={'是' if body['is_rejected'] else '否'}")
        if body.get("reject_reason"):
            changes.append(f"驳回原因={body['reject_reason']}")
        if "is_required" in body:
            changes.append(f"必传={'是' if body['is_required'] else '否'}")
        if "is_supplementary" in body:
            changes.append(f"补传={'是' if body['is_supplementary'] else '否'}")
        detail += "; ".join(changes)

        add_audit_log(db, user, "修改附件", "附件管理", ticket_id=att.ticket_id,
                      detail=detail, is_success=True)

        db.commit()
        db.refresh(att)
        return JSONResponse(attachment_to_dict(att))
    except Exception as e:
        db.rollback()
        return JSONResponse({"detail": f"更新失败: {str(e)}"}, status_code=500)
    finally:
        db.close()


async def add_attachment(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return JSONResponse({"detail": "工单不存在"}, status_code=404)

        body = await parse_json_body(request) or {}
        file_name = body.get("file_name")
        if not file_name:
            return JSONResponse({"detail": "缺少文件名"}, status_code=400)

        att = Attachment(
            ticket_id=ticket_id,
            file_name=file_name,
            file_path=body.get("file_path", f"/uploads/{file_name}"),
            file_size=body.get("file_size"),
            mime_type=body.get("mime_type"),
            attachment_type=AttachmentTypeEnum(body.get("attachment_type", "required")),
            is_required=body.get("is_required", False),
            is_supplementary=body.get("is_supplementary", False),
            uploaded_by_id=user.id,
            review_note=body.get("review_note"),
        )
        db.add(att)
        db.flush()

        add_audit_log(db, user, "上传附件", "附件管理", ticket_id=ticket_id,
                      detail=f"上传附件: {file_name} (补传={att.is_supplementary}, 必传={att.is_required})",
                      is_success=True)

        db.commit()
        db.refresh(att)
        return JSONResponse(attachment_to_dict(att), status_code=201)
    except Exception as e:
        db.rollback()
        return JSONResponse({"detail": f"添加失败: {str(e)}"}, status_code=500)
    finally:
        db.close()


async def list_audit_logs(request: Request):
    db = next(get_db())
    try:
        user = get_current_user(request, db)
        if not user:
            return JSONResponse({"detail": "未登录"}, status_code=401)

        qp = request.query_params
        ticket_id = qp.get("ticket_id")
        is_success = qp.get("is_success")
        page = int(qp.get("page", 1))
        size = int(qp.get("size", 50))

        query = db.query(AuditLog)
        if ticket_id:
            query = query.filter(AuditLog.ticket_id == int(ticket_id))
        if is_success is not None and is_success != "":
            query = query.filter(AuditLog.is_success == (is_success.lower() == "true"))

        total = query.count()
        logs = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * size).limit(size).all()
        return JSONResponse({
            "total": total,
            "items": [auditlog_to_dict(l) for l in logs]
        })
    finally:
        db.close()


async def seed_database(request: Request):
    from seed_data import init_database
    try:
        init_database()
        return JSONResponse({"status": "ok", "message": "数据库初始化并载入种子数据完成"})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


def create_app():
    app = Starlette(
        debug=True,
        routes=[
            Route("/health", health_check, methods=["GET"]),
            Route("/api/seed", seed_database, methods=["POST"]),
            Route("/api/auth/login", login, methods=["POST"]),
            Route("/api/auth/roles", get_roles, methods=["GET"]),
            Route("/api/auth/me", get_current_user_info, methods=["GET"]),
            Route("/api/users/role/{role_code}", get_users_by_role, methods=["GET"]),
            Route("/api/tickets", list_tickets, methods=["GET"]),
            Route("/api/tickets", create_ticket, methods=["POST"]),
            Route("/api/tickets/{ticket_id:int}", get_ticket, methods=["GET"]),
            Route("/api/tickets/{ticket_id:int}/submit", submit_for_review, methods=["POST"]),
            Route("/api/tickets/{ticket_id:int}/approve", approve_ticket, methods=["POST"]),
            Route("/api/tickets/{ticket_id:int}/{action:return|reject}", reject_or_return, methods=["POST"]),
            Route("/api/tickets/{ticket_id:int}/assign", assign_ticket, methods=["POST"]),
            Route("/api/tickets/{ticket_id:int}/start", start_repair, methods=["POST"]),
            Route("/api/tickets/{ticket_id:int}/complete", complete_repair, methods=["POST"]),
            Route("/api/tickets/{ticket_id:int}/review", review_complete, methods=["POST"]),
            Route("/api/tickets/{ticket_id:int}/attachments", add_attachment, methods=["POST"]),
            Route("/api/attachments/{att_id:int}", update_attachment, methods=["PATCH"]),
            Route("/api/audit-logs", list_audit_logs, methods=["GET"]),
        ],
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.FRONTEND_URL, "http://localhost:3001", "http://127.0.0.1:3001"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    db_path = os.path.join(os.path.dirname(__file__), "repair_system.db")
    if not os.path.exists(db_path):
        Base.metadata.create_all(bind=engine)
        from seed_data import init_database
        init_database()
    uvicorn.run(app, host="0.0.0.0", port=settings.BACKEND_PORT, reload=False)
