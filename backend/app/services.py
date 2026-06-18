from typing import Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from .models import (
    User, TrainingProject, Role, Stage, Status, AppealResult, ActionType
)
from .schemas import (
    SubmitData, ReviewData, ReturnForCorrectionData, CorrectData,
    AppealSubmitData, AppealReviewData, AppealRecordCreate, AppealRecordReview
)
from . import crud


class BusinessError(Exception):
    def __init__(self, message: str, error_type: str = "business_error"):
        self.message = message
        self.error_type = error_type
        super().__init__(message)


def _validate_user_role(db: Session, user_id: int, allowed_roles: list[Role]) -> User:
    user = crud.get_user(db, user_id)
    if not user:
        raise BusinessError(f"用户 {user_id} 不存在", "user_not_found")
    if user.role not in allowed_roles:
        allowed_labels = [r.value for r in allowed_roles]
        raise BusinessError(
            f"用户角色不允许执行此操作，需要角色: {allowed_labels}",
            "role_not_allowed"
        )
    return user


def _validate_handler(db: Session, project: TrainingProject, user_id: int) -> None:
    if project.current_handler_id != user_id:
        raise BusinessError(
            f"当前处理人是用户 {project.current_handler_id}，用户 {user_id} 无权操作",
            "not_current_handler"
        )


def _validate_version(project: TrainingProject, expected_version: Optional[int] = None) -> None:
    if expected_version is not None and project.version != expected_version:
        raise BusinessError(
            f"版本冲突：当前版本 {project.version}，期望版本 {expected_version}",
            "version_conflict"
        )


def _validate_status(project: TrainingProject, allowed_statuses: list[Status], op_name: str) -> None:
    if project.status not in allowed_statuses:
        allowed = [s.value for s in allowed_statuses]
        raise BusinessError(
            f"项目状态不允许{op_name}：当前状态 {project.status.value}，允许状态: {allowed}",
            "status_not_allowed"
        )


def _validate_project_not_overdue(project: TrainingProject) -> None:
    if project.status == Status.OVERDUE:
        raise BusinessError("项目已逾期，无法执行操作", "project_overdue")


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

    _validate_version(project, expected_version)
    _validate_status(project, [Status.DRAFT, Status.RETURNED], "提交")
    _validate_user_role(db, data.current_user_id, [Role.REGISTRAR])
    _validate_handler(db, project, data.current_user_id)
    _validate_project_not_overdue(project)

    has_evidence, missing = crud.check_required_evidences(db, project_id, project.stage)
    if not has_evidence:
        raise BusinessError(
            f"缺少必填证据材料: {[m.value for m in missing]}",
            "missing_required_evidences"
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

    _validate_version(project, expected_version)
    _validate_status(project, [Status.UNDER_REVIEW, Status.SUBMITTED], "审核")
    _validate_user_role(db, data.current_user_id, [Role.SUPERVISOR, Role.REVIEWER])
    _validate_handler(db, project, data.current_user_id)
    _validate_project_not_overdue(project)

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
            raise BusinessError("驳回必须填写驳回原因", "missing_reject_reason")
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

    _validate_version(project, expected_version)
    _validate_status(project, [Status.UNDER_REVIEW, Status.SUBMITTED, Status.APPEAL_UNDER_REVIEW], "退回补正")
    _validate_user_role(db, data.current_user_id, [Role.SUPERVISOR, Role.REVIEWER])
    _validate_handler(db, project, data.current_user_id)
    _validate_project_not_overdue(project)

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

    _validate_version(project, expected_version)
    _validate_status(project, [Status.RETURNED], "补正")
    _validate_user_role(db, data.current_user_id, [Role.REGISTRAR])
    _validate_handler(db, project, data.current_user_id)
    _validate_project_not_overdue(project)

    has_evidence, missing = crud.check_required_evidences(db, project_id, project.stage)
    if not has_evidence:
        raise BusinessError(
            f"缺少必填证据材料: {[m.value for m in missing]}",
            "missing_required_evidences"
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


def submit_appeal(
    db: Session,
    project_id: int,
    data: AppealSubmitData,
    expected_version: Optional[int] = None,
) -> TrainingProject:
    project = crud.get_project(db, project_id)
    if not project:
        raise BusinessError(f"项目 {project_id} 不存在", "project_not_found")

    _validate_version(project, expected_version)
    _validate_status(project, [Status.REJECTED], "提交申诉")
    _validate_user_role(db, data.current_user_id, [Role.REGISTRAR])
    _validate_project_not_overdue(project)

    if project.created_by_id != data.current_user_id:
        raise BusinessError("仅项目创建人可提交申诉", "not_project_creator")

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

    _validate_version(project, expected_version)
    _validate_status(project, [Status.APPEAL_UNDER_REVIEW, Status.APPEAL_SUBMITTED], "复核申诉")
    _validate_user_role(db, data.current_user_id, [Role.REVIEWER])
    _validate_handler(db, project, data.current_user_id)
    _validate_project_not_overdue(project)

    appeals = crud.get_project_appeals(db, project_id)
    pending_appeals = [a for a in appeals if a.result == AppealResult.PENDING]
    if not pending_appeals:
        raise BusinessError("没有待处理的申诉", "no_pending_appeal")

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
        project.status = Status.APPEAL_APPROVED
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

    _validate_version(project, expected_version)
    _validate_user_role(db, current_user_id, [Role.REVIEWER])
    _validate_status(
        project,
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

    _validate_user_role(db, current_user_id, [Role.SUPERVISOR, Role.REVIEWER])

    if project.status not in [Status.SUBMITTED, Status.UNDER_REVIEW, Status.APPEAL_UNDER_REVIEW]:
        raise BusinessError(
            f"当前状态 {project.status.value} 无法标记为逾期",
            "status_not_allowed",
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
    current_user_id: int,
    expected_version: Optional[int] = None,
) -> TrainingProject:
    project = crud.get_project(db, project_id)
    if not project:
        raise BusinessError(f"项目 {project_id} 不存在", "project_not_found")

    _validate_version(project, expected_version)
    _validate_handler(db, project, current_user_id)
    _validate_user_role(db, current_user_id, [Role.SUPERVISOR, Role.REVIEWER])

    if project.status == Status.SUBMITTED:
        from_status = project.status
        project.status = Status.UNDER_REVIEW
        project.version += 1

        crud.add_operation_log(
            db,
            project_id=project_id,
            user_id=current_user_id,
            action=ActionType.REVIEW_APPROVE,
            from_status=from_status,
            to_status=Status.UNDER_REVIEW,
            stage=project.stage,
            version=project.version,
            comment="已接收项目进入审核",
        )

        db.commit()
        db.refresh(project)

    return project
