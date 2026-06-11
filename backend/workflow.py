from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


ROLE_REGISTRAR = "registrar"
ROLE_SUPERVISOR = "supervisor"
ROLE_REVIEWER = "reviewer"

STATUS_DRAFT = "draft"
STATUS_SUBMITTED = "submitted"
STATUS_UNDER_REVIEW = "under_review"
STATUS_REVIEWED = "reviewed"
STATUS_ARCHIVED = "archived"
STATUS_REJECTED = "rejected"
STATUS_RETURNED = "returned"

STATUS_LABELS = {
    STATUS_DRAFT: "草稿",
    STATUS_SUBMITTED: "已提交",
    STATUS_UNDER_REVIEW: "审核中",
    STATUS_REVIEWED: "已审核",
    STATUS_ARCHIVED: "已归档",
    STATUS_REJECTED: "已驳回",
    STATUS_RETURNED: "已退回",
}

ROLE_LABELS = {
    ROLE_REGISTRAR: "登记员",
    ROLE_SUPERVISOR: "审核主管",
    ROLE_REVIEWER: "复核负责人",
}

VALID_TRANSITIONS = {
    (ROLE_REGISTRAR, STATUS_DRAFT): [STATUS_SUBMITTED],
    (ROLE_REGISTRAR, STATUS_RETURNED): [STATUS_SUBMITTED],
    (ROLE_SUPERVISOR, STATUS_SUBMITTED): [STATUS_UNDER_REVIEW],
    (ROLE_SUPERVISOR, STATUS_UNDER_REVIEW): [STATUS_REVIEWED, STATUS_REJECTED, STATUS_RETURNED],
    (ROLE_REVIEWER, STATUS_REVIEWED): [STATUS_ARCHIVED, STATUS_RETURNED],
}

ACTION_STATUS_MAP = {
    "submit": STATUS_SUBMITTED,
    "review": STATUS_UNDER_REVIEW,
    "approve_review": STATUS_REVIEWED,
    "reject": STATUS_REJECTED,
    "return": STATUS_RETURNED,
    "resubmit": STATUS_SUBMITTED,
    "archive": STATUS_ARCHIVED,
}

ROLE_ACTION_PERMISSIONS = {
    ROLE_REGISTRAR: {"submit", "resubmit"},
    ROLE_SUPERVISOR: {"review", "approve_review", "reject", "return"},
    ROLE_REVIEWER: {"archive", "return"},
}

MIN_EVIDENCE_FOR_SUBMIT = 2
MIN_EVIDENCE_FOR_REVIEW = 1
MIN_EVIDENCE_FOR_ARCHIVE = 1


@dataclass
class ValidationResult:
    valid: bool
    reason: str = ""
    details: Optional[dict] = None


def validate_workflow_transition(role: str, current_status: str, action: str) -> ValidationResult:
    if role not in ROLE_ACTION_PERMISSIONS:
        return ValidationResult(False, f"未知角色: {role}")

    if action not in ROLE_ACTION_PERMISSIONS[role]:
        return ValidationResult(False, f"角色[{ROLE_LABELS.get(role, role)}]无权执行[{action}]操作")

    if action not in ACTION_STATUS_MAP:
        return ValidationResult(False, f"未知操作: {action}")

    target_status = ACTION_STATUS_MAP[action]
    key = (role, current_status)
    if key not in VALID_TRANSITIONS:
        return ValidationResult(
            False,
            f"角色[{ROLE_LABELS.get(role, role)}]不能对状态为[{STATUS_LABELS.get(current_status, current_status)}]的巡检单执行操作",
        )

    if target_status not in VALID_TRANSITIONS[key]:
        return ValidationResult(
            False,
            f"巡检单当前状态[{STATUS_LABELS.get(current_status, current_status)}]不允许流转到[{STATUS_LABELS.get(target_status, target_status)}]",
        )

    return ValidationResult(True)


def validate_version(ticket_version: int, submitted_version: int) -> ValidationResult:
    if submitted_version != ticket_version:
        return ValidationResult(
            False,
            f"版本冲突: 当前版本为{ticket_version}，提交版本为{submitted_version}，数据可能已被他人修改，请刷新后重试",
        )
    return ValidationResult(True)


def validate_evidence_for_action(action: str, evidence_count: int) -> ValidationResult:
    required = 0
    if action in ("submit", "resubmit"):
        required = MIN_EVIDENCE_FOR_SUBMIT
    elif action in ("review", "approve_review"):
        required = MIN_EVIDENCE_FOR_REVIEW
    elif action == "archive":
        required = MIN_EVIDENCE_FOR_ARCHIVE

    if evidence_count < required:
        return ValidationResult(
            False,
            f"证据不足: 执行[{action}]操作至少需要{required}条证据，当前仅有{evidence_count}条",
            {"required": required, "current": evidence_count},
        )
    return ValidationResult(True)


def validate_supplement_not_duplicate(existing_supplements: list, field_name: str, new_value: str) -> ValidationResult:
    for s in existing_supplements:
        if s["field_name"] == field_name and s["new_value"] == new_value:
            return ValidationResult(
                False,
                f"重复补录: 字段[{field_name}]已存在相同的补录值[{new_value}]，请勿重复提交",
            )
    return ValidationResult(True)


def validate_supplement_reason(reason: str) -> ValidationResult:
    if not reason or len(reason.strip()) < 2:
        return ValidationResult(False, "补录原因不能为空且不少于2个字符")
    return ValidationResult(True)
