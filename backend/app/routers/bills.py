import json as json_module
from datetime import datetime
from typing import Optional, List
from litestar import Router, get, post, put, delete, Request, patch
from litestar.di import Provide
from litestar.exceptions import HTTPException
from litestar.status_codes import HTTP_200_OK
from sqlalchemy import func, or_, case
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EnergyBill, BillStatus, ProcessNode, Role, OperationLog, User, MeterReading, Payment
from ..schemas import (
    EnergyBillCreate, EnergyBillUpdate, EnergyBillResponse,
    BillListResponse, BillStats, BillAction, OperationLogResponse,
    OverdueInfo, MeterReadingResponse, PaymentResponse
)
from ..services import (
    calculate_overdue_info, get_visible_fields, get_editable_fields, get_allowed_actions,
    transition_bill_status, update_bill_overdue_status, generate_bill_no
)


def _enrich_bill_response(db, bill: EnergyBill, user: User) -> EnergyBillResponse:
    update_bill_overdue_status(db, bill)
    overdue_info = calculate_overdue_info(db, bill)
    allowed_actions = get_allowed_actions(user.role, bill)
    visible_fields = get_visible_fields(user.role, bill)
    editable_fields = get_editable_fields(user.role, bill)

    creator = db.query(User).filter(User.id == bill.created_by).first()

    meter_readings = []
    if "meter_readings" in visible_fields:
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
    if "payments" in visible_fields:
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
    if "operation_logs" in visible_fields:
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
                field_changes=log.field_changes,
                remark=log.remark,
                created_at=log.created_at
            ))

    return EnergyBillResponse(
        id=bill.id,
        bill_no=bill.bill_no,
        period=bill.period if "period" in visible_fields else None,
        park_name=bill.park_name if "park_name" in visible_fields else None,
        building=bill.building if "building" in visible_fields else None,
        room=bill.room if "room" in visible_fields else None,
        electricity_usage=bill.electricity_usage if "electricity_usage" in visible_fields else None,
        water_usage=bill.water_usage if "water_usage" in visible_fields else None,
        gas_usage=bill.gas_usage if "gas_usage" in visible_fields else None,
        electricity_amount=bill.electricity_amount if "electricity_amount" in visible_fields else None,
        water_amount=bill.water_amount if "water_amount" in visible_fields else None,
        gas_amount=bill.gas_amount if "gas_amount" in visible_fields else None,
        total_amount=bill.total_amount if "total_amount" in visible_fields else None,
        status=bill.status,
        current_node=bill.current_node,
        current_responsible_role=bill.current_responsible_role,
        has_meter_reading=bill.has_meter_reading if "has_meter_reading" in visible_fields else None,
        has_bill_generated=bill.has_bill_generated if "has_bill_generated" in visible_fields else None,
        has_payment_verified=bill.has_payment_verified if "has_payment_verified" in visible_fields else None,
        is_overdue=bill.is_overdue if "is_overdue" in visible_fields else None,
        overdue_hours=bill.overdue_hours if "overdue_hours" in visible_fields else None,
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
        visible_fields=visible_fields,
        editable_fields=editable_fields
    )


def _calculate_stats(db) -> BillStats:
    status_counts = db.query(
        func.count(EnergyBill.id).label("total_count"),
        func.sum(case((EnergyBill.status == BillStatus.DRAFT, 1), else_=0)).label("draft_count"),
        func.sum(case((EnergyBill.status == BillStatus.PENDING_AUDIT, 1), else_=0)).label("pending_audit_count"),
        func.sum(case((EnergyBill.status == BillStatus.REJECTED, 1), else_=0)).label("rejected_count"),
        func.sum(case((EnergyBill.status == BillStatus.AUDITED, 1), else_=0)).label("audited_count"),
        func.sum(case((EnergyBill.status == BillStatus.PENDING_REVIEW, 1), else_=0)).label("pending_review_count"),
        func.sum(case((EnergyBill.status == BillStatus.REVIEW_REJECTED, 1), else_=0)).label("review_rejected_count"),
        func.sum(case((EnergyBill.status == BillStatus.ARCHIVED, 1), else_=0)).label("archived_count"),
        func.sum(case((EnergyBill.is_overdue == True, 1), else_=0)).label("overdue_count"),
        func.coalesce(func.sum(EnergyBill.total_amount), 0).label("total_amount")
    ).first()

    return BillStats(
        total_count=status_counts.total_count or 0,
        draft_count=status_counts.draft_count or 0,
        pending_audit_count=status_counts.pending_audit_count or 0,
        rejected_count=status_counts.rejected_count or 0,
        audited_count=status_counts.audited_count or 0,
        pending_review_count=status_counts.pending_review_count or 0,
        review_rejected_count=status_counts.review_rejected_count or 0,
        archived_count=status_counts.archived_count or 0,
        overdue_count=status_counts.overdue_count or 0,
        total_amount=status_counts.total_amount or 0
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

    editable_fields = get_editable_fields(user.role, bill)
    if not editable_fields:
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

    field_changes = {}
    field_map = {
        "period": ("period", data.period),
        "park_name": ("park_name", data.park_name),
        "building": ("building", data.building),
        "room": ("room", data.room),
        "electricity_usage": ("electricity_usage", data.electricity_usage),
        "water_usage": ("water_usage", data.water_usage),
        "gas_usage": ("gas_usage", data.gas_usage),
        "electricity_amount": ("electricity_amount", data.electricity_amount),
        "water_amount": ("water_amount", data.water_amount),
        "gas_amount": ("gas_amount", data.gas_amount),
    }

    for field_name, (attr_name, new_value) in field_map.items():
        if new_value is None:
            continue
        if field_name not in editable_fields:
            continue
        old_value = getattr(bill, attr_name)
        if old_value != new_value:
            field_changes[field_name] = {"old": old_value, "new": new_value}
            setattr(bill, attr_name, new_value)

    if field_changes:
        amount_fields = {"electricity_amount", "water_amount", "gas_amount"}
        if amount_fields & set(field_changes.keys()):
            bill.total_amount = (bill.electricity_amount or 0) + (bill.water_amount or 0) + (bill.gas_amount or 0)
            if "total_amount" not in field_changes:
                field_changes["total_amount"] = {"old": None, "new": bill.total_amount, "auto": True}

    bill.updated_at = datetime.utcnow()

    operation_desc = "补正账单" if bill.status in [BillStatus.REJECTED, BillStatus.REVIEW_REJECTED] else "编辑账单"
    log = OperationLog(
        bill_id=bill.id,
        operator_id=user.id,
        operation=operation_desc,
        from_status=bill.status,
        to_status=bill.status,
        from_node=bill.current_node,
        to_node=bill.current_node,
        field_changes=json_module.dumps(field_changes, ensure_ascii=False) if field_changes else None,
        remark=data.remark if hasattr(data, 'remark') and data.remark else None
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

    if data.action in ("audit_reject", "review_reject") and not data.anomaly_reason:
        raise HTTPException(
            status_code=400,
            detail={"code": 400, "message": "驳回操作必须填写异常原因", "required_field": "anomaly_reason"}
        )

    bill, result = transition_bill_status(
        db, bill, data.action, user,
        anomaly_reason=data.anomaly_reason,
        remark=data.remark
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result)

    db.refresh(bill)
    enriched = _enrich_bill_response(db, bill, user)

    return {
        **result,
        "bill_id": bill.id,
        "bill_no": bill.bill_no,
        "current_status": bill.status.value,
        "current_node": bill.current_node.value,
        "bill": enriched.model_dump(mode="json") if hasattr(enriched, "model_dump") else enriched
    }


@post("/bills/batch-action")
async def batch_action(data: dict, request: Request, db: Session = Provide(get_db)) -> dict:
    user = request.user
    bill_ids = data.get("bill_ids", [])
    action = data.get("action")
    anomaly_reason = data.get("anomaly_reason")
    remark = data.get("remark")

    if not bill_ids or not action:
        raise HTTPException(
            status_code=400,
            detail={"code": 400, "message": "缺少必要参数: bill_ids, action"}
        )

    if action in ("audit_reject", "review_reject") and not anomaly_reason:
        raise HTTPException(
            status_code=400,
            detail={"code": 400, "message": "驳回操作必须填写异常原因", "required_field": "anomaly_reason"}
        )

    results = []
    success_count = 0
    fail_count = 0

    for bill_id in bill_ids:
        bill = db.query(EnergyBill).filter(EnergyBill.id == bill_id).first()
        if not bill:
            results.append({
                "bill_id": bill_id,
                "success": False,
                "message": "账单不存在",
                "error_code": "NOT_FOUND"
            })
            fail_count += 1
            continue

        bill, result = transition_bill_status(
            db, bill, action, user,
            anomaly_reason=anomaly_reason,
            remark=remark
        )
        if result["success"]:
            db.refresh(bill)
            enriched = _enrich_bill_response(db, bill, user)
            results.append({
                "bill_id": bill_id,
                "bill_no": bill.bill_no,
                "current_status": bill.status.value,
                "current_node": bill.current_node.value,
                **result,
                "bill": enriched.model_dump(mode="json") if hasattr(enriched, "model_dump") else enriched
            })
            success_count += 1
        else:
            results.append({
                "bill_id": bill_id,
                "bill_no": bill.bill_no,
                "current_status": bill.status.value,
                **result,
                "error_code": "TRANSITION_FAILED"
            })
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
