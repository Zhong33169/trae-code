from datetime import datetime
from typing import Optional, List
import random
import string
from sqlalchemy.orm import Session
from app.models.database import (
    User, TransportOrder, OrderEvidence, AuditLog,
    RoleEnum, OrderStatus, EvidenceType
)


def _gen_order_no(user_id: int) -> str:
    rand = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"TO{datetime.now().strftime('%Y%m%d%H%M%S')}{user_id:03d}{rand}"


class OrderValidationError(Exception):
    def __init__(self, message: str, code: str = "validation_error"):
        self.message = message
        self.code = code
        super().__init__(message)


STATUS_TRANSITIONS = {
    OrderStatus.DRAFT: [OrderStatus.ENTRUSTED],
    OrderStatus.ENTRUSTED: [OrderStatus.DISPATCHED, OrderStatus.REJECTED],
    OrderStatus.DISPATCHED: [OrderStatus.IN_TRANSIT, OrderStatus.REJECTED],
    OrderStatus.IN_TRANSIT: [OrderStatus.DELIVERED, OrderStatus.REJECTED],
    OrderStatus.DELIVERED: [OrderStatus.REVIEWED, OrderStatus.REJECTED],
    OrderStatus.REVIEWED: [],
    OrderStatus.REJECTED: [OrderStatus.DRAFT, OrderStatus.ENTRUSTED],
}

ROLE_STATUS_MAP = {
    RoleEnum.INITIATOR: {
        OrderStatus.DRAFT: [OrderStatus.ENTRUSTED],
        OrderStatus.REJECTED: [OrderStatus.DRAFT],
    },
    RoleEnum.HANDLER: {
        OrderStatus.ENTRUSTED: [OrderStatus.DISPATCHED],
        OrderStatus.DISPATCHED: [OrderStatus.IN_TRANSIT],
        OrderStatus.IN_TRANSIT: [OrderStatus.DELIVERED],
        OrderStatus.REJECTED: [OrderStatus.ENTRUSTED],
    },
    RoleEnum.REVIEWER: {
        OrderStatus.DELIVERED: [OrderStatus.REVIEWED, OrderStatus.REJECTED],
        OrderStatus.ENTRUSTED: [OrderStatus.REJECTED],
        OrderStatus.DISPATCHED: [OrderStatus.REJECTED],
        OrderStatus.IN_TRANSIT: [OrderStatus.REJECTED],
    },
}

STATUS_REQUIRED_EVIDENCE = {
    OrderStatus.ENTRUSTED: [EvidenceType.ENTRUSTMENT],
    OrderStatus.DISPATCHED: [EvidenceType.ENTRUSTMENT, EvidenceType.DISPATCH],
    OrderStatus.IN_TRANSIT: [EvidenceType.ENTRUSTMENT, EvidenceType.DISPATCH],
    OrderStatus.DELIVERED: [EvidenceType.ENTRUSTMENT, EvidenceType.DISPATCH, EvidenceType.RECEIPT],
    OrderStatus.REVIEWED: [EvidenceType.ENTRUSTMENT, EvidenceType.DISPATCH, EvidenceType.RECEIPT],
}


class OrderService:
    @staticmethod
    def create_order(db: Session, data: dict, user: User) -> TransportOrder:
        if user.role != RoleEnum.INITIATOR:
            role_name = {RoleEnum.INITIATOR: "发起岗", RoleEnum.HANDLER: "办理岗", RoleEnum.REVIEWER: "复核岗"}.get(user.role, user.role.value)
            raise OrderValidationError(
                f"角色无权限：您是【{role_name}】，只有发起岗可以创建运输订单",
                code="ROLE_PERMISSION_DENIED"
            )
        order = TransportOrder(
            order_no=_gen_order_no(user.id),
            customer=data["customer"],
            cargo_name=data["cargo_name"],
            cargo_weight=data["cargo_weight"],
            origin=data["origin"],
            destination=data["destination"],
            status=OrderStatus.DRAFT,
            version=1,
            initiator_id=user.id,
        )
        db.add(order)
        db.flush()
        OrderService._log_audit(db, order, user, "create_order", None, OrderStatus.DRAFT, "创建运输订单")
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def validate_transition(db: Session, order: TransportOrder, target_status: OrderStatus, user: User, expected_version: int):
        if expected_version != order.version:
            raise OrderValidationError(
                f"版本冲突：当前版本为 v{order.version}，您提交的是 v{expected_version}，请刷新后重试",
                code="VERSION_CONFLICT"
            )

        allowed_targets = STATUS_TRANSITIONS.get(order.status, [])
        if target_status not in allowed_targets:
            raise OrderValidationError(
                f"状态不允许变更：{order.status.value} 不能直接变更为 {target_status.value}。允许的目标：{[s.value for s in allowed_targets]}",
                code="INVALID_STATUS_TRANSITION"
            )

        role_allowed = ROLE_STATUS_MAP.get(user.role, {})
        status_allowed = role_allowed.get(order.status, [])
        if target_status not in status_allowed:
            role_name = {RoleEnum.INITIATOR: "发起岗", RoleEnum.HANDLER: "办理岗", RoleEnum.REVIEWER: "复核岗"}.get(user.role, user.role.value)
            raise OrderValidationError(
                f"角色无权限：您是【{role_name}】，无权从 {order.status.value} 变更为 {target_status.value}",
                code="ROLE_PERMISSION_DENIED"
            )

        required_evidences = STATUS_REQUIRED_EVIDENCE.get(target_status, [])
        existing_types = {e.evidence_type for e in order.evidences}
        missing = [et.value for et in required_evidences if et not in existing_types]
        if missing:
            evidence_names = {
                EvidenceType.ENTRUSTMENT: "运输委托单",
                EvidenceType.DISPATCH: "车辆调度单",
                EvidenceType.RECEIPT: "签收回单",
            }
            missing_names = [evidence_names.get(et, et) for et in missing]
            raise OrderValidationError(
                f"缺少必要证据：变更为 {target_status.value} 需要 {', '.join(missing_names)}",
                code="MISSING_EVIDENCE"
            )

        if target_status == OrderStatus.DISPATCHED:
            if not order.plate_number or not order.driver:
                raise OrderValidationError(
                    "调度前必须填写车牌号和司机信息",
                    code="MISSING_DISPATCH_INFO"
                )

        if target_status == OrderStatus.DELIVERED:
            if not order.receiver:
                raise OrderValidationError(
                    "签收必须填写签收人信息",
                    code="MISSING_RECEIVER_INFO"
                )

    @staticmethod
    def transition_order(db: Session, order_id: int, target_status: OrderStatus, user: User, expected_version: int, remark: Optional[str] = None) -> TransportOrder:
        order = db.query(TransportOrder).filter(TransportOrder.id == order_id).first()
        if not order:
            raise OrderValidationError(f"订单不存在：id={order_id}", code="ORDER_NOT_FOUND")

        old_status = order.status
        OrderService.validate_transition(db, order, target_status, user, expected_version)

        order.status = target_status
        order.version += 1
        order.updated_at = datetime.utcnow()

        if target_status == OrderStatus.ENTRUSTED:
            order.initiator_id = user.id
        elif target_status in [OrderStatus.DISPATCHED, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED]:
            order.handler_id = user.id
        elif target_status == OrderStatus.REVIEWED:
            order.reviewer_id = user.id

        if target_status == OrderStatus.DELIVERED:
            order.signed_at = datetime.utcnow()

        if remark and target_status == OrderStatus.REJECTED:
            order.rejected_reason = remark

        OrderService._log_audit(
            db, order, user,
            action=f"transition_{target_status.value}",
            old_status=old_status,
            new_status=target_status,
            detail=remark or f"状态变更: {old_status.value} → {target_status.value}"
        )

        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def add_evidence(db: Session, order_id: int, evidence_data: dict, user: User) -> OrderEvidence:
        order = db.query(TransportOrder).filter(TransportOrder.id == order_id).first()
        if not order:
            raise OrderValidationError(f"订单不存在：id={order_id}", code="ORDER_NOT_FOUND")

        if order.status in [OrderStatus.REVIEWED]:
            raise OrderValidationError("订单已归档，不能再上传证据", code="ORDER_ARCHIVED")

        evidence = OrderEvidence(
            order_id=order_id,
            evidence_type=evidence_data["evidence_type"],
            file_name=evidence_data["file_name"],
            file_ref=evidence_data["file_ref"],
            remark=evidence_data.get("remark"),
            uploaded_by=user.id,
        )
        db.add(evidence)
        order.version += 1
        order.updated_at = datetime.utcnow()

        OrderService._log_audit(
            db, order, user,
            action="upload_evidence",
            old_status=order.status,
            new_status=order.status,
            detail=f"上传证据: {evidence_data['evidence_type'].value} - {evidence_data['file_name']}"
        )
        db.commit()
        db.refresh(evidence)
        return evidence

    @staticmethod
    def update_order_info(db: Session, order_id: int, data: dict, user: User) -> TransportOrder:
        order = db.query(TransportOrder).filter(TransportOrder.id == order_id).first()
        if not order:
            raise OrderValidationError(f"订单不存在：id={order_id}", code="ORDER_NOT_FOUND")

        if order.status in [OrderStatus.REVIEWED, OrderStatus.DELIVERED]:
            raise OrderValidationError(f"订单状态为 {order.status.value}，不可修改基本信息", code="ORDER_LOCKED")

        if order.status in [OrderStatus.ENTRUSTED, OrderStatus.DISPATCHED, OrderStatus.IN_TRANSIT] and user.role not in [RoleEnum.HANDLER, RoleEnum.INITIATOR]:
            raise OrderValidationError("只有发起岗或办理岗可修改订单信息", code="ROLE_PERMISSION_DENIED")

        for field in ["plate_number", "driver", "receiver"]:
            if field in data and data[field] is not None:
                setattr(order, field, data[field])

        order.version += 1
        order.updated_at = datetime.utcnow()

        OrderService._log_audit(
            db, order, user,
            action="update_order",
            old_status=order.status,
            new_status=order.status,
            detail=f"更新订单信息: {data}"
        )
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def _log_audit(db: Session, order: TransportOrder, user: User, action: str,
                   old_status, new_status, detail: str):
        log = AuditLog(
            order_id=order.id,
            order_no=order.order_no,
            user_id=user.id,
            username=user.username,
            action=action,
            old_status=old_status.value if old_status else None,
            new_status=new_status.value if new_status else None,
            detail=detail,
        )
        db.add(log)
