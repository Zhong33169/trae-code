from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from typing import Optional, List, Tuple
from datetime import datetime, timezone

from database import get_db
from deps import (
    get_current_user,
    allow_registrar,
    allow_supervisor,
    allow_reviewer,
    allow_all_authenticated,
    allow_registrar_supervisor,
)
from models.user import User, UserRole
from models.inspection import InspectionOrder, InspectionStatus, InspectionType
from models.charging_pile import ChargingPile
from models.audit_log import AuditAction
from models.fault_report import FaultReport
from models.repair_acceptance import RepairAcceptance
from models.qr_record import QRCodeRecord
from schemas.inspection import (
    InspectionOrderCreate,
    InspectionOrderUpdate,
    InspectionOrderResponse,
    InspectionOrderListResponse,
    StatusUpdateRequest,
    InspectionOrderWithDetails,
)
from schemas.fault_report import FaultReportCreate, FaultReportResponse
from schemas.repair_acceptance import RepairAcceptanceCreate, RepairAcceptanceResponse
from utils import (
    generate_order_no,
    create_audit_log,
    validate_inspection_materials,
    validate_fault_report_materials,
    validate_repair_acceptance_materials,
    acquire_lock,
    release_lock,
    check_version,
    generate_request_id,
    get_status_label,
    get_type_label,
    get_role_label,
)

router = APIRouter()


def get_role_queues(user_role: UserRole) -> List[InspectionStatus]:
    if user_role == UserRole.REGISTRAR:
        return [
            InspectionStatus.DRAFT,
            InspectionStatus.REVIEW_REJECTED,
            InspectionStatus.FINAL_REVIEW_REJECTED,
            InspectionStatus.ACCEPTANCE_REJECTED,
        ]
    elif user_role == UserRole.SUPERVISOR:
        return [
            InspectionStatus.PENDING_REVIEW,
            InspectionStatus.PENDING_FAULT_REPORT,
            InspectionStatus.FAULT_REPORTED,
            InspectionStatus.PENDING_REPAIR,
            InspectionStatus.REPAIR_COMPLETED,
            InspectionStatus.PENDING_ACCEPTANCE,
        ]
    elif user_role == UserRole.REVIEWER:
        return [
            InspectionStatus.PENDING_FINAL_REVIEW,
        ]
    return []


def get_allowed_actions(inspection: InspectionOrder, user: User) -> Tuple[bool, List[str]]:
    actions = []
    can_operate = False

    if user.role == UserRole.REGISTRAR:
        if inspection.status in [InspectionStatus.DRAFT, InspectionStatus.REVIEW_REJECTED,
                                 InspectionStatus.FINAL_REVIEW_REJECTED, InspectionStatus.ACCEPTANCE_REJECTED]:
            can_operate = True
            actions = ["view", "update", "scan_qr", "submit"]

    elif user.role == UserRole.SUPERVISOR:
        if inspection.status == InspectionStatus.PENDING_REVIEW:
            can_operate = True
            actions = ["view", "approve", "reject", "report_fault"]
        elif inspection.status == InspectionStatus.PENDING_FAULT_REPORT:
            can_operate = True
            actions = ["view", "submit_fault_report"]
        elif inspection.status == InspectionStatus.FAULT_REPORTED:
            can_operate = True
            actions = ["view", "mark_repair_start"]
        elif inspection.status == InspectionStatus.PENDING_REPAIR:
            can_operate = True
            actions = ["view", "mark_repair_complete"]
        elif inspection.status == InspectionStatus.REPAIR_COMPLETED:
            can_operate = True
            actions = ["view", "submit_acceptance"]
        elif inspection.status == InspectionStatus.PENDING_ACCEPTANCE:
            can_operate = True
            actions = ["view", "acceptance_pass", "acceptance_reject"]

    elif user.role == UserRole.REVIEWER:
        if inspection.status == InspectionStatus.PENDING_FINAL_REVIEW:
            can_operate = True
            actions = ["view", "archive", "final_reject"]

    if not can_operate:
        actions = ["view"]

    return can_operate, actions


def get_action_target_status(action: str) -> Optional[InspectionStatus]:
    action_map = {
        "submit": InspectionStatus.PENDING_REVIEW,
        "approve": InspectionStatus.PENDING_FINAL_REVIEW,
        "reject": InspectionStatus.REVIEW_REJECTED,
        "report_fault": InspectionStatus.PENDING_FAULT_REPORT,
        "submit_fault_report": InspectionStatus.FAULT_REPORTED,
        "mark_repair_start": InspectionStatus.PENDING_REPAIR,
        "mark_repair_complete": InspectionStatus.REPAIR_COMPLETED,
        "submit_acceptance": InspectionStatus.PENDING_ACCEPTANCE,
        "acceptance_pass": InspectionStatus.PENDING_FINAL_REVIEW,
        "acceptance_reject": InspectionStatus.ACCEPTANCE_REJECTED,
        "archive": InspectionStatus.ARCHIVED,
        "final_reject": InspectionStatus.FINAL_REVIEW_REJECTED,
    }
    return action_map.get(action)


def get_action_label(action: str) -> str:
    label_map = {
        "view": "查看",
        "update": "编辑",
        "scan_qr": "扫码核验",
        "submit": "提交审核",
        "approve": "审核通过",
        "reject": "审核退回",
        "report_fault": "故障上报",
        "submit_fault_report": "提交故障报告",
        "mark_repair_start": "开始修复",
        "mark_repair_complete": "修复完成",
        "submit_acceptance": "提交验收",
        "acceptance_pass": "验收通过",
        "acceptance_reject": "验收驳回",
        "archive": "复核归档",
        "final_reject": "复核退回",
    }
    return label_map.get(action, action)


def build_inspection_response(
    inspection: InspectionOrder,
    current_user: Optional[User] = None
) -> InspectionOrderResponse:
    type_label = get_type_label(inspection.type)
    status_label = get_status_label(inspection.status)
    is_overdue = False
    if inspection.time_limit:
        now = datetime.now(timezone.utc)
        if inspection.time_limit.tzinfo is None:
            now = now.replace(tzinfo=None)
        is_overdue = now > inspection.time_limit

    can_operate = False
    allowed_actions = ["view"]
    if current_user:
        can_operate, allowed_actions = get_allowed_actions(inspection, current_user)

    return InspectionOrderResponse(
        id=inspection.id,
        order_no=inspection.order_no,
        type=inspection.type,
        type_label=type_label,
        status=inspection.status,
        status_label=status_label,
        charging_pile_id=inspection.charging_pile_id,
        charging_pile=inspection.charging_pile,
        inspection_date=inspection.inspection_date,
        inspector_name=inspection.inspector_name,
        appearance_check=inspection.appearance_check,
        appearance_note=inspection.appearance_note,
        cable_check=inspection.cable_check,
        cable_note=inspection.cable_note,
        connector_check=inspection.connector_check,
        connector_note=inspection.connector_note,
        display_check=inspection.display_check,
        display_note=inspection.display_note,
        charging_check=inspection.charging_check,
        charging_note=inspection.charging_note,
        emergency_stop_check=inspection.emergency_stop_check,
        emergency_stop_note=inspection.emergency_stop_note,
        grounding_check=inspection.grounding_check,
        grounding_note=inspection.grounding_note,
        overall_result=inspection.overall_result,
        registrar_opinion=inspection.registrar_opinion,
        supervisor_opinion=inspection.supervisor_opinion,
        supervisor_review_date=inspection.supervisor_review_date,
        reviewer_opinion=inspection.reviewer_opinion,
        reviewer_review_date=inspection.reviewer_review_date,
        time_limit=inspection.time_limit,
        is_overdue=is_overdue,
        created_by=inspection.created_by,
        created_at=inspection.created_at,
        updated_at=inspection.updated_at,
        version=inspection.version,
        can_operate=can_operate,
        allowed_actions=allowed_actions,
    )


async def get_statistics(db: AsyncSession, user: User) -> dict:
    stats = {}

    for status in InspectionStatus:
        query = select(func.count()).select_from(InspectionOrder)
        if user.role == UserRole.REGISTRAR:
            query = query.where(InspectionOrder.created_by == user.id)
        query = query.where(InspectionOrder.status == status)
        result = await db.execute(query)
        count = result.scalar_one()
        stats[status.value] = count

    role_queues = get_role_queues(user.role)
    my_todo_query = select(func.count()).select_from(InspectionOrder)
    if user.role == UserRole.REGISTRAR:
        my_todo_query = my_todo_query.where(
            and_(
                InspectionOrder.status.in_(role_queues),
                InspectionOrder.created_by == user.id
            )
        )
    else:
        my_todo_query = my_todo_query.where(InspectionOrder.status.in_(role_queues))
    my_todo_result = await db.execute(my_todo_query)
    stats["my_todo"] = my_todo_result.scalar_one()

    my_created_query = select(func.count()).select_from(InspectionOrder).where(
        InspectionOrder.created_by == user.id
    )
    my_created_result = await db.execute(my_created_query)
    stats["my_created"] = my_created_result.scalar_one()

    all_query = select(func.count()).select_from(InspectionOrder)
    all_result = await db.execute(all_query)
    stats["all"] = all_result.scalar_one()

    return stats


@router.get("", response_model=InspectionOrderListResponse, summary="获取巡检单列表", description="获取巡检单列表，支持按角色筛选队列、状态筛选、分页、统计")
async def get_inspections(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    status: Optional[InspectionStatus] = Query(None, description="状态筛选"),
    queue: Optional[str] = Query(None, description="队列筛选: my_todo, my_created, all"),
    type: Optional[InspectionType] = Query(None, description="巡检类型"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    current_user: User = Depends(allow_all_authenticated),
    db: AsyncSession = Depends(get_db)
):
    query = select(InspectionOrder).options(joinedload(InspectionOrder.charging_pile))

    if queue == "my_todo":
        role_queues = get_role_queues(current_user.role)
        query = query.where(InspectionOrder.status.in_(role_queues))
    elif queue == "my_created":
        query = query.where(InspectionOrder.created_by == current_user.id)

    if status:
        query = query.where(InspectionOrder.status == status)
    if type:
        query = query.where(InspectionOrder.type == type)
    if keyword:
        query = query.join(ChargingPile).where(
            or_(
                InspectionOrder.order_no.like(f"%{keyword}%"),
                ChargingPile.pile_name.like(f"%{keyword}%"),
                ChargingPile.pile_code.like(f"%{keyword}%"),
                InspectionOrder.inspector_name.like(f"%{keyword}%"),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    query = query.order_by(InspectionOrder.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    inspections = result.scalars().all()

    statistics = await get_statistics(db, current_user)

    return InspectionOrderListResponse(
        total=total,
        items=[build_inspection_response(inspection, current_user) for inspection in inspections],
        page=page,
        page_size=page_size,
        statistics=statistics,
    )


@router.get("/{order_id}", response_model=InspectionOrderWithDetails, summary="获取巡检单详情", description="获取巡检单详情，包含扫码记录、故障报告、修复验收、可操作权限")
async def get_inspection(
    order_id: int,
    current_user: User = Depends(allow_all_authenticated),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(InspectionOrder)
        .options(
            joinedload(InspectionOrder.charging_pile),
            selectinload(InspectionOrder.qr_records).joinedload(QRCodeRecord.scanner),
            joinedload(InspectionOrder.fault_report),
            joinedload(InspectionOrder.repair_acceptance),
        )
        .where(InspectionOrder.id == order_id)
    )
    inspection = result.scalar_one_or_none()

    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"巡检单ID {order_id} 不存在"
        )

    base_response = build_inspection_response(inspection, current_user)

    return InspectionOrderWithDetails(
        **base_response.model_dump(),
        qr_records=inspection.qr_records,
        fault_report=inspection.fault_report,
        repair_acceptance=inspection.repair_acceptance,
    )


@router.post("", response_model=InspectionOrderResponse, summary="创建巡检单", description="创建新的巡检单（仅登记员）")
async def create_inspection(
    inspection_data: InspectionOrderCreate,
    request: Request,
    current_user: User = Depends(allow_registrar),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ChargingPile).where(ChargingPile.id == inspection_data.charging_pile_id)
    )
    pile = result.scalar_one_or_none()
    if not pile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"充电桩ID {inspection_data.charging_pile_id} 不存在"
        )

    order_no = generate_order_no()

    inspection = InspectionOrder(
        **inspection_data.model_dump(),
        order_no=order_no,
        status=InspectionStatus.DRAFT,
        created_by=current_user.id,
        version=1,
    )

    db.add(inspection)
    await db.flush()

    request_id = getattr(request.state, "request_id", generate_request_id())
    await create_audit_log(
        db=db,
        inspection_order_id=inspection.id,
        action=AuditAction.CREATE,
        operator=current_user,
        from_status=None,
        to_status=InspectionStatus.DRAFT,
        detail=f"创建巡检单 {order_no}",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        request_id=request_id,
    )

    await db.commit()
    await db.refresh(inspection)

    result = await db.execute(
        select(InspectionOrder)
        .options(joinedload(InspectionOrder.charging_pile))
        .where(InspectionOrder.id == inspection.id)
    )
    inspection = result.scalar_one()

    return build_inspection_response(inspection, current_user)


@router.put("/{order_id}", response_model=InspectionOrderResponse, summary="更新巡检单", description="更新巡检单（登记员在草稿或退回状态）")
async def update_inspection(
    order_id: int,
    inspection_data: InspectionOrderUpdate,
    request: Request,
    current_user: User = Depends(allow_registrar),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(InspectionOrder)
        .options(joinedload(InspectionOrder.charging_pile))
        .where(InspectionOrder.id == order_id)
    )
    inspection = result.scalar_one_or_none()

    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"巡检单ID {order_id} 不存在"
        )

    allowed_statuses = [
        InspectionStatus.DRAFT,
        InspectionStatus.REVIEW_REJECTED,
        InspectionStatus.FINAL_REVIEW_REJECTED,
        InspectionStatus.ACCEPTANCE_REJECTED,
    ]
    if inspection.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"当前状态 [{get_status_label(inspection.status)}] 不允许编辑"
        )

    if inspection.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只能编辑自己创建的巡检单"
        )

    for field, value in inspection_data.model_dump().items():
        setattr(inspection, field, value)

    inspection.version += 1

    request_id = getattr(request.state, "request_id", generate_request_id())
    await create_audit_log(
        db=db,
        inspection_order_id=inspection.id,
        action=AuditAction.UPDATE,
        operator=current_user,
        from_status=inspection.status,
        to_status=inspection.status,
        detail=f"更新巡检单 {inspection.order_no}",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        request_id=request_id,
    )

    await db.commit()
    await db.refresh(inspection)

    return build_inspection_response(inspection, current_user)


@router.post("/{order_id}/status", response_model=InspectionOrderResponse, summary="状态流转", description="巡检单状态流转API，需要校验权限、材料完整性、并发控制")
async def update_status(
    order_id: int,
    status_data: StatusUpdateRequest,
    request: Request,
    current_user: User = Depends(allow_all_authenticated),
    db: AsyncSession = Depends(get_db)
):
    lock_acquired, lock_error = await acquire_lock(order_id, timeout=5.0)
    if not lock_acquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=lock_error
        )

    try:
        result = await db.execute(
            select(InspectionOrder)
            .options(joinedload(InspectionOrder.charging_pile))
            .where(InspectionOrder.id == order_id)
        )
        inspection = result.scalar_one_or_none()

        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"巡检单ID {order_id} 不存在"
            )

        if status_data.current_version is not None:
            check_version(inspection.version, status_data.current_version, inspection.order_no)

        from_status = inspection.status
        target_status = status_data.target_status

        valid_transitions = {
            (UserRole.REGISTRAR, InspectionStatus.DRAFT): [InspectionStatus.PENDING_REVIEW],
            (UserRole.REGISTRAR, InspectionStatus.REVIEW_REJECTED): [InspectionStatus.PENDING_REVIEW],
            (UserRole.REGISTRAR, InspectionStatus.FINAL_REVIEW_REJECTED): [InspectionStatus.PENDING_REVIEW],
            (UserRole.REGISTRAR, InspectionStatus.ACCEPTANCE_REJECTED): [InspectionStatus.PENDING_REVIEW],
            (UserRole.SUPERVISOR, InspectionStatus.PENDING_REVIEW): [
                InspectionStatus.PENDING_FINAL_REVIEW,
                InspectionStatus.PENDING_FAULT_REPORT,
                InspectionStatus.REVIEW_REJECTED,
            ],
            (UserRole.SUPERVISOR, InspectionStatus.REVIEW_REJECTED): [InspectionStatus.PENDING_FINAL_REVIEW],
            (UserRole.SUPERVISOR, InspectionStatus.PENDING_FAULT_REPORT): [InspectionStatus.FAULT_REPORTED],
            (UserRole.SUPERVISOR, InspectionStatus.FAULT_REPORTED): [InspectionStatus.PENDING_REPAIR],
            (UserRole.SUPERVISOR, InspectionStatus.PENDING_REPAIR): [InspectionStatus.REPAIR_COMPLETED],
            (UserRole.SUPERVISOR, InspectionStatus.REPAIR_COMPLETED): [InspectionStatus.PENDING_ACCEPTANCE],
            (UserRole.SUPERVISOR, InspectionStatus.PENDING_ACCEPTANCE): [
                InspectionStatus.PENDING_FINAL_REVIEW,
                InspectionStatus.ACCEPTANCE_REJECTED,
            ],
            (UserRole.SUPERVISOR, InspectionStatus.ACCEPTANCE_REJECTED): [InspectionStatus.PENDING_FINAL_REVIEW],
            (UserRole.REVIEWER, InspectionStatus.PENDING_FINAL_REVIEW): [
                InspectionStatus.ARCHIVED,
                InspectionStatus.FINAL_REVIEW_REJECTED,
            ],
            (UserRole.REVIEWER, InspectionStatus.FINAL_REVIEW_REJECTED): [InspectionStatus.ARCHIVED],
        }

        key = (current_user.role, from_status)
        if key not in valid_transitions or target_status not in valid_transitions[key]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"角色 [{get_role_label(current_user.role)}] 不允许从 [{get_status_label(from_status)}] 流转到 [{get_status_label(target_status)}]"
            )

        if target_status == InspectionStatus.PENDING_FINAL_REVIEW:
            inspection.supervisor_opinion = status_data.opinion
            inspection.supervisor_signature = status_data.signature
            inspection.supervisor_review_date = datetime.now(timezone.utc)
            inspection.current_handler_id = None

        elif target_status == InspectionStatus.REVIEW_REJECTED:
            inspection.supervisor_opinion = status_data.opinion
            inspection.supervisor_signature = status_data.signature
            inspection.supervisor_review_date = datetime.now(timezone.utc)
            inspection.current_handler_id = inspection.created_by

        elif target_status == InspectionStatus.ARCHIVED:
            inspection.reviewer_opinion = status_data.opinion
            inspection.reviewer_signature = status_data.signature
            inspection.reviewer_review_date = datetime.now(timezone.utc)
            inspection.current_handler_id = None

        elif target_status == InspectionStatus.FINAL_REVIEW_REJECTED:
            inspection.reviewer_opinion = status_data.opinion
            inspection.reviewer_signature = status_data.signature
            inspection.reviewer_review_date = datetime.now(timezone.utc)
            inspection.current_handler_id = inspection.created_by

        elif target_status == InspectionStatus.PENDING_REVIEW:
            inspection.registrar_signature = status_data.signature
            inspection.current_handler_id = None

        elif target_status == InspectionStatus.ACCEPTANCE_REJECTED:
            inspection.current_handler_id = inspection.created_by

        materials_ok, materials_error, _ = validate_inspection_materials(inspection, target_status)
        if not materials_ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=materials_error
            )

        inspection.status = target_status
        inspection.version += 1

        action_map = {
            InspectionStatus.PENDING_REVIEW: AuditAction.SUBMIT,
            InspectionStatus.REVIEWING: AuditAction.REVIEW,
            InspectionStatus.PENDING_FINAL_REVIEW: AuditAction.REVIEW,
            InspectionStatus.REVIEW_REJECTED: AuditAction.REJECT,
            InspectionStatus.FINAL_REVIEW_REJECTED: AuditAction.REJECT,
            InspectionStatus.ARCHIVED: AuditAction.ARCHIVE,
            InspectionStatus.PENDING_FAULT_REPORT: AuditAction.REPORT_FAULT,
        }
        action = action_map.get(target_status, AuditAction.UPDATE)

        request_id = status_data.request_id or getattr(request.state, "request_id", generate_request_id())
        await create_audit_log(
            db=db,
            inspection_order_id=inspection.id,
            action=action,
            operator=current_user,
            from_status=from_status,
            to_status=target_status,
            detail=status_data.opinion or f"状态从 [{get_status_label(from_status)}] 变更为 [{get_status_label(target_status)}]",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            request_id=request_id,
        )

        await db.commit()
        await db.refresh(inspection)

        return build_inspection_response(inspection, current_user)

    finally:
        release_lock(order_id)


@router.post("/{order_id}/fault-report", response_model=FaultReportResponse, summary="提交故障报告", description="提交故障报告，进入故障处理流程")
async def submit_fault_report(
    order_id: int,
    fault_data: FaultReportCreate,
    request: Request,
    current_user: User = Depends(allow_supervisor),
    db: AsyncSession = Depends(get_db)
):
    lock_acquired, lock_error = await acquire_lock(order_id, timeout=5.0)
    if not lock_acquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=lock_error
        )

    try:
        result = await db.execute(
            select(InspectionOrder).where(InspectionOrder.id == order_id)
        )
        inspection = result.scalar_one_or_none()

        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"巡检单ID {order_id} 不存在"
            )

        if inspection.status != InspectionStatus.PENDING_FAULT_REPORT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"当前状态 [{get_status_label(inspection.status)}] 不允许提交故障报告"
            )

        result = await db.execute(
            select(FaultReport).where(FaultReport.inspection_order_id == order_id)
        )
        existing_report = result.scalar_one_or_none()
        if existing_report:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该巡检单已有故障报告"
            )

        temp_report = FaultReport(**fault_data.model_dump())
        materials_ok, materials_error = validate_fault_report_materials(temp_report)
        if not materials_ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=materials_error
            )

        from_status = inspection.status

        fault_report = FaultReport(
            **fault_data.model_dump(),
            inspection_order_id=order_id,
            reported_by=current_user.id,
        )
        db.add(fault_report)
        await db.flush()

        inspection.status = InspectionStatus.FAULT_REPORTED
        inspection.version += 1

        request_id = generate_request_id()
        await create_audit_log(
            db=db,
            inspection_order_id=inspection.id,
            action=AuditAction.REPORT_FAULT,
            operator=current_user,
            from_status=from_status,
            to_status=InspectionStatus.FAULT_REPORTED,
            detail=f"提交故障报告，故障代码: {fault_data.fault_code}",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            request_id=request_id,
        )

        await db.commit()
        await db.refresh(fault_report)

        return FaultReportResponse.model_validate(fault_report)

    finally:
        release_lock(order_id)


@router.post("/{order_id}/repair-complete", response_model=InspectionOrderResponse, summary="标记修复完成", description="标记故障修复完成，进入验收阶段")
async def mark_repair_complete(
    order_id: int,
    request: Request,
    current_user: User = Depends(allow_supervisor),
    db: AsyncSession = Depends(get_db)
):
    lock_acquired, lock_error = await acquire_lock(order_id, timeout=5.0)
    if not lock_acquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=lock_error
        )

    try:
        result = await db.execute(
            select(InspectionOrder)
            .options(joinedload(InspectionOrder.charging_pile))
            .where(InspectionOrder.id == order_id)
        )
        inspection = result.scalar_one_or_none()

        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"巡检单ID {order_id} 不存在"
            )

        if inspection.status not in [InspectionStatus.PENDING_REPAIR]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"当前状态 [{get_status_label(inspection.status)}] 不允许标记修复完成"
            )

        from_status = inspection.status
        inspection.status = InspectionStatus.REPAIR_COMPLETED
        inspection.version += 1

        request_id = generate_request_id()
        await create_audit_log(
            db=db,
            inspection_order_id=inspection.id,
            action=AuditAction.REPAIR_COMPLETE,
            operator=current_user,
            from_status=from_status,
            to_status=InspectionStatus.REPAIR_COMPLETED,
            detail="标记修复完成，待提交验收",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            request_id=request_id,
        )

        await db.commit()
        await db.refresh(inspection)

        return build_inspection_response(inspection, current_user)

    finally:
        release_lock(order_id)


@router.post("/{order_id}/acceptance", response_model=RepairAcceptanceResponse, summary="提交修复验收", description="提交修复验收，验收通过进入复核归档，验收不通过进入重新修复")
async def submit_acceptance(
    order_id: int,
    acceptance_data: RepairAcceptanceCreate,
    request: Request,
    current_user: User = Depends(allow_supervisor),
    db: AsyncSession = Depends(get_db)
):
    lock_acquired, lock_error = await acquire_lock(order_id, timeout=5.0)
    if not lock_acquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=lock_error
        )

    try:
        result = await db.execute(
            select(InspectionOrder)
            .options(joinedload(InspectionOrder.charging_pile))
            .where(InspectionOrder.id == order_id)
        )
        inspection = result.scalar_one_or_none()

        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"巡检单ID {order_id} 不存在"
            )

        if inspection.status != InspectionStatus.PENDING_ACCEPTANCE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"当前状态 [{get_status_label(inspection.status)}] 不允许提交验收"
            )

        result = await db.execute(
            select(RepairAcceptance).where(RepairAcceptance.inspection_order_id == order_id)
        )
        existing_acceptance = result.scalar_one_or_none()
        if existing_acceptance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该巡检单已有验收记录"
            )

        temp_acceptance = RepairAcceptance(**acceptance_data.model_dump())
        materials_ok, materials_error = validate_repair_acceptance_materials(temp_acceptance)
        if not materials_ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=materials_error
            )

        from_status = inspection.status

        acceptance = RepairAcceptance(
            **acceptance_data.model_dump(),
            inspection_order_id=order_id,
            accepted_by=current_user.id,
        )
        db.add(acceptance)
        await db.flush()

        if acceptance_data.acceptance_result == "合格" or acceptance_data.acceptance_result == "pass":
            inspection.status = InspectionStatus.PENDING_FINAL_REVIEW
        else:
            inspection.status = InspectionStatus.ACCEPTANCE_REJECTED
            inspection.current_handler_id = inspection.created_by

        inspection.version += 1

        request_id = generate_request_id()
        await create_audit_log(
            db=db,
            inspection_order_id=inspection.id,
            action=AuditAction.ACCEPT,
            operator=current_user,
            from_status=from_status,
            to_status=inspection.status,
            detail=f"修复验收结果: {acceptance_data.acceptance_result}, {acceptance_data.acceptance_opinion or ''}",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            request_id=request_id,
        )

        await db.commit()
        await db.refresh(acceptance)

        return RepairAcceptanceResponse.model_validate(acceptance)

    finally:
        release_lock(order_id)
