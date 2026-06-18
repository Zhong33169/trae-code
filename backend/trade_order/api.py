import uuid
from datetime import datetime
from typing import Optional, List

from django.db import transaction
from django.db.models import Q
from django.contrib.auth.models import User
from ninja import Router, Query, Header


class APIError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message


def _e(status: int, code: str, message: str):
    raise APIError(status, code, message)

from .models import (
    TradeOrder, OrderStatus, OrderEvidence, EvidenceType,
    BatchOperation, BatchAction, BatchStatus, BatchOperationItem, ItemStatus,
    ResolvedStatus,
    OrderHistory, UserProfile, Role,
)
from .schemas import (
    TradeOrderOut, TradeOrderIn, TradeOrderUpdate,
    EvidenceIn, EvidenceOut,
    ActionIn, BatchOperationIn, BatchOperationOut, BatchItemResult,
    OrderHistoryOut, UserOut, ErrorOut,
)

router = Router()


ERROR_RESPONSIBLE_MAP = {
    "VERSION_CONFLICT": ("operator", "刷新页面获取最新版本后重新提交"),
    "NOT_OWNER": ("sales", "只能操作自己创建的订单，请切换到正确的业务员账号"),
    "INVALID_STATUS": ("operator", "当前订单状态不允许该操作，请确认订单状态后重试"),
    "MISSING_EVIDENCE": ("sales", "缺少必要证据，请上传齐全后再提交"),
    "REMARK_REQUIRED": ("operator", "该操作必须填写备注说明，请补充后重新提交"),
    "ORDER_NOT_FOUND": ("operator", "订单不存在，请确认订单ID是否正确"),
    "INVALID_ACTION": ("operator", "不支持的操作类型，请选择正确的操作"),
    "PERMISSION_DENIED": ("operator", "权限不足，请使用对应岗位的账号操作"),
    "SYSTEM_ERROR": ("admin", "系统错误，请联系管理员处理"),
    "MISSING_USER": ("operator", "用户信息缺失，请重新登录"),
    "INVALID_USER": ("operator", "用户不存在，请确认账号"),
    "NO_PROFILE": ("admin", "用户资料不存在，请联系管理员"),
    "ROLE_MISMATCH": ("operator", "角色不匹配，请使用正确的角色登录"),
}


def _get_responsible_and_suggestion(error_code: str) -> tuple[str, str]:
    if not error_code:
        return "", ""
    role, suggestion = ERROR_RESPONSIBLE_MAP.get(error_code, ("operator", "请检查错误信息后重试"))
    return role, suggestion


def _can_handle_item(user: User, item: BatchOperationItem) -> bool:
    """判断当前用户是否可以办理该补正项"""
    if item.item_status == ItemStatus.SUCCESS:
        return False
    if item.resolved_status != ResolvedStatus.UNRESOLVED:
        return False
    role = user.profile.role
    resp_role = item.responsible_role
    if not resp_role:
        return True
    if resp_role == "operator":
        return True
    if resp_role == "admin":
        return role == Role.BIZ_MANAGER
    return role == resp_role


def _item_to_result(item: BatchOperationItem, current_user: User | None = None) -> BatchItemResult:
    """将 BatchOperationItem 统一转换为 BatchItemResult"""
    order = item.order
    order_id = order.id if order else item.order_id_tmp
    order_no = order.order_no if order else f"[不存在-{item.order_id_tmp}]"

    resolved_batch_no = None
    resolved_display = ResolvedStatus(item.resolved_status).label
    if item.resolved_by_id:
        try:
            resolved_batch_no = item.resolved_by.batch.batch_no
        except BatchOperationItem.DoesNotExist:
            resolved_batch_no = None

    can_handle = False
    if current_user is not None:
        can_handle = _can_handle_item(current_user, item)

    processed_at_str = item.processed_at.strftime("%Y-%m-%d %H:%M:%S") if item.processed_at else None
    resolved_at_str = item.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if item.resolved_at else None

    action_display = ""
    try:
        action_display = BatchAction(item.batch.action).label
    except Exception:
        pass

    return BatchItemResult(
        order_id=order_id,
        order_no=order_no,
        item_status=item.item_status,
        error_code=item.error_code or None,
        error_message=item.error_message or None,
        submitted_version=item.version,
        responsible_role=item.responsible_role,
        suggestion=item.suggestion,
        batch_no=item.batch.batch_no,
        action=item.batch.action,
        action_display=action_display,
        processed_at=processed_at_str,
        resolved_status=item.resolved_status,
        resolved_status_display=resolved_display,
        resolved_batch_no=resolved_batch_no,
        resolved_at=resolved_at_str,
        can_handle=can_handle,
    )


def _get_user_from_headers(x_user_id: str = Header(None), x_role: str = Header(None)) -> User:
    if not x_user_id:
        _e(401, "MISSING_USER", "缺少用户标识(x-user-id)")
    try:
        user = User.objects.select_related("profile").get(id=int(x_user_id))
    except (ValueError, User.DoesNotExist):
        _e(401, "INVALID_USER", "用户不存在")
    if x_role:
        try:
            profile = user.profile
            if profile.role != x_role:
                _e(403, "ROLE_MISMATCH", f"当前角色{x_role}与用户实际角色{profile.role}不符")
        except UserProfile.DoesNotExist:
            _e(403, "NO_PROFILE", "用户资料不存在")
    return user


def _require_role(user: User, *roles: str) -> str:
    try:
        role = user.profile.role
    except UserProfile.DoesNotExist:
        _e(403, "NO_PROFILE", "用户资料不存在")
    if role not in roles:
        _e(403, "PERMISSION_DENIED", f"当前角色({Role(role).label})无权限执行该操作，需角色: {', '.join([Role(r).label for r in roles])}")
    return role


def _order_to_out(order: TradeOrder) -> TradeOrderOut:
    created_by_name = ""
    if order.created_by:
        try:
            created_by_name = order.created_by.profile.display_name
        except UserProfile.DoesNotExist:
            created_by_name = order.created_by.username

    doc_handler_name = None
    if order.doc_handler:
        try:
            doc_handler_name = order.doc_handler.profile.display_name
        except UserProfile.DoesNotExist:
            doc_handler_name = order.doc_handler.username

    confirm_handler_name = None
    if order.confirm_handler:
        try:
            confirm_handler_name = order.confirm_handler.profile.display_name
        except UserProfile.DoesNotExist:
            confirm_handler_name = order.confirm_handler.username

    evidences_out = []
    for ev in order.evidences.all():
        uploader_name = ""
        try:
            uploader_name = ev.uploader.profile.display_name
        except UserProfile.DoesNotExist:
            uploader_name = ev.uploader.username
        evidences_out.append(EvidenceOut(
            id=ev.id,
            order_id=ev.order_id,
            evidence_type=ev.evidence_type,
            evidence_type_display=EvidenceType(ev.evidence_type).label,
            file_name=ev.file_name,
            file_url=ev.file_url,
            uploader_id=ev.uploader_id,
            uploader_name=uploader_name,
            uploaded_at=ev.uploaded_at,
            remark=ev.remark,
        ))

    return TradeOrderOut(
        id=order.id,
        order_no=order.order_no,
        customer_name=order.customer_name,
        country=order.country,
        product_name=order.product_name,
        quantity=order.quantity,
        unit=order.unit,
        amount=order.amount,
        currency=order.currency,
        status=order.status,
        status_display=OrderStatus(order.status).label,
        version=order.version,
        sales_remark=order.sales_remark,
        doc_remark=order.doc_remark,
        confirm_remark=order.confirm_remark,
        exception_remark=order.exception_remark,
        created_by_id=order.created_by_id,
        created_by_name=created_by_name,
        doc_handler_id=order.doc_handler_id,
        doc_handler_name=doc_handler_name,
        confirm_handler_id=order.confirm_handler_id,
        confirm_handler_name=confirm_handler_name,
        created_at=order.created_at,
        updated_at=order.updated_at,
        submitted_at=order.submitted_at,
        doc_processed_at=order.doc_processed_at,
        confirmed_at=order.confirmed_at,
        evidences=evidences_out,
    )


def _check_version(order: TradeOrder, expected_version: int):
    if order.version != expected_version:
        _e(409, "VERSION_CONFLICT", f"版本冲突：当前版本为{order.version}，你提供的版本为{expected_version}，请刷新后重试")


def _check_evidences(order: TradeOrder):
    types_in_order = set(order.evidences.values_list("evidence_type", flat=True))
    required = {EvidenceType.INQUIRY, EvidenceType.QUOTATION, EvidenceType.CONTRACT}
    missing = required - types_in_order
    if missing:
        missing_labels = [EvidenceType(m).label for m in missing]
        _e(400, "MISSING_EVIDENCE", f"缺少必要证据：{', '.join(missing_labels)}，请上传后再提交")


def _add_history(order: TradeOrder, user: User, action: str, remark: str = ""):
    OrderHistory.objects.create(
        order=order,
        operator=user,
        action=action,
        from_status=order.status,
        to_status=order.status,
        remark=remark,
    )


def _transition_status(order: TradeOrder, target_status: str, user: User, action_name: str, remark: str = ""):
    from_status = order.status
    order.status = target_status
    order.version += 1
    order.save()
    OrderHistory.objects.create(
        order=order,
        operator=user,
        action=action_name,
        from_status=from_status,
        to_status=target_status,
        remark=remark,
    )


@router.get("/users", response=List[UserOut], tags=["用户"])
def list_users(request):
    users = User.objects.select_related("profile").all()
    result = []
    for u in users:
        try:
            profile = u.profile
            result.append(UserOut(
                id=u.id, username=u.username,
                display_name=profile.display_name, role=profile.role,
            ))
        except UserProfile.DoesNotExist:
            pass
    return result


@router.get("", response=List[TradeOrderOut], tags=["外贸订单"])
def list_orders(
    request,
    status: Optional[str] = Query(None, description="按状态筛选"),
    keyword: Optional[str] = Query(None, description="订单号/客户/产品关键词"),
    x_user_id: str = Header(None),
    x_role: str = Header(None),
):
    _get_user_from_headers(x_user_id, x_role)
    qs = TradeOrder.objects.prefetch_related("evidences").order_by("-created_at")
    if status:
        status_list = status.split(",")
        qs = qs.filter(status__in=status_list)
    if keyword:
        qs = qs.filter(
            Q(order_no__icontains=keyword)
            | Q(customer_name__icontains=keyword)
            | Q(product_name__icontains=keyword)
        )
    return [_order_to_out(o) for o in qs]


@router.get("/{order_id}", response=TradeOrderOut, tags=["外贸订单"])
def get_order(request, order_id: int, x_user_id: str = Header(None), x_role: str = Header(None)):
    _get_user_from_headers(x_user_id, x_role)
    try:
        order = TradeOrder.objects.prefetch_related("evidences").get(id=order_id)
    except TradeOrder.DoesNotExist:
        _e(404, "ORDER_NOT_FOUND", f"订单{order_id}不存在")
    return _order_to_out(order)


@router.post("", response=TradeOrderOut, tags=["外贸订单"])
def create_order(request, payload: TradeOrderIn, x_user_id: str = Header(None), x_role: str = Header(None)):
    user = _get_user_from_headers(x_user_id, x_role)
    _require_role(user, Role.SALES)

    if payload.order_no:
        if TradeOrder.objects.filter(order_no=payload.order_no).exists():
            _e(400, "ORDER_NO_EXISTS", f"订单号{payload.order_no}已存在")
        order_no = payload.order_no
    else:
        order_no = f"PO{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"

    order = TradeOrder.objects.create(
        order_no=order_no,
        customer_name=payload.customer_name,
        country=payload.country,
        product_name=payload.product_name,
        quantity=payload.quantity,
        unit=payload.unit or "PCS",
        amount=payload.amount,
        currency=payload.currency or "USD",
        status=OrderStatus.DRAFT,
        created_by=user,
        sales_remark=payload.sales_remark or "",
    )
    _add_history(order, user, "创建订单", payload.sales_remark or "")
    return _order_to_out(order)


@router.put("/{order_id}", response=TradeOrderOut, tags=["外贸订单"])
def update_order(request, order_id: int, payload: TradeOrderUpdate, x_user_id: str = Header(None), x_role: str = Header(None)):
    user = _get_user_from_headers(x_user_id, x_role)
    _require_role(user, Role.SALES)
    try:
        order = TradeOrder.objects.prefetch_related("evidences").get(id=order_id)
    except TradeOrder.DoesNotExist:
        _e(404, "ORDER_NOT_FOUND", f"订单{order_id}不存在")

    if order.created_by_id != user.id:
        _e(403, "NOT_OWNER", "只能修改自己创建的订单")

    if order.status not in (OrderStatus.DRAFT, OrderStatus.DOC_CORRECTION):
        _e(400, "INVALID_STATUS_FOR_EDIT", f"当前状态({OrderStatus(order.status).label})不允许编辑，仅草稿或待业务员补正状态可编辑")

    _check_version(order, payload.version)

    changed = False
    for field in ["customer_name", "country", "product_name", "quantity", "unit", "amount", "currency", "sales_remark"]:
        val = getattr(payload, field)
        if val is not None and getattr(order, field) != val:
            setattr(order, field, val)
            changed = True
    if changed:
        order.version += 1
        order.save()
        _add_history(order, user, "修改订单")
    return _order_to_out(order)


@router.post("/{order_id}/evidences", response=EvidenceOut, tags=["外贸订单-证据"])
def add_evidence(request, order_id: int, payload: EvidenceIn, x_user_id: str = Header(None), x_role: str = Header(None)):
    user = _get_user_from_headers(x_user_id, x_role)
    try:
        order = TradeOrder.objects.get(id=order_id)
    except TradeOrder.DoesNotExist:
        _e(404, "ORDER_NOT_FOUND", f"订单{order_id}不存在")

    if payload.evidence_type not in [t[0] for t in EvidenceType.choices]:
        _e(400, "INVALID_EVIDENCE_TYPE", "证据类型无效")

    role = user.profile.role
    if role == Role.SALES and order.created_by_id != user.id:
        _e(403, "NOT_OWNER", "业务员只能上传自己订单的证据")

    ev = OrderEvidence.objects.create(
        order=order,
        evidence_type=payload.evidence_type,
        file_name=payload.file_name,
        file_url=payload.file_url,
        uploader=user,
        remark=payload.remark or "",
    )
    uploader_name = ""
    try:
        uploader_name = user.profile.display_name
    except UserProfile.DoesNotExist:
        uploader_name = user.username

    _add_history(order, user, f"上传证据[{EvidenceType(payload.evidence_type).label}]", payload.remark or "")
    return EvidenceOut(
        id=ev.id,
        order_id=ev.order_id,
        evidence_type=ev.evidence_type,
        evidence_type_display=EvidenceType(ev.evidence_type).label,
        file_name=ev.file_name,
        file_url=ev.file_url,
        uploader_id=ev.uploader_id,
        uploader_name=uploader_name,
        uploaded_at=ev.uploaded_at,
        remark=ev.remark,
    )


@router.delete("/evidences/{evidence_id}", tags=["外贸订单-证据"])
def delete_evidence(request, evidence_id: int, x_user_id: str = Header(None), x_role: str = Header(None)):
    user = _get_user_from_headers(x_user_id, x_role)
    try:
        ev = OrderEvidence.objects.select_related("order").get(id=evidence_id)
    except OrderEvidence.DoesNotExist:
        _e(404, "EVIDENCE_NOT_FOUND", "证据不存在")

    if ev.uploader_id != user.id:
        _e(403, "NOT_UPLOADER", "只能删除自己上传的证据")

    if ev.order.status not in (OrderStatus.DRAFT, OrderStatus.DOC_CORRECTION):
        _e(400, "INVALID_STATUS_FOR_DELETE", "当前状态不允许删除证据")

    order = ev.order
    ev.delete()
    _add_history(order, user, f"删除证据[{EvidenceType(ev.evidence_type).label}]")
    return {"success": True}


@router.post("/{order_id}/submit-to-doc", response=TradeOrderOut, tags=["外贸订单-流转"])
def submit_to_doc(request, order_id: int, payload: ActionIn, x_user_id: str = Header(None), x_role: str = Header(None)):
    user = _get_user_from_headers(x_user_id, x_role)
    _require_role(user, Role.SALES)
    try:
        order = TradeOrder.objects.prefetch_related("evidences").get(id=order_id)
    except TradeOrder.DoesNotExist:
        _e(404, "ORDER_NOT_FOUND", f"订单{order_id}不存在")

    if order.created_by_id != user.id:
        _e(403, "NOT_OWNER", "只能提交自己创建的订单")

    if order.status not in (OrderStatus.DRAFT, OrderStatus.DOC_CORRECTION):
        _e(400, "INVALID_STATUS", f"当前状态({OrderStatus(order.status).label})不允许提交单证，仅草稿或待业务员补正可提交")

    _check_version(order, payload.version)
    _check_evidences(order)

    order.submitted_at = datetime.now()
    order.sales_remark = payload.remark or order.sales_remark
    _transition_status(order, OrderStatus.PENDING_DOC, user, "提交单证处理", payload.remark or "")
    return _order_to_out(order)


@router.post("/{order_id}/doc-approve", response=TradeOrderOut, tags=["外贸订单-流转"])
def doc_approve(request, order_id: int, payload: ActionIn, x_user_id: str = Header(None), x_role: str = Header(None)):
    user = _get_user_from_headers(x_user_id, x_role)
    _require_role(user, Role.DOC_SUPERVISOR)
    try:
        order = TradeOrder.objects.prefetch_related("evidences").get(id=order_id)
    except TradeOrder.DoesNotExist:
        _e(404, "ORDER_NOT_FOUND", f"订单{order_id}不存在")

    if order.status not in (OrderStatus.PENDING_DOC, OrderStatus.DOC_PROCESSING, OrderStatus.CONFIRM_CORRECTION):
        _e(400, "INVALID_STATUS", f"当前状态({OrderStatus(order.status).label})不允许单证复核通过")

    _check_version(order, payload.version)

    order.doc_handler = user
    order.doc_processed_at = datetime.now()
    order.doc_remark = payload.remark or order.doc_remark
    _transition_status(order, OrderStatus.PENDING_CONFIRM, user, "单证复核通过", payload.remark or "")
    return _order_to_out(order)


@router.post("/{order_id}/doc-reject", response=TradeOrderOut, tags=["外贸订单-流转"])
def doc_reject(request, order_id: int, payload: ActionIn, x_user_id: str = Header(None), x_role: str = Header(None)):
    user = _get_user_from_headers(x_user_id, x_role)
    _require_role(user, Role.DOC_SUPERVISOR)
    try:
        order = TradeOrder.objects.prefetch_related("evidences").get(id=order_id)
    except TradeOrder.DoesNotExist:
        _e(404, "ORDER_NOT_FOUND", f"订单{order_id}不存在")

    if order.status not in (OrderStatus.PENDING_DOC, OrderStatus.DOC_PROCESSING):
        _e(400, "INVALID_STATUS", f"当前状态({OrderStatus(order.status).label})不允许退回业务员补正")

    if not payload.remark:
        _e(400, "REMARK_REQUIRED", "退回必须填写补正说明")

    _check_version(order, payload.version)

    order.doc_handler = user
    order.doc_remark = payload.remark
    _transition_status(order, OrderStatus.DOC_CORRECTION, user, "退回业务员补正", payload.remark)
    return _order_to_out(order)


@router.post("/{order_id}/doc-mark-exception", response=TradeOrderOut, tags=["外贸订单-流转"])
def doc_mark_exception(request, order_id: int, payload: ActionIn, x_user_id: str = Header(None), x_role: str = Header(None)):
    user = _get_user_from_headers(x_user_id, x_role)
    _require_role(user, Role.DOC_SUPERVISOR)
    try:
        order = TradeOrder.objects.prefetch_related("evidences").get(id=order_id)
    except TradeOrder.DoesNotExist:
        _e(404, "ORDER_NOT_FOUND", f"订单{order_id}不存在")

    if order.status not in (OrderStatus.PENDING_DOC, OrderStatus.DOC_PROCESSING):
        _e(400, "INVALID_STATUS", f"当前状态({OrderStatus(order.status).label})不允许标记异常")

    if not payload.remark:
        _e(400, "REMARK_REQUIRED", "标记异常必须填写异常说明")

    _check_version(order, payload.version)

    order.doc_handler = user
    order.exception_remark = payload.remark
    _transition_status(order, OrderStatus.DOC_EXCEPTION, user, "单证标记异常", payload.remark)
    return _order_to_out(order)


@router.post("/{order_id}/confirm-approve", response=TradeOrderOut, tags=["外贸订单-流转"])
def confirm_approve(request, order_id: int, payload: ActionIn, x_user_id: str = Header(None), x_role: str = Header(None)):
    user = _get_user_from_headers(x_user_id, x_role)
    _require_role(user, Role.BIZ_MANAGER)
    try:
        order = TradeOrder.objects.prefetch_related("evidences").get(id=order_id)
    except TradeOrder.DoesNotExist:
        _e(404, "ORDER_NOT_FOUND", f"订单{order_id}不存在")

    if order.status not in (OrderStatus.PENDING_CONFIRM, OrderStatus.CONFIRM_EXCEPTION):
        _e(400, "INVALID_STATUS", f"当前状态({OrderStatus(order.status).label})不允许经理确认")

    _check_version(order, payload.version)
    _check_evidences(order)

    order.confirm_handler = user
    order.confirmed_at = datetime.now()
    order.confirm_remark = payload.remark or order.confirm_remark
    _transition_status(order, OrderStatus.COMPLETED, user, "经理确认通过，订单完成", payload.remark or "")
    return _order_to_out(order)


@router.post("/{order_id}/confirm-reject", response=TradeOrderOut, tags=["外贸订单-流转"])
def confirm_reject(request, order_id: int, payload: ActionIn, x_user_id: str = Header(None), x_role: str = Header(None)):
    user = _get_user_from_headers(x_user_id, x_role)
    _require_role(user, Role.BIZ_MANAGER)
    try:
        order = TradeOrder.objects.prefetch_related("evidences").get(id=order_id)
    except TradeOrder.DoesNotExist:
        _e(404, "ORDER_NOT_FOUND", f"订单{order_id}不存在")

    if order.status not in (OrderStatus.PENDING_CONFIRM,):
        _e(400, "INVALID_STATUS", f"当前状态({OrderStatus(order.status).label})不允许退回单证补正")

    if not payload.remark:
        _e(400, "REMARK_REQUIRED", "退回必须填写补正说明")

    _check_version(order, payload.version)

    order.confirm_handler = user
    order.confirm_remark = payload.remark
    _transition_status(order, OrderStatus.CONFIRM_CORRECTION, user, "退回单证补正", payload.remark)
    return _order_to_out(order)


@router.post("/{order_id}/confirm-mark-exception", response=TradeOrderOut, tags=["外贸订单-流转"])
def confirm_mark_exception(request, order_id: int, payload: ActionIn, x_user_id: str = Header(None), x_role: str = Header(None)):
    user = _get_user_from_headers(x_user_id, x_role)
    _require_role(user, Role.BIZ_MANAGER)
    try:
        order = TradeOrder.objects.prefetch_related("evidences").get(id=order_id)
    except TradeOrder.DoesNotExist:
        _e(404, "ORDER_NOT_FOUND", f"订单{order_id}不存在")

    if order.status not in (OrderStatus.PENDING_CONFIRM,):
        _e(400, "INVALID_STATUS", f"当前状态({OrderStatus(order.status).label})不允许标记异常")

    if not payload.remark:
        _e(400, "REMARK_REQUIRED", "标记异常必须填写异常说明")

    _check_version(order, payload.version)

    order.confirm_handler = user
    order.exception_remark = payload.remark
    _transition_status(order, OrderStatus.CONFIRM_EXCEPTION, user, "确认环节标记异常", payload.remark)
    return _order_to_out(order)


@router.get("/{order_id}/histories", response=List[OrderHistoryOut], tags=["外贸订单-历史"])
def list_histories(request, order_id: int, x_user_id: str = Header(None), x_role: str = Header(None)):
    _get_user_from_headers(x_user_id, x_role)
    try:
        order = TradeOrder.objects.get(id=order_id)
    except TradeOrder.DoesNotExist:
        _e(404, "ORDER_NOT_FOUND", f"订单{order_id}不存在")
    histories = order.histories.select_related("operator", "operator__profile").all()
    result = []
    for h in histories:
        operator_name = ""
        try:
            operator_name = h.operator.profile.display_name
        except UserProfile.DoesNotExist:
            operator_name = h.operator.username
        from_display = OrderStatus(h.from_status).label if h.from_status else ""
        to_display = OrderStatus(h.to_status).label if h.to_status else ""
        result.append(OrderHistoryOut(
            id=h.id,
            order_id=h.order_id,
            operator_id=h.operator_id,
            operator_name=operator_name,
            action=h.action,
            from_status=h.from_status,
            from_status_display=from_display,
            to_status=h.to_status,
            to_status_display=to_display,
            remark=h.remark,
            created_at=h.created_at,
        ))
    return result


def _process_single_action(order: TradeOrder, action: str, user: User, expected_version: int, remark: str = "") -> tuple[str, Optional[str], Optional[str], str, str]:
    try:
        if order.version != expected_version:
            _add_history(order, user, "批量-版本冲突", remark)
            resp_role, resp_sug = _get_responsible_and_suggestion("VERSION_CONFLICT")
            return ItemStatus.FAILED, "VERSION_CONFLICT", f"版本冲突：当前版本为{order.version}，你提供的版本为{expected_version}，请刷新后重试", resp_role, resp_sug

        if action == BatchAction.SUBMIT_TO_DOC:
            _require_role(user, Role.SALES)
            if order.created_by_id != user.id:
                _add_history(order, user, "批量-提交失败(非本人)", remark)
                resp_role, resp_sug = _get_responsible_and_suggestion("NOT_OWNER")
                return ItemStatus.FAILED, "NOT_OWNER", "只能提交自己创建的订单", resp_role, resp_sug
            if order.status not in (OrderStatus.DRAFT, OrderStatus.DOC_CORRECTION):
                _add_history(order, user, "批量-提交失败(状态错误)", remark)
                resp_role, resp_sug = _get_responsible_and_suggestion("INVALID_STATUS")
                return ItemStatus.FAILED, "INVALID_STATUS", f"状态{OrderStatus(order.status).label}不允许提交单证", resp_role, resp_sug
            try:
                _check_evidences(order)
            except APIError as e:
                _add_history(order, user, "批量-提交需重试(缺证据)", remark)
                resp_role, resp_sug = _get_responsible_and_suggestion(e.code)
                return ItemStatus.RETRY, e.code, e.message, resp_role, resp_sug
            order.submitted_at = datetime.now()
            _transition_status(order, OrderStatus.PENDING_DOC, user, "批量-提交单证处理", remark)
            return ItemStatus.SUCCESS, None, "提交成功", "", ""

        elif action == BatchAction.APPROVE_DOC:
            _require_role(user, Role.DOC_SUPERVISOR)
            if order.status not in (OrderStatus.PENDING_DOC, OrderStatus.DOC_PROCESSING, OrderStatus.CONFIRM_CORRECTION):
                _add_history(order, user, "批量-单证复核失败(状态错误)", remark)
                resp_role, resp_sug = _get_responsible_and_suggestion("INVALID_STATUS")
                return ItemStatus.FAILED, "INVALID_STATUS", f"状态{OrderStatus(order.status).label}不允许单证复核通过", resp_role, resp_sug
            order.doc_handler = user
            order.doc_processed_at = datetime.now()
            _transition_status(order, OrderStatus.PENDING_CONFIRM, user, "批量-单证复核通过", remark)
            return ItemStatus.SUCCESS, None, "单证复核通过", "", ""

        elif action == BatchAction.REJECT_DOC:
            _require_role(user, Role.DOC_SUPERVISOR)
            if not remark or not remark.strip():
                _add_history(order, user, "批量-退回失败(缺备注)", "")
                resp_role, resp_sug = _get_responsible_and_suggestion("REMARK_REQUIRED")
                return ItemStatus.FAILED, "REMARK_REQUIRED", "批量退回必须填写备注说明", resp_role, resp_sug
            if order.status not in (OrderStatus.PENDING_DOC, OrderStatus.DOC_PROCESSING):
                _add_history(order, user, "批量-退回失败(状态错误)", remark)
                resp_role, resp_sug = _get_responsible_and_suggestion("INVALID_STATUS")
                return ItemStatus.FAILED, "INVALID_STATUS", f"状态{OrderStatus(order.status).label}不允许退回补正", resp_role, resp_sug
            order.doc_handler = user
            order.doc_remark = remark
            _transition_status(order, OrderStatus.DOC_CORRECTION, user, "批量-退回业务员补正", remark)
            return ItemStatus.SUCCESS, None, "已退回业务员补正", "", ""

        elif action == BatchAction.MARK_EXCEPTION_DOC:
            _require_role(user, Role.DOC_SUPERVISOR)
            if not remark or not remark.strip():
                _add_history(order, user, "批量-标记异常失败(缺备注)", "")
                resp_role, resp_sug = _get_responsible_and_suggestion("REMARK_REQUIRED")
                return ItemStatus.FAILED, "REMARK_REQUIRED", "批量标记异常必须填写备注说明", resp_role, resp_sug
            if order.status not in (OrderStatus.PENDING_DOC, OrderStatus.DOC_PROCESSING):
                _add_history(order, user, "批量-标记异常失败(状态错误)", remark)
                resp_role, resp_sug = _get_responsible_and_suggestion("INVALID_STATUS")
                return ItemStatus.FAILED, "INVALID_STATUS", f"状态{OrderStatus(order.status).label}不允许标记异常", resp_role, resp_sug
            order.doc_handler = user
            order.exception_remark = remark
            _transition_status(order, OrderStatus.DOC_EXCEPTION, user, "批量-单证标记异常", remark)
            return ItemStatus.SUCCESS, None, "已标记异常", "", ""

        elif action == BatchAction.SUBMIT_TO_CONFIRM:
            _require_role(user, Role.DOC_SUPERVISOR)
            if order.status not in (OrderStatus.PENDING_DOC, OrderStatus.DOC_PROCESSING, OrderStatus.CONFIRM_CORRECTION):
                _add_history(order, user, "批量-提交确认失败(状态错误)", remark)
                resp_role, resp_sug = _get_responsible_and_suggestion("INVALID_STATUS")
                return ItemStatus.FAILED, "INVALID_STATUS", f"状态{OrderStatus(order.status).label}不允许提交确认", resp_role, resp_sug
            order.doc_handler = user
            order.doc_processed_at = datetime.now()
            _transition_status(order, OrderStatus.PENDING_CONFIRM, user, "批量-提交经理确认", remark)
            return ItemStatus.SUCCESS, None, "已提交经理确认", "", ""

        elif action == BatchAction.APPROVE_CONFIRM:
            _require_role(user, Role.BIZ_MANAGER)
            if order.status not in (OrderStatus.PENDING_CONFIRM, OrderStatus.CONFIRM_EXCEPTION):
                _add_history(order, user, "批量-确认失败(状态错误)", remark)
                resp_role, resp_sug = _get_responsible_and_suggestion("INVALID_STATUS")
                return ItemStatus.FAILED, "INVALID_STATUS", f"状态{OrderStatus(order.status).label}不允许确认通过", resp_role, resp_sug
            try:
                _check_evidences(order)
            except APIError as e:
                _add_history(order, user, "批量-确认需重试(缺证据)", remark)
                resp_role, resp_sug = _get_responsible_and_suggestion(e.code)
                return ItemStatus.RETRY, e.code, e.message, resp_role, resp_sug
            order.confirm_handler = user
            order.confirmed_at = datetime.now()
            _transition_status(order, OrderStatus.COMPLETED, user, "批量-经理确认通过", remark)
            return ItemStatus.SUCCESS, None, "经理确认通过", "", ""

        elif action == BatchAction.REJECT_CONFIRM:
            _require_role(user, Role.BIZ_MANAGER)
            if not remark or not remark.strip():
                _add_history(order, user, "批量-退回失败(缺备注)", "")
                resp_role, resp_sug = _get_responsible_and_suggestion("REMARK_REQUIRED")
                return ItemStatus.FAILED, "REMARK_REQUIRED", "批量退回必须填写备注说明", resp_role, resp_sug
            if order.status not in (OrderStatus.PENDING_CONFIRM,):
                _add_history(order, user, "批量-退回失败(状态错误)", remark)
                resp_role, resp_sug = _get_responsible_and_suggestion("INVALID_STATUS")
                return ItemStatus.FAILED, "INVALID_STATUS", f"状态{OrderStatus(order.status).label}不允许退回补正", resp_role, resp_sug
            order.confirm_handler = user
            order.confirm_remark = remark
            _transition_status(order, OrderStatus.CONFIRM_CORRECTION, user, "批量-退回单证补正", remark)
            return ItemStatus.SUCCESS, None, "已退回单证补正", "", ""

        elif action == BatchAction.MARK_EXCEPTION_CONFIRM:
            _require_role(user, Role.BIZ_MANAGER)
            if not remark or not remark.strip():
                _add_history(order, user, "批量-标记异常失败(缺备注)", "")
                resp_role, resp_sug = _get_responsible_and_suggestion("REMARK_REQUIRED")
                return ItemStatus.FAILED, "REMARK_REQUIRED", "批量标记异常必须填写备注说明", resp_role, resp_sug
            if order.status not in (OrderStatus.PENDING_CONFIRM,):
                _add_history(order, user, "批量-标记异常失败(状态错误)", remark)
                resp_role, resp_sug = _get_responsible_and_suggestion("INVALID_STATUS")
                return ItemStatus.FAILED, "INVALID_STATUS", f"状态{OrderStatus(order.status).label}不允许标记异常", resp_role, resp_sug
            order.confirm_handler = user
            order.exception_remark = remark
            _transition_status(order, OrderStatus.CONFIRM_EXCEPTION, user, "批量-确认环节标记异常", remark)
            return ItemStatus.SUCCESS, None, "已标记异常", "", ""

        else:
            _add_history(order, user, "批量-操作失败(不支持的操作)", remark)
            resp_role, resp_sug = _get_responsible_and_suggestion("INVALID_ACTION")
            return ItemStatus.FAILED, "INVALID_ACTION", f"不支持的批量操作: {action}", resp_role, resp_sug

    except APIError as e:
        _add_history(order, user, f"批量-操作失败({e.code})", remark)
        resp_role, resp_sug = _get_responsible_and_suggestion(e.code)
        return ItemStatus.FAILED, e.code, e.message, resp_role, resp_sug
    except Exception as e:
        _add_history(order, user, f"批量-系统错误", remark)
        resp_role, resp_sug = _get_responsible_and_suggestion("SYSTEM_ERROR")
        return ItemStatus.FAILED, "SYSTEM_ERROR", str(e), resp_role, resp_sug


@router.post("/ops/batches", response=BatchOperationOut, tags=["外贸订单-批量操作"])
def batch_operation(request, payload: BatchOperationIn, x_user_id: str = Header(None), x_role: str = Header(None)):
    user = _get_user_from_headers(x_user_id, x_role)

    valid_actions = [a[0] for a in BatchAction.choices]
    if payload.action not in valid_actions:
        _e(400, "INVALID_ACTION", f"不支持的批量操作: {payload.action}")

    if len(payload.order_items) == 0:
        _e(400, "INVALID_ACTION", "请至少选择一条订单")

    order_ids = [item.order_id for item in payload.order_items]
    version_map = {item.order_id: item.version for item in payload.order_items}

    orders = TradeOrder.objects.filter(id__in=order_ids).order_by("id")
    existing_ids = set(orders.values_list("id", flat=True))
    missing_ids = set(order_ids) - existing_ids

    batch_no = f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"

    with transaction.atomic():
        batch = BatchOperation.objects.create(
            batch_no=batch_no,
            action=payload.action,
            operator=user,
            status=BatchStatus.RUNNING,
            total_count=len(order_ids),
            remark=payload.remark or "",
            started_at=datetime.now(),
        )

        success_count = 0
        failed_count = 0
        retry_count = 0
        created_items = []
        success_items = []

        for oid in order_ids:
            expected_version = version_map.get(oid, 0)
            if oid in missing_ids:
                failed_count += 1
                resp_role, resp_sug = _get_responsible_and_suggestion("ORDER_NOT_FOUND")
                item = BatchOperationItem.objects.create(
                    batch=batch,
                    order=None,
                    order_id_tmp=oid,
                    item_status=ItemStatus.FAILED,
                    error_code="ORDER_NOT_FOUND",
                    error_message=f"订单{oid}不存在",
                    responsible_role=resp_role,
                    suggestion=resp_sug,
                    processed_at=datetime.now(),
                    version=expected_version,
                )
                created_items.append(item)
                continue

            order = orders.get(id=oid)
            item_status, err_code, err_msg, resp_role, resp_sug = _process_single_action(order, payload.action, user, expected_version, payload.remark or "")

            item = BatchOperationItem.objects.create(
                batch=batch,
                order=order,
                order_id_tmp=0,
                item_status=item_status,
                error_code=err_code or "",
                error_message=err_msg or "",
                responsible_role=resp_role,
                suggestion=resp_sug,
                processed_at=datetime.now(),
                version=expected_version,
            )
            created_items.append(item)

            if item_status == ItemStatus.SUCCESS:
                success_count += 1
                success_items.append(item)
            elif item_status == ItemStatus.RETRY:
                retry_count += 1
            else:
                failed_count += 1

        if success_items:
            now = datetime.now()
            success_oids = [it.order_id for it in success_items if it.order_id]
            prev_unresolved = BatchOperationItem.objects.filter(
                order_id__in=success_oids,
                order__isnull=False,
                resolved_status=ResolvedStatus.UNRESOLVED,
            ).exclude(item_status=ItemStatus.SUCCESS)

            prev_map = {}
            for pit in prev_unresolved:
                prev_map.setdefault(pit.order_id, []).append(pit)

            for sitem in success_items:
                if not sitem.order_id:
                    continue
                prevs = prev_map.get(sitem.order_id, [])
                for pitem in prevs:
                    pitem.resolved_status = ResolvedStatus.RESUBMITTED
                    pitem.resolved_by = sitem
                    pitem.resolved_at = now
                    pitem.save(update_fields=["resolved_status", "resolved_by", "resolved_at"])

        batch.success_count = success_count
        batch.failed_count = failed_count
        batch.retry_count = retry_count
        batch.status = BatchStatus.COMPLETED
        batch.finished_at = datetime.now()
        batch.save(update_fields=["success_count", "failed_count", "retry_count", "status", "finished_at"])

        for item in created_items:
            if item.resolved_status == ResolvedStatus.UNRESOLVED and item.resolved_by_id is None:
                item.refresh_from_db()

        items_out = [_item_to_result(it, user) for it in created_items]

    operator_name = ""
    try:
        operator_name = user.profile.display_name
    except UserProfile.DoesNotExist:
        operator_name = user.username

    return BatchOperationOut(
        id=batch.id,
        batch_no=batch.batch_no,
        action=batch.action,
        action_display=BatchAction(batch.action).label,
        operator_id=batch.operator_id,
        operator_name=operator_name,
        status=batch.status,
        status_display=BatchStatus(batch.status).label,
        total_count=batch.total_count,
        success_count=batch.success_count,
        failed_count=batch.failed_count,
        retry_count=batch.retry_count,
        created_at=batch.created_at,
        started_at=batch.started_at,
        finished_at=batch.finished_at,
        remark=batch.remark,
        items=items_out,
    )


@router.get("/ops/batches", response=List[BatchOperationOut], tags=["外贸订单-批量操作"])
def list_batch_operations(request, x_user_id: str = Header(None), x_role: str = Header(None)):
    user = _get_user_from_headers(x_user_id, x_role)
    batches = BatchOperation.objects.select_related("operator", "operator__profile").prefetch_related("items", "items__order").order_by("-created_at")[:50]
    result = []
    for b in batches:
        operator_name = ""
        try:
            operator_name = b.operator.profile.display_name
        except UserProfile.DoesNotExist:
            operator_name = b.operator.username
        items_out = [_item_to_result(it, user) for it in b.items.all()]
        result.append(BatchOperationOut(
            id=b.id,
            batch_no=b.batch_no,
            action=b.action,
            action_display=BatchAction(b.action).label,
            operator_id=b.operator_id,
            operator_name=operator_name,
            status=b.status,
            status_display=BatchStatus(b.status).label,
            total_count=b.total_count,
            success_count=b.success_count,
            failed_count=b.failed_count,
            retry_count=b.retry_count,
            created_at=b.created_at,
            started_at=b.started_at,
            finished_at=b.finished_at,
            remark=b.remark,
            items=items_out,
        ))
    return result


@router.get("/ops/batch-items/latest", response=List[BatchItemResult], tags=["外贸订单-批量操作"])
def get_latest_batch_items_by_orders(request, order_ids: str = "", x_user_id: str = Header(None), x_role: str = Header(None)):
    """
    批量获取指定订单的最近一次批量操作记录（仅当最近一次是失败/重试时返回）
    order_ids: 逗号分隔的订单ID列表
    按角色限制：业务员只能查看自己创建的订单
    """
    user = _get_user_from_headers(x_user_id, x_role)
    
    if not order_ids:
        return []
    
    oid_list = [int(x.strip()) for x in order_ids.split(",") if x.strip().isdigit()]
    if not oid_list:
        return []
    
    role = user.profile.role
    qs = (
        BatchOperationItem.objects
        .filter(order_id__in=oid_list, order__isnull=False)
        .select_related("order", "batch", "batch__operator", "batch__operator__profile", "resolved_by", "resolved_by__batch")
        .order_by("order_id", "-id")
    )
    
    if role == Role.SALES:
        qs = qs.filter(order__created_by=user)
    
    items = list(qs)
    
    seen = set()
    latest_items = []
    for it in items:
        if it.order_id in seen:
            continue
        seen.add(it.order_id)
        latest_items.append(it)
    
    result = []
    for it in latest_items:
        if it.item_status == ItemStatus.SUCCESS:
            continue
        result.append(_item_to_result(it, user))
    
    return result


@router.get("/ops/orders/{order_id}/batch-items", response=List[BatchItemResult], tags=["外贸订单-批量操作"])
def get_order_batch_items(request, order_id: int, x_user_id: str = Header(None), x_role: str = Header(None)):
    """
    获取单个订单的批量操作历史明细
    按角色限制：业务员只能查看自己创建的订单
    """
    user = _get_user_from_headers(x_user_id, x_role)
    
    try:
        order = TradeOrder.objects.get(id=order_id)
    except TradeOrder.DoesNotExist:
        _e(404, "ORDER_NOT_FOUND", "订单不存在")
    
    role = user.profile.role
    if role == Role.SALES and order.created_by_id != user.id:
        _e(403, "PERMISSION_DENIED", "无权查看他人订单的批量操作记录")
    
    items = (
        BatchOperationItem.objects
        .filter(order=order)
        .select_related("batch", "batch__operator", "batch__operator__profile", "resolved_by", "resolved_by__batch")
        .order_by("-id")[:20]
    )
    
    return [_item_to_result(it, user) for it in items]
