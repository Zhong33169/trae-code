from app.models import ApplicationStatusEnum, RoleEnum, AuditActionEnum


STATUS_TRANSITIONS = {
    ApplicationStatusEnum.DRAFT: [ApplicationStatusEnum.SUBMITTED],
    ApplicationStatusEnum.SUBMITTED: [ApplicationStatusEnum.UNDER_REVIEW],
    ApplicationStatusEnum.UNDER_REVIEW: [
        ApplicationStatusEnum.AUDIT_PASSED,
        ApplicationStatusEnum.CORRECTION_REQUESTED,
        ApplicationStatusEnum.REJECTED,
    ],
    ApplicationStatusEnum.CORRECTION_REQUESTED: [ApplicationStatusEnum.CORRECTED],
    ApplicationStatusEnum.CORRECTED: [ApplicationStatusEnum.UNDER_REVIEW],
    ApplicationStatusEnum.AUDIT_PASSED: [
        ApplicationStatusEnum.REVIEW_PASSED,
        ApplicationStatusEnum.UNDER_REVIEW,
    ],
    ApplicationStatusEnum.REVIEW_PASSED: [ApplicationStatusEnum.ARCHIVED],
    ApplicationStatusEnum.REJECTED: [],
    ApplicationStatusEnum.ARCHIVED: [],
}


ROLE_ACTIONS = {
    RoleEnum.REGISTRAR: [
        AuditActionEnum.CREATE,
        AuditActionEnum.UPDATE,
        AuditActionEnum.SUBMIT,
        AuditActionEnum.CORRECT,
    ],
    RoleEnum.AUDIT_SUPERVISOR: [
        AuditActionEnum.START_AUDIT,
        AuditActionEnum.REQUEST_CORRECTION,
        AuditActionEnum.AUDIT_PASS,
        AuditActionEnum.REJECT,
    ],
    RoleEnum.REVIEW_LEADER: [
        AuditActionEnum.REVIEW_PASS,
        AuditActionEnum.REJECT,
        AuditActionEnum.ARCHIVE,
    ],
}


def can_transition(from_status: ApplicationStatusEnum, to_status: ApplicationStatusEnum) -> bool:
    allowed = STATUS_TRANSITIONS.get(from_status, [])
    return to_status in allowed


def can_role_perform_action(role: RoleEnum, action: AuditActionEnum) -> bool:
    allowed = ROLE_ACTIONS.get(role, [])
    return action in allowed


def get_allowed_statuses(current_status: ApplicationStatusEnum) -> list:
    return list(STATUS_TRANSITIONS.get(current_status, []))
