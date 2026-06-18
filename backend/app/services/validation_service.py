from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.models import (
    ExhibitorApplication, ApplicationStatusEnum,
    RoleEnum, AuditActionEnum,
)
from app.utils.state_machine import can_transition, can_role_perform_action


class ActionError(Exception):
    def __init__(self, message: str, error_code: str = "BAD_REQUEST", data: Optional[dict] = None):
        self.message = message
        self.error_code = error_code
        self.data = data
        super().__init__(message)


def check_role_permission(user_role: str, action: AuditActionEnum) -> None:
    try:
        role_enum = RoleEnum(user_role)
    except ValueError:
        raise ActionError("角色无效", error_code="FORBIDDEN")

    if not can_role_perform_action(role_enum, action):
        raise ActionError(
            f"权限不足：{role_enum.value} 无权执行此操作",
            error_code="FORBIDDEN",
        )


def check_version(application: ExhibitorApplication, expected_version: int) -> None:
    if application.version != expected_version:
        raise ActionError(
            "申请已被其他操作修改，请刷新后重试",
            error_code="VERSION_CONFLICT",
            data={
                "current_version": application.version,
                "expected_version": expected_version,
                "current_status": application.status.value,
            },
        )


def check_status_allowed(
    application: ExhibitorApplication,
    allowed_statuses: list,
) -> None:
    if application.status not in allowed_statuses:
        allowed_str = "、".join(s.value for s in allowed_statuses)
        raise ActionError(
            f"当前状态【{application.status.value}】不支持此操作，仅【{allowed_str}】状态可操作",
            error_code="INVALID_STATUS",
            data={
                "current_status": application.status.value,
                "allowed_statuses": [s.value for s in allowed_statuses],
            },
        )


def check_overdue_remark(application: ExhibitorApplication, remark: str, needs_remark: bool) -> None:
    if needs_remark and application.is_overdue and not remark:
        raise ActionError(
            f"该申请已逾期（{application.overdue_reason or '原因未知'}），请填写逾期处理说明后再操作",
            error_code="OVERDUE_REMARK_REQUIRED",
            data={
                "current_status": application.status.value,
                "overdue_reason": application.overdue_reason,
            },
        )


def atomic_status_update(
    db: Session,
    application: ExhibitorApplication,
    expected_version: int,
    target_status: ApplicationStatusEnum,
    extra_fields: Optional[dict] = None,
    recalculate_deadline: bool = True,
) -> bool:
    check_version(application, expected_version)

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
        raise ActionError(
            "申请已被其他操作修改，请刷新后重试",
            error_code="VERSION_CONFLICT",
            data={"current_status": application.status.value},
        )

    db.refresh(application)

    if recalculate_deadline and target_status not in [
        ApplicationStatusEnum.REJECTED,
        ApplicationStatusEnum.ARCHIVED,
    ]:
        application.calculate_deadline()

    return True


def safe_commit_with_audit(
    db: Session,
    application: ExhibitorApplication,
    user_id: int,
    action: AuditActionEnum,
    action_name: str,
    old_status: ApplicationStatusEnum,
    new_status: ApplicationStatusEnum,
    remark: str = "",
) -> None:
    from app.services.application_service import add_audit_log
    add_audit_log(
        db, application.id, user_id, action, action_name,
        old_status, new_status, remark,
    )
    db.commit()
    db.refresh(application)
