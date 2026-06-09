from datetime import datetime
from sqlalchemy.orm import Session
from typing import Tuple, Optional

from .database import FollowUpRecord, AuditLog, User, Patient
from .config import (
    STATUS_DRAFT, STATUS_PENDING_DOCTOR, STATUS_PENDING_DIRECTOR,
    STATUS_CONFIRMED, STATUS_REJECTED,
    ROLE_TRIAGE_NURSE, ROLE_GP_DOCTOR, ROLE_MEDICAL_DIRECTOR,
    VALID_TRANSITIONS, ROLE_PERMISSIONS,
)


class ValidationError(Exception):
    def __init__(self, detail: str, error_code: str, field: Optional[str] = None):
        self.detail = detail
        self.error_code = error_code
        self.field = field
        super().__init__(detail)


def validate_role_permission(role: str, current_status: str, action: str = "process"):
    if role not in ROLE_PERMISSIONS:
        raise ValidationError(
            detail=f"未知角色: {role}",
            error_code="UNKNOWN_ROLE",
            field="role"
        )
    if current_status not in ROLE_PERMISSIONS[role]:
        role_names = {
            ROLE_TRIAGE_NURSE: "导诊护士",
            ROLE_GP_DOCTOR: "全科医生",
            ROLE_MEDICAL_DIRECTOR: "医务科主任",
        }
        status_names = {
            STATUS_DRAFT: "草稿",
            STATUS_PENDING_DOCTOR: "待医生处理",
            STATUS_PENDING_DIRECTOR: "待主任确认",
            STATUS_CONFIRMED: "已确认",
            STATUS_REJECTED: "已驳回",
        }
        raise ValidationError(
            detail=f"角色【{role_names.get(role, role)}】无权{action}状态为【{status_names.get(current_status, current_status)}】的记录",
            error_code="ROLE_PERMISSION_DENIED",
            field="role"
        )


def validate_version(record: FollowUpRecord, expected_version: int):
    if record.version != expected_version:
        raise ValidationError(
            detail=f"版本不匹配：当前版本为 {record.version}，您提交的版本为 {expected_version}，请刷新后重试",
            error_code="VERSION_MISMATCH",
            field="version"
        )


def validate_status_transition(current_status: str, target_status: str):
    valid_targets = VALID_TRANSITIONS.get(current_status, [])
    if target_status not in valid_targets:
        status_names = {
            STATUS_DRAFT: "草稿",
            STATUS_PENDING_DOCTOR: "待医生处理",
            STATUS_PENDING_DIRECTOR: "待主任确认",
            STATUS_CONFIRMED: "已确认",
            STATUS_REJECTED: "已驳回",
        }
        valid_names = [status_names.get(s, s) for s in valid_targets]
        raise ValidationError(
            detail=f"无效的状态流转：不能从【{status_names.get(current_status, current_status)}】流转到【{status_names.get(target_status, target_status)}】。允许的目标状态：{valid_names if valid_names else '无'}",
            error_code="INVALID_STATUS_TRANSITION",
            field="status"
        )


def validate_evidence_complete(db: Session, record: FollowUpRecord) -> Tuple[bool, list]:
    missing = []
    if not record.appointment_id:
        missing.append("预约登记")
    else:
        from .database import Appointment
        apt = db.query(Appointment).filter(Appointment.id == record.appointment_id).first()
        if not apt:
            missing.append("预约登记（记录不存在）")

    if not record.visit_id:
        missing.append("就诊分诊")
    else:
        from .database import Visit
        visit = db.query(Visit).filter(Visit.id == record.visit_id).first()
        if not visit:
            missing.append("就诊分诊（记录不存在）")

    if not record.follow_up_visit_id:
        missing.append("随访回访")
    else:
        from .database import FollowUpVisit
        fuv = db.query(FollowUpVisit).filter(FollowUpVisit.id == record.follow_up_visit_id).first()
        if not fuv:
            missing.append("随访回访（记录不存在）")

    return len(missing) == 0, missing


def validate_no_duplicate(db: Session, patient_id: int, follow_up_type: str,
                          follow_up_date: Optional[datetime] = None, exclude_id: Optional[int] = None):
    query = db.query(FollowUpRecord).filter(
        FollowUpRecord.patient_id == patient_id,
        FollowUpRecord.follow_up_type == follow_up_type,
        FollowUpRecord.status != STATUS_REJECTED,
    )
    if exclude_id:
        query = query.filter(FollowUpRecord.id != exclude_id)

    existing = query.first()
    if existing:
        raise ValidationError(
            detail=f"重复补录：患者ID {patient_id} 已存在同类型【{follow_up_type}】的随访记录（记录号：{existing.record_no}）",
            error_code="DUPLICATE_RECORD",
            field="follow_up_type"
        )


def validate_not_confirmed(record: FollowUpRecord):
    if record.status == STATUS_CONFIRMED:
        raise ValidationError(
            detail="该记录已确认，不能覆盖或修改",
            error_code="RECORD_CONFIRMED",
            field="status"
        )


def get_next_status_for_role(role: str, current_status: str) -> str:
    if role == ROLE_TRIAGE_NURSE and current_status == STATUS_DRAFT:
        return STATUS_PENDING_DOCTOR
    if role == ROLE_GP_DOCTOR and current_status == STATUS_PENDING_DOCTOR:
        return STATUS_PENDING_DIRECTOR
    if role == ROLE_MEDICAL_DIRECTOR and current_status == STATUS_PENDING_DIRECTOR:
        return STATUS_CONFIRMED
    return current_status


def create_audit_log(db: Session, record_id: int, action: str, operator: str,
                     operator_role: str, from_status: str, to_status: str, reason: str = ""):
    log = AuditLog(
        record_id=record_id,
        action=action,
        operator=operator,
        operator_role=operator_role,
        from_status=from_status,
        to_status=to_status,
        reason=reason,
    )
    db.add(log)


def generate_record_no() -> str:
    now = datetime.now()
    return f"FUR{now.strftime('%Y%m%d%H%M%S')}{now.microsecond // 1000:03d}"
