from __future__ import annotations

from typing import Optional, List
from datetime import datetime

from sqlalchemy.orm import Session
from litestar import Router, get, post, put, patch
from litestar.params import Parameter
from litestar.di import Provide

from ..models import InspectionStatus, RiskLevel, UserRole
from ..schemas import (
    ApiResponse, InspectionOrderInitiate, InspectionOrderHandle,
    InspectionOrderReview, InspectionOrderReturn, RiskLevelChangeRequest,
    InspectionOrderSubmitRequest, FaultReportCreate, RecoveryConfirmCreate,
    InspectionOrderDetail, InspectionOrderListItem, StatisticsResponse,
    QueueItem, FaultReport, RecoveryConfirm
)
from ..services.inspection_service import (
    get_inspection_order_list, get_inspection_order_detail,
    initiate_inspection, handle_inspection, review_inspection,
    return_inspection, change_risk_level, create_fault_report,
    confirm_recovery, get_statistics, get_queue, validate_submit,
    get_user
)
from ..dependencies import get_db


@get("/inspections")
async def list_inspections(
    db: Session,
    status: Optional[InspectionStatus] = Parameter(default=None, description="状态过滤"),
    risk_level: Optional[RiskLevel] = Parameter(default=None, description="风险等级过滤"),
    location: Optional[str] = Parameter(default=None, description="位置过滤"),
    user_id: Optional[int] = Parameter(default=None, description="当前用户ID"),
    role: Optional[UserRole] = Parameter(default=None, description="当前用户角色"),
) -> ApiResponse[List[InspectionOrderListItem]]:
    orders = get_inspection_order_list(
        db, status=status, risk_level=risk_level, location=location,
        current_user_id=user_id, role=role
    )
    return ApiResponse.ok(data=orders, message="获取列表成功")


@get("/inspections/{order_id:int}")
async def get_inspection(
    db: Session,
    order_id: int,
) -> ApiResponse[Optional[InspectionOrderDetail]]:
    order = get_inspection_order_detail(db, order_id)
    if not order:
        return ApiResponse.error(message="巡检单不存在", data=None)
    return ApiResponse.ok(data=order, message="获取详情成功")


@post("/inspections")
async def create_inspection(
    db: Session,
    data: InspectionOrderInitiate,
    user_id: int = Parameter(default=1, description="发起人ID"),
) -> ApiResponse[Optional[InspectionOrderDetail]]:
    result, error = initiate_inspection(db, data, user_id)
    if error:
        return ApiResponse.error(message=error, data=None)
    return ApiResponse.ok(data=result, message="发起巡检成功")


@post("/inspections/{order_id:int}/handle")
async def handle_inspection_route(
    db: Session,
    order_id: int,
    data: InspectionOrderHandle,
    user_id: int = Parameter(default=2, description="办理人ID"),
) -> ApiResponse[Optional[InspectionOrderDetail]]:
    result, error = handle_inspection(db, order_id, data, user_id)
    if error:
        return ApiResponse.error(message=error, data=None)
    return ApiResponse.ok(data=result, message="办理成功")


@post("/inspections/{order_id:int}/review")
async def review_inspection_route(
    db: Session,
    order_id: int,
    data: InspectionOrderReview,
    user_id: int = Parameter(default=3, description="复核人ID"),
) -> ApiResponse[Optional[InspectionOrderDetail]]:
    result, error = review_inspection(db, order_id, data, user_id)
    if error:
        return ApiResponse.error(message=error, data=None)
    return ApiResponse.ok(data=result, message="复核成功")


@post("/inspections/{order_id:int}/return")
async def return_inspection_route(
    db: Session,
    order_id: int,
    data: InspectionOrderReturn,
    user_id: int = Parameter(default=3, description="复核人ID"),
) -> ApiResponse[Optional[InspectionOrderDetail]]:
    result, error = return_inspection(db, order_id, data, user_id)
    if error:
        return ApiResponse.error(message=error, data=None)
    return ApiResponse.ok(data=result, message="退回成功")


@post("/inspections/{order_id:int}/risk")
async def change_risk_level_route(
    db: Session,
    order_id: int,
    data: RiskLevelChangeRequest,
    user_id: int = Parameter(default=2, description="操作人ID"),
) -> ApiResponse[Optional[InspectionOrderDetail]]:
    result, error = change_risk_level(db, order_id, data, user_id)
    if error:
        return ApiResponse.error(message=error, data=None)
    return ApiResponse.ok(data=result, message="风险等级变更成功")


@post("/inspections/{order_id:int}/validate")
async def validate_submit_route(
    db: Session,
    order_id: int,
    data: InspectionOrderSubmitRequest,
) -> ApiResponse[bool]:
    success, error = validate_submit(db, order_id, data)
    if not success:
        return ApiResponse.error(message=error or "校验失败", data=False)
    return ApiResponse.ok(data=True, message="校验通过")


@get("/inspections/high-risk")
async def get_high_risk_inspections(
    db: Session,
) -> ApiResponse[List[InspectionOrderListItem]]:
    orders = get_inspection_order_list(db, risk_level=RiskLevel.HIGH)
    return ApiResponse.ok(data=orders, message="获取高风险巡检单成功")


@post("/fault-reports")
async def create_fault_report_route(
    db: Session,
    data: FaultReportCreate,
    user_id: int = Parameter(default=1, description="报告人ID"),
) -> ApiResponse[Optional[FaultReport]]:
    result, error = create_fault_report(db, data, user_id)
    if error:
        return ApiResponse.error(message=error, data=None)
    return ApiResponse.ok(data=result, message="故障报修成功")


@post("/recovery-confirms")
async def confirm_recovery_route(
    db: Session,
    data: RecoveryConfirmCreate,
    user_id: int = Parameter(default=2, description="确认人ID"),
) -> ApiResponse[Optional[RecoveryConfirm]]:
    result, error = confirm_recovery(db, data, user_id)
    if error:
        return ApiResponse.error(message=error, data=None)
    return ApiResponse.ok(data=result, message="恢复确认成功")


@get("/statistics")
async def get_statistics_route(
    db: Session,
) -> ApiResponse[StatisticsResponse]:
    stats = get_statistics(db)
    return ApiResponse.ok(data=stats, message="获取统计成功")


@get("/queue")
async def get_queue_route(
    db: Session,
    user_id: int = Parameter(default=1, description="用户ID"),
    role: UserRole = Parameter(default=UserRole.INSPECTOR, description="用户角色"),
) -> ApiResponse[List[QueueItem]]:
    items = get_queue(db, user_id, role)
    return ApiResponse.ok(data=items, message="获取队列成功")


@get("/users")
async def list_users(
    db: Session,
) -> ApiResponse[List[dict]]:
    from ..models import User
    users = db.query(User).all()
    user_list = [
        {
            "id": u.id,
            "username": u.username,
            "name": u.name,
            "real_name": u.name,
            "role": u.role.value,
            "created_at": u.created_at,
        }
        for u in users
    ]
    return ApiResponse.ok(data=user_list, message="获取用户列表成功")


@get("/equipments")
async def list_equipments(
    db: Session,
) -> ApiResponse[List[dict]]:
    from ..models import Equipment
    equipments = db.query(Equipment).all()
    eq_list = [
        {
            "id": eq.id,
            "code": eq.code,
            "name": eq.name,
            "location": eq.location,
            "model": eq.specification,
            "specification": eq.specification,
            "last_inspection_date": eq.last_inspection_date,
        }
        for eq in equipments
    ]
    return ApiResponse.ok(data=eq_list, message="获取设备列表成功")


inspection_router = Router(
    path="/api",
    route_handlers=[
        list_inspections,
        get_inspection,
        create_inspection,
        handle_inspection_route,
        review_inspection_route,
        return_inspection_route,
        change_risk_level_route,
        validate_submit_route,
        get_high_risk_inspections,
        create_fault_report_route,
        confirm_recovery_route,
        get_statistics_route,
        get_queue_route,
        list_users,
        list_equipments,
    ],
    dependencies={"db": Provide(get_db)},
)
