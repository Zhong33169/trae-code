from typing import Optional, Tuple, List, Dict, Any
from datetime import datetime
from ..database import get_sqlite_conn
from ..schemas.models import (
    OperationSubmitRequest,
    AccountApplication,
    OperationRecord,
    RiskLevelLog,
    EvidenceItem,
)
from .validators import (
    validate_submit_request,
    validate_role_advance_permission,
    validate_role_archive_permission,
    validate_required_evidences,
    validate_risk_level_change,
)
from .application_no import generate_application_no


STAGE_ORDER = ["开户预约", "资料审核", "账户启用"]


def _isoformat(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str):
        return value
    return str(value)


def _row_to_dict(cursor, row: tuple) -> Dict:
    """通过 cursor.description 将 tuple 转为 {列名: 值} 的字典，不依赖列顺序"""
    if row is None:
        return {}
    columns = [desc[0] for desc in cursor.description]
    return dict(zip(columns, row))


def _rows_to_dicts(cursor, rows: List[tuple]) -> List[Dict]:
    """批量转换行列表为字典列表"""
    if not rows:
        return []
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, row)) for row in rows]


APPLICATION_COLUMNS = """
    a.id, a.application_no, a.applicant_name, a.applicant_id_card, a.applicant_phone,
    a.account_type, a.risk_level, a.risk_reason, a.stage, a.status,
    a.current_handler_id, a.version, a.deadline, a.is_overdue, a.is_evidence_missing,
    a.is_returned, a.returned_reason, a.created_at, a.updated_at,
    u.name AS handler_name, u.role AS handler_role
"""

EVIDENCE_COLUMNS = """
    id, application_id, evidence_type, evidence_name,
    is_provided, is_required, verified_at, verified_by, created_at
"""

OPERATION_COLUMNS = """
    o.id, o.application_id, o.operator_id, o.operator_role, o.operation_type,
    o.is_success, o.from_stage, o.to_stage, o.from_status, o.to_status,
    o.from_risk_level, o.to_risk_level, o.remark, o.evidence_checked,
    o.version_before, o.version_after, o.created_at,
    u.name AS operator_name
"""

RISK_LOG_COLUMNS = """
    r.id, r.application_id, r.operator_id, r.operator_role,
    r.from_level, r.to_level, r.change_reason, r.created_at,
    u.name AS operator_name
"""


def _map_application(d: Dict, evidences: Optional[List] = None) -> Dict:
    return {
        "id": d.get("id"),
        "application_no": d.get("application_no"),
        "applicant_name": d.get("applicant_name"),
        "applicant_id_card": d.get("applicant_id_card"),
        "applicant_phone": d.get("applicant_phone"),
        "account_type": d.get("account_type"),
        "risk_level": d.get("risk_level"),
        "risk_reason": d.get("risk_reason"),
        "stage": d.get("stage"),
        "status": d.get("status"),
        "current_handler_id": d.get("current_handler_id"),
        "current_handler_name": d.get("handler_name"),
        "current_handler_role": d.get("handler_role"),
        "version": d.get("version"),
        "deadline": _isoformat(d.get("deadline")),
        "is_overdue": d.get("is_overdue", 0),
        "is_evidence_missing": d.get("is_evidence_missing", 0),
        "is_returned": d.get("is_returned", 0),
        "returned_reason": d.get("returned_reason"),
        "created_at": _isoformat(d.get("created_at")),
        "updated_at": _isoformat(d.get("updated_at")),
        "evidences": evidences,
    }


def _map_evidence(d: Dict) -> Dict:
    return {
        "id": d.get("id"),
        "application_id": d.get("application_id"),
        "evidence_type": d.get("evidence_type"),
        "evidence_name": d.get("evidence_name"),
        "is_provided": d.get("is_provided", 0),
        "is_required": d.get("is_required", 0),
        "verified_at": _isoformat(d.get("verified_at")),
        "verified_by": d.get("verified_by"),
        "created_at": _isoformat(d.get("created_at")),
    }


def _map_operation(d: Dict) -> Dict:
    is_success = d.get("is_success")
    if is_success is None:
        is_success = 0 if d.get("operation_type") == "操作失败" else 1
    return {
        "id": d.get("id"),
        "application_id": d.get("application_id"),
        "operator_id": d.get("operator_id"),
        "operator_role": d.get("operator_role"),
        "operation_type": d.get("operation_type"),
        "is_success": is_success,
        "from_stage": d.get("from_stage"),
        "to_stage": d.get("to_stage"),
        "from_status": d.get("from_status"),
        "to_status": d.get("to_status"),
        "from_risk_level": d.get("from_risk_level"),
        "to_risk_level": d.get("to_risk_level"),
        "remark": d.get("remark"),
        "evidence_checked": d.get("evidence_checked"),
        "version_before": d.get("version_before"),
        "version_after": d.get("version_after"),
        "created_at": _isoformat(d.get("created_at")),
        "operator_name": d.get("operator_name"),
    }


def _map_risk_log(d: Dict) -> Dict:
    return {
        "id": d.get("id"),
        "application_id": d.get("application_id"),
        "operator_id": d.get("operator_id"),
        "operator_role": d.get("operator_role"),
        "from_level": d.get("from_level"),
        "to_level": d.get("to_level"),
        "change_reason": d.get("change_reason"),
        "created_at": _isoformat(d.get("created_at")),
        "operator_name": d.get("operator_name"),
    }


def get_application_list(
    stage: Optional[str] = None,
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    handler_id: Optional[int] = None,
) -> List[Dict]:
    conn = get_sqlite_conn()
    try:
        sql = f"""
            SELECT {APPLICATION_COLUMNS}
            FROM account_applications a
            LEFT JOIN users u ON a.current_handler_id = u.id
            WHERE 1=1
        """
        params = []
        if stage:
            sql += " AND a.stage = ?"
            params.append(stage)
        if status:
            sql += " AND a.status = ?"
            params.append(status)
        if risk_level:
            sql += " AND a.risk_level = ?"
            params.append(risk_level)
        if handler_id:
            sql += " AND a.current_handler_id = ?"
            params.append(handler_id)
        sql += " ORDER BY a.created_at DESC"

        cursor = conn.execute(sql, params)
        app_rows = cursor.fetchall()
        app_dicts = _rows_to_dicts(cursor, app_rows)

        result = []
        for app_dict in app_dicts:
            app_id = app_dict.get("id")
            ev_cursor = conn.execute(
                f"SELECT {EVIDENCE_COLUMNS} FROM evidence_items WHERE application_id = ? ORDER BY id",
                (app_id,)
            )
            ev_rows = ev_cursor.fetchall()
            ev_dicts = _rows_to_dicts(ev_cursor, ev_rows)
            evidences = [_map_evidence(ev) for ev in ev_dicts]
            result.append(_map_application(app_dict, evidences))
        return result
    finally:
        conn.close()


def get_application_detail(application_id: int) -> Optional[Dict]:
    conn = get_sqlite_conn()
    try:
        cursor = conn.execute(
            f"""
            SELECT {APPLICATION_COLUMNS}
            FROM account_applications a
            LEFT JOIN users u ON a.current_handler_id = u.id
            WHERE a.id = ?
            """,
            (application_id,)
        )
        row = cursor.fetchone()
        if not row:
            return None
        app_dict = _row_to_dict(cursor, row)

        ev_cursor = conn.execute(
            f"SELECT {EVIDENCE_COLUMNS} FROM evidence_items WHERE application_id = ? ORDER BY id",
            (application_id,)
        )
        ev_rows = ev_cursor.fetchall()
        ev_dicts = _rows_to_dicts(ev_cursor, ev_rows)
        evidences = [_map_evidence(ev) for ev in ev_dicts]
        return _map_application(app_dict, evidences)
    finally:
        conn.close()


def get_operation_records(application_id: int) -> List[Dict]:
    conn = get_sqlite_conn()
    try:
        cursor = conn.execute(
            f"""
            SELECT {OPERATION_COLUMNS}
            FROM operation_records o
            LEFT JOIN users u ON o.operator_id = u.id
            WHERE o.application_id = ?
            ORDER BY o.created_at DESC
            """,
            (application_id,)
        )
        rows = cursor.fetchall()
        dicts = _rows_to_dicts(cursor, rows)
        return [_map_operation(d) for d in dicts]
    finally:
        conn.close()


def get_risk_level_logs(application_id: int) -> List[Dict]:
    conn = get_sqlite_conn()
    try:
        cursor = conn.execute(
            f"""
            SELECT {RISK_LOG_COLUMNS}
            FROM risk_level_logs r
            LEFT JOIN users u ON r.operator_id = u.id
            WHERE r.application_id = ?
            ORDER BY r.created_at DESC
            """,
            (application_id,)
        )
        rows = cursor.fetchall()
        dicts = _rows_to_dicts(cursor, rows)
        return [_map_risk_log(d) for d in dicts]
    finally:
        conn.close()


def get_statistics() -> Dict:
    conn = get_sqlite_conn()
    try:
        cursor = conn.execute("SELECT COUNT(*) FROM account_applications")
        total = cursor.fetchone()[0]

        cursor.execute("SELECT status, COUNT(*) FROM account_applications GROUP BY status")
        status_counts = {row[0]: row[1] for row in cursor.fetchall()}

        cursor.execute("SELECT risk_level, COUNT(*) FROM account_applications GROUP BY risk_level")
        risk_counts = {row[0]: row[1] for row in cursor.fetchall()}

        cursor.execute("SELECT stage, COUNT(*) FROM account_applications GROUP BY stage")
        stage_counts = {row[0]: row[1] for row in cursor.fetchall()}

        cursor.execute("SELECT COUNT(*) FROM account_applications WHERE is_overdue = 1")
        overdue = cursor.fetchone()[0]

        return {
            "total_count": total,
            "pending_count": status_counts.get("待签收", 0),
            "abnormal_count": status_counts.get("异常回传", 0),
            "done_count": status_counts.get("签收完成", 0),
            "high_risk_count": risk_counts.get("high", 0),
            "medium_risk_count": risk_counts.get("medium", 0),
            "low_risk_count": risk_counts.get("low", 0),
            "overdue_count": overdue,
            "stage_booking_count": stage_counts.get("开户预约", 0),
            "stage_review_count": stage_counts.get("资料审核", 0),
            "stage_enable_count": stage_counts.get("账户启用", 0),
        }
    finally:
        conn.close()


def get_users() -> List[Dict]:
    conn = get_sqlite_conn()
    try:
        cursor = conn.execute(
            "SELECT id, username, name, role FROM users ORDER BY id"
        )
        rows = cursor.fetchall()
        dicts = _rows_to_dicts(cursor, rows)
        return [
            {
                "id": d.get("id"),
                "username": d.get("username"),
                "name": d.get("name"),
                "role": d.get("role"),
            }
            for d in dicts
        ]
    finally:
        conn.close()


def handle_submit_operation(req: OperationSubmitRequest) -> Tuple[bool, str, Optional[Dict]]:
    ok, msg, context = validate_submit_request(req)
    if not ok:
        return False, msg, None

    user = context["user"]
    app = context["application"]
    conn = get_sqlite_conn()
    try:
        cursor = conn.cursor()

        new_stage = app["stage"]
        new_status = app["status"]
        new_risk_level = app["risk_level"]
        operation_type = "操作"
        remark = req.remark or ""
        returned_reason = app.get("returned_reason")
        is_returned = 0
        is_evidence_missing = 0

        if req.action == "advance_stage":
            current_idx = STAGE_ORDER.index(app["stage"])
            if current_idx >= len(STAGE_ORDER) - 1:
                return False, "已在最后阶段，无法继续推进", None
            target_stage = STAGE_ORDER[current_idx + 1]
            ok, msg = validate_role_advance_permission(
                req.operator_role, app["stage"], target_stage
            )
            if not ok:
                _record_operation_failed(cursor, req, app, "阶段推进失败: " + msg)
                conn.commit()
                return False, msg, None

            ok, msg, evidences = validate_required_evidences(req.application_id)
            if not ok:
                _record_operation_failed(cursor, req, app, "阶段推进失败: " + msg)
                conn.commit()
                return False, msg, None

            new_stage = target_stage
            new_status = "待签收"
            operation_type = "阶段推进"
            remark = f"从{app['stage']}推进到{new_stage}"

        elif req.action == "sign_complete":
            if app["stage"] != "账户启用":
                return False, "只有账户启用阶段可以签收完成", None
            ok, msg = validate_role_archive_permission(req.operator_role)
            if not ok:
                _record_operation_failed(cursor, req, app, "签收失败: " + msg)
                conn.commit()
                return False, msg, None

            ok, msg, evidences = validate_required_evidences(req.application_id)
            if not ok:
                _record_operation_failed(cursor, req, app, "签收失败: " + msg)
                conn.commit()
                return False, msg, None

            new_status = "签收完成"
            operation_type = "签收完成"
            remark = "支行行长完成最终审批，账户启用归档"

        elif req.action == "sign_receive":
            new_status = "签收完成"
            operation_type = "签收"
            remark = f"{user['name']}已签收"

        elif req.action == "return_back":
            current_idx = STAGE_ORDER.index(app["stage"])
            if current_idx > 0:
                new_stage = STAGE_ORDER[current_idx - 1]
            new_status = "异常回传"
            is_returned = 1
            returned_reason = req.returned_reason or "资料不完整，请补充后重新提交"

            ok, msg, _ = validate_required_evidences(req.application_id)
            if not ok:
                is_evidence_missing = 1

            operation_type = "退回补正"
            remark = returned_reason

        elif req.action == "mark_abnormal":
            new_status = "异常回传"
            is_returned = 1
            returned_reason = req.returned_reason or "存在异常"
            operation_type = "异常标记"
            remark = returned_reason

        else:
            return False, f"未知操作: {req.action}", None

        if req.new_risk_level and req.new_risk_level != app["risk_level"]:
            ok, msg = validate_risk_level_change(
                app["risk_level"], req.new_risk_level, req.risk_change_reason
            )
            if not ok:
                _record_operation_failed(cursor, req, app, "风险变更失败: " + msg)
                conn.commit()
                return False, msg, None
            new_risk_level = req.new_risk_level

            cursor.execute(
                """
                INSERT INTO risk_level_logs (
                    application_id, operator_id, operator_role, from_level, to_level, change_reason
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    req.application_id,
                    req.operator_id,
                    req.operator_role,
                    app["risk_level"],
                    new_risk_level,
                    req.risk_change_reason or "风险等级调整",
                )
            )
            if not remark:
                remark = f"风险等级从{app['risk_level']}调整为{new_risk_level}"
            else:
                remark += f"；风险等级从{app['risk_level']}调整为{new_risk_level}"

        new_handler_id = None
        if new_stage == "开户预约":
            cursor.execute("SELECT id FROM users WHERE role = '客户经理' ORDER BY id LIMIT 1")
            row = cursor.fetchone()
            new_handler_id = row[0] if row else req.operator_id
        elif new_stage == "资料审核":
            cursor.execute("SELECT id FROM users WHERE role = '运营主管' ORDER BY id LIMIT 1")
            row = cursor.fetchone()
            new_handler_id = row[0] if row else req.operator_id
        elif new_stage == "账户启用":
            cursor.execute("SELECT id FROM users WHERE role = '支行行长' ORDER BY id LIMIT 1")
            row = cursor.fetchone()
            new_handler_id = row[0] if row else req.operator_id

        if req.evidence_ids_verified:
            for ev_id in req.evidence_ids_verified:
                cursor.execute(
                    """
                    UPDATE evidence_items
                    SET is_provided = 1, verified_at = ?, verified_by = ?
                    WHERE id = ? AND application_id = ?
                    """,
                    (datetime.now().isoformat(), req.operator_id, ev_id, req.application_id)
                )

        evidence_checked_str = None
        if req.evidence_ids_verified:
            evidence_checked_str = ",".join(str(x) for x in req.evidence_ids_verified)

        new_version = app["version"] + 1

        cursor.execute(
            """
            UPDATE account_applications
            SET stage = ?, status = ?, risk_level = ?, current_handler_id = ?,
                version = ?, is_returned = ?, returned_reason = ?,
                is_evidence_missing = ?, updated_at = ?
            WHERE id = ? AND version = ?
            """,
            (
                new_stage,
                new_status,
                new_risk_level,
                new_handler_id,
                new_version,
                is_returned,
                returned_reason,
                is_evidence_missing,
                datetime.now().isoformat(),
                req.application_id,
                req.current_version,
            )
        )

        if cursor.rowcount == 0:
            conn.rollback()
            return False, "更新失败，可能存在版本冲突，请刷新后重试", None

        cursor.execute(
            """
            INSERT INTO operation_records (
                application_id, operator_id, operator_role, operation_type,
                is_success, from_stage, to_stage, from_status, to_status,
                from_risk_level, to_risk_level, remark,
                evidence_checked, version_before, version_after
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                req.application_id,
                req.operator_id,
                req.operator_role,
                operation_type,
                1,
                app["stage"],
                new_stage,
                app["status"],
                new_status,
                app["risk_level"],
                new_risk_level,
                remark,
                evidence_checked_str,
                app["version"],
                new_version,
            )
        )

        conn.commit()

        updated_app = get_application_detail(req.application_id)
        return True, "操作成功", updated_app

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def _record_operation_failed(cursor, req: OperationSubmitRequest, app: Dict, reason: str):
    cursor.execute(
        """
        INSERT INTO operation_records (
            application_id, operator_id, operator_role, operation_type,
            is_success, from_stage, to_stage, from_status, to_status,
            from_risk_level, to_risk_level, remark,
            evidence_checked, version_before, version_after
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            req.application_id,
            req.operator_id,
            req.operator_role,
            "操作失败",
            0,
            app["stage"],
            None,
            app["status"],
            None,
            app["risk_level"],
            None,
            reason,
            None,
            app["version"],
            app["version"],
        )
    )


def create_application(data: Dict) -> Tuple[bool, str, Optional[Dict]]:
    conn = get_sqlite_conn()
    try:
        app_no = generate_application_no(conn)

        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO account_applications (
                application_no, applicant_name, applicant_id_card, applicant_phone,
                account_type, risk_level, risk_reason, stage, status,
                current_handler_id, deadline
            ) VALUES (?, ?, ?, ?, ?, ?, ?, '开户预约', '待签收', ?, ?)
            """,
            (
                app_no,
                data["applicant_name"],
                data["applicant_id_card"],
                data.get("applicant_phone"),
                data["account_type"],
                data.get("risk_level", "low"),
                data.get("risk_reason"),
                1,
                data.get("deadline", datetime.now().isoformat()),
            )
        )
        app_id = cursor.lastrowid

        for ev in data.get("evidences", []):
            cursor.execute(
                """
                INSERT INTO evidence_items (
                    application_id, evidence_type, evidence_name,
                    is_provided, is_required
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (
                    app_id,
                    ev["evidence_type"],
                    ev["evidence_name"],
                    ev.get("is_provided", 0),
                    ev.get("is_required", 1),
                )
            )

        cursor.execute(
            """
            INSERT INTO operation_records (
                application_id, operator_id, operator_role, operation_type,
                is_success, from_stage, to_stage, from_status, to_status,
                from_risk_level, to_risk_level, remark,
                evidence_checked, version_before, version_after
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                app_id,
                1,
                "客户经理",
                "创建申请",
                1,
                None,
                "开户预约",
                None,
                "待签收",
                None,
                None,
                "创建开户申请",
                None,
                0,
                1,
            )
        )

        conn.commit()
        new_app = get_application_detail(app_id)
        return True, "创建成功", new_app
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()
