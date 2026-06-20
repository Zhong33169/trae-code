from datetime import datetime
from typing import Optional, List
from litestar import Router, get, post, put, delete, Request, patch
from litestar.di import Provide
from litestar.exceptions import HTTPException
from litestar.status_codes import HTTP_200_OK
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EnergyBill, BillStatus, ProcessNode, Role, OperationLog, User, MeterReading, Payment
from ..schemas import (
    EnergyBillCreate, EnergyBillUpdate, EnergyBillResponse,
    BillListResponse, BillStats, BillAction, OperationLogResponse,
    OverdueInfo, MeterReadingResponse, PaymentResponse
)
from ..services import (
    calculate_overdue_info, get_visible_fields, get_allowed_actions,
    transition_bill_status, update_bill_overdue_status, generate_bill_no
)


def _enrich_bill_response(db, bill: EnergyBill, user: User) -> EnergyBillResponse:
    update_bill_overdue_status(db, bill)
    overdue_info = calculate_overdue_info(db, bill)
    allowed_actions = get_allowed_actions(user.role, bill)
    visible_fields = get_visible_fields(user.role, bill)

    creator = db.query(User).filter(User.id == bill.created_by).first()

    meter_readings = []
    for mr in bill.meter_readings:
        reader = db.query(User).filter(User.id == mr.read_by).first()
        meter_readings.append(MeterReadingResponse(
            id=mr.id,
            bill_id=mr.bill_id,
            reading_type=mr.reading_type,
            previous_reading=mr.previous_reading,
            current_reading=mr.current_reading,
            usage=mr.usage,
            remark=mr.remark,
            read_by=mr.read_by,
            read_at=mr.read_at,
            reader_name=reader.real_name if reader else None
        ))

    payments = []
    for p in bill.payments:
        verifier = db.query(User).filter(User.id == p.verified_by).first() if p.verified_by else None
        payments.append(PaymentResponse(
            id=p.id,
            bill_id=p.bill_id,
            amount=p.amount,
            payment_method=p.payment_method,
            transaction_no=p.transaction_no,
            paid_by=p.paid_by,
            paid_at=p.paid_at,
            remark=p.remark,
            verified_by=p.verified_by,
            verified_at=p.verified_at,
            is_verified=p.is_verified,
            verifier_name=verifier.real_name if verifier else None
        ))

    operation_logs = []
    for log in bill.operation_logs:
        operator = db.query(User).filter(User.id == log.operator_id).first()
        operation_logs.append(OperationLogResponse(
            id=log.id,
            bill_id=log.bill_id,
            operator_id=log.operator_id,
            operator_name=operator.real_name if operator else None,
            operation=log.operation,
            from_status=log.from_status,
            to_status=log.to_status,
            from_node=log.from_node,
            to_node=log.to_node,
            anomaly_reason=log.anomaly_reason,
            remark=log.remark,
            created_at=log.created_at
        ))

    return EnergyBillResponse(
        id=bill.id,
        bill_no=bill.bill_no,
        period=bill.period,
        park_name=bill.park_name,
        building=bill.building,
        room=bill.room,
        electricity_usage=bill.electricity_usage,
        water_usage=bill.water_usage,
        gas_usage=bill.gas_usage,
        electricity_amount=bill.electricity_amount,
        water_amount=bill.water_amount,
        gas_amount=bill.gas_amount,
        total_amount=bill.total_amount,
        status=bill.status,
        current_node=bill.current_node,
        current_responsible_role=bill.current_responsible_role,
        has_meter_reading=bill.has_meter_reading,
        has_bill_generated=bill.has_bill_generated,
        has_payment_verified=bill.has_payment_verified,
        is_overdue=bill.is_overdue,
        overdue_hours=bill.overdue_hours,
        current_node_started_at=bill.current_node_started_at,
        created_by=bill.created_by,
        creator_name=creator.real_name if creator else None,
        created_at=bill.created_at,
        updated_at=bill.updated_at,
        meter_readings=meter_readings,
        payments=payments,
        operation_logs=operation_logs,
        overdue_info=overdue_info,
        allowed_actions=allowed_actions,
        visible_fields=visible_fields
    )


def _calculate_stats(db) -> BillStats:
    stats = db.query(
        func.count(EnergyBill.id).label("total_count"),
        func.sum(func.case((EnergyBill.status == BillStatus.DRAFT, 1), else_=0)).label("draft_count"),
        func.sum(func.case((EnergyBill.status == BillStatus.PENDING_AUDIT, 1), else_=0)).label("pending_audit_count"),
        func.sum(func.case((or_(EnergyBill.status == BillStatus.REJECTED, EnergyBill.status == BillStatus.REVIEW_REJECTED), 1), else_=0)).label("rejected_count"),
        func.sum(func.case((EnergyBill.status == BillStatus.AUDITED, 1), else_=0)).label("audited_count"),
        func.sum(func.case((EnergyBill.status == BillStatus.PENDING_REVIEW, 1), else_=0)).label("pending_review_count"),
        func.sum(func.case((EnergyBill.status == BillStatus.REVIEW_REJECTED, 1), else_=0)).label("review_rejected_count"),
        func.sum(func.case((EnergyBill.status == BillStatus.ARCHIVED, 1), else_=0)).label("archived_count"),
        func.sum(func.case((EnergyBill.is_overdue == True, 1), else_=0)).label("overdue_count"),
        func.sum(EnergyBill.total_amount).label("total_amount")
    ).first()

    return BillStats(
        total_count=stats.total_count or 0,
        draft_count=stats.draft_count or 0,
        pending_audit_count=stats.pending_audit_count or 0,
        rejected_count=stats.rejected_count or 0,
        audited_count=stats.audited_count or 0,
        pending_review_count=stats.pending_review_count or 0,
        review_rejected_count=stats.review_rejected_count or 0,
        archived_count=stats.archived_count or 0,
        overdue_count=stats.overdue_count or 0,
        total_amount=stats.total_amount or 0
    )


@get("/bills")
async def list_bills(
    request: Request,
    db: Session = Provide(get_db),
    status: Optional[str] = None,
    period: Optional[str] = None,
    park_name: Optional[str] = None,
    is_overdue: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100
) -> BillListResponse:
    user = request.user
    query = db.query(EnergyBill)

    if status:
        try:
            query = query.filter(EnergyBill.status == BillStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效的状态值: {status}")

    if period:
        query = query.filter(EnergyBill.period == period)
    if park_name:
        query = query.filter(EnergyBill.park_name.like(f"%{park_name}%"))
    if is_overdue is not None:
        query = query.filter(EnergyBill.is_overdue == is_overdue)

    total = query.count()
    bills = query.order_by(EnergyBill.updated_at.desc()).offset(skip).limit(limit).all()

    items = [_enrich_bill_response(db, bill, user) for bill in bills]
    stats = _calculate_stats(db)

    return BillListResponse(items=items, total=total, stats=stats)


@get("/bills/stats")
async def get_bill_stats(request: Request, db: Session = Provide(get_db)) -> BillStats:
    return _calculate_stats(db)


@get("/bills/{bill_id:int}")
async def get_bill(bill_id: int, request: Request, db: Session = Provide(get_db)) -> EnergyBillResponse:
    user = request.user
    bill = db.query(EnergyBill).filter(EnergyBill.id == bill_id).first()
    if not bill:
        raise HTTPException(
            status_code=404,
            detail={"code": 404, "message": f"账单不存在: {bill_id}"}
        )
    return _enrich_bill_response(db, bill, user)


@post("/bills")
async def create_bill(data: EnergyBillCreate, request: Request, db: Session = Provide(get_db)) -> EnergyBillResponse:
    user = request.user
    if user.role != Role.REGISTRAR:
        raise HTTPException(
            status_code=403,
            detail={"code": 403, "message": "只有登记员可以创建账单", "required_role": "registrar"}
        )

    bill_no = generate_bill_no(db, data.period)

    bill = EnergyBill(
        bill_no=bill_no,
        period=data.period,
        park_name=data.park_name,
        building=data.building,
        room=data.room,
        electricity_usage=data.electricity_usage,
        water_usage=data.water_usage,
        gas_usage=data.gas_usage,
        electricity_amount=data.electricity_amount,
        water_amount=data.water_amount,
        gas_amount=data.gas_amount,
        total_amount=(data.electricity_amount or 0) + (data.water_amount or 0) + (data.gas_amount or 0),
        created_by=user.id
    )

    db.add(bill)
    db.flush()

    log = OperationLog(
        bill_id=bill.id,
        operator_id=user.id,
        operation="创建账单",
        to_status=BillStatus.DRAFT,
        to_node=ProcessNode.REGISTRATION,
        remark="新建能耗账单草稿"
    )
    db.add(log)
    db.commit()
    db.refresh(bill)

    return _enrich_bill_response(db, bill, user)


@put("/bills/{bill_id:int}")
async def update_bill(bill_id: int, data: EnergyBillUpdate, request: Request, db: Session = Provide(get_db)) -> EnergyBillResponse:
    user = request.user
    bill = db.query(EnergyBill).filter(EnergyBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail=f"账单不存在: {bill_id}")

    allowed_actions = get_allowed_actions(user.role, bill)
    if "edit" not in allowed_actions:
        raise HTTPException(
            status_code=403,
            detail={
                "code": 403,
                "message": "当前状态不允许编辑",
                "current_status": bill.status.value,
                "current_node": bill.current_node.value,
                "required_role": bill.current_responsible_role.value
            }
        )

    bill.period = data.period
    bill.park_name = data.park_name
    bill.building = data.building
    bill.room = data.room
    bill.electricity_usage = data.electricity_usage
    bill.water_usage = data.water_usage
    bill.gas_usage = data.gas_usage
    bill.electricity_amount = data.electricity_amount
    bill.water_amount = data.water_amount
    bill.gas_amount = data.gas_amount
    bill.total_amount = (data.electricity_amount or 0) + (data.water_amount or 0) + (data.gas_amount or 0)
    bill.updated_at = datetime.utcnow()

    log = OperationLog(
        bill_id=bill.id,
        operator_id=user.id,
        operation="编辑账单",
        from_status=bill.status,
        to_status=bill.status,
        from_node=bill.current_node,
        to_node=bill.current_node,
        remark="修改账单内容"
    )
    db.add(log)
    db.commit()
    db.refresh(bill)

    return _enrich_bill_response(db, bill, user)


@delete("/bills/{bill_id:int}", status_code=HTTP_200_OK)
async def delete_bill(bill_id: int, request: Request, db: Session = Provide(get_db)) -> dict:
    user = request.user
    bill = db.query(EnergyBill).filter(EnergyBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail=f"账单不存在: {bill_id}")

    allowed_actions = get_allowed_actions(user.role, bill)
    if "delete" not in allowed_actions:
        raise HTTPException(
            status_code=403,
            detail={
                "code": 403,
                "message": "当前状态不允许删除",
                "current_status": bill.status.value
            }
        )

    bill_no = bill.bill_no
    db.delete(bill)
    db.commit()

    return {
        "success": True,
        "message": f"账单 {bill_no} 删除成功"
    }


@post("/bills/{bill_id:int}/action")
async def perform_bill_action(bill_id: int, data: BillAction, request: Request, db: Session = Provide(get_db)) -> dict:
    user = request.user
    bill = db.query(EnergyBill).filter(EnergyBill.id == bill_id).first()
    if not bill:
        raise HTTPException(
            status_code=404,
            detail={"code": 404, "message": f"账单不存在: {bill_id}"}
        )

    bill, result = transition_bill_status(
        db, bill, data.action, user,
        anomaly_reason=data.anomaly_reason,
        remark=data.remark
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result)

    return {
        **result,
        "bill_id": bill.id,
        "bill_no": bill.bill_no,
        "current_status": bill.status.value,
        "current_node": bill.current_node.value
    }


@post("/bills/batch-action")
async def batch_action(data: dict, request: Request, db: Session = Provide(get_db)) -> dict:
    user = request.user
    bill_ids = data.get("bill_ids", [])
    action = data.get("action")
    anomaly_reason = data.get("anomaly_reason")
    remark = data.get("remark")

    if not bill_ids or not action:
        raise HTTPException(status_code=400, detail="缺少必要参数: bill_ids, action")

    results = []
    success_count = 0
    fail_count = 0

    for bill_id in bill_ids:
        bill = db.query(EnergyBill).filter(EnergyBill.id == bill_id).first()
        if not bill:
            results.append({"bill_id": bill_id, "success": False, "message": "账单不存在"})
            fail_count += 1
            continue

        bill, result = transition_bill_status(
            db, bill, action, user,
            anomaly_reason=anomaly_reason,
            remark=remark
        )
        results.append({
            "bill_id": bill_id,
            "bill_no": bill.bill_no,
            **result
        })
        if result["success"]:
            success_count += 1
        else:
            fail_count += 1

    return {
        "success": True,
        "message": f"批量操作完成: 成功 {success_count} 条, 失败 {fail_count} 条",
        "success_count": success_count,
        "fail_count": fail_count,
        "total_count": len(bill_ids),
        "results": results
    }


bills_router = Router(
    path="/api",
    route_handlers=[
        list_bills, get_bill_stats, get_bill,
        create_bill, update_bill, delete_bill,
        perform_bill_action, batch_action
    ]
)
