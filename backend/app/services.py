from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

from .models import (
    User, TrainingProject, Role, Stage, Status, AppealResult, ActionType
)
from .schemas import (
    SubmitData, ReviewData, ReturnForCorrectionData, CorrectData,
    AppealSubmitData, AppealReviewData, AppealRecordCreate, AppealRecordReview,
    ConflictRecoveryData, ReceiveData
)
from . import crud


class BusinessError(Exception):
    def __init__(self, message: str, error_type: str = "business_error"):
        self.message = message
        self.error_type = error_type
        super().__init__(message)


def _log_conflict(
    db: Session,
    project: Optional[TrainingProject],
    user_id: int,
    message: str,
    error_type: str,
) -> None:
    """校验失败时写一条 STATE_CONFLICT 操作记录（保留项目原状态），再抛出业务异常。

    之所以在写日志后 commit，是为了让冲突记录独立于失败的业务操作落库；
    此时项目对象尚未被任何业务逻辑改写，原状态被完整保留。
    """
    if project is not None:
        crud.add_operation_log(
            db,
            project_id=project.id,
            user_id=user_id,
            action=ActionType.STATE_CONFLICT,
            from_status=project.status,
            to_status=project.status,
            stage=project.stage,
            version=project.version,
            comment=f"[{error_type}] {message}",
        )
        db.commit()
    raise BusinessError(message, error_type)


def _validate_user_role(
    db: Session,
    user_id: int,
    allowed_roles: list[Role],
    project: Optional[TrainingProject] = None,
) -> User:
    user = crud.get_user(db, user_id)
    if not user:
        _log_conflict(db, project, user_id, f"用户 {user_id} 不存在", "user_not_found")
    if user.role not in allowed_roles:
        allowed_labels = [r.value for r in allowed_roles]
        _log_conflict(
            db, project, user_id,
            f"用户角色不允许执行此操作，需要角色: {allowed_labels}",
            "role_not_allowed",
        )
    return user


def _validate_handler(db: Session, project: TrainingProject, user_id: int) -> None:
    if project.current_handler_id != user_id:
        _log_conflict(
            db, project, user_id,
            f"当前处理人是用户 {project.current_handler_id}，用户 {user_id} 无权操作",
            "not_current_handler",
        )


def _validate_version(
    db: Session,
    project: TrainingProject,
    user_id: int,
    expected_version: Optional[int] = None,
) -> None:
    if expected_version is not None and project.version != expected_version:
        _log_conflict(
            db, project, user_id,
            f"版本冲突：当前版本 {project.version}，期望版本 {expected_version}",
            "version_conflict",
        )


def _validate_status(
    db: Session,
    project: TrainingProject,
    user_id: int,
    allowed_statuses: list[Status],
    op_name: str,
) -> None:
    if project.status not in allowed_statuses:
        allowed = [s.value for s in allowed_statuses]
        _log_conflict(
            db, project, user_id,
            f"项目状态不允许{op_name}：当前状态 {project.status.value}，允许状态: {allowed}",
            "status_not_allowed",
        )


def _validate_project_not_overdue(
    db: Session, project: TrainingProject, user_id: int
) -> None:
    if project.status == Status.OVERDUE:
        _log_conflict(db, project, user_id, "项目已逾期，无法执行操作", "project_overdue")


def _check_overdue(project: TrainingProject) -> None:
    if project.deadline and datetime.utcnow() > project.deadline and not project.is_overdue:
        project.is_overdue = True
        if project.status in [Status.SUBMITTED, Status.UNDER_REVIEW, Status.APPEAL_UNDER_REVIEW]:
            project.status = Status.OVERDUE


def submit_project(
    db: Session,
    project_id: int,
    data: SubmitData,
    expected_version: Optional[int] = None,
) -> TrainingProject:
    project = crud.get_project(db, project_id)
    if not project:
        raise BusinessError(f"项目 {project_id} 不存在", "project_not_found")

    _validate_version(db, project, data.current_user_id, expected_version)
    # 申诉通过后允许登记员再次提交（转回补正或直接草稿再提交两条路径）
    _validate_status(
        db, project, data.current_user_id,
        [Status.DRAFT, Status.RETURNED, Status.APPEAL_APPROVED],
        "提交",
    )
    _validate_user_role(db, data.current_user_id, [Role.REGISTRAR], project)
    _validate_handler(db, project, data.current_user_id)
    _validate_project_not_overdue(db, project, data.current_user_id)

    has_evidence, missing = crud.check_required_evidences(db, project_id, project.stage)
    if not has_evidence:
        _log_conflict(
            db, project, data.current_user_id,
            f"缺少必填证据材料: {[m.value for m in missing]}",
            "missing_required_evidences",
        )

    from_status = project.status
    project.status = Status.SUBMITTED
    project.version += 1

    supervisors = crud.get_users_by_role(db, Role.SUPERVISOR)
    if supervisors:
        project.current_handler_id = supervisors[0].id

    crud.add_operation_log(
        db,
        project_id=project_id,
        user_id=data.current_user_id,
        action=ActionType.SUBMIT,
        from_status=from_status,
        to_status=Status.SUBMITTED,
        stage=project.stage,
        version=project.version,
        comment=data.comment,
    )

    db.commit()
    db.refresh(project)
    return project


def review_project(
    db: Session,
    project_id: int,
    data: ReviewData,
    expected_version: Optional[int] = None,
    approve: bool = True,
) -> TrainingProject:
    project = crud.get_project(db, project_id)
    if not project:
        raise BusinessError(f"项目 {project_id} 不存在", "project_not_found")

    _validate_version(db, project, data.current_user_id, expected_version)
    _validate_status(db, project, data.current_user_id, [Status.UNDER_REVIEW, Status.SUBMITTED], "审核")
    _validate_user_role(db, data.current_user_id, [Role.SUPERVISOR, Role.REVIEWER], project)
    _validate_handler(db, project, data.current_user_id)
    _validate_project_not_overdue(db, project, data.current_user_id)

    from_status = project.status
    from_stage = project.stage

    current_user = crud.get_user(db, data.current_user_id)
    current_role = current_user.role if current_user else None

    if approve:
        if data.next_stage:
            project.stage = data.next_stage
            project.status = Status.DRAFT
            project.current_handler_id = project.created_by_id
        else:
            if project.stage == Stage.CONTRACT:
                if current_role == Role.REVIEWER:
                    project.status = Status.APPROVED
                    project.current_handler_id = None
                else:
                    reviewers = crud.get_users_by_role(db, Role.REVIEWER)
                    if reviewers:
                        project.status = Status.UNDER_REVIEW
                        project.current_handler_id = reviewers[0].id
                    else:
                        project.status = Status.APPROVED
                        project.current_handler_id = None
            else:
                next_stage_map = {
                    Stage.NEED: Stage.QUOTATION,
                    Stage.QUOTATION: Stage.CONTRACT,
                }
                project.stage = next_stage_map.get(project.stage, project.stage)
                project.status = Status.DRAFT
                project.current_handler_id = project.created_by_id

        project.version += 1
        crud.add_operation_log(
            db,
            project_id=project_id,
            user_id=data.current_user_id,
            action=ActionType.REVIEW_APPROVE,
            from_status=from_status,
            to_status=project.status,
            stage=project.stage,
            version=project.version,
            opinion=data.opinion,
        )
    else:
        if not data.reject_reason:
            _log_conflict(
                db, project, data.current_user_id,
                "驳回必须填写驳回原因",
                "missing_reject_reason",
            )
        if project.stage == Stage.CONTRACT and data.current_user_id:
            reviewer = crud.get_user(db, data.current_user_id)
            if reviewer and reviewer.role == Role.REVIEWER:
                project.status = Status.REJECTED
            else:
                project.status = Status.RETURNED
                project.current_handler_id = project.created_by_id
        else:
            project.status = Status.RETURNED
            project.current_handler_id = project.created_by_id

        project.version += 1
        crud.add_operation_log(
            db,
            project_id=project_id,
            user_id=data.current_user_id,
            action=ActionType.REVIEW_REJECT,
            from_status=from_status,
            to_status=project.status,
            stage=from_stage,
            version=project.version,
            opinion=data.opinion,
            reject_reason=data.reject_reason,
        )

    db.commit()
    db.refresh(project)
    return project


def return_for_correction(
    db: Session,
    project_id: int,
    data: ReturnForCorrectionData,
    expected_version: Optional[int] = None,
) -> TrainingProject:
    project = crud.get_project(db, project_id)
    if not project:
        raise BusinessError(f"项目 {project_id} 不存在", "project_not_found")

    _validate_version(db, project, data.current_user_id, expected_version)
    _validate_status(
        db, project, data.current_user_id,
        [Status.UNDER_REVIEW, Status.SUBMITTED, Status.APPEAL_UNDER_REVIEW],
        "退回补正",
    )
    _validate_user_role(db, data.current_user_id, [Role.SUPERVISOR, Role.REVIEWER], project)
    _validate_handler(db, project, data.current_user_id)
    _validate_project_not_overdue(db, project, data.current_user_id)

    from_status = project.status
    project.status = Status.RETURNED
    project.current_handler_id = project.created_by_id
    project.version += 1

    crud.add_operation_log(
        db,
        project_id=project_id,
        user_id=data.current_user_id,
        action=ActionType.RETURN_FOR_CORRECTION,
        from_status=from_status,
        to_status=Status.RETURNED,
        stage=project.stage,
        version=project.version,
        opinion=data.opinion,
        reject_reason=data.reject_reason,
    )

    db.commit()
    db.refresh(project)
    return project


def correct_project(
    db: Session,
    project_id: int,
    data: CorrectData,
    expected_version: Optional[int] = None,
) -> TrainingProject:
    project = crud.get_project(db, project_id)
    if not project:
        raise BusinessError(f"项目 {project_id} 不存在", "project_not_found")

    _validate_version(db, project, data.current_user_id, expected_version)
    _validate_status(db, project, data.current_user_id, [Status.RETURNED], "补正")
    _validate_user_role(db, data.current_user_id, [Role.REGISTRAR], project)
    _validate_handler(db, project, data.current_user_id)
    _validate_project_not_overdue(db, project, data.current_user_id)

    has_evidence, missing = crud.check_required_evidences(db, project_id, project.stage)
    if not has_evidence:
        _log_conflict(
            db, project, data.current_user_id,
            f"缺少必填证据材料: {[m.value for m in missing]}",
            "missing_required_evidences",
        )

    from_status = project.status
    project.status = Status.SUBMITTED
    project.version += 1

    supervisors = crud.get_users_by_role(db, Role.SUPERVISOR)
    if supervisors:
        project.current_handler_id = supervisors[0].id

    crud.add_operation_log(
        db,
        project_id=project_id,
        user_id=data.current_user_id,
        action=ActionType.CORRECT,
        from_status=from_status,
        to_status=Status.SUBMITTED,
        stage=project.stage,
        version=project.version,
        comment=data.comment,
    )

    db.commit()
    db.refresh(project)
    return project


def recover_from_conflict(
    db: Session,
    project_id: int,
    data: ConflictRecoveryData,
    expected_version: Optional[int] = None,
) -> TrainingProject:
    project = crud.get_project(db, project_id)
    if not project:
        raise BusinessError(f"项目 {project_id} 不存在", "project_not_found")

    _validate_version(db, project, data.current_user_id, expected_version)
    _validate_status(
        db, project, data.current_user_id,
        [Status.DRAFT, Status.RETURNED, Status.APPEAL_APPROVED],
        "冲突恢复",
    )
    _validate_user_role(db, data.current_user_id, [Role.REGISTRAR], project)
    _validate_handler(db, project, data.current_user_id)
    _validate_project_not_overdue(db, project, data.current_user_id)

    has_evidence, missing = crud.check_required_evidences(db, project_id, project.stage)
    if not has_evidence:
        _log_conflict(
            db, project, data.current_user_id,
            f"缺少必填证据材料: {[m.value for m in missing]}",
            "missing_required_evidences",
        )

    from_status = project.status
    project.status = Status.SUBMITTED
    project.version += 1

    supervisors = crud.get_users_by_role(db, Role.SUPERVISOR)
    next_handler_id = None
    next_handler_name = None
    if supervisors:
        project.current_handler_id = supervisors[0].id
        next_handler_id = supervisors[0].id
        next_handler_name = supervisors[0].name

    crud.add_operation_log(
        db,
        project_id=project_id,
        user_id=data.current_user_id,
        action=ActionType.CONFLICT_RECOVERED,
        from_status=from_status,
        to_status=Status.SUBMITTED,
        stage=project.stage,
        version=project.version,
        comment=data.comment,
        audit_note=data.audit_note,
        recovery_source=from_status,
        next_handler_id=next_handler_id,
        next_handler_name=next_handler_name,
    )

    db.commit()
    db.refresh(project)
    return project


def submit_appeal(
    db: Session,
    project_id: int,
    data: AppealSubmitData,
    expected_version: Optional[int] = None,
) -> TrainingProject:
    project = crud.get_project(db, project_id)
    if not project:
        raise BusinessError(f"项目 {project_id} 不存在", "project_not_found")

    _validate_version(db, project, data.current_user_id, expected_version)
    _validate_status(db, project, data.current_user_id, [Status.REJECTED], "提交申诉")
    _validate_user_role(db, data.current_user_id, [Role.REGISTRAR], project)
    _validate_project_not_overdue(db, project, data.current_user_id)

    if project.created_by_id != data.current_user_id:
        _log_conflict(
            db, project, data.current_user_id,
            "仅项目创建人可提交申诉",
            "not_project_creator",
        )

    from_status = project.status
    project.status = Status.APPEAL_SUBMITTED
    project.version += 1

    crud.create_appeal(
        db,
        AppealRecordCreate(
            submitter_id=data.current_user_id,
            appeal_reason=data.appeal_reason,
            submitter_opinion=data.submitter_opinion,
        ),
        project_id,
        project.version,
    )

    reviewers = crud.get_users_by_role(db, Role.REVIEWER)
    if reviewers:
        project.current_handler_id = reviewers[0].id
        project.status = Status.APPEAL_UNDER_REVIEW

    crud.add_operation_log(
        db,
        project_id=project_id,
        user_id=data.current_user_id,
        action=ActionType.APPEAL_SUBMIT,
        from_status=from_status,
        to_status=project.status,
        stage=project.stage,
        version=project.version,
        comment=data.submitter_opinion,
        reject_reason=data.appeal_reason,
    )

    db.commit()
    db.refresh(project)
    return project


def review_appeal(
    db: Session,
    project_id: int,
    data: AppealReviewData,
    expected_version: Optional[int] = None,
) -> TrainingProject:
    project = crud.get_project(db, project_id)
    if not project:
        raise BusinessError(f"项目 {project_id} 不存在", "project_not_found")

    _validate_version(db, project, data.current_user_id, expected_version)
    _validate_status(
        db, project, data.current_user_id,
        [Status.APPEAL_UNDER_REVIEW, Status.APPEAL_SUBMITTED],
        "复核申诉",
    )
    _validate_user_role(db, data.current_user_id, [Role.REVIEWER], project)
    _validate_handler(db, project, data.current_user_id)
    _validate_project_not_overdue(db, project, data.current_user_id)

    appeals = crud.get_project_appeals(db, project_id)
    pending_appeals = [a for a in appeals if a.result == AppealResult.PENDING]
    if not pending_appeals:
        _log_conflict(db, project, data.current_user_id, "没有待处理的申诉", "no_pending_appeal")

    appeal = pending_appeals[0]
    crud.review_appeal(
        db,
        appeal.id,
        AppealRecordReview(
            reviewer_id=data.current_user_id,
            reviewer_opinion=data.reviewer_opinion,
            result=data.result,
        ),
    )

    from_status = project.status
    if data.result == AppealResult.APPROVED:
        # 申诉通过：转回退回补正（RETURNED），把当前处理人还给登记员，
        # 由登记员补正后再次提交，形成「申诉通过 → 补正 → 再提交」闭环。
        project.status = Status.RETURNED
        project.current_handler_id = project.created_by_id
        action = ActionType.APPEAL_APPROVE
    else:
        project.status = Status.APPEAL_REJECTED
        project.current_handler_id = None
        action = ActionType.APPEAL_REJECT

    project.version += 1

    crud.add_operation_log(
        db,
        project_id=project_id,
        user_id=data.current_user_id,
        action=action,
        from_status=from_status,
        to_status=project.status,
        stage=project.stage,
        version=project.version,
        opinion=data.reviewer_opinion,
    )

    db.commit()
    db.refresh(project)
    return project


def archive_project(
    db: Session,
    project_id: int,
    current_user_id: int,
    expected_version: Optional[int] = None,
) -> TrainingProject:
    project = crud.get_project(db, project_id)
    if not project:
        raise BusinessError(f"项目 {project_id} 不存在", "project_not_found")

    _validate_version(db, project, current_user_id, expected_version)
    _validate_user_role(db, current_user_id, [Role.REVIEWER], project)
    _validate_status(
        db, project, current_user_id,
        [Status.APPROVED, Status.APPEAL_APPROVED, Status.APPEAL_REJECTED, Status.REJECTED],
        "归档",
    )

    from_status = project.status
    project.status = Status.ARCHIVED
    project.current_handler_id = None
    project.version += 1

    crud.add_operation_log(
        db,
        project_id=project_id,
        user_id=current_user_id,
        action=ActionType.ARCHIVE,
        from_status=from_status,
        to_status=Status.ARCHIVED,
        stage=project.stage,
        version=project.version,
    )

    db.commit()
    db.refresh(project)
    return project


def mark_overdue(db: Session, project_id: int, current_user_id: int) -> TrainingProject:
    project = crud.get_project(db, project_id)
    if not project:
        raise BusinessError(f"项目 {project_id} 不存在", "project_not_found")

    _validate_user_role(db, current_user_id, [Role.SUPERVISOR, Role.REVIEWER], project)
    _validate_status(
        db, project, current_user_id,
        [Status.SUBMITTED, Status.UNDER_REVIEW, Status.APPEAL_UNDER_REVIEW],
        "标记逾期",
    )

    from_status = project.status
    project.status = Status.OVERDUE
    project.is_overdue = True
    project.version += 1

    crud.add_operation_log(
        db,
        project_id=project_id,
        user_id=current_user_id,
        action=ActionType.MARK_OVERDUE,
        from_status=from_status,
        to_status=Status.OVERDUE,
        stage=project.stage,
        version=project.version,
    )

    db.commit()
    db.refresh(project)
    return project


def process_incoming_project(
    db: Session,
    project_id: int,
    data: ReceiveData,
    expected_version: Optional[int] = None,
) -> TrainingProject:
    project = crud.get_project(db, project_id)
    if not project:
        raise BusinessError(f"项目 {project_id} 不存在", "project_not_found")

    _validate_version(db, project, data.current_user_id, expected_version)
    _validate_handler(db, project, data.current_user_id)
    _validate_user_role(db, data.current_user_id, [Role.SUPERVISOR, Role.REVIEWER], project)

    if project.status not in [Status.SUBMITTED, Status.UNDER_REVIEW]:
        _log_conflict(
            db, project, data.current_user_id,
            f"项目状态不允许接收：当前状态 {project.status.value}，仅允许 submitted 或 under_review",
            "status_not_allowed",
        )

    from_status = project.status
    if from_status == Status.UNDER_REVIEW:
        project.version += 1

        crud.add_operation_log(
            db,
            project_id=project_id,
            user_id=data.current_user_id,
            action=ActionType.REVIEW_APPROVE,
            from_status=from_status,
            to_status=Status.UNDER_REVIEW,
            stage=project.stage,
            version=project.version,
            comment=data.comment or "已接收项目进入复核",
            audit_note=data.audit_note,
        )

        db.commit()
        db.refresh(project)
        return project

    project.status = Status.UNDER_REVIEW
    project.version += 1

    last_recovery = crud.get_last_recovery_log(db, project_id)
    is_from_recovery = last_recovery is not None

    crud.add_operation_log(
        db,
        project_id=project_id,
        user_id=data.current_user_id,
        action=ActionType.REVIEW_APPROVE,
        from_status=from_status,
        to_status=Status.UNDER_REVIEW,
        stage=project.stage,
        version=project.version,
        comment=data.comment or "已接收项目进入审核",
        audit_note=data.audit_note,
        receive_from_recovery=is_from_recovery,
        receive_source_status=last_recovery.recovery_source if is_from_recovery else None,
        next_status=Status.UNDER_REVIEW,
    )

    db.commit()
    db.refresh(project)
    return project
