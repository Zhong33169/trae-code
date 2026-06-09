from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Tuple

from .database import FollowUpRecord, Patient, Appointment, Visit, FollowUpVisit, User
from .schemas import FollowUpRecordCreate, FollowUpRecordUpdate, ProcessRecordRequest
from .validators import (
    ValidationError, validate_role_permission, validate_version,
    validate_status_transition, validate_evidence_complete,
    validate_no_duplicate, validate_not_confirmed,
    get_next_status_for_role, create_audit_log, generate_record_no,
)
from .config import (
    STATUS_DRAFT, STATUS_PENDING_DOCTOR, STATUS_PENDING_DIRECTOR,
    STATUS_CONFIRMED, STATUS_REJECTED,
    ROLE_TRIAGE_NURSE, ROLE_GP_DOCTOR, ROLE_MEDICAL_DIRECTOR,
    ROLE_PERMISSIONS,
)


def get_current_user(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def list_records(
    db: Session,
    role: str,
    status: Optional[str] = None,
    patient_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[int, List[FollowUpRecord]]:
    query = db.query(FollowUpRecord)

    if status:
        query = query.filter(FollowUpRecord.status == status)
    else:
        allowed_statuses = ROLE_PERMISSIONS.get(role, [])
        if allowed_statuses:
            query = query.filter(FollowUpRecord.status.in_(allowed_statuses))

    if patient_name:
        query = query.join(Patient).filter(Patient.name.contains(patient_name))

    total = query.count()
    items = (
        query
        .order_by(FollowUpRecord.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return total, items


def get_record_detail(db: Session, record_id: int) -> Optional[FollowUpRecord]:
    return (
        db.query(FollowUpRecord)
        .filter(FollowUpRecord.id == record_id)
        .first()
    )


def create_record(db: Session, data: FollowUpRecordCreate, operator: str, role: str) -> FollowUpRecord:
    if role != ROLE_TRIAGE_NURSE:
        raise ValidationError(
            detail="只有导诊护士可以创建随访记录",
            error_code="ROLE_PERMISSION_DENIED",
            field="role"
        )

    patient = db.query(Patient).filter(Patient.id == data.patient_id).first()
    if not patient:
        raise ValidationError(
            detail=f"患者不存在: ID={data.patient_id}",
            error_code="PATIENT_NOT_FOUND",
            field="patient_id"
        )

    if data.follow_up_type:
        validate_no_duplicate(db, data.patient_id, data.follow_up_type)

    record_no = generate_record_no()

    record = FollowUpRecord(
        record_no=record_no,
        patient_id=data.patient_id,
        appointment_id=data.appointment_id,
        visit_id=data.visit_id,
        follow_up_visit_id=data.follow_up_visit_id,
        status=STATUS_DRAFT,
        version=1,
        follow_up_type=data.follow_up_type,
        content=data.content,
        result=data.result,
        remarks=data.remarks,
        created_by=operator,
        updated_by=operator,
    )

    db.add(record)
    db.flush()

    create_audit_log(
        db, record.id, "create", operator, role,
        "", STATUS_DRAFT, "创建随访记录"
    )

    db.commit()
    db.refresh(record)
    return record


def submit_record(db: Session, record_id: int, version: int, operator: str, role: str) -> FollowUpRecord:
    record = get_record_detail(db, record_id)
    if not record:
        raise ValidationError(
            detail=f"记录不存在: ID={record_id}",
            error_code="RECORD_NOT_FOUND",
            field="record_id"
        )

    validate_role_permission(role, record.status, "提交")
    validate_version(record, version)
    validate_not_confirmed(record)

    is_complete, missing = validate_evidence_complete(db, record)
    if not is_complete:
        raise ValidationError(
            detail=f"证据不完整，缺少：{', '.join(missing)}。提交前请确保关联了预约登记、就诊分诊和随访回访记录。",
            error_code="INCOMPLETE_EVIDENCE",
            field="evidence"
        )

    if record.follow_up_type:
        validate_no_duplicate(db, record.patient_id, record.follow_up_type, exclude_id=record.id)

    target_status = get_next_status_for_role(role, record.status)
    validate_status_transition(record.status, target_status)

    old_status = record.status
    record.status = target_status
    record.version += 1
    record.updated_by = operator

    if role == ROLE_GP_DOCTOR:
        record.doctor_verified = True
        record.doctor_verified_at = datetime.utcnow()

    if role == ROLE_MEDICAL_DIRECTOR:
        record.director_verified = True
        record.director_verified_at = datetime.utcnow()

    create_audit_log(
        db, record.id, "submit", operator, role,
        old_status, target_status, "提交审核"
    )

    db.commit()
    db.refresh(record)
    return record


def reject_record(db: Session, record_id: int, version: int, opinion: str,
                  operator: str, role: str) -> FollowUpRecord:
    record = get_record_detail(db, record_id)
    if not record:
        raise ValidationError(
            detail=f"记录不存在: ID={record_id}",
            error_code="RECORD_NOT_FOUND",
            field="record_id"
        )

    validate_role_permission(role, record.status, "驳回")
    validate_version(record, version)
    validate_not_confirmed(record)
    validate_status_transition(record.status, STATUS_REJECTED)

    old_status = record.status
    record.status = STATUS_REJECTED
    record.version += 1
    record.updated_by = operator

    if role == ROLE_GP_DOCTOR:
        record.doctor_opinion = opinion
    elif role == ROLE_MEDICAL_DIRECTOR:
        record.director_opinion = opinion

    create_audit_log(
        db, record.id, "reject", operator, role,
        old_status, STATUS_REJECTED, opinion or "驳回"
    )

    db.commit()
    db.refresh(record)
    return record


def update_record(db: Session, record_id: int, data: FollowUpRecordUpdate,
                  operator: str, role: str) -> FollowUpRecord:
    record = get_record_detail(db, record_id)
    if not record:
        raise ValidationError(
            detail=f"记录不存在: ID={record_id}",
            error_code="RECORD_NOT_FOUND",
            field="record_id"
        )

    validate_role_permission(role, record.status, "编辑")
    validate_version(record, data.version)
    validate_not_confirmed(record)

    if data.follow_up_type and data.follow_up_type != record.follow_up_type:
        validate_no_duplicate(db, record.patient_id, data.follow_up_type, exclude_id=record.id)

    if data.follow_up_type is not None:
        record.follow_up_type = data.follow_up_type
    if data.content is not None:
        record.content = data.content
    if data.result is not None:
        record.result = data.result
    if data.remarks is not None:
        record.remarks = data.remarks

    record.version += 1
    record.updated_by = operator

    create_audit_log(
        db, record.id, "update", operator, role,
        record.status, record.status, "编辑记录"
    )

    db.commit()
    db.refresh(record)
    return record


def process_record(db: Session, record_id: int, data: ProcessRecordRequest,
                   operator: str, role: str) -> FollowUpRecord:
    record = get_record_detail(db, record_id)
    if not record:
        raise ValidationError(
            detail=f"记录不存在: ID={record_id}",
            error_code="RECORD_NOT_FOUND",
            field="record_id"
        )

    validate_role_permission(role, record.status, "办理")
    validate_version(record, data.version)
    validate_not_confirmed(record)

    if data.result and role == ROLE_GP_DOCTOR:
        record.result = data.result

    if role == ROLE_GP_DOCTOR and data.opinion:
        record.doctor_opinion = data.opinion
    elif role == ROLE_MEDICAL_DIRECTOR and data.opinion:
        record.director_opinion = data.opinion

    target_status = get_next_status_for_role(role, record.status)
    validate_status_transition(record.status, target_status)

    old_status = record.status
    record.status = target_status
    record.version += 1
    record.updated_by = operator

    if role == ROLE_GP_DOCTOR:
        record.doctor_verified = True
        record.doctor_verified_at = datetime.utcnow()
    elif role == ROLE_MEDICAL_DIRECTOR:
        record.director_verified = True
        record.director_verified_at = datetime.utcnow()

    create_audit_log(
        db, record.id, "process", operator, role,
        old_status, target_status, data.opinion or "办理通过"
    )

    db.commit()
    db.refresh(record)
    return record


def batch_process(db: Session, record_ids: List[int], version_map: dict,
                  opinion: str, operator: str, role: str) -> dict:
    results = {"success": [], "failed": []}

    for record_id in record_ids:
        try:
            version = version_map.get(str(record_id), 0)
            data = ProcessRecordRequest(version=version, opinion=opinion)
            record = process_record(db, record_id, data, operator, role)
            results["success"].append({"id": record_id, "record_no": record.record_no})
        except ValidationError as e:
            results["failed"].append({
                "id": record_id,
                "error": e.detail,
                "error_code": e.error_code,
            })
        except Exception as e:
            results["failed"].append({
                "id": record_id,
                "error": str(e),
                "error_code": "UNKNOWN_ERROR",
            })

    return results


def batch_reject(db: Session, record_ids: List[int], version_map: dict,
                 opinion: str, operator: str, role: str) -> dict:
    results = {"success": [], "failed": []}

    for record_id in record_ids:
        try:
            version = version_map.get(str(record_id), 0)
            record = reject_record(db, record_id, version, opinion, operator, role)
            results["success"].append({"id": record_id, "record_no": record.record_no})
        except ValidationError as e:
            results["failed"].append({
                "id": record_id,
                "error": e.detail,
                "error_code": e.error_code,
            })
        except Exception as e:
            results["failed"].append({
                "id": record_id,
                "error": str(e),
                "error_code": "UNKNOWN_ERROR",
            })

    return results


def list_patients(db: Session, name: Optional[str] = None) -> List[Patient]:
    query = db.query(Patient)
    if name:
        query = query.filter(Patient.name.contains(name))
    return query.all()


def list_evidence_for_patient(db: Session, patient_id: int) -> dict:
    appointments = db.query(Appointment).filter(Appointment.patient_id == patient_id).all()
    visits = db.query(Visit).filter(Visit.patient_id == patient_id).all()
    follow_up_visits = db.query(FollowUpVisit).filter(FollowUpVisit.patient_id == patient_id).all()

    return {
        "appointments": appointments,
        "visits": visits,
        "follow_up_visits": follow_up_visits,
    }
