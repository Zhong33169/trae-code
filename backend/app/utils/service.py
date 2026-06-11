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


def _dict_to_evidence(ev: tuple) -> Dict:
    return {
        "id": ev[0],
        "application_id": ev[1],
        "evidence_type": ev[2],
        "evidence_name": ev[3],
        "is_provided": ev[4],
        "is_required": ev[5],
        "verified_at": _isoformat(ev[6]),
        "verified_by": ev[7],
        "created_at": _isoformat(ev[8]),
    }


def _dict_to_application(row: tuple, evidences: Optional[List] = None) -> Dict:
    return {
        "id": row[0],
        "application_no": row[1],
        "applicant_name": row[2],
        "applicant_id_card": row[3],
        "applicant_phone": row[4],
        "account_type": row[5],
        "risk_level": row[6],
        "risk_reason": row[7],
        "stage": row[8],
        "status": row[9],
        "current_handler_id": row[10],
        "current_handler_name": row[19] if len(row) > 19 and row[19] else None,
        "current_handler_role": row[20] if len(row) > 20 and row[20] else None,
        "version": row[11],
        "deadline": _isoformat(row[12]),
        "is_overdue": row[13],
        "is_evidence_missing": row[14],
        "is_returned": row[15],
        "returned_reason": row[16],
        "created_at": _isoformat(row[17]),
        "updated_at": _isoformat(row[18]),
        "evidences": evidences,
    }


def get_application_list(
    stage: Optional[str] = None,
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    handler_id: Optional[int] = None,
) -> List[Dict]:
    conn = get_sqlite_conn()
    try:
        sql = """
            SELECT a.*, u.name as handler_name, u.role as handler_role
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
        rows = cursor.fetchall()

        result = []
        for row in rows:
            app = _dict_to_application(row)
            ev_cursor = conn.execute(
                "SELECT * FROM evidence_items WHERE application_id = ? ORDER BY id",
                (row[0],)
            )
            ev_rows = ev_cursor.fetchall()
            app["evidences"] = [_dict_to_evidence(ev) for ev in ev_rows]
            result.append(app)
        return result
    finally:
        conn.close()


def get_application_detail(application_id: int) -> Optional[Dict]:
    conn = get_sqlite_conn()
    try:
        cursor = conn.execute(
            """
            SELECT a.*, u.name as handler_name, u.role as handler_role
            FROM account_applications a
            LEFT JOIN users u ON a.current_handler_id = u.id
            WHERE a.id = ?
            """,
            (application_id,)
        )
        row = cursor.fetchone()
        if not row:
            return None

        ev_cursor = conn.execute(
            "SELECT * FROM evidence_items WHERE application_id = ? ORDER BY id",
            (application_id,)
        )
        ev_rows = ev_cursor.fetchall()
        evidences = [_dict_to_evidence(ev) for ev in ev_rows]
        return _dict_to_application(row, evidences)
    finally:
        conn.close()


def _dict_to_operation(r: tuple) -> Dict:
    return {
        "id": r[0],
        "application_id": r[1],
        "operator_id": r[2],
        "operator_role": r[3],
        "operation_type": r[4],
        "is_success": r[5],
        "from_stage": r[6],
        "to_stage": r[7],
        "from_status": r[8],
        "to_status": r[9],
        "from_risk_level": r[10],
        "to_risk_level": r[11],
        "remark": r[12],
        "evidence_checked": r[13],
        "version_before": r[14],
        "version_after": r[15],
        "created_at": _isoformat(r[16]),
        "operator_name": r[17] if len(r) > 17 else None,
    }


def get_operation_records(application_id: int) -> List[Dict]:
    conn = get_sqlite_conn()
    try:
        cursor = conn.execute(
            """
            SELECT o.*, u.name as operator_name
            FROM operation_records o
            LEFT JOIN users u ON o.operator_id = u.id
            WHERE o.application_id = ?
            ORDER BY o.created_at DESC
            """,
            (application_id,)
        )
        rows = cursor.fetchall()
        return [_dict_to_operation(r) for r in rows]
    finally:
        conn.close()


def _dict_to_risk_log(r: tuple) -> Dict:
    return {
        "id": r[0],
        "application_id": r[1],
        "operator_id": r[2],
        "operator_role": r[3],
        "from_level": r[4],
        "to_level": r[5],
        "change_reason": r[6],
        "created_at": _isoformat(r[7]),
        "operator_name": r[9] if len(r) > 9 else None,
    }


def get_risk_level_logs(application_id: int) -> List[Dict]:
    conn = get_sqlite_conn()
    try:
        cursor = conn.execute(
            """
            SELECT r.*, u.name as operator_name
            FROM risk_level_logs r
            LEFT JOIN users u ON r.operator_id = u.id
            WHERE r.application_id = ?
            ORDER BY r.created_at DESC
            """,
            (application_id,)
        )
        rows = cursor.fetchall()
        return [_dict_to_risk_log(r) for r in rows]
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
        cursor = conn.execute("SELECT id, username, name, role FROM users ORDER BY id")
        return [
            {"id": r[0], "username": r[1], "name": r[2], "role": r[3]}
            for r in cursor.fetchall()
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
                from_stage, to_stage, from_status, to_status, remark,
                version_before, version_after
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                app_id,
                1,
                "客户经理",
                "创建申请",
                None,
                "开户预约",
                None,
                "待签收",
                "创建开户申请",
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
