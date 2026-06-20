from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple, Union
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    User, Equipment, InspectionOrder, OperationRecord, RiskLevelChange,
    FaultReport, RecoveryConfirm, UserRole, InspectionStatus, RiskLevel,
    InspectionResult, OperationType
)
from ..schemas import (
    InspectionOrderInitiate, InspectionOrderHandle, InspectionOrderReview,
    InspectionOrderReturn, RiskLevelChangeRequest, InspectionOrderSubmitRequest,
    FaultReportCreate, RecoveryConfirmCreate, StatisticsResponse,
    InspectionOrderListItem, InspectionOrderDetail, OperationRecord as OpRecordSchema,
    RiskLevelChange as RiskChangeSchema, FaultReport as FaultReportSchema,
    RecoveryConfirm as RecoveryConfirmSchema, QueueItem, ApiResponse
)


class ValidationError(Exception):
    def __init__(self, message: str, error_type: str = "validation_error"):
        self.message = message
        self.error_type = error_type
        super().__init__(message)


def generate_order_no(db: Session) -> str:
    prefix = f"INSP{datetime.now().strftime('%Y%m%d')}"
    count = db.query(InspectionOrder).filter(
        InspectionOrder.order_no.like(f"{prefix}%")
    ).count()
    return f"{prefix}{(count + 1):04d}"


def _add_operation_record(
    db: Session,
    order: InspectionOrder,
    operator_id: int,
    operation_type: OperationType,
    from_status: Optional[InspectionStatus] = None,
    to_status: Optional[InspectionStatus] = None,
    from_risk: Optional[RiskLevel] = None,
    to_risk: Optional[RiskLevel] = None,
    opinion: Optional[str] = None,
    result: Optional[str] = None,
    remark: Optional[str] = None,
    version: Optional[int] = None,
) -> OperationRecord:
    record = OperationRecord(
        inspection_order_id=order.id,
        operator_id=operator_id,
        operation_type=operation_type,
        from_status=from_status,
        to_status=to_status,
        from_risk_level=from_risk,
        to_risk_level=to_risk,
        opinion=opinion,
        result=result,
        remark=remark,
        version=version or order.version,
        operated_at=datetime.utcnow(),
    )
    db.add(record)
    return record


def _validate_submission(
    db: Session,
    order: InspectionOrder,
    current_user_id: int,
    expected_role: UserRole,
    expected_status: Union[InspectionStatus, List[InspectionStatus]],
    version: int,
    required_evidences: Optional[List[str]] = None,
) -> None:
    if order.version != version:
        raise ValidationError(
            f"版本冲突：当前版本为 {order.version}，您提交的版本为 {version}，请刷新后重试",
            "version_conflict"
        )

    expected_list = expected_status if isinstance(expected_status, list) else [expected_status]
    if order.status not in expected_list:
        expected_vals = ", ".join(s.value for s in expected_list)
        raise ValidationError(
            f"状态冲突：当前状态为 {order.status.value}，预期状态为 {expected_vals}",
            "status_conflict"
        )

    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        raise ValidationError("操作人不存在", "user_not_found")

    if user.role != expected_role:
        raise ValidationError(
            f"角色不匹配：当前角色为 {user.role.value}，需要 {expected_role.value} 角色",
            "role_mismatch"
        )

    if expected_role == UserRole.HANDLER and order.current_handler_id != current_user_id:
        raise ValidationError(
            "您不是当前办理人，无法执行此操作",
            "handler_mismatch"
        )

    if required_evidences:
        missing_evidences = []
        for evidence_field in required_evidences:
            value = getattr(order, evidence_field, None)
            if not value:
                missing_evidences.append(evidence_field)
        if missing_evidences:
            raise ValidationError(
                f"缺少必填证据：{', '.join(missing_evidences)}",
                "missing_evidence"
            )


def _determine_inspection_result(order: InspectionOrder) -> InspectionResult:
    checks = [
        order.appearance_check,
        order.function_check,
        order.safety_check,
        order.maintenance_check,
    ]
    if all(c is True for c in checks):
        return InspectionResult.NORMAL
    elif any(c is False for c in checks):
        return InspectionResult.ABNORMAL
    elif not all(c is not None for c in checks):
        return InspectionResult.MISSING_EVIDENCE
    return InspectionResult.NORMAL


def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_equipment(db: Session, equipment_id: int) -> Optional[Equipment]:
    return db.query(Equipment).filter(Equipment.id == equipment_id).first()


def _enrich_order_list_item(db: Session, order: InspectionOrder) -> InspectionOrderListItem:
    initiator = get_user(db, order.initiator_id)
    handler = get_user(db, order.current_handler_id) if order.current_handler_id else None
    equipment = get_equipment(db, order.equipment_id)

    is_overdue = False
    if order.due_date and order.status != InspectionStatus.ARCHIVED:
        is_overdue = datetime.utcnow() > order.due_date

    has_fault = db.query(FaultReport).filter(
        FaultReport.inspection_order_id == order.id,
        FaultReport.is_resolved == False
    ).first() is not None

    risk_change_count = db.query(RiskLevelChange).filter(
        RiskLevelChange.inspection_order_id == order.id
    ).count()

    fault_report_count = db.query(FaultReport).filter(
        FaultReport.inspection_order_id == order.id
    ).count()

    recovery_confirm_count = db.query(RecoveryConfirm).filter(
        RecoveryConfirm.inspection_order_id == order.id
    ).count()

    reviewer_name = None
    reviewer_ops = db.query(OperationRecord).filter(
        OperationRecord.inspection_order_id == order.id,
        OperationRecord.operation_type.in_([
            OperationType.REVIEW, OperationType.ARCHIVE, OperationType.RETURN
        ])
    ).order_by(OperationRecord.operated_at.desc()).first()
    if reviewer_ops:
        r_user = get_user(db, reviewer_ops.operator_id)
        if r_user:
            reviewer_name = r_user.name

    return InspectionOrderListItem(
        id=order.id,
        order_no=order.order_no,
        equipment_id=order.equipment_id,
        equipment_name=equipment.name if equipment else "未知设备",
        equipment_code=equipment.code if equipment else "N/A",
        equipment_location=equipment.location if equipment else "未知位置",
        equipment_specification=equipment.specification if equipment else None,
        equipment_model=equipment.specification if equipment else None,
        location_detail=equipment.location if equipment else None,
        initiator_id=order.initiator_id,
        initiator_name=initiator.name if initiator else "未知",
        inspector_name=initiator.name if initiator else None,
        current_handler_id=order.current_handler_id,
        current_handler_name=handler.name if handler else None,
        handler_name=handler.name if handler else None,
        reviewer_name=reviewer_name,
        status=order.status,
        risk_level=order.risk_level,
        inspection_result=order.inspection_result,
        inspection_date=order.inspection_date,
        due_date=order.due_date,
        inspection_remark=order.inspection_remark,
        last_handler_opinion=order.last_handler_opinion,
        last_handler_result=order.last_handler_result,
        handler_opinion=order.handler_opinion,
        handler_result=order.handler_result,
        last_reviewer_opinion=order.last_reviewer_opinion,
        last_reviewer_result=order.last_reviewer_result,
        reviewer_opinion=order.reviewer_opinion,
        reviewer_result=order.reviewer_result,
        version=order.version,
        created_at=order.created_at,
        updated_at=order.updated_at,
        is_overdue=is_overdue,
        has_fault=has_fault,
        risk_change_count=risk_change_count,
        fault_report_count=fault_report_count,
        recovery_confirm_count=recovery_confirm_count,
    )


def get_inspection_order_list(
    db: Session,
    status: Optional[InspectionStatus] = None,
    risk_level: Optional[RiskLevel] = None,
    location: Optional[str] = None,
    current_user_id: Optional[int] = None,
    role: Optional[UserRole] = None,
) -> List[InspectionOrderListItem]:
    query = db.query(InspectionOrder)

    if status:
        query = query.filter(InspectionOrder.status == status)
    if risk_level:
        query = query.filter(InspectionOrder.risk_level == risk_level)
    if location:
        equipment_ids = db.query(Equipment.id).filter(Equipment.location.like(f"%{location}%")).subquery()
        query = query.filter(InspectionOrder.equipment_id.in_(equipment_ids))

    if role == UserRole.INSPECTOR and current_user_id:
        query = query.filter(InspectionOrder.initiator_id == current_user_id)
    elif role == UserRole.HANDLER and current_user_id:
        query = query.filter(
            (InspectionOrder.status == InspectionStatus.PENDING_HANDLING) |
            (InspectionOrder.status == InspectionStatus.IN_PROGRESS) &
            (InspectionOrder.current_handler_id == current_user_id)
        )
    elif role == UserRole.REVIEWER and current_user_id:
        query = query.filter(InspectionOrder.status == InspectionStatus.PENDING_REVIEW)

    orders = query.order_by(InspectionOrder.updated_at.desc()).all()
    return [_enrich_order_list_item(db, order) for order in orders]


def get_inspection_order_detail(db: Session, order_id: int) -> Optional[InspectionOrderDetail]:
    order = db.query(InspectionOrder).filter(InspectionOrder.id == order_id).first()
    if not order:
        return None

    list_item = _enrich_order_list_item(db, order)

    op_records = db.query(OperationRecord).filter(
        OperationRecord.inspection_order_id == order_id
    ).order_by(OperationRecord.operated_at.desc()).all()

    op_schemas = []
    for rec in op_records:
        operator = get_user(db, rec.operator_id)
        op_schemas.append(OpRecordSchema(
            id=rec.id,
            inspection_order_id=rec.inspection_order_id,
            operator_id=rec.operator_id,
            operator_name=operator.name if operator else None,
            operation_type=rec.operation_type,
            from_status=rec.from_status,
            to_status=rec.to_status,
            from_risk_level=rec.from_risk_level,
            to_risk_level=rec.to_risk_level,
            opinion=rec.opinion,
            result=rec.result,
            remark=rec.remark,
            version=rec.version,
            operated_at=rec.operated_at,
        ))

    risk_changes = db.query(RiskLevelChange).filter(
        RiskLevelChange.inspection_order_id == order_id
    ).order_by(RiskLevelChange.changed_at.desc()).all()

    risk_schemas = []
    for rc in risk_changes:
        operator = get_user(db, rc.operator_id)
        risk_schemas.append(RiskChangeSchema(
            id=rc.id,
            inspection_order_id=rc.inspection_order_id,
            operator_id=rc.operator_id,
            operator_name=operator.name if operator else None,
            from_level=rc.from_level,
            to_level=rc.to_level,
            reason=rc.reason,
            changed_at=rc.changed_at,
        ))

    fault_reports = db.query(FaultReport).filter(
        FaultReport.inspection_order_id == order_id
    ).order_by(FaultReport.reported_at.desc()).all()

    fault_schemas = []
    for fr in fault_reports:
        reporter = get_user(db, fr.reported_by)
        resolver = get_user(db, fr.resolved_by) if fr.resolved_by else None
        fault_schemas.append(FaultReportSchema(
            id=fr.id,
            inspection_order_id=fr.inspection_order_id,
            fault_description=fr.fault_description,
            fault_level=fr.fault_level,
            reported_by=fr.reported_by,
            reported_by_name=reporter.name if reporter else None,
            reported_at=fr.reported_at,
            is_resolved=fr.is_resolved,
            resolved_by=fr.resolved_by,
            resolved_by_name=resolver.name if resolver else None,
            resolved_at=fr.resolved_at,
            resolution=fr.resolution,
        ))

    recovery_records = db.query(RecoveryConfirm).filter(
        RecoveryConfirm.inspection_order_id == order_id
    ).order_by(RecoveryConfirm.confirmed_at.desc()).all()

    recovery_schemas = []
    for rc in recovery_records:
        confirmer = get_user(db, rc.confirmed_by)
        recovery_schemas.append(RecoveryConfirmSchema(
            id=rc.id,
            fault_report_id=rc.fault_report_id,
            inspection_order_id=rc.inspection_order_id,
            confirmation_remark=rc.confirmation_remark,
            is_successful=rc.is_successful,
            evidence_path=rc.evidence_path,
            confirmed_by=rc.confirmed_by,
            confirmed_by_name=confirmer.name if confirmer else None,
            confirmed_at=rc.confirmed_at,
        ))

    return InspectionOrderDetail(
        **list_item.model_dump(),
        appearance_check=order.appearance_check,
        appearance_evidence=order.appearance_evidence,
        appearance_remark=order.appearance_remark,
        function_check=order.function_check,
        function_evidence=order.function_evidence,
        function_remark=order.function_remark,
        safety_check=order.safety_check,
        safety_evidence=order.safety_evidence,
        safety_remark=order.safety_remark,
        maintenance_check=order.maintenance_check,
        maintenance_evidence=order.maintenance_evidence,
        maintenance_remark=order.maintenance_remark,
        operation_records=op_schemas,
        risk_changes=risk_schemas,
        fault_reports=fault_schemas,
        recovery_confirms=recovery_schemas,
    )


def initiate_inspection(
    db: Session,
    data: InspectionOrderInitiate,
    initiator_id: int,
) -> Tuple[Optional[InspectionOrderDetail], Optional[str]]:
    try:
        initiator = get_user(db, initiator_id)
        if not initiator or initiator.role != UserRole.INSPECTOR:
            return None, "只有巡检员可以发起巡检单"

        equipment = get_equipment(db, data.equipment_id)
        if not equipment:
            return None, "设备不存在"

        for check_field in ['appearance_check', 'function_check', 'safety_check', 'maintenance_check']:
            check_value = getattr(data, check_field)
            evidence_field = check_field.replace('_check', '_evidence')
            evidence_value = getattr(data, evidence_field)
            if check_value is False and not evidence_value:
                return None, f"检查项 {check_field} 不通过时必须提供证据"

        handler = db.query(User).filter(User.role == UserRole.HANDLER).first()
        if not handler:
            return None, "系统中没有办理员，无法分配"

        order = InspectionOrder(
            order_no=generate_order_no(db),
            equipment_id=data.equipment_id,
            initiator_id=initiator_id,
            current_handler_id=handler.id,
            status=InspectionStatus.PENDING_HANDLING,
            risk_level=data.risk_level,
            inspection_date=data.inspection_date,
            due_date=data.due_date,
            appearance_check=data.appearance_check,
            appearance_evidence=data.appearance_evidence,
            appearance_remark=data.appearance_remark,
            function_check=data.function_check,
            function_evidence=data.function_evidence,
            function_remark=data.function_remark,
            safety_check=data.safety_check,
            safety_evidence=data.safety_evidence,
            safety_remark=data.safety_remark,
            maintenance_check=data.maintenance_check,
            maintenance_evidence=data.maintenance_evidence,
            maintenance_remark=data.maintenance_remark,
            inspection_result=_determine_inspection_result(
                InspectionOrder(
                    appearance_check=data.appearance_check,
                    function_check=data.function_check,
                    safety_check=data.safety_check,
                    maintenance_check=data.maintenance_check,
                )
            ),
            version=1,
        )

        db.add(order)
        db.flush()

        _add_operation_record(
            db, order, initiator_id, OperationType.INITIATE,
            from_status=InspectionStatus.DRAFT,
            to_status=InspectionStatus.PENDING_HANDLING,
            opinion="发起巡检",
            result="巡检单已提交",
            version=1,
        )

        equipment.last_inspection_date = datetime.utcnow()

        db.commit()
        return get_inspection_order_detail(db, order.id), None

    except Exception as e:
        db.rollback()
        return None, str(e)


def handle_inspection(
    db: Session,
    order_id: int,
    data: InspectionOrderHandle,
    handler_id: int,
) -> Tuple[Optional[InspectionOrderDetail], Optional[str]]:
    order = db.query(InspectionOrder).filter(InspectionOrder.id == order_id).first()
    if not order:
        return None, "巡检单不存在"

    original_status = order.status
    original_risk = order.risk_level

    try:
        _validate_submission(
            db, order, handler_id,
            expected_role=UserRole.HANDLER,
            expected_status=[
                InspectionStatus.PENDING_HANDLING,
                InspectionStatus.IN_PROGRESS,
                InspectionStatus.RETURNED,
            ],
            version=data.version,
            required_evidences=None,
        )

        for check_field in ['appearance_check', 'function_check', 'safety_check', 'maintenance_check']:
            check_value = getattr(data, check_field)
            evidence_field = check_field.replace('_check', '_evidence')
            evidence_value = getattr(data, evidence_field, None)
            if check_value is False and not evidence_value:
                raise ValidationError(
                    f"检查项 {check_field} 不通过时必须提供证据（{evidence_field}）",
                    "missing_evidence"
                )

        if data.new_risk_level and data.new_risk_level != original_risk:
            if not data.risk_change_reason:
                raise ValidationError("风险等级变更必须提供原因")

            risk_change = RiskLevelChange(
                inspection_order_id=order.id,
                operator_id=handler_id,
                from_level=original_risk,
                to_level=data.new_risk_level,
                reason=data.risk_change_reason,
            )
            db.add(risk_change)

            order.risk_level = data.new_risk_level

            risk_op_type = OperationType.RISK_UPGRADE if data.new_risk_level.value > original_risk.value else OperationType.RISK_DOWNGRADE
            _add_operation_record(
                db, order, handler_id, risk_op_type,
                from_risk=original_risk,
                to_risk=data.new_risk_level,
                opinion=data.risk_change_reason,
                result=f"风险等级从 {original_risk.value} 变更为 {data.new_risk_level.value}",
                version=order.version,
            )

        update_fields = [
            'appearance_check', 'appearance_evidence', 'appearance_remark',
            'function_check', 'function_evidence', 'function_remark',
            'safety_check', 'safety_evidence', 'safety_remark',
            'maintenance_check', 'maintenance_evidence', 'maintenance_remark',
        ]
        for field in update_fields:
            value = getattr(data, field, None)
            if value is not None:
                setattr(order, field, value)

        order.last_handler_opinion = order.handler_opinion
        order.last_handler_result = order.handler_result
        order.handler_opinion = data.handler_opinion
        order.handler_result = data.handler_result
        order.handled_at = datetime.utcnow()
        order.status = InspectionStatus.PENDING_REVIEW
        order.inspection_result = _determine_inspection_result(order)
        order.version += 1

        reviewer = db.query(User).filter(User.role == UserRole.REVIEWER).first()
        if reviewer:
            order.current_handler_id = reviewer.id

        _add_operation_record(
            db, order, handler_id, OperationType.HANDLE,
            from_status=original_status,
            to_status=InspectionStatus.PENDING_REVIEW,
            opinion=data.handler_opinion,
            result=data.handler_result,
            version=order.version,
        )

        db.commit()
        return get_inspection_order_detail(db, order.id), None

    except ValidationError as e:
        _add_operation_record(
            db, order, handler_id, OperationType.HANDLE,
            from_status=original_status,
            to_status=original_status,
            opinion="办理失败",
            result=e.message,
            remark=f"错误类型: {e.error_type}",
            version=order.version,
        )
        db.commit()
        return None, e.message
    except Exception as e:
        db.rollback()
        return None, str(e)


def review_inspection(
    db: Session,
    order_id: int,
    data: InspectionOrderReview,
    reviewer_id: int,
) -> Tuple[Optional[InspectionOrderDetail], Optional[str]]:
    order = db.query(InspectionOrder).filter(InspectionOrder.id == order_id).first()
    if not order:
        return None, "巡检单不存在"

    original_status = order.status

    try:
        _validate_submission(
            db, order, reviewer_id,
            expected_role=UserRole.REVIEWER,
            expected_status=InspectionStatus.PENDING_REVIEW,
            version=data.version,
        )

        order.last_reviewer_opinion = order.reviewer_opinion
        order.last_reviewer_result = order.reviewer_result
        order.reviewer_opinion = data.reviewer_opinion
        order.reviewer_result = data.reviewer_result
        order.reviewed_at = datetime.utcnow()
        order.version += 1

        if data.is_approved:
            order.status = InspectionStatus.ARCHIVED
            result_status = InspectionStatus.ARCHIVED
            op_type = OperationType.ARCHIVE
        else:
            order.status = InspectionStatus.RETURNED
            result_status = InspectionStatus.RETURNED
            op_type = OperationType.RETURN
            order.inspection_result = InspectionResult.RETURNED

            handler = db.query(User).filter(User.role == UserRole.HANDLER).first()
            if handler:
                order.current_handler_id = handler.id

        _add_operation_record(
            db, order, reviewer_id, op_type,
            from_status=original_status,
            to_status=result_status,
            opinion=data.reviewer_opinion,
            result=data.reviewer_result,
            version=order.version,
        )

        db.commit()
        return get_inspection_order_detail(db, order.id), None

    except ValidationError as e:
        _add_operation_record(
            db, order, reviewer_id, OperationType.REVIEW,
            from_status=original_status,
            to_status=original_status,
            opinion="复核失败",
            result=e.message,
            remark=f"错误类型: {e.error_type}",
            version=order.version,
        )
        db.commit()
        return None, e.message
    except Exception as e:
        db.rollback()
        return None, str(e)


def return_inspection(
    db: Session,
    order_id: int,
    data: InspectionOrderReturn,
    reviewer_id: int,
) -> Tuple[Optional[InspectionOrderDetail], Optional[str]]:
    order = db.query(InspectionOrder).filter(InspectionOrder.id == order_id).first()
    if not order:
        return None, "巡检单不存在"

    original_status = order.status

    try:
        _validate_submission(
            db, order, reviewer_id,
            expected_role=UserRole.REVIEWER,
            expected_status=InspectionStatus.PENDING_REVIEW,
            version=data.version,
        )

        order.status = InspectionStatus.RETURNED
        order.inspection_result = InspectionResult.RETURNED
        order.version += 1
        order.last_handler_opinion = order.handler_opinion
        order.last_handler_result = order.handler_result
        order.last_reviewer_opinion = order.reviewer_opinion
        order.last_reviewer_result = order.reviewer_result
        order.reviewer_opinion = data.opinion
        order.reviewer_result = "退回补正"
        order.reviewed_at = datetime.utcnow()

        handler = db.query(User).filter(User.role == UserRole.HANDLER).first()
        if handler:
            order.current_handler_id = handler.id

        _add_operation_record(
            db, order, reviewer_id, OperationType.RETURN,
            from_status=original_status,
            to_status=InspectionStatus.RETURNED,
            opinion=data.opinion,
            result="退回补正",
            version=order.version,
        )

        db.commit()
        return get_inspection_order_detail(db, order.id), None

    except ValidationError as e:
        _add_operation_record(
            db, order, reviewer_id, OperationType.RETURN,
            from_status=original_status,
            to_status=original_status,
            opinion="退回失败",
            result=e.message,
            version=order.version,
        )
        db.commit()
        return None, e.message
    except Exception as e:
        db.rollback()
        return None, str(e)


def change_risk_level(
    db: Session,
    order_id: int,
    data: RiskLevelChangeRequest,
    operator_id: int,
) -> Tuple[Optional[InspectionOrderDetail], Optional[str]]:
    order = db.query(InspectionOrder).filter(InspectionOrder.id == order_id).first()
    if not order:
        return None, "巡检单不存在"

    original_risk = order.risk_level
    original_status = order.status

    try:
        user = db.query(User).filter(User.id == operator_id).first()
        if not user:
            raise ValidationError("操作人不存在", "user_not_found")

        if user.role not in (UserRole.HANDLER, UserRole.REVIEWER):
            raise ValidationError(
                f"角色不匹配：当前角色为 {user.role.value}，需要 handler 或 reviewer 角色",
                "role_mismatch"
            )

        if order.version != data.version:
            raise ValidationError(
                f"版本冲突：当前版本为 {order.version}，您提交的版本为 {data.version}",
                "version_conflict"
            )

        if data.new_risk_level == original_risk:
            return None, "风险等级未发生变化"

        risk_change = RiskLevelChange(
            inspection_order_id=order.id,
            operator_id=operator_id,
            from_level=original_risk,
            to_level=data.new_risk_level,
            reason=data.reason,
        )
        db.add(risk_change)

        order.risk_level = data.new_risk_level
        order.version += 1

        op_type = OperationType.RISK_UPGRADE if data.new_risk_level.value > original_risk.value else OperationType.RISK_DOWNGRADE
        _add_operation_record(
            db, order, operator_id, op_type,
            from_risk=original_risk,
            to_risk=data.new_risk_level,
            opinion=data.reason,
            result=f"风险等级从 {original_risk.value} 变更为 {data.new_risk_level.value}",
            version=order.version,
        )

        db.commit()
        return get_inspection_order_detail(db, order.id), None

    except ValidationError as e:
        _add_operation_record(
            db, order, operator_id, OperationType.HANDLE,
            from_status=original_status,
            to_status=original_status,
            from_risk=original_risk,
            to_risk=original_risk,
            opinion="风险变更失败",
            result=e.message,
            remark=f"错误类型: {e.error_type}",
            version=order.version,
        )
        db.commit()
        return None, e.message
    except Exception as e:
        db.rollback()
        return None, str(e)


def create_fault_report(
    db: Session,
    data: FaultReportCreate,
    reporter_id: int,
) -> Tuple[Optional[FaultReportSchema], Optional[str]]:
    order = db.query(InspectionOrder).filter(
        InspectionOrder.id == data.inspection_order_id
    ).first()
    if not order:
        return None, "巡检单不存在"

    original_status = order.status
    original_risk = order.risk_level

    try:
        user = db.query(User).filter(User.id == reporter_id).first()
        if not user:
            raise ValidationError("报告人不存在", "user_not_found")
        if user.role not in (UserRole.INSPECTOR, UserRole.HANDLER):
            raise ValidationError(
                f"角色不匹配：当前角色为 {user.role.value}，需要 inspector 或 handler 角色",
                "role_mismatch"
            )

        if order.version != data.version:
            raise ValidationError(
                f"版本冲突：当前版本为 {order.version}，您提交的版本为 {data.version}，请刷新后重试",
                "version_conflict"
            )

        if order.status == InspectionStatus.ARCHIVED:
            raise ValidationError("已归档的巡检单不能再报修故障", "status_conflict")

        fault = FaultReport(
            inspection_order_id=data.inspection_order_id,
            fault_description=data.fault_description,
            fault_level=data.fault_level,
            reported_by=reporter_id,
        )
        db.add(fault)
        db.flush()

        _add_operation_record(
            db, order, reporter_id, OperationType.REPORT_FAULT,
            opinion=data.fault_description,
            result=f"故障报修，等级：{data.fault_level.value}",
            version=order.version,
        )

        if data.fault_level == RiskLevel.HIGH and order.risk_level != RiskLevel.HIGH:
            original_risk = order.risk_level
            risk_change = RiskLevelChange(
                inspection_order_id=order.id,
                operator_id=reporter_id,
                from_level=original_risk,
                to_level=RiskLevel.HIGH,
                reason=f"因故障报修自动升级：{data.fault_description}",
            )
            db.add(risk_change)
            order.risk_level = RiskLevel.HIGH
            order.version += 1

            _add_operation_record(
                db, order, reporter_id, OperationType.RISK_UPGRADE,
                from_risk=original_risk,
                to_risk=RiskLevel.HIGH,
                opinion="故障报修自动升级",
                result="风险等级自动升级为高风险",
                version=order.version,
            )

        db.commit()

        reporter = get_user(db, reporter_id)
        return FaultReportSchema(
            id=fault.id,
            inspection_order_id=fault.inspection_order_id,
            fault_description=fault.fault_description,
            fault_level=fault.fault_level,
            reported_by=fault.reported_by,
            reported_by_name=reporter.name if reporter else None,
            reported_at=fault.reported_at,
            is_resolved=fault.is_resolved,
        ), None

    except ValidationError as e:
        _add_operation_record(
            db, order, reporter_id, OperationType.REPORT_FAULT,
            from_status=original_status,
            to_status=original_status,
            from_risk=original_risk,
            to_risk=original_risk,
            opinion="故障报修失败",
            result=e.message,
            remark=f"错误类型: {e.error_type}",
            version=order.version,
        )
        db.commit()
        return None, e.message
    except Exception as e:
        db.rollback()
        return None, str(e)


def confirm_recovery(
    db: Session,
    data: RecoveryConfirmCreate,
    confirmer_id: int,
) -> Tuple[Optional[RecoveryConfirmSchema], Optional[str]]:
    fault = db.query(FaultReport).filter(
        FaultReport.id == data.fault_report_id
    ).first()
    if not fault:
        return None, "故障报告不存在"

    if fault.is_resolved:
        return None, "该故障已确认恢复"

    order = db.query(InspectionOrder).filter(
        InspectionOrder.id == (data.inspection_order_id or fault.inspection_order_id)
    ).first()
    if not order:
        return None, "巡检单不存在"

    original_status = order.status
    original_risk = order.risk_level

    try:
        user = db.query(User).filter(User.id == confirmer_id).first()
        if not user:
            raise ValidationError("确认人不存在", "user_not_found")
        if user.role not in (UserRole.HANDLER, UserRole.REVIEWER):
            raise ValidationError(
                f"角色不匹配：当前角色为 {user.role.value}，需要 handler 或 reviewer 角色",
                "role_mismatch"
            )

        if order.version != data.version:
            raise ValidationError(
                f"版本冲突：当前版本为 {order.version}，您提交的版本为 {data.version}，请刷新后重试",
                "version_conflict"
            )

        if order.status == InspectionStatus.ARCHIVED:
            raise ValidationError("已归档的巡检单不能做恢复确认", "status_conflict")

        confirm = RecoveryConfirm(
            fault_report_id=data.fault_report_id,
            inspection_order_id=order.id,
            confirmed_by=confirmer_id,
            confirmation_remark=data.confirmation_remark,
            evidence_path=data.evidence_path,
            is_successful=data.is_successful,
        )
        db.add(confirm)
        db.flush()

        fault.is_resolved = True
        fault.resolved_by = confirmer_id
        fault.resolved_at = datetime.utcnow()
        fault.resolution = data.confirmation_remark

        _add_operation_record(
            db, order, confirmer_id, OperationType.CONFIRM_RECOVERY,
            from_status=original_status,
            to_status=original_status,
            opinion=data.confirmation_remark,
            result="恢复确认完成" if data.is_successful else "恢复确认失败",
            version=order.version,
        )

        db.commit()

        confirmer = get_user(db, confirmer_id)
        return RecoveryConfirmSchema(
            id=confirm.id,
            fault_report_id=confirm.fault_report_id,
            inspection_order_id=confirm.inspection_order_id,
            confirmation_remark=confirm.confirmation_remark,
            is_successful=confirm.is_successful,
            evidence_path=confirm.evidence_path,
            confirmed_by=confirm.confirmed_by,
            confirmed_by_name=confirmer.name if confirmer else None,
            confirmed_at=confirm.confirmed_at,
        ), None

    except ValidationError as e:
        _add_operation_record(
            db, order, confirmer_id, OperationType.CONFIRM_RECOVERY,
            from_status=original_status,
            to_status=original_status,
            from_risk=original_risk,
            to_risk=original_risk,
            opinion="恢复确认失败",
            result=e.message,
            remark=f"错误类型: {e.error_type}",
            version=order.version,
        )
        db.commit()
        return None, e.message
    except Exception as e:
        db.rollback()
        return None, str(e)


def get_statistics(db: Session) -> StatisticsResponse:
    total = db.query(InspectionOrder).count()

    stats = StatisticsResponse()
    stats.total = total

    status_counts = db.query(
            InspectionOrder.status,
            func.count(InspectionOrder.id)
        ).group_by(InspectionOrder.status).all()

    status_map = {
        InspectionStatus.DRAFT: "draft",
        InspectionStatus.PENDING_HANDLING: "pending_handling",
        InspectionStatus.IN_PROGRESS: "in_progress",
        InspectionStatus.PENDING_REVIEW: "pending_review",
        InspectionStatus.RETURNED: "returned",
        InspectionStatus.ARCHIVED: "archived",
    }
    for status, count in status_counts:
        field = status_map.get(status)
        if field:
            setattr(stats, field, count)

    risk_counts = db.query(
        InspectionOrder.risk_level,
        func.count(InspectionOrder.id)
    ).group_by(InspectionOrder.risk_level).all()

    risk_map = {
        RiskLevel.LOW: "low_risk",
        RiskLevel.MEDIUM: "medium_risk",
        RiskLevel.HIGH: "high_risk",
    }
    for risk, count in risk_counts:
        field = risk_map.get(risk)
        if field:
            setattr(stats, field, count)

    result_counts = db.query(
        InspectionOrder.inspection_result,
        func.count(InspectionOrder.id)
    ).group_by(InspectionOrder.inspection_result).all()

    result_map = {
        InspectionResult.NORMAL: "normal",
        InspectionResult.ABNORMAL: "abnormal",
        InspectionResult.MISSING_EVIDENCE: "missing_evidence",
        InspectionResult.OVERDUE: "overdue",
        InspectionResult.STATUS_CONFLICT: "status_conflict",
    }
    for result, count in result_counts:
        field = result_map.get(result)
        if field:
            setattr(stats, field, count)

    overdue_count = db.query(func.count(InspectionOrder.id)).filter(
        InspectionOrder.due_date < datetime.utcnow(),
        InspectionOrder.status != InspectionStatus.ARCHIVED
    ).scalar() or 0
    stats.overdue = max(stats.overdue, overdue_count)

    by_location = {}
    equipments = db.query(Equipment).all()
    for eq in equipments:
        count = db.query(InspectionOrder).filter(
            InspectionOrder.equipment_id == eq.id
        ).count()
        if count > 0:
            if eq.location in by_location:
                by_location[eq.location] += count
            else:
                by_location[eq.location] = count
    stats.by_location = by_location

    return stats


def get_queue(db: Session, user_id: int, role: UserRole) -> List[QueueItem]:
    queue_items: List[QueueItem] = []
    now = datetime.utcnow()

    if role == UserRole.INSPECTOR:
        orders = db.query(InspectionOrder).filter(
            InspectionOrder.initiator_id == user_id,
            InspectionOrder.status.in_([
                InspectionStatus.RETURNED,
                InspectionStatus.IN_PROGRESS,
            ])
        ).order_by(InspectionOrder.updated_at.desc()).all()

        for order in orders:
            equipment = get_equipment(db, order.equipment_id)
            action = "待重新提交" if order.status == InspectionStatus.RETURNED else "处理中"
            queue_items.append(QueueItem(
                id=order.id,
                order_no=order.order_no,
                equipment_name=equipment.name if equipment else "未知",
                equipment_location=equipment.location if equipment else "",
                status=order.status,
                risk_level=order.risk_level,
                current_handler_name=None,
                updated_at=order.updated_at,
                action_required=action,
            ))

    elif role == UserRole.HANDLER:
        orders = db.query(InspectionOrder).filter(
            (InspectionOrder.status == InspectionStatus.PENDING_HANDLING) |
            ((InspectionOrder.status == InspectionStatus.IN_PROGRESS) &
             (InspectionOrder.current_handler_id == user_id)) |
            ((InspectionOrder.status == InspectionStatus.RETURNED) &
             (InspectionOrder.current_handler_id == user_id))
        ).order_by(InspectionOrder.updated_at.desc()).all()

        for order in orders:
            equipment = get_equipment(db, order.equipment_id)
            if order.status == InspectionStatus.PENDING_HANDLING:
                action = "待办理"
            elif order.status == InspectionStatus.RETURNED:
                action = "待重新办理"
            else:
                action = "办理中"
            handler = get_user(db, order.current_handler_id)
            queue_items.append(QueueItem(
                id=order.id,
                order_no=order.order_no,
                equipment_name=equipment.name if equipment else "未知",
                equipment_location=equipment.location if equipment else "",
                status=order.status,
                risk_level=order.risk_level,
                current_handler_name=handler.name if handler else None,
                updated_at=order.updated_at,
                action_required=action,
            ))

    elif role == UserRole.REVIEWER:
        orders = db.query(InspectionOrder).filter(
            InspectionOrder.status == InspectionStatus.PENDING_REVIEW
        ).order_by(InspectionOrder.updated_at.desc()).all()

        for order in orders:
            equipment = get_equipment(db, order.equipment_id)
            handler = get_user(db, order.current_handler_id)
            queue_items.append(QueueItem(
                id=order.id,
                order_no=order.order_no,
                equipment_name=equipment.name if equipment else "未知",
                equipment_location=equipment.location if equipment else "",
                status=order.status,
                risk_level=order.risk_level,
                current_handler_name=handler.name if handler else None,
                updated_at=order.updated_at,
                action_required="待复核",
            ))

    return queue_items


def validate_submit(
    db: Session,
    order_id: int,
    data: InspectionOrderSubmitRequest,
) -> Tuple[bool, Optional[str]]:
    order = db.query(InspectionOrder).filter(InspectionOrder.id == order_id).first()
    if not order:
        return False, "巡检单不存在"

    original_status = order.status

    try:
        _validate_submission(
            db, order,
            current_user_id=data.current_user_id,
            expected_role=data.expected_role,
            expected_status=data.expected_status,
            version=data.version,
            required_evidences=data.required_evidences,
        )
        return True, None
    except ValidationError as e:
        _add_operation_record(
            db, order, data.current_user_id, OperationType.SUBMIT,
            from_status=original_status,
            to_status=original_status,
            opinion="提交校验失败",
            result=e.message,
            remark=f"错误类型: {e.error_type}",
            version=order.version,
        )
        db.commit()
        return False, e.message
