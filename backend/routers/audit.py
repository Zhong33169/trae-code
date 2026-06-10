from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from typing import Optional, Dict
from datetime import datetime, timezone, timedelta

from database import get_db
from deps import allow_all_authenticated, allow_supervisor_reviewer
from models.user import User
from models.audit_log import AuditLog, AuditAction
from models.inspection import InspectionOrder
from schemas.audit_log import AuditLogResponse, AuditStatistics

router = APIRouter()


@router.get("/logs", response_model=dict, summary="获取审计日志列表", description="获取审计日志列表，支持按巡检单、操作人、操作类型、时间范围筛选")
async def get_audit_logs(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=200, description="每页数量"),
    inspection_order_id: Optional[int] = Query(None, description="巡检单ID"),
    operator_id: Optional[int] = Query(None, description="操作人ID"),
    action: Optional[AuditAction] = Query(None, description="操作类型"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    current_user: User = Depends(allow_all_authenticated),
    db: AsyncSession = Depends(get_db)
):
    query = select(AuditLog).options(
        joinedload(AuditLog.operator),
        joinedload(AuditLog.inspection_order),
    )

    if inspection_order_id:
        query = query.where(AuditLog.inspection_order_id == inspection_order_id)
    if operator_id:
        query = query.where(AuditLog.operator_id == operator_id)
    if action:
        query = query.where(AuditLog.action == action)
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    query = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    items = []
    for log in logs:
        order_no = log.inspection_order.order_no if log.inspection_order else None
        items.append(
            AuditLogResponse(
                id=log.id,
                inspection_order_id=log.inspection_order_id,
                order_no=order_no,
                action=log.action,
                action_label=log.action.value,
                from_status=log.from_status,
                to_status=log.to_status,
                operator_id=log.operator_id,
                operator_name=log.operator_name,
                operator_role=log.operator_role,
                detail=log.detail,
                ip_address=log.ip_address,
                created_at=log.created_at,
            )
        )

    return {
        "total": total,
        "items": items,
        "page": page,
        "page_size": page_size,
    }


@router.get("/statistics", response_model=AuditStatistics, summary="获取审计统计数据", description="获取审计统计数据，包括按操作类型、角色、状态的统计")
async def get_audit_statistics(
    days: int = Query(30, ge=1, le=365, description="统计天数"),
    current_user: User = Depends(allow_supervisor_reviewer),
    db: AsyncSession = Depends(get_db)
):
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    total_query = select(func.count()).select_from(AuditLog).where(
        AuditLog.created_at >= start_date
    )
    total_result = await db.execute(total_query)
    total_operations = total_result.scalar_one()

    today_query = select(func.count()).select_from(AuditLog).where(
        AuditLog.created_at >= today_start
    )
    today_result = await db.execute(today_query)
    operations_today = today_result.scalar_one()

    week_query = select(func.count()).select_from(AuditLog).where(
        AuditLog.created_at >= week_start
    )
    week_result = await db.execute(week_query)
    operations_this_week = week_result.scalar_one()

    action_query = select(
        AuditLog.action,
        func.count(AuditLog.id).label("count")
    ).where(
        AuditLog.created_at >= start_date
    ).group_by(AuditLog.action)
    action_result = await db.execute(action_query)
    action_rows = action_result.all()
    operations_by_action: Dict[str, int] = {}
    for row in action_rows:
        action, count = row
        operations_by_action[action.value] = count

    role_query = select(
        AuditLog.operator_role,
        func.count(AuditLog.id).label("count")
    ).where(
        AuditLog.created_at >= start_date
    ).group_by(AuditLog.operator_role)
    role_result = await db.execute(role_query)
    role_rows = role_result.all()
    operations_by_role: Dict[str, int] = {}
    for row in role_rows:
        role, count = row
        operations_by_role[role] = count

    status_query = select(
        AuditLog.to_status,
        func.count(AuditLog.id).label("count")
    ).where(
        and_(
            AuditLog.created_at >= start_date,
            AuditLog.to_status.isnot(None)
        )
    ).group_by(AuditLog.to_status)
    status_result = await db.execute(status_query)
    status_rows = status_result.all()
    operations_by_status: Dict[str, int] = {}
    for row in status_rows:
        status, count = row
        operations_by_status[status] = count

    time_query = select(
        func.julianday(AuditLog.created_at) - func.julianday(func.lag(AuditLog.created_at).over(
            order_by=AuditLog.created_at,
            partition_by=AuditLog.inspection_order_id
        ))
    ).where(
        and_(
            AuditLog.created_at >= start_date,
            AuditLog.inspection_order_id.isnot(None)
        )
    )
    time_result = await db.execute(time_query)
    time_diffs = time_result.scalars().all()
    valid_diffs = [diff for diff in time_diffs if diff is not None and diff > 0]
    average_processing_time = None
    if valid_diffs:
        average_processing_time = (sum(valid_diffs) / len(valid_diffs)) * 24 * 60

    return AuditStatistics(
        total_operations=total_operations,
        operations_by_action=operations_by_action,
        operations_by_role=operations_by_role,
        operations_by_status=operations_by_status,
        operations_today=operations_today,
        operations_this_week=operations_this_week,
        average_processing_time=average_processing_time,
    )


@router.get("/inspection/{order_id}", response_model=dict, summary="获取指定巡检单的审计日志", description="获取指定巡检单的所有审计日志")
async def get_inspection_audit_logs(
    order_id: int,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=200, description="每页数量"),
    current_user: User = Depends(allow_all_authenticated),
    db: AsyncSession = Depends(get_db)
):
    inspection_query = select(InspectionOrder).where(InspectionOrder.id == order_id)
    inspection_result = await db.execute(inspection_query)
    inspection = inspection_result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"巡检单ID {order_id} 不存在"
        )

    query = select(AuditLog).options(
        joinedload(AuditLog.operator),
    ).where(
        AuditLog.inspection_order_id == order_id
    )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    query = query.order_by(AuditLog.created_at.asc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    items = []
    for log in logs:
        items.append(
            AuditLogResponse(
                id=log.id,
                inspection_order_id=log.inspection_order_id,
                order_no=inspection.order_no,
                action=log.action,
                action_label=log.action.value,
                from_status=log.from_status,
                to_status=log.to_status,
                operator_id=log.operator_id,
                operator_name=log.operator_name,
                operator_role=log.operator_role,
                detail=log.detail,
                ip_address=log.ip_address,
                created_at=log.created_at,
            )
        )

    return {
        "total": total,
        "items": items,
        "page": page,
        "page_size": page_size,
        "order_no": inspection.order_no,
    }
