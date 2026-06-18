from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.models import (
    ExhibitorApplication, ApplicationStatusEnum,
    RoleEnum, AuditActionEnum,
)
from app.utils.state_machine import can_transition, can_role_perform_action


class ActionValidationError(Exception):
    def __init__(self, message: str, code: int = 400):
        self.message = message
        self.code = code
        super().__init__(message)


def validate_and_get_application(
    db: Session,
    app_id: int,
    user_role: str,
    action: AuditActionEnum,
) -> ExhibitorApplication:
    application = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.id == app_id
    ).first()

    if not application:
        raise ActionValidationError("申请不存在", code=404)

    try:
        role_enum = RoleEnum(user_role)
    except ValueError:
        raise ActionValidationError("角色无效", code=403)

    if not can_role_perform_action(role_enum, action):
        raise ActionValidationError("权限不足：该角色无此操作权限", code=403)

    return application


def validate_status_transition(
    application: ExhibitorApplication,
    target_status: ApplicationStatusEnum,
) -> None:
    if not can_transition(application.status, target_status):
        raise ActionValidationError(
            f"状态流转不合法：当前状态【{application.status.value}】不能转换为【{target_status.value}】",
            code=400,
        )


def optimistic_update(
    db: Session,
    application: ExhibitorApplication,
    update_fields: dict,
) -> bool:
    old_version = application.version
    update_fields["version"] = old_version + 1

    rows = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.id == application.id,
        ExhibitorApplication.version == old_version,
    ).update(update_fields, synchronize_session=False)

    if rows == 0:
        db.rollback()
        return False

    application.version = old_version + 1
    return True


def execute_status_transition(
    db: Session,
    application: ExhibitorApplication,
    target_status: ApplicationStatusEnum,
    extra_fields: Optional[dict] = None,
    recalculate_deadline: bool = True,
) -> bool:
    validate_status_transition(application, target_status)

    old_version = application.version
    now = datetime.utcnow()

    update_data = {
        "status": target_status,
        "status_changed_at": now,
        "is_overdue": False,
        "overdue_reason": None,
        "version": old_version + 1,
    }

    if extra_fields:
        update_data.update(extra_fields)

    if target_status in [
        ApplicationStatusEnum.REJECTED,
        ApplicationStatusEnum.ARCHIVED,
    ]:
        update_data["deadline_at"] = None

    rows = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.id == application.id,
        ExhibitorApplication.version == old_version,
    ).update(update_data, synchronize_session=False)

    if rows == 0:
        db.rollback()
        return False

    db.refresh(application)

    if recalculate_deadline and target_status not in [
        ApplicationStatusEnum.REJECTED,
        ApplicationStatusEnum.ARCHIVED,
    ]:
        application.calculate_deadline()
        db.commit()
        db.refresh(application)

    return True
