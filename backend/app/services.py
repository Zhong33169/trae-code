from datetime import datetime
from sqlalchemy.orm import Session
from typing import Optional, Tuple, List

from .models import (
    EnergyBill, BillStatus, ProcessNode, Role,
    OperationLog, NodeTimeoutConfig, User
)
from .schemas import OverdueInfo


def calculate_overdue_info(db: Session, bill: EnergyBill) -> Optional[OverdueInfo]:
    if bill.current_node == ProcessNode.COMPLETED:
        return None

    config = db.query(NodeTimeoutConfig).filter_by(node=bill.current_node).first()
    if not config:
        return None

    now = datetime.utcnow()
    delta = now - bill.current_node_started_at
    hours_passed = delta.total_seconds() / 3600
    is_overdue = hours_passed > config.timeout_hours
    overdue_hours = max(0, hours_passed - config.timeout_hours) if is_overdue else 0

    next_role = get_next_responsible_role(bill.current_node)

    return OverdueInfo(
        is_overdue=is_overdue,
        overdue_hours=round(overdue_hours, 2),
        current_node=bill.current_node,
        current_node_started_at=bill.current_node_started_at,
        timeout_hours=config.timeout_hours,
        responsible_role=bill.current_responsible_role,
        next_responsible_role=next_role
    )


def get_next_responsible_role(current_node: ProcessNode) -> Optional[Role]:
    flow = {
        ProcessNode.REGISTRATION: Role.AUDITOR,
        ProcessNode.AUDIT: Role.PROPERTY,
        ProcessNode.REVIEW: None,
        ProcessNode.COMPLETED: None,
    }
    return flow.get(current_node)


def update_bill_overdue_status(db: Session, bill: EnergyBill) -> None:
    overdue_info = calculate_overdue_info(db, bill)
    if overdue_info:
        bill.is_overdue = overdue_info.is_overdue
        bill.overdue_hours = overdue_info.overdue_hours


def update_all_bills_overdue(db: Session) -> int:
    bills = db.query(EnergyBill).filter(
        EnergyBill.current_node != ProcessNode.COMPLETED
    ).all()
    count = 0
    for bill in bills:
        old_overdue = bill.is_overdue
        update_bill_overdue_status(db, bill)
        if bill.is_overdue != old_overdue:
            count += 1
    db.commit()
    return count


def get_visible_fields(role: Role, bill: EnergyBill) -> List[str]:
    base_fields = [
        "id", "bill_no", "period", "park_name", "building", "room",
        "status", "current_node", "is_overdue", "overdue_hours",
        "created_at", "updated_at", "creator_name"
    ]

    role_fields = {
        Role.REGISTRAR: [
            "electricity_usage", "water_usage", "gas_usage",
            "electricity_amount", "water_amount", "gas_amount", "total_amount",
            "has_meter_reading", "has_bill_generated", "has_payment_verified",
            "meter_readings", "payments", "operation_logs"
        ],
        Role.AUDITOR: [
            "electricity_usage", "water_usage", "gas_usage",
            "electricity_amount", "water_amount", "gas_amount", "total_amount",
            "has_meter_reading", "has_bill_generated", "has_payment_verified",
            "meter_readings", "operation_logs"
        ],
        Role.PROPERTY: [
            "electricity_usage", "water_usage", "gas_usage",
            "electricity_amount", "water_amount", "gas_amount", "total_amount",
            "has_meter_reading", "has_bill_generated", "has_payment_verified",
            "payments", "operation_logs"
        ],
    }

    return base_fields + role_fields.get(role, [])


def get_editable_fields(role: Role, bill: EnergyBill) -> List[str]:
    editable = []

    if bill.current_node == ProcessNode.REGISTRATION and bill.current_responsible_role == role:
        if bill.status in [BillStatus.DRAFT, BillStatus.REJECTED, BillStatus.REVIEW_REJECTED]:
            editable = ["period", "park_name", "building", "room"]

    return editable


def get_allowed_actions(role: Role, bill: EnergyBill) -> List[str]:
    actions = []
    node_role_map = {
        ProcessNode.REGISTRATION: Role.REGISTRAR,
        ProcessNode.AUDIT: Role.AUDITOR,
        ProcessNode.REVIEW: Role.PROPERTY,
    }

    if node_role_map.get(bill.current_node) != role:
        return actions

    if bill.current_node == ProcessNode.REGISTRATION:
        if bill.status == BillStatus.DRAFT:
            actions.extend(["edit", "delete", "submit_audit"])
        elif bill.status == BillStatus.REJECTED:
            actions.extend(["edit", "resubmit_audit"])
        elif bill.status == BillStatus.REVIEW_REJECTED:
            actions.extend(["edit", "resubmit_audit"])
        if not bill.has_meter_reading:
            actions.append("add_meter_reading")
        if bill.has_meter_reading and not bill.has_bill_generated:
            actions.append("generate_bill")
        if not bill.has_payment_verified:
            actions.append("add_payment")

    elif bill.current_node == ProcessNode.AUDIT:
        if bill.status == BillStatus.PENDING_AUDIT:
            actions.extend(["audit_approve", "audit_reject"])

    elif bill.current_node == ProcessNode.REVIEW:
        if bill.status in [BillStatus.PENDING_REVIEW, BillStatus.AUDITED]:
            actions.extend(["review_approve", "review_reject"])
        if not bill.has_payment_verified:
            actions.append("verify_payment")

    return actions


def transition_bill_status(
    db: Session,
    bill: EnergyBill,
    action: str,
    operator: User,
    anomaly_reason: Optional[str] = None,
    remark: Optional[str] = None
) -> Tuple[EnergyBill, dict]:
    from_status = bill.status
    from_node = bill.current_node

    transitions = {
        "submit_audit": {
            "from_status": [BillStatus.DRAFT],
            "to_status": BillStatus.PENDING_AUDIT,
            "to_node": ProcessNode.AUDIT,
            "to_role": Role.AUDITOR,
            "operation": "提交审核",
            "require_anomaly_reason": False
        },
        "resubmit_audit": {
            "from_status": [BillStatus.REJECTED, BillStatus.REVIEW_REJECTED],
            "to_status": BillStatus.PENDING_AUDIT,
            "to_node": ProcessNode.AUDIT,
            "to_role": Role.AUDITOR,
            "operation": "补正后重提审核",
            "require_anomaly_reason": False
        },
        "audit_approve": {
            "from_status": [BillStatus.PENDING_AUDIT],
            "to_status": BillStatus.AUDITED,
            "to_node": ProcessNode.REVIEW,
            "to_role": Role.PROPERTY,
            "operation": "审核通过",
            "require_anomaly_reason": False
        },
        "audit_reject": {
            "from_status": [BillStatus.PENDING_AUDIT],
            "to_status": BillStatus.REJECTED,
            "to_node": ProcessNode.REGISTRATION,
            "to_role": Role.REGISTRAR,
            "operation": "审核驳回",
            "require_anomaly_reason": True
        },
        "review_approve": {
            "from_status": [BillStatus.AUDITED, BillStatus.PENDING_REVIEW],
            "to_status": BillStatus.ARCHIVED,
            "to_node": ProcessNode.COMPLETED,
            "to_role": Role.PROPERTY,
            "operation": "复核归档完成",
            "require_anomaly_reason": False
        },
        "review_reject": {
            "from_status": [BillStatus.AUDITED, BillStatus.PENDING_REVIEW],
            "to_status": BillStatus.REVIEW_REJECTED,
            "to_node": ProcessNode.REGISTRATION,
            "to_role": Role.REGISTRAR,
            "operation": "复核驳回",
            "require_anomaly_reason": True
        },
    }

    if action not in transitions:
        return bill, {"success": False, "message": f"未知操作: {action}"}

    trans = transitions[action]

    if trans.get("require_anomaly_reason") and not anomaly_reason:
        return bill, {
            "success": False,
            "message": f"{trans['operation']}必须填写异常原因",
            "required_field": "anomaly_reason"
        }

    if from_status not in trans["from_status"]:
        return bill, {
            "success": False,
            "message": f"当前状态 {from_status.value} 不允许执行 {trans['operation']}",
            "current_status": from_status.value,
            "required_status": [s.value for s in trans["from_status"]]
        }

    allowed_actions = get_allowed_actions(operator.role, bill)
    if action not in allowed_actions:
        return bill, {
            "success": False,
            "message": f"角色 {operator.role.value} 无权限执行 {trans['operation']}",
            "required_role": bill.current_responsible_role.value
        }

    bill.status = trans["to_status"]
    bill.current_node = trans["to_node"]
    bill.current_responsible_role = trans["to_role"]
    bill.current_node_started_at = datetime.utcnow()
    bill.is_overdue = False
    bill.overdue_hours = 0

    log = OperationLog(
        bill_id=bill.id,
        operator_id=operator.id,
        operation=trans["operation"],
        from_status=from_status,
        to_status=trans["to_status"],
        from_node=from_node,
        to_node=trans["to_node"],
        anomaly_reason=anomaly_reason,
        remark=remark
    )
    db.add(log)
    db.commit()
    db.refresh(bill)

    return bill, {
        "success": True,
        "message": f"{trans['operation']}成功",
        "operation": trans["operation"],
        "from_status": from_status.value,
        "to_status": trans["to_status"].value,
        "next_responsible_role": trans["to_role"].value
    }


def generate_bill_no(db: Session, period: str) -> str:
    prefix = f"EB-{period}-"
    last_bill = db.query(EnergyBill).filter(
        EnergyBill.bill_no.like(f"{prefix}%")
    ).order_by(EnergyBill.bill_no.desc()).first()

    if last_bill:
        try:
            num = int(last_bill.bill_no.split("-")[-1]) + 1
        except (IndexError, ValueError):
            num = 1
    else:
        num = 1

    return f"{prefix}{num:03d}"
