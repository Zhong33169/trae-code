from datetime import datetime
from litestar import Router, get, post, Request
from litestar.di import Provide
from litestar.exceptions import HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EnergyBill, MeterReading, Role, OperationLog, BillStatus, ProcessNode
from ..schemas import MeterReadingCreate, MeterReadingResponse
from ..services import get_allowed_actions


@post("/meter-readings")
async def create_meter_reading(
    data: MeterReadingCreate, request: Request, db: Session = Provide(get_db)
) -> dict:
    user = request.user
    bill = db.query(EnergyBill).filter(EnergyBill.id == data.bill_id).first()
    if not bill:
        raise HTTPException(
            status_code=404,
            detail={"code": 404, "message": f"账单不存在: {data.bill_id}"}
        )

    allowed_actions = get_allowed_actions(user.role, bill)
    if "add_meter_reading" not in allowed_actions:
        raise HTTPException(
            status_code=403,
            detail={
                "code": 403,
                "message": "当前状态不允许添加抄表数据",
                "current_status": bill.status.value,
                "current_node": bill.current_node.value
            }
        )

    meter_reading = MeterReading(
        bill_id=data.bill_id,
        reading_type=data.reading_type,
        previous_reading=data.previous_reading,
        current_reading=data.current_reading,
        usage=data.usage,
        remark=data.remark,
        read_by=user.id
    )
    db.add(meter_reading)
    db.flush()

    bill.has_meter_reading = True
    if data.reading_type == "electricity":
        bill.electricity_usage = data.usage
    elif data.reading_type == "water":
        bill.water_usage = data.usage
    elif data.reading_type == "gas":
        bill.gas_usage = data.usage

    log = OperationLog(
        bill_id=bill.id,
        operator_id=user.id,
        operation="录入抄表",
        from_status=bill.status,
        to_status=bill.status,
        from_node=bill.current_node,
        to_node=bill.current_node,
        remark=f"录入{data.reading_type}抄表数据: 本次读数{data.current_reading}, 用量{data.usage}"
    )
    db.add(log)
    db.commit()
    db.refresh(bill)

    return {
        "success": True,
        "message": "抄表数据录入成功",
        "bill_id": bill.id,
        "bill_no": bill.bill_no,
        "reading_type": data.reading_type,
        "has_meter_reading": bill.has_meter_reading
    }


@get("/meter-readings/{bill_id:int}")
async def get_meter_readings(
    bill_id: int, request: Request, db: Session = Provide(get_db)
) -> list:
    readings = db.query(MeterReading).filter(
        MeterReading.bill_id == bill_id
    ).order_by(MeterReading.read_at.desc()).all()
    return readings


meter_router = Router(
    path="/api",
    route_handlers=[create_meter_reading, get_meter_readings]
)
