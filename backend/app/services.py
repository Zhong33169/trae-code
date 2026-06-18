from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional, Tuple
from .models import (
    User, RectificationOrder, NodeRecord, OperationLog,
    QualityControl, RectificationNotice, ReviewArchive
)
from .config import STATUS, ROLES, NODE_DEADLINES, NODE_NAMES_CN
from .auth import get_password_hash

STATUS_TRANSITIONS = {
    "PENDING_SUBMIT": {
        "allowed_roles": ["DEPARTMENT_SECRETARY"],
        "allowed_actions": {
            "SUBMIT": {
                "new_status": "SUBMITTED",
                "new_node": "QUALITY_REVIEW",
                "operation_cn": "提交整改单",
            },
        },
    },
    "SUBMITTED": {
        "allowed_roles": ["QUALITY_DOCTOR"],
        "allowed_actions": {
            "APPROVE_QUALITY": {
                "new_status": "QUALITY_CHECKED",
                "new_node": "NOTICE_SEND",
                "operation_cn": "质控审核通过",
            },
            "REJECT": {
                "new_status": "REJECTED",
                "new_node": "DEPARTMENT_SUBMIT",
                "operation_cn": "退回整改单",
            },
        },
    },
    "REJECTED": {
        "allowed_roles": ["DEPARTMENT_SECRETARY"],
        "allowed_actions": {
            "RESUBMIT": {
                "new_status": "RESUBMITTED",
                "new_node": "QUALITY_REVIEW",
                "operation_cn": "重新提交",
            },
        },
    },
    "RESUBMITTED": {
        "allowed_roles": ["QUALITY_DOCTOR"],
        "allowed_actions": {
            "APPROVE_QUALITY": {
                "new_status": "QUALITY_CHECKED",
                "new_node": "NOTICE_SEND",
                "operation_cn": "质控审核通过",
            },
            "REJECT": {
                "new_status": "REJECTED",
                "new_node": "DEPARTMENT_SUBMIT",
                "operation_cn": "再次退回",
            },
        },
    },
    "QUALITY_CHECKED": {
        "allowed_roles": ["QUALITY_DOCTOR"],
        "allowed_actions": {
            "SEND_NOTICE": {
                "new_status": "NOTICE_SENT",
                "new_node": "RECTIFICATION",
                "operation_cn": "发送整改通知",
            },
        },
    },
    "NOTICE_SENT": {
        "allowed_roles": ["DEPARTMENT_SECRETARY"],
        "allowed_actions": {
            "COMPLETE_RECTIFICATION": {
                "new_status": "REVIEWED",
                "new_node": "REVIEW_ARCHIVE",
                "operation_cn": "完成整改并申请复核",
            },
        },
    },
    "REVIEWED": {
        "allowed_roles": ["QUALITY_DOCTOR"],
        "allowed_actions": {
            "APPROVE_ARCHIVE": {
                "new_status": "ARCHIVED",
                "new_node": "DIRECTOR_CONFIRM",
                "operation_cn": "复核通过并归档",
            },
            "REJECT_RECTIFICATION": {
                "new_status": "NOTICE_SENT",
                "new_node": "RECTIFICATION",
                "operation_cn": "退回重新整改",
            },
        },
    },
    "ARCHIVED": {
        "allowed_roles": ["MEDICAL_DIRECTOR"],
        "allowed_actions": {
            "CONFIRM": {
                "new_status": "CONFIRMED",
                "new_node": None,
                "operation_cn": "医务部确认完成",
            },
        },
    },
}

VISIBLE_FIELDS_BY_ROLE = {
    "DEPARTMENT_SECRETARY": [
        "id", "order_no", "patient_name", "medical_record_no", "department",
        "diagnosis", "status", "status_cn", "current_node", "current_node_cn",
        "content", "rectification_requirements", "notice_content",
        "department_secretary_name", "is_overdue", "created_at", "updated_at",
        "nodes", "logs",
    ],
    "QUALITY_DOCTOR": [
        "id", "order_no", "patient_name", "medical_record_no", "department",
        "diagnosis", "status", "status_cn", "current_node", "current_node_cn",
        "content", "rectification_requirements", "quality_opinion",
        "notice_content", "review_opinion",
        "department_secretary_name", "quality_doctor_name",
        "is_overdue", "created_at", "updated_at", "nodes", "logs",
    ],
    "MEDICAL_DIRECTOR": [
        "id", "order_no", "patient_name", "medical_record_no", "department",
        "diagnosis", "status", "status_cn", "current_node", "current_node_cn",
        "content", "rectification_requirements", "quality_opinion",
        "notice_content", "review_opinion", "director_opinion",
        "department_secretary_name", "quality_doctor_name", "medical_director_name",
        "is_overdue", "created_at", "updated_at", "nodes", "logs",
    ],
}


def init_database(db: Session):
    existing = db.query(User).count()
    if existing > 0:
        return

    users = [
        User(
            username="secretary",
            name="张秘书",
            role="DEPARTMENT_SECRETARY",
            department="内科",
            hashed_password=get_password_hash("123456"),
        ),
        User(
            username="quality",
            name="李质控",
            role="QUALITY_DOCTOR",
            department="质控科",
            hashed_password=get_password_hash("123456"),
        ),
        User(
            username="director",
            name="王主任",
            role="MEDICAL_DIRECTOR",
            department="医务部",
            hashed_password=get_password_hash("123456"),
        ),
        User(
            username="secretary2",
            name="刘秘书",
            role="DEPARTMENT_SECRETARY",
            department="外科",
            hashed_password=get_password_hash("123456"),
        ),
    ]
    db.add_all(users)
    db.flush()

    sample_orders = []
    now = datetime.utcnow()

    for i in range(1, 6):
        dept = "内科" if i % 2 == 1 else "外科"
        sec_id = users[0].id if dept == "内科" else users[3].id

        status_list = ["PENDING_SUBMIT", "PENDING_SUBMIT", "PENDING_SUBMIT", "SUBMITTED", "ARCHIVED"]
        status = status_list[i - 1]
        current_node = _get_node_by_status(status)

        create_offset = i - 1 if status == "PENDING_SUBMIT" else i * 2

        order = RectificationOrder(
            order_no=f"ZG{now.year}{str(i).zfill(4)}",
            patient_name=f"患者{i}",
            medical_record_no=f"BL{20240000 + i}",
            department=dept,
            admission_date=now - timedelta(days=i * 5),
            discharge_date=now - timedelta(days=i * 3),
            diagnosis=f"诊断{i}：高血压、糖尿病" if i % 2 == 0 else f"诊断{i}：冠心病、心绞痛",
            status=status,
            current_node=current_node,
            content=f"病历存在以下问题：{i}. 病史记录不完整；{i + 1}. 病程记录签字缺失",
            rectification_requirements=f"请于{7}日内完成整改，补充相关记录并完善签字",
            department_secretary_id=sec_id,
            quality_doctor_id=users[1].id if status != "PENDING_SUBMIT" else None,
            created_at=now - timedelta(hours=create_offset),
        )
        sample_orders.append(order)

    db.add_all(sample_orders)
    db.flush()

    for order in sample_orders:
        _initialize_order_nodes(db, order)
        if order.status != "PENDING_SUBMIT":
            _simulate_history(db, order, users)

    db.commit()


def _get_node_by_status(status: str) -> str:
    mapping = {
        "PENDING_SUBMIT": "DEPARTMENT_SUBMIT",
        "SUBMITTED": "QUALITY_REVIEW",
        "REJECTED": "DEPARTMENT_SUBMIT",
        "RESUBMITTED": "QUALITY_REVIEW",
        "QUALITY_CHECKED": "NOTICE_SEND",
        "NOTICE_SENT": "RECTIFICATION",
        "REVIEWED": "REVIEW_ARCHIVE",
        "ARCHIVED": "DIRECTOR_CONFIRM",
        "CONFIRMED": None,
    }
    return mapping.get(status, "DEPARTMENT_SUBMIT")


def _initialize_order_nodes(db: Session, order: RectificationOrder):
    nodes_config = [
        ("DEPARTMENT_SUBMIT", NODE_DEADLINES["DEPARTMENT_SUBMIT"]),
        ("QUALITY_REVIEW", NODE_DEADLINES["QUALITY_REVIEW"]),
        ("NOTICE_SEND", NODE_DEADLINES["NOTICE_SEND"]),
        ("RECTIFICATION", NODE_DEADLINES["RECTIFICATION"]),
        ("REVIEW_ARCHIVE", NODE_DEADLINES["REVIEW_ARCHIVE"]),
        ("DIRECTOR_CONFIRM", NODE_DEADLINES["DIRECTOR_CONFIRM"]),
    ]

    created_time = order.created_at
    for idx, (node_name, deadline_delta) in enumerate(nodes_config):
        node_start = created_time if idx == 0 else None
        node_deadline = (created_time + deadline_delta) if idx == 0 else None

        status = "IN_PROGRESS"
        if node_name == order.current_node:
            status = "IN_PROGRESS"
        elif _is_node_before(node_name, order.current_node):
            status = "COMPLETED"
            node_start = created_time
            node_deadline = created_time + deadline_delta
        else:
            status = "PENDING"

        node = NodeRecord(
            order_id=order.id,
            node_name=node_name,
            node_name_cn=NODE_NAMES_CN[node_name],
            started_at=node_start,
            deadline=node_deadline if node_deadline else created_time + deadline_delta,
            status=status,
            is_overdue=False,
        )
        db.add(node)

    db.flush()


def _is_node_before(node_a: str, node_b: str) -> bool:
    order = ["DEPARTMENT_SUBMIT", "QUALITY_REVIEW", "NOTICE_SEND",
             "RECTIFICATION", "REVIEW_ARCHIVE", "DIRECTOR_CONFIRM"]
    if node_a not in order or node_b not in order:
        return False
    return order.index(node_a) < order.index(node_b)


def _simulate_history(db: Session, order: RectificationOrder, users: List[User]):
    history = []
    if order.status == "SUBMITTED":
        history = [("PENDING_SUBMIT", "SUBMITTED", "DEPARTMENT_SUBMIT", "QUALITY_REVIEW", "SUBMIT", users[0])]
    elif order.status == "REJECTED":
        history = [
            ("PENDING_SUBMIT", "SUBMITTED", "DEPARTMENT_SUBMIT", "QUALITY_REVIEW", "SUBMIT", users[0]),
            ("SUBMITTED", "REJECTED", "QUALITY_REVIEW", "DEPARTMENT_SUBMIT", "REJECT", users[1]),
        ]
    elif order.status == "QUALITY_CHECKED":
        history = [
            ("PENDING_SUBMIT", "SUBMITTED", "DEPARTMENT_SUBMIT", "QUALITY_REVIEW", "SUBMIT", users[0]),
            ("SUBMITTED", "QUALITY_CHECKED", "QUALITY_REVIEW", "NOTICE_SEND", "APPROVE_QUALITY", users[1]),
        ]
    elif order.status == "ARCHIVED":
        history = [
            ("PENDING_SUBMIT", "SUBMITTED", "DEPARTMENT_SUBMIT", "QUALITY_REVIEW", "SUBMIT", users[0]),
            ("SUBMITTED", "QUALITY_CHECKED", "QUALITY_REVIEW", "NOTICE_SEND", "APPROVE_QUALITY", users[1]),
            ("QUALITY_CHECKED", "NOTICE_SENT", "NOTICE_SEND", "RECTIFICATION", "SEND_NOTICE", users[1]),
            ("NOTICE_SENT", "REVIEWED", "RECTIFICATION", "REVIEW_ARCHIVE", "COMPLETE_RECTIFICATION", users[0]),
            ("REVIEWED", "ARCHIVED", "REVIEW_ARCHIVE", "DIRECTOR_CONFIRM", "APPROVE_ARCHIVE", users[1]),
        ]

    for old_status, new_status, old_node, new_node, action, user in history:
        _record_operation(db, order, user, old_status, new_status, action, "系统初始化样例数据")
        _advance_node(db, order, old_node, new_node, user)


def check_overdue(db: Session, order: RectificationOrder) -> Dict[str, Any]:
    now = datetime.utcnow()
    current_node_record = db.query(NodeRecord).filter(
        NodeRecord.order_id == order.id,
        NodeRecord.node_name == order.current_node,
        NodeRecord.status == "IN_PROGRESS"
    ).first()

    if not current_node_record:
        return {"is_overdue": False, "current_node": None}

    is_overdue = current_node_record.deadline < now
    current_node_record.is_overdue = is_overdue
    db.flush()

    return {
        "is_overdue": is_overdue,
        "current_node": current_node_record,
        "remaining_hours": max(0, (current_node_record.deadline - now).total_seconds() / 3600),
    }


def get_allowed_actions(db: Session, order: RectificationOrder, user: User) -> List[Dict[str, str]]:
    transition = STATUS_TRANSITIONS.get(order.status, {})
    if user.role not in transition.get("allowed_roles", []):
        return []

    actions = []
    for action_key, action_info in transition.get("allowed_actions", {}).items():
        actions.append({
            "action": action_key,
            "action_cn": action_info["operation_cn"],
            "new_status": action_info["new_status"],
            "new_status_cn": STATUS.get(action_info["new_status"], action_info["new_status"]),
        })
    return actions


def validate_status_transition(
    db: Session, order: RectificationOrder, action: str, user: User
) -> Tuple[bool, str, Dict[str, Any]]:
    transition = STATUS_TRANSITIONS.get(order.status)
    if not transition:
        return False, f"当前状态 {order.status} 不支持任何操作", {}

    if user.role not in transition["allowed_roles"]:
        role_cn = ROLES.get(user.role, user.role)
        return False, f"角色[{role_cn}]无权执行此操作", {}

    action_info = transition["allowed_actions"].get(action)
    if not action_info:
        return False, f"当前状态不支持操作 [{action}]", {}

    return True, "", action_info


def update_order_status(
    db: Session,
    order: RectificationOrder,
    action: str,
    user: User,
    remark: Optional[str] = None,
    overdue_reason: Optional[str] = None,
    follow_up_action: Optional[str] = None,
    extra_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    valid, error_msg, action_info = validate_status_transition(db, order, action, user)
    if not valid:
        exc = Exception(error_msg)
        setattr(exc, "status_code", 400)
        raise exc

    old_status = order.status
    new_status = action_info["new_status"]
    new_node = action_info["new_node"]
    operation_cn = action_info["operation_cn"]

    check_result = check_overdue(db, order)
    if check_result["is_overdue"] and not overdue_reason:
        exc = Exception("该节点已超时，请填写超时原因")
        setattr(exc, "status_code", 400)
        raise exc

    if check_result["is_overdue"]:
        current_node = check_result["current_node"]
        current_node.overdue_reason = overdue_reason
        current_node.follow_up_action = follow_up_action
        db.flush()

    _update_linked_entities(db, order, action, user, extra_data)

    _advance_node(db, order, order.current_node, new_node, user)

    order.status = new_status
    order.current_node = new_node
    order.updated_at = datetime.utcnow()

    if new_node == "QUALITY_REVIEW" and not order.quality_doctor_id:
        order.quality_doctor_id = user.id
    if new_node == "DIRECTOR_CONFIRM" and not order.medical_director_id:
        order.medical_director_id = user.id

    db.flush()

    _record_operation(db, order, user, old_status, new_status, action, operation_cn, remark, {
        "overdue_reason": overdue_reason,
        "follow_up_action": follow_up_action,
        **(extra_data or {}),
    })

    return {
        "success": True,
        "message": f"{operation_cn}成功",
        "order_id": order.id,
        "old_status": old_status,
        "old_status_cn": STATUS.get(old_status, old_status),
        "new_status": new_status,
        "new_status_cn": STATUS.get(new_status, new_status),
    }


def _update_linked_entities(
    db: Session, order: RectificationOrder, action: str, user: User, extra_data: Optional[Dict[str, Any]]
):
    if not extra_data:
        return

    if action == "APPROVE_QUALITY" and extra_data.get("quality_data"):
        q_data = extra_data["quality_data"]
        if order.quality_control:
            qc = order.quality_control
        else:
            qc = QualityControl(order_id=order.id, quality_doctor_id=user.id)
            order.quality_control = qc
            db.flush()

        qc.problems_found = q_data.get("problems_found", qc.problems_found)
        qc.quality_score = q_data.get("quality_score", qc.quality_score)
        qc.check_result = q_data.get("check_result", "PASS")
        qc.checked_at = datetime.utcnow()
        qc.status = "COMPLETED"

        order.quality_opinion = q_data.get("quality_opinion", order.quality_opinion)

    if action == "REJECT" and extra_data.get("quality_data"):
        q_data = extra_data["quality_data"]
        if order.quality_control:
            qc = order.quality_control
        else:
            qc = QualityControl(order_id=order.id, quality_doctor_id=user.id)
            order.quality_control = qc
            db.flush()

        qc.problems_found = q_data.get("problems_found", qc.problems_found)
        qc.quality_score = q_data.get("quality_score", qc.quality_score)
        qc.check_result = q_data.get("check_result", "FAIL")
        qc.checked_at = datetime.utcnow()
        qc.status = "REJECTED"

        order.quality_opinion = q_data.get("quality_opinion", order.quality_opinion)

    if action == "SEND_NOTICE" and extra_data.get("notice_data"):
        n_data = extra_data["notice_data"]
        if order.rectification_notice:
            notice = order.rectification_notice
        else:
            notice = RectificationNotice(order_id=order.id, sender_id=user.id)
            order.rectification_notice = notice
            db.flush()

        notice.notice_title = n_data.get("notice_title", notice.notice_title)
        notice.notice_content = n_data.get("notice_content", notice.notice_content)
        notice.deadline = n_data.get("deadline", notice.deadline)
        notice.recipient_department = n_data.get("recipient_department", notice.recipient_department)
        notice.sent_at = datetime.utcnow()
        notice.status = "SENT"

        order.notice_content = notice.notice_content

    if action == "APPROVE_ARCHIVE" and extra_data.get("review_data"):
        r_data = extra_data["review_data"]
        if order.review_archive:
            ra = order.review_archive
        else:
            ra = ReviewArchive(order_id=order.id, reviewer_id=user.id)
            order.review_archive = ra
            db.flush()

        ra.review_opinion = r_data.get("review_opinion", ra.review_opinion)
        ra.review_result = r_data.get("review_result", "PASS")
        ra.archive_location = r_data.get("archive_location", ra.archive_location)
        ra.archived_at = datetime.utcnow()
        ra.status = "ARCHIVED"

        order.review_opinion = ra.review_opinion

    if action == "REJECT_RECTIFICATION" and extra_data.get("review_data"):
        r_data = extra_data["review_data"]
        if order.review_archive:
            ra = order.review_archive
        else:
            ra = ReviewArchive(order_id=order.id, reviewer_id=user.id)
            order.review_archive = ra
            db.flush()

        ra.review_opinion = r_data.get("review_opinion", ra.review_opinion)
        ra.review_result = r_data.get("review_result", "FAIL")
        ra.status = "REJECTED"

        order.review_opinion = ra.review_opinion

    if action == "CONFIRM" and extra_data:
        order.director_opinion = extra_data.get("director_opinion", order.director_opinion)


def _advance_node(
    db: Session, order: RectificationOrder, old_node: str, new_node: Optional[str], handler: User
):
    now = datetime.utcnow()

    if old_node:
        old_node_record = db.query(NodeRecord).filter(
            NodeRecord.order_id == order.id,
            NodeRecord.node_name == old_node
        ).first()
        if old_node_record:
            old_node_record.status = "COMPLETED"
            old_node_record.completed_at = now
            old_node_record.handler_id = handler.id
            db.flush()

    if new_node:
        new_node_record = db.query(NodeRecord).filter(
            NodeRecord.order_id == order.id,
            NodeRecord.node_name == new_node
        ).first()
        if new_node_record:
            new_node_record.status = "IN_PROGRESS"
            new_node_record.started_at = now
            new_node_record.deadline = now + NODE_DEADLINES.get(new_node, timedelta(hours=24))
            db.flush()


def _record_operation(
    db: Session,
    order: RectificationOrder,
    user: User,
    old_status: str,
    new_status: str,
    action: str,
    operation_cn: str,
    remark: Optional[str] = None,
    extra_data: Optional[Dict[str, Any]] = None,
):
    log = OperationLog(
        order_id=order.id,
        operator_id=user.id,
        operation=action,
        operation_cn=operation_cn,
        old_status=old_status,
        new_status=new_status,
        remark=remark,
        extra_data=extra_data,
    )
    db.add(log)
    db.flush()


def _serialize_datetime(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _serialize_datetime(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize_datetime(item) for item in obj]
    return obj


def serialize_order(db: Session, order: RectificationOrder, user: User, include_details: bool = False) -> Dict[str, Any]:
    check_overdue(db, order)
    is_overdue = any(n.is_overdue and n.status == "IN_PROGRESS" for n in order.nodes)

    sec = db.query(User).filter(User.id == order.department_secretary_id).first() if order.department_secretary_id else None
    qc = db.query(User).filter(User.id == order.quality_doctor_id).first() if order.quality_doctor_id else None
    md = db.query(User).filter(User.id == order.medical_director_id).first() if order.medical_director_id else None

    visible = VISIBLE_FIELDS_BY_ROLE.get(user.role, [])

    result = {
        "id": order.id,
        "order_no": order.order_no,
        "patient_name": order.patient_name,
        "medical_record_no": order.medical_record_no,
        "department": order.department,
        "diagnosis": order.diagnosis,
        "status": order.status,
        "status_cn": STATUS.get(order.status, order.status),
        "current_node": order.current_node,
        "current_node_cn": NODE_NAMES_CN.get(order.current_node, order.current_node),
        "content": order.content,
        "rectification_requirements": order.rectification_requirements,
        "quality_opinion": order.quality_opinion,
        "notice_content": order.notice_content,
        "review_opinion": order.review_opinion,
        "director_opinion": order.director_opinion,
        "department_secretary_name": sec.name if sec else None,
        "quality_doctor_name": qc.name if qc else None,
        "medical_director_name": md.name if md else None,
        "is_overdue": is_overdue,
        "created_at": order.created_at.isoformat(),
        "updated_at": order.updated_at.isoformat(),
    }

    if include_details:
        nodes = []
        for node in sorted(order.nodes, key=lambda n: n.id):
            handler = db.query(User).filter(User.id == node.handler_id).first() if node.handler_id else None
            nodes.append({
                "id": node.id,
                "node_name": node.node_name,
                "node_name_cn": node.node_name_cn,
                "started_at": node.started_at.isoformat() if node.started_at else None,
                "deadline": node.deadline.isoformat() if node.deadline else None,
                "completed_at": node.completed_at.isoformat() if node.completed_at else None,
                "is_overdue": node.is_overdue,
                "overdue_reason": node.overdue_reason,
                "follow_up_action": node.follow_up_action,
                "status": node.status,
                "handler_name": handler.name if handler else None,
            })
        result["nodes"] = nodes

        logs = []
        for log in sorted(order.logs, key=lambda l: l.id, reverse=True):
            operator = db.query(User).filter(User.id == log.operator_id).first()
            logs.append({
                "id": log.id,
                "operation": log.operation,
                "operation_cn": log.operation_cn,
                "old_status": log.old_status,
                "new_status": log.new_status,
                "old_status_cn": STATUS.get(log.old_status, log.old_status) if log.old_status else None,
                "new_status_cn": STATUS.get(log.new_status, log.new_status) if log.new_status else None,
                "operator_name": operator.name if operator else "系统",
                "remark": log.remark,
                "extra_data": log.extra_data,
                "created_at": log.created_at.isoformat(),
            })
        result["logs"] = logs

        result["allowed_actions"] = get_allowed_actions(db, order, user)

    return {k: v for k, v in result.items() if k in visible or k == "allowed_actions"}


def get_order_list(
    db: Session,
    user: User,
    status: Optional[str] = None,
    department: Optional[str] = None,
    is_overdue: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
) -> Dict[str, Any]:
    query = db.query(RectificationOrder)

    if user.role == "DEPARTMENT_SECRETARY":
        query = query.filter(RectificationOrder.department == user.department)

    if status:
        query = query.filter(RectificationOrder.status == status)

    if department and user.role != "DEPARTMENT_SECRETARY":
        query = query.filter(RectificationOrder.department == department)

    total = query.count()

    orders = query.order_by(RectificationOrder.updated_at.desc()).offset(skip).limit(limit).all()

    items = []
    overdue_count = 0
    for order in orders:
        serialized = serialize_order(db, order, user, include_details=False)
        serialized["allowed_actions"] = get_allowed_actions(db, order, user)
        if serialized.get("is_overdue"):
            overdue_count += 1
        if is_overdue is None or serialized.get("is_overdue") == is_overdue:
            items.append(serialized)

    stats = get_statistics(db, user)

    return {
        "items": items,
        "total": total if is_overdue is None else len(items),
        "page": skip // limit + 1,
        "page_size": limit,
        "overdue_count": overdue_count,
        "statistics": stats,
    }


def get_statistics(db: Session, user: User) -> Dict[str, Any]:
    from sqlalchemy import func

    query = db.query(RectificationOrder)

    if user.role == "DEPARTMENT_SECRETARY":
        query = query.filter(RectificationOrder.department == user.department)

    total = query.count()

    by_status = {}
    status_counts = query.with_entities(
        RectificationOrder.status, func.count(RectificationOrder.id)
    ).group_by(RectificationOrder.status).all()
    for s, count in status_counts:
        by_status[s] = count
        by_status[STATUS.get(s, s)] = count

    by_dept = {}
    dept_counts = query.with_entities(
        RectificationOrder.department, func.count(RectificationOrder.id)
    ).group_by(RectificationOrder.department).all()
    for d, count in dept_counts:
        by_dept[d] = count

    overdue_count = 0
    pending_my_action = 0

    for order in query.all():
        check_overdue(db, order)
        for node in order.nodes:
            if node.is_overdue and node.status == "IN_PROGRESS":
                overdue_count += 1
                break

        transition = STATUS_TRANSITIONS.get(order.status, {})
        if user.role in transition.get("allowed_roles", []):
            pending_my_action += 1

    return {
        "total": total,
        "by_status": by_status,
        "by_department": by_dept,
        "overdue_count": overdue_count,
        "pending_my_action": pending_my_action,
    }


def batch_update_status(
    db: Session,
    order_ids: List[int],
    action: str,
    user: User,
    remark: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    results = []
    success_count = 0
    failed_count = 0
    valid_orders = []
    status_set = set()

    for order_id in order_ids:
        order = db.query(RectificationOrder).filter(RectificationOrder.id == order_id).first()
        if not order:
            results.append({
                "order_id": order_id,
                "success": False,
                "message": "整改单不存在",
            })
            failed_count += 1
            continue

        if user.role == "DEPARTMENT_SECRETARY" and order.department != user.department:
            results.append({
                "order_id": order_id,
                "order_no": order.order_no,
                "success": False,
                "message": "科室秘书不能操作其他科室的订单",
            })
            failed_count += 1
            continue

        valid, error_msg, _ = validate_status_transition(db, order, action, user)
        if not valid:
            results.append({
                "order_id": order_id,
                "order_no": order.order_no,
                "success": False,
                "message": error_msg,
            })
            failed_count += 1
            continue

        valid_orders.append(order)
        status_set.add(order.status)

    if len(status_set) > 1:
        for order in valid_orders:
            results.append({
                "order_id": order.id,
                "order_no": order.order_no,
                "success": False,
                "message": "批量操作必须同一状态",
            })
            failed_count += 1
        valid_orders = []

    for order in valid_orders:
        try:
            result = update_order_status(
                db, order, action, user,
                remark=remark,
                overdue_reason=data.get("overdue_reason") if data else None,
                follow_up_action=data.get("follow_up_action") if data else None,
                extra_data=data,
            )
            results.append({
                "order_id": order.id,
                "order_no": order.order_no,
                "success": True,
                **result,
            })
            success_count += 1
        except Exception as e:
            db.rollback()
            results.append({
                "order_id": order.id,
                "order_no": order.order_no,
                "success": False,
                "message": str(e),
            })
            failed_count += 1

    if valid_orders and success_count > 0:
        db.commit()

    return {
        "success_count": success_count,
        "failed_count": failed_count,
        "total_count": len(order_ids),
        "results": results,
    }


def get_operation_logs(
    db: Session,
    order_id: Optional[int] = None,
    user: User = None,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    query = db.query(OperationLog)

    if order_id:
        query = query.filter(OperationLog.order_id == order_id)

    total = query.count()
    logs = query.order_by(OperationLog.created_at.desc()).offset(skip).limit(limit).all()

    items = []
    for log in logs:
        operator = db.query(User).filter(User.id == log.operator_id).first()
        items.append({
            "id": log.id,
            "order_id": log.order_id,
            "order_no": log.order.order_no if log.order else None,
            "operation": log.operation,
            "operation_cn": log.operation_cn,
            "old_status": log.old_status,
            "new_status": log.new_status,
            "old_status_cn": STATUS.get(log.old_status, log.old_status) if log.old_status else None,
            "new_status_cn": STATUS.get(log.new_status, log.new_status) if log.new_status else None,
            "operator_name": operator.name if operator else "系统",
            "operator_role": ROLES.get(operator.role, operator.role) if operator else None,
            "remark": log.remark,
            "extra_data": log.extra_data,
            "created_at": log.created_at.isoformat(),
        })

    return {
        "items": items,
        "total": total,
        "page": skip // limit + 1,
        "page_size": limit,
    }


def create_order(db: Session, data: Dict[str, Any], user: User) -> Dict[str, Any]:
    now = datetime.utcnow()
    order_no = f"ZG{now.year}{str(db.query(RectificationOrder).count() + 1).zfill(4)}"

    order = RectificationOrder(
        order_no=order_no,
        patient_name=data["patient_name"],
        medical_record_no=data["medical_record_no"],
        department=user.department if user.role == "DEPARTMENT_SECRETARY" else data.get("department", ""),
        diagnosis=data.get("diagnosis", ""),
        content=data.get("content", ""),
        rectification_requirements=data.get("rectification_requirements", ""),
        status="PENDING_SUBMIT",
        current_node="DEPARTMENT_SUBMIT",
        department_secretary_id=user.id if user.role == "DEPARTMENT_SECRETARY" else None,
    )
    db.add(order)
    db.flush()

    _initialize_order_nodes(db, order)

    _record_operation(db, order, user, None, "PENDING_SUBMIT", "CREATE", "创建整改单", "新建整改单")

    db.commit()
    db.refresh(order)

    return serialize_order(db, order, user, include_details=True)
