from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.database import (
    User, RoleEnum, TransportOrder, OrderStatus, OrderEvidence, EvidenceType,
    BatchChange, BatchItem, BatchStatus, BatchItemStatus, AuditLog
)
from app.models.db_config import init_db, engine
from app.services.order_service import OrderService
from sqlalchemy import text


DEMO_USERS = [
    {"username": "fqr", "display_name": "冯庆荣", "role": RoleEnum.INITIATOR},
    {"username": "bl", "display_name": "办理员", "role": RoleEnum.HANDLER},
    {"username": "fhr", "display_name": "复核人", "role": RoleEnum.REVIEWER},
]

SAMPLE_ORDERS = [
    {"customer": "华盛物流", "cargo_name": "电子元件", "cargo_weight": 12.5, "origin": "深圳宝安", "destination": "广州白云"},
    {"customer": "顺丰快运", "cargo_name": "服装面料", "cargo_weight": 8.0, "origin": "上海浦东", "destination": "杭州余杭"},
    {"customer": "德邦物流", "cargo_name": "机械设备", "cargo_weight": 45.2, "origin": "北京朝阳", "destination": "天津滨海"},
    {"customer": "中通物流", "cargo_name": "食品饮料", "cargo_weight": 22.3, "origin": "成都武侯", "destination": "重庆江北"},
    {"customer": "圆通速递", "cargo_name": "日用百货", "cargo_weight": 5.7, "origin": "南京鼓楼", "destination": "苏州工业园"},
    {"customer": "韵达快递", "cargo_name": "图书教材", "cargo_weight": 3.2, "origin": "武汉武昌", "destination": "长沙岳麓"},
    {"customer": "极兔速递", "cargo_name": "生鲜水果", "cargo_weight": 18.9, "origin": "西安雁塔", "destination": "郑州金水"},
    {"customer": "EMS邮政", "cargo_name": "文件包裹", "cargo_weight": 1.5, "origin": "济南历下", "destination": "青岛崂山"},
    {"customer": "京东物流", "cargo_name": "家电冰箱", "cargo_weight": 68.0, "origin": "广州番禺", "destination": "佛山南海"},
    {"customer": "申通快递", "cargo_name": "母婴用品", "cargo_weight": 7.3, "origin": "杭州萧山", "destination": "宁波鄞州"},
]


def _get_user(db: Session, username: str) -> User:
    return db.query(User).filter(User.username == username).first()


def _add_evidence(db: Session, order: TransportOrder, ev_type: EvidenceType, file_name: str, user: User):
    ev = OrderEvidence(
        order_id=order.id,
        evidence_type=ev_type,
        file_name=file_name,
        file_ref=f"/mock/{order.order_no}/{file_name}",
        uploaded_by=user.id,
    )
    db.add(ev)
    db.flush()
    order.evidences.append(ev)


def seed_data(db: Session):
    for u in DEMO_USERS:
        existing = db.query(User).filter(User.username == u["username"]).first()
        if not existing:
            user = User(**u)
            db.add(user)
    db.commit()

    if db.query(TransportOrder).count() > 0:
        return

    u_initiator = _get_user(db, "fqr")
    u_handler = _get_user(db, "bl")
    u_reviewer = _get_user(db, "fhr")

    orders = []
    for i, so in enumerate(SAMPLE_ORDERS):
        order = OrderService.create_order(db, so, u_initiator)
        orders.append(order)

    OrderService.add_evidence(db, orders[1].id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "华盛物流委托单.pdf",
        "file_ref": "/evidences/huasheng_entrust.pdf",
    }, u_initiator)
    orders[1] = OrderService.transition_order(db, orders[1].id, OrderStatus.ENTRUSTED, u_initiator, 2, "初始委托")

    OrderService.add_evidence(db, orders[2].id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "德邦物流委托单.pdf",
        "file_ref": "/evidences/debang_entrust.pdf",
    }, u_initiator)
    orders[2] = OrderService.transition_order(db, orders[2].id, OrderStatus.ENTRUSTED, u_initiator, 2)
    OrderService.update_order_info(db, orders[2].id, {"plate_number": "京A12345", "driver": "张师傅"}, u_handler)
    orders[2] = db.query(TransportOrder).filter(TransportOrder.id == orders[2].id).first()
    OrderService.add_evidence(db, orders[2].id, {
        "evidence_type": EvidenceType.DISPATCH,
        "file_name": "车辆调度单-京A12345.pdf",
        "file_ref": "/evidences/dispatch_jingA12345.pdf",
    }, u_handler)
    orders[2] = OrderService.transition_order(db, orders[2].id, OrderStatus.DISPATCHED, u_handler, orders[2].version)

    OrderService.add_evidence(db, orders[3].id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "中通物流委托单.pdf",
        "file_ref": "/evidences/zhongtong_entrust.pdf",
    }, u_initiator)
    orders[3] = OrderService.transition_order(db, orders[3].id, OrderStatus.ENTRUSTED, u_initiator, 2)
    OrderService.update_order_info(db, orders[3].id, {"plate_number": "川B88888", "driver": "李师傅"}, u_handler)
    orders[3] = db.query(TransportOrder).filter(TransportOrder.id == orders[3].id).first()
    OrderService.add_evidence(db, orders[3].id, {
        "evidence_type": EvidenceType.DISPATCH,
        "file_name": "车辆调度单-川B88888.pdf",
        "file_ref": "/evidences/dispatch_chuanB88888.pdf",
    }, u_handler)
    orders[3] = OrderService.transition_order(db, orders[3].id, OrderStatus.DISPATCHED, u_handler, orders[3].version)
    orders[3] = OrderService.transition_order(db, orders[3].id, OrderStatus.IN_TRANSIT, u_handler, orders[3].version)

    OrderService.add_evidence(db, orders[4].id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "圆通速递委托单.pdf",
        "file_ref": "/evidences/yuantong_entrust.pdf",
    }, u_initiator)
    orders[4] = OrderService.transition_order(db, orders[4].id, OrderStatus.ENTRUSTED, u_initiator, 2)
    OrderService.update_order_info(db, orders[4].id, {"plate_number": "苏E66666", "driver": "王师傅"}, u_handler)
    orders[4] = db.query(TransportOrder).filter(TransportOrder.id == orders[4].id).first()
    OrderService.add_evidence(db, orders[4].id, {
        "evidence_type": EvidenceType.DISPATCH,
        "file_name": "车辆调度单-苏E66666.pdf",
        "file_ref": "/evidences/dispatch_suE66666.pdf",
    }, u_handler)
    orders[4] = OrderService.transition_order(db, orders[4].id, OrderStatus.DISPATCHED, u_handler, orders[4].version)
    orders[4] = OrderService.transition_order(db, orders[4].id, OrderStatus.IN_TRANSIT, u_handler, orders[4].version)
    OrderService.update_order_info(db, orders[4].id, {"receiver": "赵经理 13800001111"}, u_handler)
    orders[4] = db.query(TransportOrder).filter(TransportOrder.id == orders[4].id).first()
    OrderService.add_evidence(db, orders[4].id, {
        "evidence_type": EvidenceType.RECEIPT,
        "file_name": "签收回单-圆通.pdf",
        "file_ref": "/evidences/receipt_yuantong.pdf",
    }, u_handler)
    orders[4] = OrderService.transition_order(db, orders[4].id, OrderStatus.DELIVERED, u_handler, orders[4].version)

    OrderService.add_evidence(db, orders[5].id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "韵达快递委托单.pdf",
        "file_ref": "/evidences/yunda_entrust.pdf",
    }, u_initiator)
    orders[5] = OrderService.transition_order(db, orders[5].id, OrderStatus.ENTRUSTED, u_initiator, 2)
    OrderService.update_order_info(db, orders[5].id, {"plate_number": "鄂A77777", "driver": "刘师傅"}, u_handler)
    orders[5] = db.query(TransportOrder).filter(TransportOrder.id == orders[5].id).first()
    OrderService.add_evidence(db, orders[5].id, {
        "evidence_type": EvidenceType.DISPATCH,
        "file_name": "车辆调度单-鄂A77777.pdf",
        "file_ref": "/evidences/dispatch_eA77777.pdf",
    }, u_handler)
    orders[5] = OrderService.transition_order(db, orders[5].id, OrderStatus.DISPATCHED, u_handler, orders[5].version)
    orders[5] = OrderService.transition_order(db, orders[5].id, OrderStatus.IN_TRANSIT, u_handler, orders[5].version)
    OrderService.update_order_info(db, orders[5].id, {"receiver": "陈女士 13900002222"}, u_handler)
    orders[5] = db.query(TransportOrder).filter(TransportOrder.id == orders[5].id).first()
    OrderService.add_evidence(db, orders[5].id, {
        "evidence_type": EvidenceType.RECEIPT,
        "file_name": "签收回单-韵达.pdf",
        "file_ref": "/evidences/receipt_yunda.pdf",
    }, u_handler)
    orders[5] = OrderService.transition_order(db, orders[5].id, OrderStatus.DELIVERED, u_handler, orders[5].version)

    OrderService.add_evidence(db, orders[6].id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "极兔速递委托单.pdf",
        "file_ref": "/evidences/jitu_entrust.pdf",
    }, u_initiator)
    orders[6] = OrderService.transition_order(db, orders[6].id, OrderStatus.ENTRUSTED, u_initiator, 2)
    OrderService.update_order_info(db, orders[6].id, {"plate_number": "陕B22222", "driver": "孙师傅"}, u_handler)
    orders[6] = db.query(TransportOrder).filter(TransportOrder.id == orders[6].id).first()
    OrderService.add_evidence(db, orders[6].id, {
        "evidence_type": EvidenceType.DISPATCH,
        "file_name": "车辆调度单-陕B22222.pdf",
        "file_ref": "/evidences/dispatch_shanB22222.pdf",
    }, u_handler)
    orders[6] = OrderService.transition_order(db, orders[6].id, OrderStatus.DISPATCHED, u_handler, orders[6].version)
    orders[6] = OrderService.transition_order(db, orders[6].id, OrderStatus.REJECTED, u_reviewer, orders[6].version, "调度单信息不完整，请补充货物明细后重新提交")

    OrderService.add_evidence(db, orders[7].id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "EMS委托单.pdf",
        "file_ref": "/evidences/ems_entrust.pdf",
    }, u_initiator)
    orders[7] = OrderService.transition_order(db, orders[7].id, OrderStatus.ENTRUSTED, u_initiator, 2)
    OrderService.update_order_info(db, orders[7].id, {"plate_number": "鲁F33333", "driver": "周师傅"}, u_handler)
    orders[7] = db.query(TransportOrder).filter(TransportOrder.id == orders[7].id).first()
    OrderService.add_evidence(db, orders[7].id, {
        "evidence_type": EvidenceType.DISPATCH,
        "file_name": "车辆调度单-鲁F33333.pdf",
        "file_ref": "/evidences/dispatch_luF33333.pdf",
    }, u_handler)
    orders[7] = OrderService.transition_order(db, orders[7].id, OrderStatus.DISPATCHED, u_handler, orders[7].version)
    orders[7] = OrderService.transition_order(db, orders[7].id, OrderStatus.IN_TRANSIT, u_handler, orders[7].version)
    OrderService.update_order_info(db, orders[7].id, {"receiver": "暂缺"}, u_handler)
    orders[7] = db.query(TransportOrder).filter(TransportOrder.id == orders[7].id).first()
    orders[7] = OrderService.transition_order(db, orders[7].id, OrderStatus.REJECTED, u_reviewer, orders[7].version, "签收人信息无效，请核实后重新提交")

    OrderService.add_evidence(db, orders[8].id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "京东物流委托单.pdf",
        "file_ref": "/evidences/jd_entrust.pdf",
    }, u_initiator)
    orders[8] = OrderService.transition_order(db, orders[8].id, OrderStatus.ENTRUSTED, u_initiator, 2)
    OrderService.update_order_info(db, orders[8].id, {"plate_number": "粤X99999", "driver": "吴师傅"}, u_handler)
    orders[8] = db.query(TransportOrder).filter(TransportOrder.id == orders[8].id).first()
    OrderService.add_evidence(db, orders[8].id, {
        "evidence_type": EvidenceType.DISPATCH,
        "file_name": "车辆调度单-粤X99999.pdf",
        "file_ref": "/evidences/dispatch_yueX99999.pdf",
    }, u_handler)
    orders[8] = OrderService.transition_order(db, orders[8].id, OrderStatus.DISPATCHED, u_handler, orders[8].version)
    orders[8] = OrderService.transition_order(db, orders[8].id, OrderStatus.IN_TRANSIT, u_handler, orders[8].version)
    OrderService.update_order_info(db, orders[8].id, {"receiver": "林总 13700003333"}, u_handler)
    orders[8] = db.query(TransportOrder).filter(TransportOrder.id == orders[8].id).first()
    OrderService.add_evidence(db, orders[8].id, {
        "evidence_type": EvidenceType.RECEIPT,
        "file_name": "签收回单-京东.pdf",
        "file_ref": "/evidences/receipt_jd.pdf",
    }, u_handler)
    orders[8] = OrderService.transition_order(db, orders[8].id, OrderStatus.DELIVERED, u_handler, orders[8].version)

    OrderService.add_evidence(db, orders[9].id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "申通快递委托单.pdf",
        "file_ref": "/evidences/shentong_entrust.pdf",
    }, u_initiator)
    orders[9] = OrderService.transition_order(db, orders[9].id, OrderStatus.ENTRUSTED, u_initiator, 2)
    OrderService.update_order_info(db, orders[9].id, {"plate_number": "浙A55555", "driver": "郑师傅"}, u_handler)
    orders[9] = db.query(TransportOrder).filter(TransportOrder.id == orders[9].id).first()
    OrderService.add_evidence(db, orders[9].id, {
        "evidence_type": EvidenceType.DISPATCH,
        "file_name": "车辆调度单-浙A55555.pdf",
        "file_ref": "/evidences/dispatch_zheA55555.pdf",
    }, u_handler)
    orders[9] = OrderService.transition_order(db, orders[9].id, OrderStatus.DISPATCHED, u_handler, orders[9].version)
    orders[9] = OrderService.transition_order(db, orders[9].id, OrderStatus.IN_TRANSIT, u_handler, orders[9].version)
    OrderService.update_order_info(db, orders[9].id, {"receiver": "徐经理 13600004444"}, u_handler)
    orders[9] = db.query(TransportOrder).filter(TransportOrder.id == orders[9].id).first()

    db.flush()

    from app.services.batch_service import BatchService

    batch_order_ids = [orders[4].id, orders[5].id, orders[8].id, orders[9].id, orders[3].id]
    batch = BatchService.create_batch(db, batch_order_ids, OrderStatus.DELIVERED, "batch_status", u_handler)
    batch = BatchService.execute_batch(db, batch.id, u_handler)

    batch2_order_ids = [orders[4].id, orders[2].id]
    batch2 = BatchService.create_batch(db, batch2_order_ids, OrderStatus.REVIEWED, "batch_status", u_reviewer)
    batch2 = BatchService.execute_batch(db, batch2.id, u_reviewer)

    failed_items = [item.id for item in batch2.items if item.status == BatchItemStatus.FAILED]
    if failed_items:
        BatchService.retry_failed_items(db, batch2.id, failed_items[:2], u_reviewer)

    orders[8] = db.query(TransportOrder).filter(TransportOrder.id == orders[8].id).first()
    if orders[8].status == OrderStatus.DELIVERED:
        orders[8] = OrderService.transition_order(
            db, orders[8].id, OrderStatus.REJECTED, u_reviewer,
            orders[8].version, "签收单签字模糊，且货物数量有差异，请核实后重新提交"
        )

    db.commit()


def reset_and_seed():
    init_db()
    from app.models.db_config import SessionLocal
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()
