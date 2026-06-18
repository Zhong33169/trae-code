from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from .models import (
    User, TrainingProject, Evidence, OperationLog, AppealRecord,
    Role, Stage, Status, AppealResult, EvidenceType, ActionType,
    STAGE_REQUIRED_EVIDENCES, STATUS_LABELS, ROLE_LABELS
)
from .schemas import (
    UserCreate, TrainingProjectCreate, TrainingProjectUpdate,
    EvidenceCreate, AppealRecordCreate, AppealRecordReview, ConflictFilter
)


def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_users(db: Session) -> List[User]:
    return db.query(User).all()


def get_users_by_role(db: Session, role: Role) -> List[User]:
    return db.query(User).filter(User.role == role).all()


def create_user(db: Session, user: UserCreate) -> User:
    db_user = User(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def generate_project_no(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    count = db.query(func.count(TrainingProject.id)).filter(
        TrainingProject.project_no.like(f"TP{today}%")
    ).scalar() or 0
    return f"TP{today}{count + 1:03d}"


def get_project(db: Session, project_id: int) -> Optional[TrainingProject]:
    return db.query(TrainingProject).filter(TrainingProject.id == project_id).first()


def get_project_by_no(db: Session, project_no: str) -> Optional[TrainingProject]:
    return db.query(TrainingProject).filter(TrainingProject.project_no == project_no).first()


def _project_ids_with_action(db: Session, action: ActionType) -> set:
    rows = (
        db.query(func.distinct(OperationLog.project_id))
        .filter(OperationLog.action == action)
        .all()
    )
    return {r[0] for r in rows}


def get_projects(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: Optional[Status] = None,
    stage: Optional[Stage] = None,
    handler_id: Optional[int] = None,
    creator_id: Optional[int] = None,
    conflict_filter: Optional[ConflictFilter] = None,
) -> List[TrainingProject]:
    query = db.query(TrainingProject)
    if status:
        query = query.filter(TrainingProject.status == status)
    if stage:
        query = query.filter(TrainingProject.stage == stage)
    if handler_id:
        query = query.filter(TrainingProject.current_handler_id == handler_id)
    if creator_id:
        query = query.filter(TrainingProject.created_by_id == creator_id)

    if conflict_filter:
        conflict_ids = _project_ids_with_action(db, ActionType.STATE_CONFLICT)
        recovered_ids = _project_ids_with_action(db, ActionType.CONFLICT_RECOVERED)
        if conflict_filter == ConflictFilter.PENDING_CONFLICT:
            target_ids = {
                pid for pid in conflict_ids
                if pid not in recovered_ids
            }
            query = query.filter(TrainingProject.id.in_(target_ids)) if target_ids \
                else query.filter(TrainingProject.id == -1)
        elif conflict_filter == ConflictFilter.CONFLICT_RECOVERED:
            query = query.filter(TrainingProject.id.in_(recovered_ids)) if recovered_ids \
                else query.filter(TrainingProject.id == -1)
        elif conflict_filter == ConflictFilter.RECOVERED_PENDING_RECEIVE:
            query = query.filter(
                TrainingProject.id.in_(recovered_ids),
                TrainingProject.status == Status.SUBMITTED,
            ) if recovered_ids else query.filter(TrainingProject.id == -1)

    return query.order_by(TrainingProject.updated_at.desc()).offset(skip).limit(limit).all()


def create_project(db: Session, project: TrainingProjectCreate) -> TrainingProject:
    project_no = generate_project_no(db)
    db_project = TrainingProject(
        **project.model_dump(),
        project_no=project_no,
        status=Status.DRAFT,
        version=1,
        current_handler_id=project.created_by_id,
    )
    db.add(db_project)
    db.flush()

    creator = get_user(db, project.created_by_id)
    log = OperationLog(
        project_id=db_project.id,
        user_id=project.created_by_id,
        user_role=creator.role if creator else Role.REGISTRAR,
        user_name=creator.name if creator else "未知",
        action=ActionType.CREATE,
        from_status=None,
        to_status=Status.DRAFT,
        stage=project.stage,
        version=1,
    )
    db.add(log)

    db.commit()
    db.refresh(db_project)
    return db_project


def update_project(db: Session, project_id: int, update: TrainingProjectUpdate) -> Optional[TrainingProject]:
    db_project = get_project(db, project_id)
    if not db_project:
        return None
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(db_project, key, value)
    db.commit()
    db.refresh(db_project)
    return db_project


def add_evidence(db: Session, evidence: EvidenceCreate, project_id: int) -> Evidence:
    db_evidence = Evidence(**evidence.model_dump(), project_id=project_id)
    db.add(db_evidence)
    db.commit()
    db.refresh(db_evidence)
    return db_evidence


def remove_evidence(db: Session, evidence_id: int) -> bool:
    db_evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if db_evidence:
        db.delete(db_evidence)
        db.commit()
        return True
    return False


def get_project_evidences(db: Session, project_id: int) -> List[Evidence]:
    return db.query(Evidence).filter(Evidence.project_id == project_id).all()


def check_required_evidences(db: Session, project_id: int, stage: Stage) -> tuple[bool, List[EvidenceType]]:
    required = STAGE_REQUIRED_EVIDENCES.get(stage, [])
    evidences = get_project_evidences(db, project_id)
    existing_types = {e.evidence_type for e in evidences}
    missing = [et for et in required if et not in existing_types]
    return len(missing) == 0, missing


def add_operation_log(
    db: Session,
    project_id: int,
    user_id: int,
    action: ActionType,
    from_status: Optional[Status] = None,
    to_status: Optional[Status] = None,
    stage: Optional[Stage] = None,
    version: Optional[int] = None,
    comment: Optional[str] = None,
    opinion: Optional[str] = None,
    reject_reason: Optional[str] = None,
    audit_note: Optional[str] = None,
    recovery_source: Optional[Status] = None,
    next_handler_id: Optional[int] = None,
    next_handler_name: Optional[str] = None,
) -> OperationLog:
    user = get_user(db, user_id)
    log = OperationLog(
        project_id=project_id,
        user_id=user_id,
        user_role=user.role if user else Role.REGISTRAR,
        user_name=user.name if user else "未知",
        action=action,
        from_status=from_status,
        to_status=to_status,
        stage=stage,
        version=version,
        comment=comment,
        opinion=opinion,
        reject_reason=reject_reason,
        audit_note=audit_note,
        recovery_source=recovery_source,
        next_handler_id=next_handler_id,
        next_handler_name=next_handler_name,
    )
    db.add(log)
    db.flush()
    return log


def get_project_logs(db: Session, project_id: int) -> List[OperationLog]:
    return (
        db.query(OperationLog)
        .filter(OperationLog.project_id == project_id)
        .order_by(OperationLog.created_at.desc())
        .all()
    )


def get_recovery_summary(db: Session, project_id: int) -> Optional[str]:
    log = (
        db.query(OperationLog)
        .filter(
            OperationLog.project_id == project_id,
            OperationLog.action == ActionType.CONFLICT_RECOVERED,
        )
        .order_by(OperationLog.created_at.desc())
        .first()
    )
    if not log:
        return None
    source_label = STATUS_LABELS.get(log.recovery_source, log.recovery_source.value) \
        if log.recovery_source else "未知状态"
    handler = log.next_handler_name or "待分配"
    return f"从「{source_label}」恢复提交，下一处理人：{handler}"


def create_appeal(db: Session, appeal: AppealRecordCreate, project_id: int, version: int) -> AppealRecord:
    submitter = get_user(db, appeal.submitter_id)
    db_appeal = AppealRecord(
        **appeal.model_dump(),
        project_id=project_id,
        version=version,
        submitter_name=submitter.name if submitter else "未知",
    )
    db.add(db_appeal)
    db.commit()
    db.refresh(db_appeal)
    return db_appeal


def review_appeal(db: Session, appeal_id: int, review: AppealRecordReview) -> Optional[AppealRecord]:
    db_appeal = db.query(AppealRecord).filter(AppealRecord.id == appeal_id).first()
    if not db_appeal:
        return None
    reviewer = get_user(db, review.reviewer_id)
    db_appeal.reviewer_id = review.reviewer_id
    db_appeal.reviewer_name = reviewer.name if reviewer else "未知"
    db_appeal.reviewer_opinion = review.reviewer_opinion
    db_appeal.result = review.result
    db_appeal.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(db_appeal)
    return db_appeal


def get_project_appeals(db: Session, project_id: int) -> List[AppealRecord]:
    return (
        db.query(AppealRecord)
        .filter(AppealRecord.project_id == project_id)
        .order_by(AppealRecord.created_at.desc())
        .all()
    )


def get_statistics(db: Session) -> dict:
    def count_status(s: Status) -> int:
        return db.query(func.count(TrainingProject.id)).filter(TrainingProject.status == s).scalar() or 0

    def count_stage(s: Stage) -> int:
        return db.query(func.count(TrainingProject.id)).filter(TrainingProject.stage == s).scalar() or 0

    total = db.query(func.count(TrainingProject.id)).scalar() or 0

    pending_conflict = (
        db.query(func.count(func.distinct(OperationLog.project_id)))
        .filter(
            OperationLog.action == ActionType.STATE_CONFLICT,
            OperationLog.project_id.in_(
                db.query(TrainingProject.id).filter(
                    TrainingProject.status.in_([
                        Status.DRAFT, Status.RETURNED, Status.APPEAL_APPROVED
                    ])
                )
            )
        )
        .scalar() or 0
    )

    conflict_recovered = (
        db.query(func.count(func.distinct(OperationLog.project_id)))
        .filter(OperationLog.action == ActionType.CONFLICT_RECOVERED)
        .scalar() or 0
    )

    recovered_project_ids = {
        r[0] for r in
        db.query(func.distinct(OperationLog.project_id))
        .filter(OperationLog.action == ActionType.CONFLICT_RECOVERED)
        .all()
    }
    recovered_pending_receive = 0
    if recovered_project_ids:
        recovered_pending_receive = (
            db.query(func.count(TrainingProject.id))
            .filter(
                TrainingProject.id.in_(recovered_project_ids),
                TrainingProject.status == Status.SUBMITTED,
            )
            .scalar() or 0
        )

    return {
        "total": total,
        "draft": count_status(Status.DRAFT),
        "submitted": count_status(Status.SUBMITTED),
        "under_review": count_status(Status.UNDER_REVIEW),
        "returned": count_status(Status.RETURNED),
        "approved": count_status(Status.APPROVED),
        "rejected": count_status(Status.REJECTED),
        "appeal_submitted": count_status(Status.APPEAL_SUBMITTED),
        "appeal_under_review": count_status(Status.APPEAL_UNDER_REVIEW),
        "appeal_approved": count_status(Status.APPEAL_APPROVED),
        "appeal_rejected": count_status(Status.APPEAL_REJECTED),
        "overdue": count_status(Status.OVERDUE),
        "archived": count_status(Status.ARCHIVED),
        "pending_conflict": pending_conflict,
        "conflict_recovered": conflict_recovered,
        "recovered_pending_receive": recovered_pending_receive,
        "by_stage_need": count_stage(Stage.NEED),
        "by_stage_quotation": count_stage(Stage.QUOTATION),
        "by_stage_contract": count_stage(Stage.CONTRACT),
    }
