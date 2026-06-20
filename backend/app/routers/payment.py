from datetime import datetime
from litestar import Router, post, Request
from litestar.di import Provide
from litestar.exceptions import HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EnergyBill, Payment, Role, OperationLog, BillStatus, ProcessNode
from ..schemas import PaymentCreate, PaymentVerify
from ..services import get_allowed_actions


@post("/payments")
async def create_payment(
    data: PaymentCreate, request: Request, db: Session = Provide(get_db)
) -> dict:
    user = request.user
    bill = db.query(EnergyBill).filter(EnergyBill.id == data.bill_id).first()
    if not bill:
        raise HTTPException(
            status_code=404,
            detail={"code": 404, "message": f"账单不存在: {data.bill_id}"}
        )

    allowed_actions = get_allowed_actions(user.role, bill)
    if "add_payment" not in allowed_actions and user.role != Role.PROPERTY:
        raise HTTPException(
            status_code=403,
            detail={
                "code": 403,
                "message": "无权限添加缴费记录",
                "current_role": user.role.value
            }
        )

    payment = Payment(
        bill_id=data.bill_id,
        amount=data.amount,
        payment_method=data.payment_method,
        transaction_no=data.transaction_no,
        paid_by=data.paid_by,
        paid_at=data.paid_at,
        remark=data.remark
    )
    db.add(payment)
    db.flush()

    log = OperationLog(
        bill_id=bill.id,
        operator_id=user.id,
        operation="登记缴费",
        from_status=bill.status,
        to_status=bill.status,
        from_node=bill.current_node,
        to_node=bill.current_node,
        remark=f"登记缴费金额: {data.amount}元"
    )
    db.add(log)
    db.commit()
    db.refresh(bill)

    return {
        "success": True,
        "message": "缴费记录登记成功",
        "bill_id": bill.id,
        "bill_no": bill.bill_no,
        "payment_id": payment.id,
        "amount": data.amount
    }


@post("/payments/{payment_id:int}/verify")
async def verify_payment(
    payment_id: int, data: PaymentVerify, request: Request, db: Session = Provide(get_db)
) -> dict:
    user = request.user
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=404,
            detail={"code": 404, "message": f"缴费记录不存在: {payment_id}"}
        )

    if user.role != Role.PROPERTY:
        raise HTTPException(
            status_code=403,
            detail={"code": 403, "message": "只有物业可以核销缴费", "required_role": "property"}
        )

    bill = db.query(EnergyBill).filter(EnergyBill.id == payment.bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail=f"关联账单不存在")

    payment.is_verified = data.is_verified
    payment.verified_by = user.id
    payment.verified_at = datetime.utcnow()

    if data.is_verified:
        all_verified = db.query(Payment).filter(
            Payment.bill_id == bill.id,
            Payment.is_verified == True
        ).count() > 0
        bill.has_payment_verified = all_verified

    log = OperationLog(
        bill_id=bill.id,
        operator_id=user.id,
        operation="缴费核销" + ("通过" if data.is_verified else "驳回"),
        from_status=bill.status,
        to_status=bill.status,
        from_node=bill.current_node,
        to_node=bill.current_node,
        remark=data.remark or f"核销缴费金额: {payment.amount}元"
    )
    db.add(log)
    db.commit()
    db.refresh(bill)
    db.refresh(payment)

    return {
        "success": True,
        "message": f"缴费核销成功",
        "bill_id": bill.id,
        "bill_no": bill.bill_no,
        "payment_id": payment.id,
        "is_verified": payment.is_verified,
        "has_payment_verified": bill.has_payment_verified
    }


@post("/bills/{bill_id:int}/generate-bill")
async def generate_bill(
    bill_id: int, request: Request, db: Session = Provide(get_db)
) -> dict:
    user = request.user
    bill = db.query(EnergyBill).filter(EnergyBill.id == bill_id).first()
    if not bill:
        raise HTTPException(
            status_code=404,
            detail={"code": 404, "message": f"账单不存在: {bill_id}"}
        )

    allowed_actions = get_allowed_actions(user.role, bill)
    if "generate_bill" not in allowed_actions:
        raise HTTPException(
            status_code=403,
            detail={
                "code": 403,
                "message": "当前状态不允许生成账单",
                "current_status": bill.status.value,
                "has_meter_reading": bill.has_meter_reading,
                "has_bill_generated": bill.has_bill_generated
            }
        )

    if not bill.has_meter_reading:
        raise HTTPException(
            status_code=400,
            detail={
                "code": 400,
                "message": "请先录入抄表数据后再生成账单"
            }
        )

    price_config = {
        "electricity": 0.8,
        "water": 5.0,
        "gas": 3.0
    }

    electricity_amount = (bill.electricity_usage or 0) * price_config["electricity"]
    water_amount = (bill.water_usage or 0) * price_config["water"]
    gas_amount = (bill.gas_usage or 0) * price_config["gas"]

    bill.electricity_amount = round(electricity_amount, 2)
    bill.water_amount = round(water_amount, 2)
    bill.gas_amount = round(gas_amount, 2)
    bill.total_amount = round(electricity_amount + water_amount + gas_amount, 2)
    bill.has_bill_generated = True

    log = OperationLog(
        bill_id=bill.id,
        operator_id=user.id,
        operation="生成账单",
        from_status=bill.status,
        to_status=bill.status,
        from_node=bill.current_node,
        to_node=bill.current_node,
        remark=f"自动计算费用: 电{bill.electricity_amount}元, 水{bill.water_amount}元, 气{bill.gas_amount}元, 合计{bill.total_amount}元"
    )
    db.add(log)
    db.commit()
    db.refresh(bill)

    return {
        "success": True,
        "message": "账单生成成功",
        "bill_id": bill.id,
        "bill_no": bill.bill_no,
        "electricity_amount": bill.electricity_amount,
        "water_amount": bill.water_amount,
        "gas_amount": bill.gas_amount,
        "total_amount": bill.total_amount,
        "has_bill_generated": bill.has_bill_generated
    }


payment_router = Router(
    path="/api",
    route_handlers=[create_payment, verify_payment, generate_bill]
)
