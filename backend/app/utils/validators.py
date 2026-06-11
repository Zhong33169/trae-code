from typing import Optional, Tuple, List
from ..database import get_sqlite_conn
from ..schemas.models import OperationSubmitRequest


ROLE_STAGE_PERMISSIONS = {
    "客户经理": ["开户预约"],
    "运营主管": ["资料审核"],
    "支行行长": ["账户启用"],
}

STAGE_TRANSITION_ORDER = ["开户预约", "资料审核", "账户启用"]

VALID_STATUSES = ["待签收", "异常回传", "签收完成"]


def validate_role_and_stage(role: str, current_stage: str) -> Tuple[bool, str]:
    allowed_stages = ROLE_STAGE_PERMISSIONS.get(role, [])
    if current_stage not in allowed_stages:
        return False, f"角色[{role}]无权处理阶段[{current_stage}]的申请"
    return True, ""


def validate_role_advance_permission(role: str, from_stage: str, to_stage: str) -> Tuple[bool, str]:
    if from_stage == "开户预约" and to_stage == "资料审核":
        if role != "客户经理":
            return False, "只有客户经理可以推进从开户预约到资料审核"
    elif from_stage == "资料审核" and to_stage == "账户启用":
        if role != "运营主管":
            return False, "只有运营主管可以推进从资料审核到账户启用"
    return True, ""


def validate_role_archive_permission(role: str) -> Tuple[bool, str]:
    if role != "支行行长":
        return False, "只有支行行长可以完成归档（签收完成）"
    return True, ""


def validate_version(application_id: int, provided_version: int) -> Tuple[bool, str, dict]:
    conn = get_sqlite_conn()
    try:
        cursor = conn.execute(
            "SELECT id, version, status, stage, risk_level FROM account_applications WHERE id = ?",
            (application_id,)
        )
        row = cursor.fetchone()
        if not row:
            return False, "申请不存在", {}
        current_version = row[1]
        if current_version != provided_version:
            return False, f"版本冲突：当前版本为{current_version}，提交版本为{provided_version}", {}
        app_data = {
            "id": row[0],
            "version": row[1],
            "status": row[2],
            "stage": row[3],
            "risk_level": row[4],
        }
        return True, "", app_data
    finally:
        conn.close()


def validate_required_evidences(application_id: int) -> Tuple[bool, str, List[dict]]:
    conn = get_sqlite_conn()
    try:
        cursor = conn.execute(
            "SELECT id, evidence_type, evidence_name, is_provided, is_required "
            "FROM evidence_items WHERE application_id = ?",
            (application_id,)
        )
        evidences = [
            {
                "id": row[0],
                "evidence_type": row[1],
                "evidence_name": row[2],
                "is_provided": row[3],
                "is_required": row[4],
            }
            for row in cursor.fetchall()
        ]
        missing_required = [e for e in evidences if e["is_required"] == 1 and e["is_provided"] == 0]
        if missing_required:
            names = ", ".join([e["evidence_name"] for e in missing_required])
            return False, f"必填证据缺失：{names}", evidences
        return True, "", evidences
    finally:
        conn.close()


def validate_operator(operator_id: int, operator_role: str) -> Tuple[bool, str, dict]:
    conn = get_sqlite_conn()
    try:
        cursor = conn.execute(
            "SELECT id, username, name, role FROM users WHERE id = ?",
            (operator_id,)
        )
        row = cursor.fetchone()
        if not row:
            return False, "处理人不存在", {}
        if row[3] != operator_role:
            return False, f"处理人角色不匹配：用户角色为{row[3]}，提交角色为{operator_role}", {}
        user_data = {
            "id": row[0],
            "username": row[1],
            "name": row[2],
            "role": row[3],
        }
        return True, "", user_data
    finally:
        conn.close()


def validate_risk_level_change(from_level: str, to_level: str, change_reason: Optional[str]) -> Tuple[bool, str]:
    if from_level == to_level:
        return True, ""
    if not change_reason or len(change_reason.strip()) < 5:
        return False, "风险等级变更必须填写变更原因（至少5个字符）"
    if to_level not in ["low", "medium", "high"]:
        return False, "无效的风险等级"
    return True, ""


def validate_submit_request(req: OperationSubmitRequest) -> Tuple[bool, str, dict]:
    ok, msg, user = validate_operator(req.operator_id, req.operator_role)
    if not ok:
        return False, msg, {}

    ok, msg, app = validate_version(req.application_id, req.current_version)
    if not ok:
        return False, msg, {}

    ok, msg = validate_role_and_stage(req.operator_role, app["stage"])
    if not ok:
        return False, msg, {}

    context = {
        "user": user,
        "application": app,
    }
    return True, "", context
