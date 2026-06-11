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

EVIDENCE_UPLOAD_RULES = {
    EvidenceType.ENTRUSTMENT: {
        "roles": [RoleEnum.INITIATOR],
        "allowed_statuses": [OrderStatus.DRAFT, OrderStatus.ENTRUSTED, OrderStatus.REJECTED],
        "label": "运输委托单",
    },
    EvidenceType.DISPATCH: {
        "roles": [RoleEnum.HANDLER],
        "allowed_statuses": [OrderStatus.ENTRUSTED, OrderStatus.DISPATCHED, OrderStatus.IN_TRANSIT, OrderStatus.REJECTED],
        "label": "车辆调度单",
    },
    EvidenceType.RECEIPT: {
        "roles": [RoleEnum.HANDLER],
        "allowed_statuses": [OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED, OrderStatus.REJECTED],
        "label": "签收回单",
    },
}

ROLE_LABELS = {
    RoleEnum.INITIATOR: "发起岗",
    RoleEnum.HANDLER: "办理岗",
    RoleEnum.REVIEWER: "复核岗",
}

EDITABLE_INFO_BY_ROLE_STATUS = {
    RoleEnum.HANDLER: {
        "fields": {
            "plate_number": [OrderStatus.ENTRUSTED, OrderStatus.DISPATCHED, OrderStatus.IN_TRANSIT, OrderStatus.REJECTED],
            "driver": [OrderStatus.ENTRUSTED, OrderStatus.DISPATCHED, OrderStatus.IN_TRANSIT, OrderStatus.REJECTED],
            "receiver": [OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED, OrderStatus.REJECTED],
        }
    },
    RoleEnum.INITIATOR: {
        "fields": {
            "plate_number": [OrderStatus.DRAFT, OrderStatus.REJECTED],
            "driver": [OrderStatus.DRAFT, OrderStatus.REJECTED],
        }
    },
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

        evidence_type = evidence_data["evidence_type"]
        rule = EVIDENCE_UPLOAD_RULES.get(evidence_type)
        if not rule:
            raise OrderValidationError(f"未知的证据类型：{evidence_type}", code="INVALID_EVIDENCE_TYPE")

        if order.status == OrderStatus.REVIEWED:
            raise OrderValidationError("订单已归档，不能再上传证据", code="ORDER_ARCHIVED")

        user_role_label = ROLE_LABELS.get(user.role, user.role.value)
        evidence_label = rule["label"]

        if user.role not in rule["roles"]:
            allowed_roles = [ROLE_LABELS.get(r, r.value) for r in rule["roles"]]
            raise OrderValidationError(
                f"角色无权限：您是【{user_role_label}】，无权上传【{evidence_label}】，仅 {', '.join(allowed_roles)} 可以上传",
                code="ROLE_PERMISSION_DENIED"
            )

        if order.status not in rule["allowed_statuses"]:
            allowed_status_labels = [
                {OrderStatus.DRAFT: "草稿", OrderStatus.ENTRUSTED: "已委托",
                 OrderStatus.DISPATCHED: "已调度", OrderStatus.IN_TRANSIT: "运输中",
                 OrderStatus.DELIVERED: "已签收", OrderStatus.REVIEWED: "已归档",
                 OrderStatus.REJECTED: "驳回"}.get(s, s.value)
                for s in rule["allowed_statuses"]
            ]
            current_status_label = {
                OrderStatus.DRAFT: "草稿", OrderStatus.ENTRUSTED: "已委托",
                OrderStatus.DISPATCHED: "已调度", OrderStatus.IN_TRANSIT: "运输中",
                OrderStatus.DELIVERED: "已签收", OrderStatus.REVIEWED: "已归档",
                OrderStatus.REJECTED: "驳回"
            }.get(order.status, order.status.value)
            raise OrderValidationError(
                f"状态不允许：当前订单状态为【{current_status_label}】，不能上传【{evidence_label}】，"
                f"仅在 {', '.join(allowed_status_labels)} 状态下可上传",
                code="INVALID_STATUS_TRANSITION"
            )

        evidence = OrderEvidence(
            order_id=order_id,
            evidence_type=evidence_type,
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
            detail=f"上传证据: {evidence_label} - {evidence_data['file_name']}"
        )
        db.commit()
        db.refresh(evidence)
        return evidence

    @staticmethod
    def update_order_info(db: Session, order_id: int, data: dict, user: User) -> TransportOrder:
        order = db.query(TransportOrder).filter(TransportOrder.id == order_id).first()
        if not order:
            raise OrderValidationError(f"订单不存在：id={order_id}", code="ORDER_NOT_FOUND")

        if order.status == OrderStatus.REVIEWED:
            raise OrderValidationError("订单已归档，不可修改信息", code="ORDER_ARCHIVED")

        user_role_label = ROLE_LABELS.get(user.role, user.role.value)
        status_label = {
            OrderStatus.DRAFT: "草稿", OrderStatus.ENTRUSTED: "已委托",
            OrderStatus.DISPATCHED: "已调度", OrderStatus.IN_TRANSIT: "运输中",
            OrderStatus.DELIVERED: "已签收", OrderStatus.REVIEWED: "已归档",
            OrderStatus.REJECTED: "驳回"
        }.get(order.status, order.status.value)

        role_rules = EDITABLE_INFO_BY_ROLE_STATUS.get(user.role)
        if not role_rules:
            raise OrderValidationError(
                f"角色无权限：您是【{user_role_label}】，无权修改订单信息",
                code="ROLE_PERMISSION_DENIED"
            )

        editable_fields = role_rules["fields"]
        fields_to_update = [f for f in ["plate_number", "driver", "receiver"] if f in data and data[f] is not None]

        field_labels = {
            "plate_number": "车牌号",
            "driver": "司机",
            "receiver": "签收人"
        }

        for field in fields_to_update:
            if field not in editable_fields:
                raise OrderValidationError(
                    f"角色无权限：您是【{user_role_label}】，无权修改【{field_labels[field]}】",
                    code="ROLE_PERMISSION_DENIED"
                )
            if order.status not in editable_fields[field]:
                allowed_statuses = editable_fields[field]
                allowed_status_labels = [
                    {
                        OrderStatus.DRAFT: "草稿", OrderStatus.ENTRUSTED: "已委托",
                        OrderStatus.DISPATCHED: "已调度", OrderStatus.IN_TRANSIT: "运输中",
                        OrderStatus.DELIVERED: "已签收", OrderStatus.REVIEWED: "已归档",
                        OrderStatus.REJECTED: "驳回"
                    }.get(s, s.value) for s in allowed_statuses
                ]
                raise OrderValidationError(
                    f"状态不允许：当前订单状态为【{status_label}】，不能修改【{field_labels[field]}】，"
                    f"仅在 {', '.join(allowed_status_labels)} 状态下可修改",
                    code="INVALID_STATUS_TRANSITION"
                )

        if not fields_to_update:
            return order

        changed = {}
        for field in fields_to_update:
            old_value = getattr(order, field)
            new_value = data[field]
            if old_value != new_value:
                changed[field_labels[field]] = {"old": old_value, "new": new_value}
                setattr(order, field, new_value)

        if not changed:
            return order

        order.version += 1
        order.updated_at = datetime.utcnow()

        detail_str = ", ".join([f"{k}: {v['old']} → {v['new']}" for k, v in changed.items()])

        OrderService._log_audit(
            db, order, user,
            action="update_order",
            old_status=order.status,
            new_status=order.status,
            detail=f"更新订单信息: {detail_str}"
        )
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def _log_audit(db: Session, order: TransportOrder, user: User, action: str,
                   old_status, new_status, detail: str,
                   failure_reason: Optional[str] = None,
                   batch_id: Optional[int] = None, batch_no: Optional[str] = None):
        log = AuditLog(
            order_id=order.id,
            order_no=order.order_no,
            user_id=user.id,
            username=user.username,
            action=action,
            old_status=old_status.value if old_status else None,
            new_status=new_status.value if new_status else None,
            detail=detail,
            failure_reason=failure_reason,
            batch_id=batch_id,
            batch_no=batch_no,
        )
        db.add(log)
