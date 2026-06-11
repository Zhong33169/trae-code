from typing import Optional, Tuple, List, Dict
from ..database import get_sqlite_conn
from ..schemas.models import OperationSubmitRequest


ROLE_STAGE_PERMISSIONS = {
    "客户经理": ["开户预约"],
    "运营主管": ["资料审核"],
    "支行行长": ["账户启用"],
}

STAGE_TRANSITION_ORDER = ["开户预约", "资料审核", "账户启用"]

VALID_STATUSES = ["待签收", "异常回传", "签收完成"]


def _row_to_dict(cursor, row) -> Dict:
    """通过 cursor.description 将 tuple 转为 {列名: 值}"""
    if row is None:
        return {}
    columns = [desc[0] for desc in cursor.description]
    return dict(zip(columns, row))


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
        d = _row_to_dict(cursor, row)
        current_version = d.get("version")
        if current_version != provided_version:
            return False, f"版本冲突：当前版本为{current_version}，提交版本为{provided_version}", {}
        return True, "", {
            "id": d.get("id"),
            "version": current_version,
            "status": d.get("status"),
            "stage": d.get("stage"),
            "risk_level": d.get("risk_level"),
        }
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
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        evidences = []
        for row in rows:
            d = dict(zip(columns, row))
            evidences.append({
                "id": d.get("id"),
                "evidence_type": d.get("evidence_type"),
                "evidence_name": d.get("evidence_name"),
                "is_provided": d.get("is_provided", 0),
                "is_required": d.get("is_required", 0),
            })
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
        d = _row_to_dict(cursor, row)
        actual_role = d.get("role")
        if actual_role != operator_role:
            return False, f"处理人角色不匹配：用户角色为{actual_role}，提交角色为{operator_role}", {}
        return True, "", {
            "id": d.get("id"),
            "username": d.get("username"),
            "name": d.get("name"),
            "role": actual_role,
        }
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
