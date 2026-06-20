from datetime import datetime, timedelta
from config import (
    STATUS_DRAFT, STATUS_PENDING_REVIEW, STATUS_PENDING_CORRECTION,
    STATUS_UNDER_REVIEW, STATUS_PENDING_ARCHIVAL, STATUS_UNDER_ARCHIVAL,
    STATUS_COMPLETED, STATUS_OVERDUE, STATUS_REJECTED,
    ROLE_ACTION_STATUS, VALID_TRANSITIONS, DEADLINE_HOURS, ACTIONS,
    QUEUE_MAP, REQUIRED_MATERIALS, CORRECTION_MATERIALS,
)
import json


def validate_action(role: str, action: str, current_status: str) -> tuple[bool, str]:
    if role not in ACTIONS:
        return False, f"角色 {role} 不存在"

    if action not in ACTIONS[role]:
        return False, f"角色 {role} 无权执行动作 {action}"

    target_status = ROLE_ACTION_STATUS.get((role, action))
    if not target_status:
        return False, f"动作 {action} 在角色 {role} 下无定义目标状态"

    if target_status not in VALID_TRANSITIONS.get(current_status, []):
        if current_status == STATUS_OVERDUE:
            pass
        else:
            return False, f"当前状态 {current_status} 不允许转换到 {target_status}，正确顺序被违反"

    return True, ""


def get_target_status(role: str, action: str) -> str | None:
    return ROLE_ACTION_STATUS.get((role, action))


def get_current_role_for_status(status: str) -> str:
    for role, statuses in QUEUE_MAP.items():
        if status in statuses:
            return role
    return "登记员"


def calculate_deadline(status: str) -> str | None:
    hours = DEADLINE_HOURS.get(status)
    if hours is None:
        return None
    return (datetime.now() + timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M:%S")


def check_overdue(app: dict) -> tuple[bool, str, str]:
    if app["status"] in (STATUS_COMPLETED, STATUS_DRAFT, STATUS_OVERDUE):
        return False, "", ""

    if not app["deadline_at"]:
        return False, "", ""

    try:
        deadline = datetime.strptime(app["deadline_at"], "%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        return False, "", ""

    if datetime.now() > deadline:
        reason = f"超过{DEADLINE_HOURS.get(app['status'], '未知')}小时处理时限"
        action = _get_overdue_action(app["status"])
        return True, reason, action

    return False, "", ""


def _get_overdue_action(status: str) -> str:
    action_map = {
        STATUS_PENDING_REVIEW: "需审核主管立即处理或登记员撤回",
        STATUS_PENDING_CORRECTION: "需登记员补正后重新提交",
        STATUS_UNDER_REVIEW: "需审核主管继续审核或要求补正",
        STATUS_PENDING_ARCHIVAL: "需复核负责人立即复核归档",
        STATUS_UNDER_ARCHIVAL: "需复核负责人继续复核或退回",
    }
    return action_map.get(status, "请联系管理员处理")

get_overdue_action_text = _get_overdue_action


def validate_materials_for_submit(status: str, materials: list, action: str) -> tuple[bool, str]:
    if action in ("提交审核", "补正提交"):
        required = [m for m in materials if m.get("is_required") and m.get("category") == "transfer"]
        missing = [m["name"] for m in required if not m.get("is_submitted")]
        if missing:
            return False, f"必交材料未提交: {', '.join(missing)}"

    if action == "补正提交":
        correction_mats = [m for m in materials if m.get("category") == "correction"]
        if correction_mats:
            missing = [m["name"] for m in correction_mats if not m.get("is_submitted")]
            if missing:
                return False, f"补正材料未提交: {', '.join(missing)}"

    if action == "审核通过":
        required = [m for m in materials if m.get("is_required") and m.get("category") == "transfer"]
        missing = [m["name"] for m in required if not m.get("is_submitted")]
        if missing:
            return False, f"审核通过前必交材料缺失: {', '.join(missing)}"

    if action == "复核归档":
        required = [m for m in materials if m.get("is_required") and m.get("category") == "transfer"]
        missing = [m["name"] for m in required if not m.get("is_submitted")]
        if missing:
            return False, f"归档前必交材料缺失: {', '.join(missing)}"

    return True, ""


def validate_opinion_required(action: str, opinion: str | None) -> tuple[bool, str]:
    opinion_required_actions = [
        "审核通过", "审核驳回", "要求补正", "复核归档", "复核退回", "补正提交"
    ]
    if action in opinion_required_actions:
        if not opinion or not opinion.strip():
            return False, f"动作 {action} 必须填写处理意见"
    return True, ""
