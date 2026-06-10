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


# ==================== 序列化工具 ====================
def serialize(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, "__dict__"):
        return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    return str(obj)


def ticket_to_dict(ticket: RepairTicket, db: Session) -> dict:
    attachments = sorted(ticket.attachments, key=lambda a: a.uploaded_at or datetime.min)
    return {
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
        "attachments": [attachment_to_dict(a) for a in attachments],
        "work_logs": [worklog_to_dict(w) for w in sorted(ticket.work_logs, key=lambda x: x.created_at or datetime.min)],
        "attachment_summary": summarize_attachments(ticket.attachments),
    }


def summarize_attachments(attachments):
    required_ok = sum(1 for a in attachments if a.is_required and not a.is_rejected)
    required_rejected = sum(1 for a in attachments if a.is_required and a.is_rejected)
    supplementary = sum(1 for a in attachments if a.is_supplementary)
    total = len(attachments)
    return {
        "total": total,
        "required_ok": required_ok,
        "required_rejected": required_rejected,
        "supplementary": supplementary,
    }


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
    operator_role = None
    if a.user and a.user and a.user.role:
        operator_role = a.user.role.code
    return {
        "id": a.id,
        "ticket_id": a.ticket_id,
        "user_id": a.user_id,
        "user_name": a.user_name,
        "operator_name": a.user_name,
        "operator_role": operator_role,
        "action": a.action,
        "module": a.module,
        "detail": a.detail,
        "remark": a.detail,
        "failure_reason": a.failure_reason,
        "attachment_result": a.detail if a.module == "附件管理" else None,
        "processing_result": a.detail if a.module == "工单审核" else None,
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


# ==================== 通用工具 ====================
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


def get_client_ip(request: Request) -> str:
    if request.client:
        return request.client.host
    return ""


# ==================== 统一角色+状态校验（核心闭环保障）====================
def _err(detail, code=400):
    return JSONResponse({"detail": detail}, status_code=code)


def check_auth(db, request):
    """返回 (user, error_response)；认证失败时 error_response 非空"""
    user = get_current_user(request, db)
    if not user:
        return None, _err("未登录", 401)
    return user, None


def require_role(user, allowed_roles):
    if not isinstance(allowed_roles, (list, tuple)):
        allowed_roles = [allowed_roles]
    if user.role.code not in [r.value if isinstance(r, RoleEnum) else r for r in allowed_roles]:
        allowed_names = ", ".join(STATUS_LABELS.get(r, r) for r in allowed_roles) if False else \
            ", ".join({
                "registrar": "报修登记员",
                "supervisor": "报修审核主管",
                "reviewer": "物业服务中心复核负责人",
            }[r.value if isinstance(r, RoleEnum) else r] for r in allowed_roles)
        return _err(f"操作权限不足：仅 {allowed_names} 可执行该操作", 403)
    return None


def require_status(ticket, allowed_statuses, action_desc):
    if not isinstance(allowed_statuses, (list, tuple)):
        allowed_statuses = [allowed_statuses]
    allowed_values = [s.value if isinstance(s, TicketStatusEnum) else s for s in allowed_statuses]
    if ticket.status.value not in allowed_values:
        allowed_names = "、".join(STATUS_LABELS.get(s, s) for s in allowed_values)
        return _err(
            f"当前工单状态为「{STATUS_LABELS.get(ticket.status.value, ticket.status.value)}」，"
            f"不允许执行「{action_desc}」，仅 {allowed_names} 状态可执行。",
            400
        )
    return None


# ==================== API Handlers ====================
async def health_check(request):
    return JSONResponse({
        "status": "ok",
        "time": datetime.utcnow().isoformat(),
        "ports": {"backend": settings.BACKEND_PORT, "frontend": settings.FRONTEND_PORT},
    })


async def seed_database(request: Request):
    from seed_data import init_database
    try:
        init_database()
        return JSONResponse({"status": "ok", "message": "数据库初始化并载入种子数据完成"})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


async def login(request: Request):
    db = next(get_db())
    ip = get_client_ip(request)
    try:
        body = await parse_json_body(request)
        if not body:
            return _err("请求体格式错误", 400)

        username = body.get("username")
        password = body.get("password")
        role_code = body.get("role")

        if not all([username, password, role_code]):
            return _err("缺少必要参数", 400)

        user = db.query(User).filter(User.username == username).first()
        if not user:
            add_audit_log(db, User(id=0, full_name="未知"), "登录失败", "认证",
                          detail=f"用户名不存在: {username}",
                          failure_reason="用户不存在", is_success=False, ip_address=ip)
            db.commit()
            return _err("用户名或密码错误", 401)

        if user.role.code != role_code:
            add_audit_log(db, user, "登录失败", "认证",
                          detail=f"用户角色不匹配: 实际{user.role.code}, 尝试以{role_code}登录",
                          failure_reason=f"账号「{username}」角色是「{user.role.name}」，"
                                         f"无法以「{role_code}」身份登录，请切换到对应角色账号",
                          is_success=False, ip_address=ip)
            db.commit()
            return _err(
                f"账号「{username}」角色为「{user.role.name}」，与所选角色不匹配。\n"
                f"请使用对应角色的独立账号：\n"
                f"· 报修登记员：registrar01\n"
                f"· 报修审核主管：supervisor01\n"
                f"· 复核负责人：reviewer01",
                403
            )

        if not verify_password(password, user.password_hash):
            add_audit_log(db, user, "登录失败", "认证",
                          detail="密码验证失败",
                          failure_reason="密码错误", is_success=False, ip_address=ip)
            db.commit()
            return _err("用户名或密码错误", 401)

        token = create_access_token({"user_id": user.id, "role": user.role.code})

        add_audit_log(db, user, "登录成功", "认证",
                      detail=f"以「{user.role.name}」角色登录系统", is_success=True, ip_address=ip)
        db.commit()

        return JSONResponse({
            "access_token": token,
            "token_type": "bearer",
            "user": user_to_dict(user),
        })
    except Exception as e:
        db.rollback()
        return _err(f"服务器错误: {str(e)}", 500)
    finally:
        db.close()


async def list_all_users(request: Request):
    """返回所有活跃用户（按角色分组，供前端角色切换选择对应账号）"""
    db = next(get_db())
    try:
        user, err = check_auth(db, request)
        if err: return err
        users = db.query(User).filter(User.is_active == True).all()
        result = {}
        for u in users:
            result.setdefault(u.role.code, []).append(user_to_dict(u))
        return JSONResponse(result)
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
        user, err = check_auth(db, request)
        if err: return err
        role_code = request.path_params.get("role_code")
        role = db.query(Role).filter(Role.code == role_code).first()
        if not role:
            return _err("角色不存在", 404)
        users = db.query(User).filter(User.role_id == role.id, User.is_active == True).all()
        return JSONResponse([user_to_dict(u) for u in users])
    finally:
        db.close()


async def get_current_user_info(request: Request):
    db = next(get_db())
    try:
        user, err = check_auth(db, request)
        if err: return err
        return JSONResponse(user_to_dict(user))
    finally:
        db.close()


# ============== 工单列表 ==============
async def list_tickets(request: Request):
    db = next(get_db())
    try:
        user, err = check_auth(db, request)
        if err: return err

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
            try: query = query.filter(RepairTicket.status == TicketStatusEnum(status))
            except ValueError: pass
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
        user, err = check_auth(db, request)
        if err: return err
        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return _err("工单不存在", 404)
        return JSONResponse(ticket_to_dict(ticket, db))
    finally:
        db.close()


# ============== 新建工单（仅登记员）==============
async def create_ticket(request: Request):
    db = next(get_db())
    ip = get_client_ip(request)
    try:
        user, err = check_auth(db, request)
        if err: return err
        err = require_role(user, [RoleEnum.REGISTRAR])
        if err:
            add_audit_log(db, user, "创建工单失败", "报修登记",
                          detail=f"角色{user.role.code}无权创建工单",
                          failure_reason="仅报修登记员可创建工单", is_success=False, ip_address=ip)
            db.commit()
            return err

        body = await parse_json_body(request)
        if not body:
            return _err("请求体格式错误", 400)

        required_fields = ["title", "owner_name", "owner_phone", "address", "repair_type", "description"]
        for f in required_fields:
            if not body.get(f):
                return _err(f"缺少字段: {f}", 400)

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
                     remark="报修登记员新建工单草稿", from_status=None, to_status="draft")

        attachments_data = body.get("attachments", [])
        created_atts = []
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
            db.flush()
            created_atts.append(att)

        # 逐条记录附件办理结果到审计
        for att in created_atts:
            add_audit_log(db, user, "附件上传(新建工单)", "附件管理", ticket_id=ticket.id,
                          detail=f"文件名: {att.file_name} | 必传={att.is_required} | 补传={att.is_supplementary} | 大小={att.file_size}",
                          is_success=True, ip_address=ip)

        add_audit_log(db, user, "创建工单", "报修登记", ticket_id=ticket.id,
                      detail=f"工单标题: {ticket.title} | 业主: {ticket.owner_name} | 附件数: {len(created_atts)}",
                      is_success=True, ip_address=ip)

        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db), status_code=201)
    except Exception as e:
        db.rollback()
        return _err(f"创建失败: {str(e)}", 500)
    finally:
        db.close()


# ============== 提交审核（登记员；逐条记录附件校验）==============
async def submit_for_review(request: Request):
    db = next(get_db())
    ip = get_client_ip(request)
    try:
        user, err = check_auth(db, request)
        if err: return err
        err = require_role(user, [RoleEnum.REGISTRAR])
        if err:
            ticket_id = int(request.path_params["ticket_id"])
            add_audit_log(db, user, "提交审核失败", "报修登记", ticket_id=ticket_id,
                          detail=f"角色{user.role.code}无权提交",
                          failure_reason="仅报修登记员可提交审核", is_success=False, ip_address=ip)
            db.commit()
            return err

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return _err("工单不存在", 404)

        err = require_status(ticket, [TicketStatusEnum.DRAFT, TicketStatusEnum.REVISION_REQUIRED], "提交审核")
        if err:
            add_audit_log(db, user, "提交审核失败", "报修登记", ticket_id=ticket.id,
                          detail=f"状态不允许提交: {ticket.status.value}",
                          failure_reason=err.body.decode() if hasattr(err, 'body') else "状态校验未通过",
                          is_success=False, ip_address=ip)
            db.commit()
            return err

        # ===== 逐条附件校验 =====
        attachments = ticket.attachments
        required_ok = [a for a in attachments if a.is_required and not a.is_rejected]
        required_rejected = [a for a in attachments if a.is_required and a.is_rejected]
        supplementary_list = [a for a in attachments if a.is_supplementary]

        # 先逐条写审计（每个附件的办理结果）
        for a in attachments:
            if a.is_rejected:
                add_audit_log(db, user, f"附件提交校验-驳回", "附件管理", ticket_id=ticket.id,
                              detail=f"文件: {a.file_name} | 驳回原因: {a.reject_reason or '(未填写)'}",
                              failure_reason=f"附件被主管驳回，需补正: {a.reject_reason}",
                              is_success=False, ip_address=ip)
            elif a.is_supplementary:
                add_audit_log(db, user, f"附件提交校验-补传", "附件管理", ticket_id=ticket.id,
                              detail=f"补传文件: {a.file_name} | 上传人: {a.uploaded_by.full_name if a.uploaded_by else user.full_name}",
                              is_success=True, ip_address=ip)
            elif a.is_required:
                add_audit_log(db, user, f"附件提交校验-必填OK", "附件管理", ticket_id=ticket.id,
                              detail=f"必填文件: {a.file_name} | 校验通过",
                              is_success=True, ip_address=ip)

        # 缺少必填附件（无任何通过的必填）则拦截
        if len(required_ok) == 0:
            detail_parts = [f"共 {len(attachments)} 个附件"]
            if required_rejected:
                detail_parts.append(f"被驳回必填 {len(required_rejected)} 个: {', '.join(a.file_name for a in required_rejected)}")
            if not attachments:
                detail_parts.append("未上传任何附件")
            failure_reason = f"缺少至少 1 个有效的必填附件（当前必填有效={len(required_ok)}，被驳回={len(required_rejected)}，补传={len(supplementary_list)}）"
            add_audit_log(db, user, "提交审核失败", "报修登记", ticket_id=ticket.id,
                          detail=" | ".join(detail_parts),
                          failure_reason=failure_reason, is_success=False, ip_address=ip)
            db.commit()
            return _err(failure_reason, 400)

        body = await parse_json_body(request) or {}
        remark = body.get("remark", "提交审核")
        if ticket.status == TicketStatusEnum.REVISION_REQUIRED:
            remark = f"补正后重提: {remark}" if remark != "提交审核" else "补正后重新提交审核"

        old_status = ticket.status.value
        ticket.status = TicketStatusEnum.PENDING_REVIEW
        previous_reject = ticket.reject_reason
        ticket.reject_reason = None

        add_work_log(db, ticket, "提交审核", user.id, user.full_name,
                     remark=remark + f" | 附件统计: 必填有效={len(required_ok)}，补传={len(supplementary_list)}，驳回={len(required_rejected)}"
                            + (f" | 原退回原因: {previous_reject}" if previous_reject else ""),
                     from_status=old_status, to_status="pending_review")

        add_audit_log(db, user, "提交审核成功", "报修登记", ticket_id=ticket.id,
                      detail=f"{remark} | 逐条附件结果: 必填OK={len(required_ok)}个, 补传={len(supplementary_list)}个, 被驳回={len(required_rejected)}个"
                             + ("（本次为补正后重提）" if old_status == "revision_required" else ""),
                      is_success=True, ip_address=ip)

        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return _err(f"提交失败: {str(e)}", 500)
    finally:
        db.close()


# ============== 审核通过（主管）==============
async def approve_ticket(request: Request):
    db = next(get_db())
    ip = get_client_ip(request)
    try:
        user, err = check_auth(db, request)
        if err: return err
        err = require_role(user, [RoleEnum.SUPERVISOR])
        if err:
            ticket_id = int(request.path_params["ticket_id"])
            add_audit_log(db, user, "审核通过失败", "工单审核", ticket_id=ticket_id,
                          failure_reason="仅报修审核主管可审核工单", is_success=False, ip_address=ip)
            db.commit()
            return err

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return _err("工单不存在", 404)

        err = require_status(ticket, [TicketStatusEnum.PENDING_REVIEW], "审核通过")
        if err:
            add_audit_log(db, user, "审核通过失败", "工单审核", ticket_id=ticket.id,
                          failure_reason=f"状态不匹配: {ticket.status.value}", is_success=False, ip_address=ip)
            db.commit()
            return err

        # 逐条审核附件：确保没有被驳回的必填附件
        attachments = ticket.attachments
        rejected_required = [a for a in attachments if a.is_required and a.is_rejected]
        if rejected_required:
            names = ", ".join(a.file_name for a in rejected_required)
            add_audit_log(db, user, "审核通过失败", "工单审核", ticket_id=ticket.id,
                          detail=f"仍有 {len(rejected_required)} 个必填附件被驳回: {names}",
                          failure_reason=f"驳回的必填附件必须先解除驳回或重新上传: {names}",
                          is_success=False, ip_address=ip)
            db.commit()
            return _err(f"仍有 {len(rejected_required)} 个必填附件处于驳回状态（{names}），请先处理附件后再通过", 400)

        body = await parse_json_body(request) or {}
        remark = body.get("remark", "审核通过")

        # 逐条记录审核通过的附件
        for a in attachments:
            tag = ""
            if a.is_supplementary: tag = "[补传]"
            elif a.is_required: tag = "[必填]"
            add_audit_log(db, user, f"附件审核通过{tag}", "附件管理", ticket_id=ticket.id,
                          detail=f"文件: {a.file_name} | 上传人: {a.uploaded_by.full_name if a.uploaded_by else '-'}",
                          is_success=True, ip_address=ip)

        old_status = ticket.status.value
        ticket.status = TicketStatusEnum.REVIEW_PASSED
        ticket.handled_by_id = user.id
        ticket.reject_reason = None

        add_work_log(db, ticket, "审核通过", user.id, user.full_name,
                     remark=remark + f" | 附件统计: {len(attachments)}个通过",
                     from_status=old_status, to_status="review_passed")

        add_audit_log(db, user, "审核通过", "工单审核", ticket_id=ticket.id,
                      detail=f"{remark} | 附件 {len(attachments)} 个全部通过",
                      is_success=True, ip_address=ip)

        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return _err(f"审核失败: {str(e)}", 500)
    finally:
        db.close()


# ============== 退回补正 / 驳回（主管；逐条记录附件处理结果）==============
async def _do_reject_or_return(request: Request, action: str):
    db = next(get_db())
    ip = get_client_ip(request)
    try:
        user, err = check_auth(db, request)
        if err: return err
        err = require_role(user, [RoleEnum.SUPERVISOR])
        if err:
            ticket_id = int(request.path_params["ticket_id"])
            add_audit_log(db, user, "退回/驳回失败", "工单审核", ticket_id=ticket_id,
                          failure_reason="仅报修审核主管可操作", is_success=False, ip_address=ip)
            db.commit()
            return err

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return _err("工单不存在", 404)

        action_label = "退回补正" if action == "return" else "驳回工单"
        err = require_status(ticket, [TicketStatusEnum.PENDING_REVIEW], action_label)
        if err:
            add_audit_log(db, user, f"{action_label}失败", "工单审核", ticket_id=ticket.id,
                          failure_reason=f"状态不匹配: {ticket.status.value}", is_success=False, ip_address=ip)
            db.commit()
            return err

        body = await parse_json_body(request) or {}
        reject_reason = body.get("reject_reason")
        remark = body.get("remark", reject_reason)

        if not reject_reason:
            add_audit_log(db, user, f"{action_label}失败", "工单审核", ticket_id=ticket.id,
                          detail="操作时未填写原因",
                          failure_reason="必须填写退回/驳回原因（用于告知登记员及审计留痕）",
                          is_success=False, ip_address=ip)
            db.commit()
            return _err("必须填写退回/驳回原因（需明确告知登记员缺失什么材料）", 400)

        old_status = ticket.status.value
        if action == "return":
            ticket.status = TicketStatusEnum.REVISION_REQUIRED
        else:
            ticket.status = TicketStatusEnum.REJECTED

        ticket.reject_reason = reject_reason
        ticket.handled_by_id = user.id

        attachments = ticket.attachments
        for a in attachments:
            if action == "return" and not a.is_rejected:
                note = f"主管{action_label}，需登记员重新核查/补传。退回原因: {reject_reason}"
                if a.review_note:
                    a.review_note = a.review_note + " | " + note
                else:
                    a.review_note = note
            add_audit_log(db, user, f"附件{action_label}", "附件管理", ticket_id=ticket.id,
                          detail=f"文件: {a.file_name} | 必填={a.is_required} | 已驳回={a.is_rejected}"
                                 + (f" | 驳回理由: {a.reject_reason}" if a.is_rejected else ""),
                          failure_reason=reject_reason if action == "return" or a.is_rejected else None,
                          is_success=not (action == "return" or a.is_rejected),
                          ip_address=ip)

        add_work_log(db, ticket, action_label, user.id, user.full_name,
                     remark=remark, from_status=old_status, to_status=ticket.status.value)

        add_audit_log(db, user, action_label, "工单审核", ticket_id=ticket.id,
                      detail=f"{action_label}原因: {reject_reason} | 涉及附件 {len(attachments)} 个",
                      failure_reason=reject_reason, is_success=False, ip_address=ip)

        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return _err(f"操作失败: {str(e)}", 500)
    finally:
        db.close()


async def return_ticket(request: Request):
    return await _do_reject_or_return(request, "return")


async def reject_ticket(request: Request):
    return await _do_reject_or_return(request, "reject")


# ============== 派单（主管）==============
async def assign_ticket(request: Request):
    db = next(get_db())
    ip = get_client_ip(request)
    try:
        user, err = check_auth(db, request)
        if err: return err
        err = require_role(user, [RoleEnum.SUPERVISOR])
        if err:
            ticket_id = int(request.path_params["ticket_id"])
            add_audit_log(db, user, "派单失败", "工单审核", ticket_id=ticket_id,
                          failure_reason="仅报修审核主管可派单", is_success=False, ip_address=ip)
            db.commit()
            return err

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return _err("工单不存在", 404)

        err = require_status(ticket, [TicketStatusEnum.REVIEW_PASSED], "派单处理")
        if err:
            add_audit_log(db, user, "派单失败", "工单审核", ticket_id=ticket.id,
                          failure_reason=f"状态不匹配: {ticket.status.value}", is_success=False, ip_address=ip)
            db.commit()
            return err

        body = await parse_json_body(request) or {}
        remark = body.get("remark", "派单处理")

        old_status = ticket.status.value
        ticket.status = TicketStatusEnum.ASSIGNED
        ticket.assigned_at = datetime.utcnow()

        add_work_log(db, ticket, "派单处理", user.id, user.full_name,
                     remark=remark, from_status=old_status, to_status="assigned")
        add_audit_log(db, user, "派单处理", "工单审核", ticket_id=ticket.id,
                      detail=f"{remark} | 派单人: {user.full_name}", is_success=True, ip_address=ip)
        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return _err(f"派单失败: {str(e)}", 500)
    finally:
        db.close()


# ============== 开始维修（主管）==============
async def start_repair(request: Request):
    db = next(get_db())
    ip = get_client_ip(request)
    try:
        user, err = check_auth(db, request)
        if err: return err
        err = require_role(user, [RoleEnum.SUPERVISOR])
        if err:
            ticket_id = int(request.path_params["ticket_id"])
            add_audit_log(db, user, "开始维修失败", "工单处理", ticket_id=ticket_id,
                          failure_reason="仅报修审核主管可操作", is_success=False, ip_address=ip)
            db.commit()
            return err

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return _err("工单不存在", 404)
        err = require_status(ticket, [TicketStatusEnum.ASSIGNED], "开始维修")
        if err:
            add_audit_log(db, user, "开始维修失败", "工单处理", ticket_id=ticket.id,
                          failure_reason=f"状态不匹配: {ticket.status.value}", is_success=False, ip_address=ip)
            db.commit()
            return err

        body = await parse_json_body(request) or {}
        remark = body.get("remark", "维修人员已到场，开始处理")

        old_status = ticket.status.value
        ticket.status = TicketStatusEnum.IN_PROGRESS

        add_work_log(db, ticket, "开始维修", user.id, user.full_name,
                     remark=remark, from_status=old_status, to_status="in_progress")
        add_audit_log(db, user, "开始维修", "工单处理", ticket_id=ticket.id,
                      detail=remark, is_success=True, ip_address=ip)
        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return _err(f"操作失败: {str(e)}", 500)
    finally:
        db.close()


# ============== 登记完工（主管）==============
async def complete_repair(request: Request):
    db = next(get_db())
    ip = get_client_ip(request)
    try:
        user, err = check_auth(db, request)
        if err: return err
        err = require_role(user, [RoleEnum.SUPERVISOR])
        if err:
            ticket_id = int(request.path_params["ticket_id"])
            add_audit_log(db, user, "完工登记失败", "工单处理", ticket_id=ticket_id,
                          failure_reason="仅报修审核主管可登记完工", is_success=False, ip_address=ip)
            db.commit()
            return err

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return _err("工单不存在", 404)
        err = require_status(ticket, [TicketStatusEnum.IN_PROGRESS], "登记完工")
        if err:
            add_audit_log(db, user, "完工登记失败", "工单处理", ticket_id=ticket.id,
                          failure_reason=f"状态不匹配: {ticket.status.value}", is_success=False, ip_address=ip)
            db.commit()
            return err

        body = await parse_json_body(request) or {}
        repair_result = body.get("repair_result")
        if not repair_result:
            add_audit_log(db, user, "完工登记失败", "工单处理", ticket_id=ticket.id,
                          detail="缺少维修结果字段",
                          failure_reason="必须填写维修结果说明（维修内容、更换零件等）",
                          is_success=False, ip_address=ip)
            db.commit()
            return _err("必须填写维修结果说明", 400)

        remark = body.get("remark", repair_result)

        old_status = ticket.status.value
        ticket.status = TicketStatusEnum.COMPLETED
        ticket.repair_result = repair_result
        ticket.completed_at = datetime.utcnow()

        overdue = False
        if ticket.deadline_at and ticket.completed_at > ticket.deadline_at:
            ticket.is_overdue = True
            overdue = True
            add_audit_log(db, user, "完工超时预警", "工单处理", ticket_id=ticket.id,
                          detail=f"截止时间: {ticket.deadline_at} | 实际完工: {ticket.completed_at}",
                          failure_reason=f"维修超时 {int((ticket.completed_at - ticket.deadline_at).total_seconds()/60)} 分钟",
                          is_success=False, ip_address=ip)

        add_work_log(db, ticket, "完工登记", user.id, user.full_name,
                     remark=repair_result + (" | ⚠超时" if overdue else ""),
                     from_status=old_status, to_status="completed")

        add_audit_log(db, user, "完工登记", "工单处理", ticket_id=ticket.id,
                      detail=f"维修结果: {repair_result} | 超时={overdue}",
                      is_success=not overdue,
                      failure_reason="完工时间超过截止时限" if overdue else None,
                      ip_address=ip)
        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return _err(f"操作失败: {str(e)}", 500)
    finally:
        db.close()


# ============== 复核归档（复核负责人；逐条记录附件、办理结果）==============
async def review_complete(request: Request):
    db = next(get_db())
    ip = get_client_ip(request)
    try:
        user, err = check_auth(db, request)
        if err: return err
        err = require_role(user, [RoleEnum.REVIEWER])
        if err:
            ticket_id = int(request.path_params["ticket_id"])
            add_audit_log(db, user, "复核归档失败", "中心复核", ticket_id=ticket_id,
                          failure_reason="仅物业服务中心复核负责人可操作", is_success=False, ip_address=ip)
            db.commit()
            return err

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return _err("工单不存在", 404)
        err = require_status(ticket, [TicketStatusEnum.COMPLETED], "复核归档")
        if err:
            add_audit_log(db, user, "复核归档失败", "中心复核", ticket_id=ticket.id,
                          failure_reason=f"状态不匹配: {ticket.status.value}", is_success=False, ip_address=ip)
            db.commit()
            return err

        body = await parse_json_body(request) or {}
        review_note = body.get("review_note")
        visit_feedback = body.get("visit_feedback")
        visit_remark = body.get("visit_remark")

        if not review_note or not visit_feedback:
            add_audit_log(db, user, "复核归档失败", "中心复核", ticket_id=ticket.id,
                          detail=f"复核意见={bool(review_note)} | 回访评价={bool(visit_feedback)}",
                          failure_reason="必须同时填写复核意见和回访评价",
                          is_success=False, ip_address=ip)
            db.commit()
            return _err("必须同时填写「复核意见」和「回访评价」", 400)

        # 复核时逐条核查附件
        attachments = ticket.attachments
        attachment_checks = []
        for idx, a in enumerate(attachments, 1):
            status_tag = []
            if a.is_required and not a.is_rejected: status_tag.append("必填OK")
            if a.is_supplementary: status_tag.append("补传")
            if a.is_rejected: status_tag.append("已驳回(异常)")
            status_str = "/".join(status_tag) if status_tag else "未标记"
            item = (f"[{idx}] {a.file_name} → {status_str}"
                    + (f" (驳回理由: {a.reject_reason})" if a.is_rejected else ""))
            attachment_checks.append(item)
            add_audit_log(db, user, f"复核附件-{status_str}", "附件管理", ticket_id=ticket.id,
                          detail=f"文件: {a.file_name} | 上传人: {a.uploaded_by.full_name if a.uploaded_by else '-'}"
                                 + (f" | 原审核备注: {a.review_note}" if a.review_note else ""),
                          is_success=not a.is_rejected,
                          failure_reason=f"存在被驳回附件: {a.reject_reason}" if a.is_rejected else None,
                          ip_address=ip)

        # 逐条核查历史办理（流转记录）结果
        work_logs = sorted(ticket.work_logs, key=lambda w: w.created_at or datetime.min)
        step_results = []
        for idx, log in enumerate(work_logs, 1):
            step_results.append(
                f"[{idx}] {log.action} @ {log.operator_name or '未知'} "
                f"→ {STATUS_LABELS.get(log.to_status, log.to_status) if log.to_status else ''}"
                + (f"（备注: {log.remark[:30]}）" if log.remark else "")
            )
            add_audit_log(db, user, f"复核办理步骤{idx}: {log.action}", "中心复核", ticket_id=ticket.id,
                          detail=f"办理人: {log.operator_name} | 状态变更: {log.from_status}→{log.to_status} | 备注: {log.remark or '无'}",
                          is_success=True, ip_address=ip)

        # 存在被驳回附件则禁止归档
        rejected_count = sum(1 for a in attachments if a.is_rejected)
        if rejected_count > 0:
            fail_msg = f"仍有 {rejected_count} 个附件处于被驳回状态，归档前需确认处理"
            add_audit_log(db, user, "复核归档失败", "中心复核", ticket_id=ticket.id,
                          detail=" | ".join(attachment_checks),
                          failure_reason=fail_msg, is_success=False, ip_address=ip)
            db.commit()
            return _err(fail_msg, 400)

        old_status = ticket.status.value
        ticket.status = TicketStatusEnum.ARCHIVED
        ticket.review_note = review_note
        ticket.visit_feedback = visit_feedback
        ticket.visit_remark = visit_remark
        ticket.reviewed_by_id = user.id
        ticket.archived_at = datetime.utcnow()

        add_work_log(db, ticket, "复核归档", user.id, user.full_name,
                     remark=f"复核: {review_note} | 回访: {visit_feedback} | 附件核查 {len(attachments)} 个 | 办理步骤 {len(work_logs)} 步",
                     from_status=old_status, to_status="archived")

        add_audit_log(db, user, "复核归档成功", "中心复核", ticket_id=ticket.id,
                      detail=(
                          f"复核意见: {review_note}\n"
                          f"回访评价: {visit_feedback} - {visit_remark or ''}\n"
                          f"--- 逐条附件结果 ({len(attachments)} 项) ---\n"
                          + "\n".join(attachment_checks)
                          + f"\n--- 逐条办理结果 ({len(work_logs)} 步) ---\n"
                          + "\n".join(step_results)
                      ),
                      is_success=True, ip_address=ip)

        db.commit()
        db.refresh(ticket)
        return JSONResponse(ticket_to_dict(ticket, db))
    except Exception as e:
        db.rollback()
        return _err(f"操作失败: {str(e)}", 500)
    finally:
        db.close()


# ============== 附件标记（主管）：严格角色+状态校验 + 逐条审计 ==============
async def update_attachment(request: Request):
    db = next(get_db())
    ip = get_client_ip(request)
    try:
        user, err = check_auth(db, request)
        if err: return err

        att_id = int(request.path_params["att_id"])
        att = db.query(Attachment).filter(Attachment.id == att_id).first()
        if not att:
            return _err("附件不存在", 404)
        ticket = db.query(RepairTicket).filter(RepairTicket.id == att.ticket_id).first()
        if not ticket:
            return _err("附件所属工单不存在", 404)

        body = await parse_json_body(request) or {}
        is_rejecting = body.get("is_rejected") is True
        is_marking_required = body.get("is_required") is True
        is_marking_supp = body.get("is_supplementary") is True

        # 角色权限矩阵
        # - 驳回附件 / 解除驳回 / 标记必填 / 标记补传 → 仅主管，且工单必须处于 PENDING_REVIEW 或 REVISION_REQUIRED
        if is_rejecting or "is_rejected" in body or is_marking_required or is_marking_supp:
            err = require_role(user, [RoleEnum.SUPERVISOR])
            if err:
                add_audit_log(db, user, "附件标记失败", "附件管理", ticket_id=ticket.id,
                              detail=f"操作附件: {att.file_name} | 当前角色: {user.role.code}",
                              failure_reason="仅报修审核主管可标记附件（驳回/必填/补传）",
                              is_success=False, ip_address=ip)
                db.commit()
                return err
            err = require_status(ticket, [TicketStatusEnum.PENDING_REVIEW, TicketStatusEnum.REVISION_REQUIRED],
                                 "附件标记")
            if err:
                add_audit_log(db, user, "附件标记失败", "附件管理", ticket_id=ticket.id,
                              detail=f"当前工单状态: {ticket.status.value}",
                              failure_reason="仅 待审核 / 待补正 状态下可标记附件",
                              is_success=False, ip_address=ip)
                db.commit()
                return err

        # 驳回必须填写原因
        if is_rejecting and not body.get("reject_reason"):
            add_audit_log(db, user, "附件驳回失败", "附件管理", ticket_id=ticket.id,
                          detail=f"文件: {att.file_name} | 未填写驳回原因",
                          failure_reason="驳回附件必须填写驳回原因（用于告知登记员补正）",
                          is_success=False, ip_address=ip)
            db.commit()
            return _err("驳回附件必须填写「驳回原因」", 400)

        old_flags = f"必填={att.is_required},补传={att.is_supplementary},驳回={att.is_rejected}"

        if body.get("attachment_type"):
            att.attachment_type = AttachmentTypeEnum(body["attachment_type"])
        if "is_required" in body:
            att.is_required = body["is_required"]
            if body["is_required"]:
                att.is_supplementary = False
        if "is_supplementary" in body:
            att.is_supplementary = body["is_supplementary"]
            if body["is_supplementary"]:
                att.is_required = False
        if "is_rejected" in body:
            was_rejected = att.is_rejected
            att.is_rejected = body["is_rejected"]
            if body["is_rejected"]:
                att.attachment_type = AttachmentTypeEnum.REJECTED
            elif not was_rejected and not body["is_rejected"]:
                # 解除驳回时，若未指定其他类型则恢复为必填
                if "attachment_type" not in body:
                    att.attachment_type = AttachmentTypeEnum.REQUIRED
                    att.is_required = True
        if body.get("reject_reason"):
            att.reject_reason = body["reject_reason"]
        if body.get("review_note"):
            att.review_note = body["review_note"]

        new_flags = f"必填={att.is_required},补传={att.is_supplementary},驳回={att.is_rejected}"

        # 决定本条审计的动作名和成败
        if is_rejecting:
            action_name = "附件驳回"
            is_success = False
            failure = body.get("reject_reason", "附件不合格，需补正")
        elif "is_rejected" in body and not body["is_rejected"]:
            action_name = "附件解除驳回"
            is_success = True
            failure = None
        elif is_marking_required:
            action_name = "附件标记为必填"
            is_success = True
            failure = None
        elif is_marking_supp:
            action_name = "附件标记为补传"
            is_success = True
            failure = None
        else:
            action_name = "附件修改"
            is_success = True
            failure = None

        add_audit_log(db, user, action_name, "附件管理", ticket_id=ticket.id,
                      detail=(
                          f"文件: {att.file_name}\n"
                          f"变更前: {old_flags}\n"
                          f"变更后: {new_flags}"
                          + (f"\n驳回原因: {body.get('reject_reason')}" if body.get("reject_reason") else "")
                          + (f"\n审核备注: {body.get('review_note')}" if body.get("review_note") else "")
                      ),
                      failure_reason=failure, is_success=is_success, ip_address=ip)

        db.commit()
        db.refresh(att)
        return JSONResponse(attachment_to_dict(att))
    except Exception as e:
        db.rollback()
        return _err(f"更新失败: {str(e)}", 500)
    finally:
        db.close()


# ============== 附件上传（登记员：草稿/待补正；主管：任意处理中状态均可补充）==============
async def add_attachment(request: Request):
    db = next(get_db())
    ip = get_client_ip(request)
    try:
        user, err = check_auth(db, request)
        if err: return err

        ticket_id = int(request.path_params["ticket_id"])
        ticket = db.query(RepairTicket).filter(RepairTicket.id == ticket_id).first()
        if not ticket:
            return _err("工单不存在", 404)

        body = await parse_json_body(request) or {}
        file_name = body.get("file_name")
        if not file_name:
            add_audit_log(db, user, "附件上传失败", "附件管理", ticket_id=ticket_id,
                          failure_reason="未指定文件名", is_success=False, ip_address=ip)
            db.commit()
            return _err("缺少文件名", 400)

        # 角色权限 + 状态校验
        is_supplementary = body.get("is_supplementary", False)
        if user.role.code == RoleEnum.REGISTRAR.value:
            # 登记员仅能在 草稿 / 待补正 状态上传
            err = require_status(ticket, [TicketStatusEnum.DRAFT, TicketStatusEnum.REVISION_REQUIRED],
                                 "上传附件（登记员）")
            if err:
                add_audit_log(db, user, "附件上传失败", "附件管理", ticket_id=ticket.id,
                              detail=f"登记员尝试在状态 {ticket.status.value} 上传",
                              failure_reason="登记员仅能在草稿或待补正状态上传附件",
                              is_success=False, ip_address=ip)
                db.commit()
                return err
            # 待补正状态上传时，自动标记为补传
            if ticket.status == TicketStatusEnum.REVISION_REQUIRED:
                is_supplementary = True

        elif user.role.code == RoleEnum.SUPERVISOR.value:
            # 主管在审核、派单、维修中都可补充附件（如维修现场图）
            err = require_status(ticket, [
                TicketStatusEnum.PENDING_REVIEW,
                TicketStatusEnum.REVIEW_PASSED,
                TicketStatusEnum.ASSIGNED,
                TicketStatusEnum.IN_PROGRESS,
                TicketStatusEnum.REVISION_REQUIRED,
            ], "上传附件（主管）")
            if err:
                add_audit_log(db, user, "附件上传失败", "附件管理", ticket_id=ticket.id,
                              failure_reason=f"当前状态 {ticket.status.value} 不允许主管补充附件",
                              is_success=False, ip_address=ip)
                db.commit()
                return err

        elif user.role.code == RoleEnum.REVIEWER.value:
            # 复核负责人仅能在待复核时补充（如签字确认单）
            err = require_status(ticket, [TicketStatusEnum.COMPLETED], "上传附件（复核）")
            if err:
                add_audit_log(db, user, "附件上传失败", "附件管理", ticket_id=ticket.id,
                              failure_reason="复核负责人仅能在待复核状态补充附件",
                              is_success=False, ip_address=ip)
                db.commit()
                return err
            is_supplementary = True
        else:
            return _err("未知角色", 403)

        # 登记员在草稿状态才能标记必填；否则都是补传
        is_required = body.get("is_required", False)
        if user.role.code != RoleEnum.REGISTRAR.value or ticket.status != TicketStatusEnum.DRAFT:
            is_required = False

        if not is_required and not is_supplementary:
            is_supplementary = True

        att = Attachment(
            ticket_id=ticket_id,
            file_name=file_name,
            file_path=body.get("file_path", f"/uploads/{ticket_id}/{file_name}"),
            file_size=body.get("file_size"),
            mime_type=body.get("mime_type"),
            attachment_type=AttachmentTypeEnum.REJECTED if False else (
                AttachmentTypeEnum.REQUIRED if is_required else AttachmentTypeEnum.SUPPLEMENTARY
            ),
            is_required=is_required,
            is_supplementary=is_supplementary,
            uploaded_by_id=user.id,
            review_note=body.get("review_note"),
        )
        db.add(att)
        db.flush()

        context_tag = ""
        if ticket.status == TicketStatusEnum.REVISION_REQUIRED:
            context_tag = "（退回补正后补传）"
        elif user.role.code == RoleEnum.SUPERVISOR.value:
            context_tag = "（主管处理补充）"
        elif user.role.code == RoleEnum.REVIEWER.value:
            context_tag = "（复核归档补充）"

        add_audit_log(db, user, f"附件上传{context_tag}", "附件管理", ticket_id=ticket_id,
                      detail=(
                          f"文件名: {file_name} | 大小: {att.file_size}\n"
                          f"类型: 必填={att.is_required}, 补传={att.is_supplementary}\n"
                          f"上传角色: {user.role.name} | 当前工单状态: {STATUS_LABELS.get(ticket.status.value, ticket.status.value)}"
                          + (f"\n备注: {body.get('review_note')}" if body.get("review_note") else "")
                      ),
                      is_success=True, ip_address=ip)

        db.commit()
        db.refresh(att)
        return JSONResponse(attachment_to_dict(att), status_code=201)
    except Exception as e:
        db.rollback()
        return _err(f"添加失败: {str(e)}", 500)
    finally:
        db.close()


# ============== 审计日志查询 ==============
async def list_audit_logs(request: Request):
    db = next(get_db())
    try:
        user, err = check_auth(db, request)
        if err: return err

        qp = request.query_params
        ticket_id = qp.get("ticket_id")
        is_success = qp.get("is_success")
        module = qp.get("module")
        action = qp.get("action")
        page = int(qp.get("page", 1))
        size = int(qp.get("size", 100))

        query = db.query(AuditLog)
        if ticket_id:
            query = query.filter(AuditLog.ticket_id == int(ticket_id))
        if is_success is not None and is_success != "":
            query = query.filter(AuditLog.is_success == (is_success.lower() == "true"))
        if module:
            query = query.filter(AuditLog.module == module)
        if action:
            like = f"%{action}%"
            query = query.filter(AuditLog.action.like(like))

        total = query.count()
        logs = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * size).limit(size).all()
        return JSONResponse({
            "total": total,
            "items": [auditlog_to_dict(l) for l in logs]
        })
    finally:
        db.close()


# ============== 应用构造 ==============
def create_app():
    app = Starlette(
        debug=True,
        routes=[
            Route("/health", health_check, methods=["GET"]),
            Route("/api/seed", seed_database, methods=["POST"]),
            Route("/api/auth/login", login, methods=["POST"]),
            Route("/api/auth/roles", get_roles, methods=["GET"]),
            Route("/api/auth/me", get_current_user_info, methods=["GET"]),
            Route("/api/auth/users", list_all_users, methods=["GET"]),
            Route("/api/users/role/{role_code}", get_users_by_role, methods=["GET"]),
            Route("/api/tickets", list_tickets, methods=["GET"]),
            Route("/api/tickets", create_ticket, methods=["POST"]),
            Route("/api/tickets/{ticket_id:int}", get_ticket, methods=["GET"]),
            Route("/api/tickets/{ticket_id:int}/submit", submit_for_review, methods=["POST"]),
            Route("/api/tickets/{ticket_id:int}/approve", approve_ticket, methods=["POST"]),
            Route("/api/tickets/{ticket_id:int}/return", return_ticket, methods=["POST"]),
            Route("/api/tickets/{ticket_id:int}/reject", reject_ticket, methods=["POST"]),
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
