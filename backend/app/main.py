from litestar import Litestar
from litestar.config.cors import CORSConfig
from litestar.openapi import OpenAPIConfig
from app.routers.api import AuthController, OrderController, BatchController, AuditController
from app.services.seed_service import reset_and_seed
from app.models.database import TransportOrder, OrderEvidence, EvidenceType, OrderStatus
from app.models.db_config import SessionLocal
from sqlalchemy.orm import Session
from datetime import datetime


cors_config = CORSConfig(
    allow_origins=["http://localhost:3003"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    allow_credentials=True,
)


def seed_sample_orders():
    db: Session = SessionLocal()
    try:
        from app.services.seed_service import SAMPLE_ORDERS, DEMO_USERS
        from app.models.database import User
        from app.services.order_service import OrderService

        order_count = db.query(TransportOrder).count()
        if order_count > 0:
            return

        users = {u["username"]: db.query(User).filter(User.username == u["username"]).first() for u in DEMO_USERS}
        initiator = users.get("fqr")
        handler = users.get("bl")
        reviewer = users.get("fhr")

        for i, od in enumerate(SAMPLE_ORDERS):
            order = OrderService.create_order(db, od, initiator)

            if i == 0:
                OrderService.add_evidence(db, order.id, {
                    "evidence_type": EvidenceType.ENTRUSTMENT,
                    "file_name": "运输委托单_华盛物流.pdf",
                    "file_ref": "/evidences/entrustment_001.pdf",
                    "remark": "客户签章齐全",
                }, initiator)
                OrderService.transition_order(db, order.id, OrderStatus.ENTRUSTED, initiator, order.version)

            if i == 1:
                OrderService.add_evidence(db, order.id, {
                    "evidence_type": EvidenceType.ENTRUSTMENT,
                    "file_name": "运输委托单_顺丰快运.pdf",
                    "file_ref": "/evidences/entrustment_002.pdf",
                    "remark": "顺丰标准合同",
                }, initiator)
                OrderService.transition_order(db, order.id, OrderStatus.ENTRUSTED, initiator, order.version)
                order_plate = db.query(TransportOrder).filter(TransportOrder.id == order.id).first()
                OrderService.update_order_info(db, order.id, {"plate_number": "沪A·88888", "driver": "张师傅", "receiver": None}, handler)
                OrderService.add_evidence(db, order.id, {
                    "evidence_type": EvidenceType.DISPATCH,
                    "file_name": "车辆调度单_沪A88888.pdf",
                    "file_ref": "/evidences/dispatch_002.pdf",
                    "remark": "已安排5吨货车",
                }, handler)
                OrderService.transition_order(db, order.id, OrderStatus.DISPATCHED, handler, order_plate.version)

            if i == 2:
                OrderService.add_evidence(db, order.id, {
                    "evidence_type": EvidenceType.ENTRUSTMENT,
                    "file_name": "运输委托单_德邦物流.pdf",
                    "file_ref": "/evidences/entrustment_003.pdf",
                    "remark": "重型设备运输",
                }, initiator)
                OrderService.transition_order(db, order.id, OrderStatus.ENTRUSTED, initiator, order.version)
                order_v2 = db.query(TransportOrder).filter(TransportOrder.id == order.id).first()
                OrderService.update_order_info(db, order.id, {"plate_number": "京B·66666", "driver": "李师傅", "receiver": None}, handler)
                OrderService.add_evidence(db, order.id, {
                    "evidence_type": EvidenceType.DISPATCH,
                    "file_name": "车辆调度单_京B66666.pdf",
                    "file_ref": "/evidences/dispatch_003.pdf",
                    "remark": "已安排20吨重型货车",
                }, handler)
                OrderService.transition_order(db, order.id, OrderStatus.DISPATCHED, handler, order_v2.version)
                order_v3 = db.query(TransportOrder).filter(TransportOrder.id == order.id).first()
                OrderService.transition_order(db, order.id, OrderStatus.IN_TRANSIT, handler, order_v3.version)

            if i == 3:
                OrderService.add_evidence(db, order.id, {
                    "evidence_type": EvidenceType.ENTRUSTMENT,
                    "file_name": "运输委托单_中通物流.pdf",
                    "file_ref": "/evidences/entrustment_004.pdf",
                    "remark": "食品冷链运输",
                }, initiator)
                OrderService.transition_order(db, order.id, OrderStatus.ENTRUSTED, initiator, order.version)
                order_v2 = db.query(TransportOrder).filter(TransportOrder.id == order.id).first()
                OrderService.update_order_info(db, order.id, {"plate_number": "川A·12345", "driver": "王师傅", "receiver": None}, handler)
                OrderService.add_evidence(db, order.id, {
                    "evidence_type": EvidenceType.DISPATCH,
                    "file_name": "车辆调度单_川A12345.pdf",
                    "file_ref": "/evidences/dispatch_004.pdf",
                    "remark": "已安排冷链车",
                }, handler)
                OrderService.transition_order(db, order.id, OrderStatus.DISPATCHED, handler, order_v2.version)
                order_v3 = db.query(TransportOrder).filter(TransportOrder.id == order.id).first()
                OrderService.transition_order(db, order.id, OrderStatus.IN_TRANSIT, handler, order_v3.version)
                order_v4 = db.query(TransportOrder).filter(TransportOrder.id == order.id).first()
                OrderService.update_order_info(db, order.id, {"receiver": "陈经理"}, handler)
                OrderService.add_evidence(db, order.id, {
                    "evidence_type": EvidenceType.RECEIPT,
                    "file_name": "签收回单_中通物流.jpg",
                    "file_ref": "/evidences/receipt_004.jpg",
                    "remark": "客户陈经理签字确认，包装完好",
                }, handler)
                OrderService.transition_order(db, order.id, OrderStatus.DELIVERED, handler, order_v4.version)

            if i == 4:
                OrderService.add_evidence(db, order.id, {
                    "evidence_type": EvidenceType.ENTRUSTMENT,
                    "file_name": "运输委托单_圆通速递.pdf",
                    "file_ref": "/evidences/entrustment_005.pdf",
                }, initiator)
                OrderService.transition_order(db, order.id, OrderStatus.ENTRUSTED, initiator, order.version)
                order_v2 = db.query(TransportOrder).filter(TransportOrder.id == order.id).first()
                OrderService.update_order_info(db, order.id, {"plate_number": "苏E·55555", "driver": "赵师傅", "receiver": None}, handler)
                OrderService.add_evidence(db, order.id, {
                    "evidence_type": EvidenceType.DISPATCH,
                    "file_name": "车辆调度单_苏E55555.pdf",
                    "file_ref": "/evidences/dispatch_005.pdf",
                }, handler)
                OrderService.transition_order(db, order.id, OrderStatus.DISPATCHED, handler, order_v2.version)
                order_v3 = db.query(TransportOrder).filter(TransportOrder.id == order.id).first()
                OrderService.transition_order(db, order.id, OrderStatus.IN_TRANSIT, handler, order_v3.version)
                order_v4 = db.query(TransportOrder).filter(TransportOrder.id == order.id).first()
                OrderService.update_order_info(db, order.id, {"receiver": "刘女士"}, handler)
                OrderService.add_evidence(db, order.id, {
                    "evidence_type": EvidenceType.RECEIPT,
                    "file_name": "签收回单_圆通速递.jpg",
                    "file_ref": "/evidences/receipt_005.jpg",
                }, handler)
                OrderService.transition_order(db, order.id, OrderStatus.DELIVERED, handler, order_v4.version)
                order_v5 = db.query(TransportOrder).filter(TransportOrder.id == order.id).first()
                OrderService.transition_order(db, order.id, OrderStatus.REVIEWED, reviewer, order_v5.version)

            if i == 5:
                pass

            if i == 6:
                OrderService.add_evidence(db, order.id, {
                    "evidence_type": EvidenceType.ENTRUSTMENT,
                    "file_name": "运输委托单_极兔速递.pdf",
                    "file_ref": "/evidences/entrustment_007.pdf",
                    "remark": "生鲜需加急",
                }, initiator)
                OrderService.transition_order(db, order.id, OrderStatus.ENTRUSTED, initiator, order.version)
                order_v2 = db.query(TransportOrder).filter(TransportOrder.id == order.id).first()
                OrderService.transition_order(db, order.id, OrderStatus.REJECTED, reviewer, order_v2.version, "调度信息不完整，请补充车辆信息后重新提交")

        db.commit()
    except Exception as e:
        print(f"Seed error: {e}")
        db.rollback()
    finally:
        db.close()


reset_and_seed()
seed_sample_orders()


app = Litestar(
    route_handlers=[AuthController, OrderController, BatchController, AuditController],
    cors_config=cors_config,
    openapi_config=OpenAPIConfig(
        title="运输订单管理系统 API",
        version="1.0.0",
        description="货运物流公司批量变更复核运输订单系统",
    ),
)
