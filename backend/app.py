from litestar import Litestar, get, post, put
from litestar.exceptions import HTTPException
from litestar.status_codes import HTTP_400_BAD_REQUEST, HTTP_403_FORBIDDEN, HTTP_404_NOT_FOUND, HTTP_409_CONFLICT
from litestar.response import Response
from litestar.config.cors import CORSConfig
from pydantic import BaseModel
from typing import Optional, Any
import datetime

from database import get_db, init_db, seed_data
from workflow import (
    validate_workflow_transition,
    validate_version,
    validate_evidence_for_action,
    validate_supplement_not_duplicate,
    validate_supplement_reason,
    STATUS_LABELS,
    ROLE_LABELS,
    ACTION_STATUS_MAP,
)


class LoginRequest(BaseModel):
    username: str


class ActionRequest(BaseModel):
    action: str
    user_id: int
    version: int
    comment: Optional[str] = ""


class SupplementRequest(BaseModel):
    user_id: int
    supplement_type: str
    field_name: str
    old_value: Optional[str] = ""
    new_value: str
    reason: str
    version: int


class TicketCreateRequest(BaseModel):
    pen_id: str
    animal_type: str
    animal_count: int
    inspector_name: str
    inspection_date: str
    created_by: int


class TicketUpdateRequest(BaseModel):
    user_id: int
    version: int
    pen_id: Optional[str] = None
    animal_type: Optional[str] = None
    animal_count: Optional[int] = None
    inspector_name: Optional[str] = None
    inspection_date: Optional[str] = None


class BatchActionRequest(BaseModel):
    ticket_ids: list[int]
    action: str
    user_id: int
    comment: Optional[str] = ""
    versions: Optional[dict[str, int]] = None


class EvidenceAddRequest(BaseModel):
    user_id: int
    evidence_type: str
    description: str
    reference_id: Optional[int] = None


class PenInspectionCreateRequest(BaseModel):
    ticket_id: int
    user_id: int
    pen_area: str
    cleanliness: str
    ventilation: str
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    notes: Optional[str] = ""


class HealthReportCreateRequest(BaseModel):
    ticket_id: int
    user_id: int
    animal_id: str
    animal_tag: str
    health_status: str
    symptoms: Optional[str] = ""
    diagnosis: Optional[str] = ""
    reporter_name: str


class TreatmentTrackingCreateRequest(BaseModel):
    ticket_id: int
    user_id: int
    health_report_id: int
    treatment_type: str
    medication: Optional[str] = ""
    dosage: Optional[str] = ""
    administered_by: str
    next_check_date: Optional[str] = ""


def _row_to_dict(row: Any) -> Optional[dict]:
    if row is None:
        return None
    return dict(row)


def _get_user_role(user_id: int) -> str:
    conn = get_db()
    user = conn.execute("SELECT role FROM users WHERE id=?", (user_id,)).fetchone()
    conn.close()
    if not user:
        return ""
    return user["role"]


def _validate_evidence_permission(user_id: int, ticket_id: int) -> None:
    role = _get_user_role(user_id)
    if role != "registrar":
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail=f"只有登记员可以录入证据，当前角色为[{ROLE_LABELS.get(role, role)}]",
        )
    conn = get_db()
    ticket = conn.execute("SELECT status FROM inspection_tickets WHERE id=?", (ticket_id,)).fetchone()
    conn.close()
    if not ticket:
        raise HTTPException(status_code=404, detail="巡检单不存在")
    if ticket["status"] not in ("draft", "returned"):
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"当前状态[{STATUS_LABELS.get(ticket['status'], '')}]不允许录入证据，仅草稿/退回状态可录入",
        )


@get("/api/users")
async def list_users() -> dict:
    conn = get_db()
    rows = conn.execute("SELECT id, username, display_name, role FROM users").fetchall()
    conn.close()
    return {"ok": True, "data": [_row_to_dict(r) for r in rows]}


@post("/api/login")
async def login(data: LoginRequest) -> dict:
    conn = get_db()
    user = conn.execute("SELECT id, username, display_name, role FROM users WHERE username=?", (data.username,)).fetchone()
    conn.close()
    if not user:
        return Response({"ok": False, "reason": f"用户 {data.username} 不存在"}, status_code=404)
    return {"ok": True, "data": _row_to_dict(user)}


@get("/api/tickets")
async def list_tickets(status: Optional[str] = None, pen_id: Optional[str] = None, role: Optional[str] = None) -> dict:
    conn = get_db()
    sql = """
        SELECT t.*, u.display_name as creator_name,
          (SELECT COUNT(*) FROM evidence_attachments WHERE ticket_id=t.id) as evidence_count,
          (SELECT COUNT(*) FROM supplement_records WHERE ticket_id=t.id) as supplement_count
        FROM inspection_tickets t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE 1=1
    """
    params: list = []
    if status:
        sql += " AND t.status=?"
        params.append(status)
    if pen_id:
        sql += " AND t.pen_id=?"
        params.append(pen_id)
    if role:
        if role == "registrar":
            sql += " AND t.status IN ('draft','returned')"
        elif role == "supervisor":
            sql += " AND t.status IN ('submitted','under_review')"
        elif role == "reviewer":
            sql += " AND t.status IN ('reviewed')"
    sql += " ORDER BY t.updated_at DESC"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return {"ok": True, "data": [_row_to_dict(r) for r in rows]}


@get("/api/tickets/{ticket_id:int}")
async def get_ticket_detail(ticket_id: int) -> dict:
    conn = get_db()
    ticket = conn.execute(
        """SELECT t.*, u.display_name as creator_name,
          (SELECT COUNT(*) FROM evidence_attachments WHERE ticket_id=t.id) as evidence_count,
          (SELECT COUNT(*) FROM supplement_records WHERE ticket_id=t.id) as supplement_count
        FROM inspection_tickets t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.id=?""",
        (ticket_id,),
    ).fetchone()
    if not ticket:
        conn.close()
        return Response({"ok": False, "reason": "巡检单不存在"}, status_code=404)

    result = _row_to_dict(ticket)

    pen_inspections = conn.execute("SELECT * FROM pen_inspections WHERE ticket_id=?", (ticket_id,)).fetchall()
    result["pen_inspections"] = [_row_to_dict(r) for r in pen_inspections]

    health_reports = conn.execute("SELECT * FROM health_reports WHERE ticket_id=?", (ticket_id,)).fetchall()
    result["health_reports"] = [_row_to_dict(r) for r in health_reports]

    treatment_trackings = conn.execute("SELECT * FROM treatment_trackings WHERE ticket_id=?", (ticket_id,)).fetchall()
    result["treatment_trackings"] = [_row_to_dict(r) for r in treatment_trackings]

    supplements = conn.execute(
        """SELECT s.*, u.display_name as operator_name
        FROM supplement_records s
        LEFT JOIN users u ON s.operated_by = u.id
        WHERE s.ticket_id=? ORDER BY s.operated_at""",
        (ticket_id,),
    ).fetchall()
    result["supplement_records"] = [_row_to_dict(r) for r in supplements]

    workflow_logs = conn.execute(
        """SELECT w.*, u.display_name as operator_name
        FROM workflow_logs w
        LEFT JOIN users u ON w.operated_by = u.id
        WHERE w.ticket_id=? ORDER BY w.operated_at""",
        (ticket_id,),
    ).fetchall()
    result["workflow_logs"] = [_row_to_dict(r) for r in workflow_logs]

    evidences = conn.execute(
        """SELECT e.*, u.display_name as uploader_name
        FROM evidence_attachments e
        LEFT JOIN users u ON e.uploaded_by = u.id
        WHERE e.ticket_id=? ORDER BY e.uploaded_at""",
        (ticket_id,),
    ).fetchall()
    result["evidences"] = [_row_to_dict(r) for r in evidences]

    batch_histories = conn.execute(
        """SELECT bi.*, bo.batch_no, bo.action as batch_action, bo.operated_at as batch_operated_at, u.display_name as operator_name
        FROM batch_operation_items bi
        INNER JOIN batch_operations bo ON bi.batch_id = bo.id
        LEFT JOIN users u ON bo.operated_by = u.id
        WHERE bi.ticket_id=? ORDER BY bo.operated_at""",
        (ticket_id,),
    ).fetchall()
    result["batch_histories"] = [_row_to_dict(r) for r in batch_histories]

    conn.close()
    return {"ok": True, "data": result}


@post("/api/tickets")
async def create_ticket(data: TicketCreateRequest) -> dict:
    conn = get_db()
    role = _get_user_role(data.created_by)
    if role != "registrar":
        conn.close()
        return Response(
            {"ok": False, "reason": f"只有登记员可以创建巡检单，当前角色为[{ROLE_LABELS.get(role, role)}]"},
            status_code=HTTP_403_FORBIDDEN,
        )

    now = datetime.datetime.now().strftime("%Y%m%d")
    count = conn.execute("SELECT COUNT(*) FROM inspection_tickets WHERE ticket_no LIKE ?", (f"XJ-{now}-%",)).fetchone()[0]
    ticket_no = f"XJ-{now}-{str(count + 1).zfill(3)}"

    try:
        cur = conn.execute(
            """INSERT INTO inspection_tickets (ticket_no,pen_id,animal_type,animal_count,inspector_name,inspection_date,status,version,created_by)
            VALUES (?,?,?,?,?,?,?,1,?)""",
            (ticket_no, data.pen_id, data.animal_type, data.animal_count, data.inspector_name, data.inspection_date, "draft", data.created_by),
        )
        ticket_id = cur.lastrowid
        conn.commit()
        conn.close()
        return {"ok": True, "data": {"id": ticket_id, "ticket_no": ticket_no}}
    except Exception as e:
        conn.close()
        return Response({"ok": False, "reason": str(e)}, status_code=HTTP_400_BAD_REQUEST)


@put("/api/tickets/{ticket_id:int}")
async def update_ticket(ticket_id: int, data: TicketUpdateRequest) -> dict:
    conn = get_db()
    ticket = conn.execute("SELECT * FROM inspection_tickets WHERE id=?", (ticket_id,)).fetchone()
    if not ticket:
        conn.close()
        return Response({"ok": False, "reason": "巡检单不存在"}, status_code=404)

    role = _get_user_role(data.user_id)
    if role != "registrar":
        conn.close()
        return Response({"ok": False, "reason": f"只有登记员可以修改巡检单，当前角色为[{ROLE_LABELS.get(role, role)}]"}, status_code=HTTP_403_FORBIDDEN)

    if ticket["status"] not in ("draft", "returned"):
        conn.close()
        return Response({"ok": False, "reason": f"当前状态[{STATUS_LABELS.get(ticket['status'], '')}]不允许修改"}, status_code=HTTP_400_BAD_REQUEST)

    v_result = validate_version(ticket["version"], data.version)
    if not v_result.valid:
        conn.close()
        return Response({"ok": False, "reason": v_result.reason}, status_code=HTTP_409_CONFLICT)

    updates = []
    params = []
    for fn in ("pen_id", "animal_type", "animal_count", "inspector_name", "inspection_date"):
        val = getattr(data, fn, None)
        if val is not None:
            updates.append(f"{fn}=?")
            params.append(val)

    if updates:
        updates.append("updated_at=datetime('now','localtime')")
        params.append(ticket_id)
        conn.execute(f"UPDATE inspection_tickets SET {', '.join(updates)} WHERE id=?", params)
        conn.commit()

    conn.close()
    return {"ok": True}


@post("/api/tickets/{ticket_id:int}/action")
async def ticket_action(ticket_id: int, data: ActionRequest) -> dict:
    conn = get_db()
    ticket = conn.execute("SELECT * FROM inspection_tickets WHERE id=?", (ticket_id,)).fetchone()
    if not ticket:
        conn.close()
        return Response({"ok": False, "reason": "巡检单不存在"}, status_code=404)

    role = _get_user_role(data.user_id)
    if not role:
        conn.close()
        return Response({"ok": False, "reason": f"用户不存在(user_id={data.user_id})"}, status_code=HTTP_403_FORBIDDEN)

    w_result = validate_workflow_transition(role, ticket["status"], data.action)
    if not w_result.valid:
        conn.close()
        return Response({"ok": False, "reason": w_result.reason}, status_code=HTTP_403_FORBIDDEN)

    v_result = validate_version(ticket["version"], data.version)
    if not v_result.valid:
        conn.close()
        return Response({"ok": False, "reason": v_result.reason}, status_code=HTTP_409_CONFLICT)

    evidence_count = conn.execute("SELECT COUNT(*) FROM evidence_attachments WHERE ticket_id=?", (ticket_id,)).fetchone()[0]
    e_result = validate_evidence_for_action(data.action, evidence_count)
    if not e_result.valid:
        conn.close()
        return Response({"ok": False, "reason": e_result.reason, "details": e_result.details}, status_code=HTTP_400_BAD_REQUEST)

    new_status = ACTION_STATUS_MAP[data.action]
    new_version = ticket["version"] + 1
    conn.execute(
        "UPDATE inspection_tickets SET status=?, version=?, updated_at=datetime('now','localtime') WHERE id=?",
        (new_status, new_version, ticket_id),
    )
    conn.execute(
        "INSERT INTO workflow_logs (ticket_id,action,from_status,to_status,operated_by,comment) VALUES (?,?,?,?,?,?)",
        (ticket_id, data.action, ticket["status"], new_status, data.user_id, data.comment),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "data": {"status": new_status, "version": new_version}}


@post("/api/tickets/{ticket_id:int}/supplement")
async def supplement_ticket(ticket_id: int, data: SupplementRequest) -> dict:
    conn = get_db()
    ticket = conn.execute("SELECT * FROM inspection_tickets WHERE id=?", (ticket_id,)).fetchone()
    if not ticket:
        conn.close()
        return Response({"ok": False, "reason": "巡检单不存在"}, status_code=404)

    role = _get_user_role(data.user_id)
    if role != "registrar":
        conn.close()
        return Response(
            {"ok": False, "reason": f"只有登记员可以补录，当前角色为[{ROLE_LABELS.get(role, role)}]"},
            status_code=HTTP_403_FORBIDDEN,
        )

    if ticket["status"] not in ("returned", "draft"):
        conn.close()
        return Response(
            {"ok": False, "reason": f"当前状态[{STATUS_LABELS.get(ticket['status'], '')}]不允许补录，仅退回/草稿状态可补录"},
            status_code=HTTP_400_BAD_REQUEST,
        )

    v_result = validate_version(ticket["version"], data.version)
    if not v_result.valid:
        conn.close()
        return Response({"ok": False, "reason": v_result.reason}, status_code=HTTP_409_CONFLICT)

    r_result = validate_supplement_reason(data.reason)
    if not r_result.valid:
        conn.close()
        return Response({"ok": False, "reason": r_result.reason}, status_code=HTTP_400_BAD_REQUEST)

    existing = conn.execute("SELECT field_name, new_value FROM supplement_records WHERE ticket_id=?", (ticket_id,)).fetchall()
    existing_list = [_row_to_dict(r) for r in existing]
    d_result = validate_supplement_not_duplicate(existing_list, data.field_name, data.new_value)
    if not d_result.valid:
        conn.close()
        return Response({"ok": False, "reason": d_result.reason}, status_code=HTTP_400_BAD_REQUEST)

    new_version = ticket["version"] + 1
    conn.execute(
        "INSERT INTO supplement_records (ticket_id,supplement_type,field_name,old_value,new_value,reason,operated_by,version_after) VALUES (?,?,?,?,?,?,?,?)",
        (ticket_id, data.supplement_type, data.field_name, data.old_value, data.new_value, data.reason, data.user_id, new_version),
    )
    conn.execute(
        "UPDATE inspection_tickets SET version=?, updated_at=datetime('now','localtime') WHERE id=?",
        (new_version, ticket_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "data": {"version": new_version}}


@post("/api/tickets/batch-action")
async def batch_action(data: BatchActionRequest) -> dict:
    results: list = []
    errors: list = []
    items: list = []
    conn = get_db()

    now_str = datetime.datetime.now().strftime("%Y%m%d")
    batch_count = conn.execute("SELECT COUNT(*) FROM batch_operations WHERE batch_no LIKE ?", (f"PL-{now_str}-%",)).fetchone()[0]
    batch_no = f"PL-{now_str}-{str(batch_count + 1).zfill(3)}"

    for tid in data.ticket_ids:
        ticket = conn.execute("SELECT * FROM inspection_tickets WHERE id=?", (tid,)).fetchone()
        ticket_no = ticket["ticket_no"] if ticket else None
        old_status = ticket["status"] if ticket else None
        error_reason = None
        success_flag = 0
        new_status = None

        if not ticket:
            error_reason = "巡检单不存在"
            errors.append({"ticket_id": tid, "reason": error_reason})
            items.append({"ticket_id": tid, "ticket_no": None, "success": 0, "error_reason": error_reason, "old_status": None, "new_status": None})
            continue

        role = _get_user_role(data.user_id)
        w_result = validate_workflow_transition(role, ticket["status"], data.action)
        if not w_result.valid:
            error_reason = w_result.reason
            errors.append({"ticket_id": tid, "ticket_no": ticket_no, "reason": error_reason})
            items.append({"ticket_id": tid, "ticket_no": ticket_no, "success": 0, "error_reason": error_reason, "old_status": old_status, "new_status": None})
            continue

        if not data.versions or str(tid) not in data.versions:
            error_reason = "版本号缺失: 批量操作需携带每条巡检单的版本号"
            errors.append({"ticket_id": tid, "ticket_no": ticket_no, "reason": error_reason})
            items.append({"ticket_id": tid, "ticket_no": ticket_no, "success": 0, "error_reason": error_reason, "old_status": old_status, "new_status": None})
            continue

        v_result = validate_version(ticket["version"], data.versions[str(tid)])
        if not v_result.valid:
            error_reason = v_result.reason
            errors.append({"ticket_id": tid, "ticket_no": ticket_no, "reason": error_reason})
            items.append({"ticket_id": tid, "ticket_no": ticket_no, "success": 0, "error_reason": error_reason, "old_status": old_status, "new_status": None})
            continue

        evidence_count = conn.execute("SELECT COUNT(*) FROM evidence_attachments WHERE ticket_id=?", (tid,)).fetchone()[0]
        e_result = validate_evidence_for_action(data.action, evidence_count)
        if not e_result.valid:
            error_reason = e_result.reason
            errors.append({"ticket_id": tid, "ticket_no": ticket_no, "reason": error_reason, "details": e_result.details})
            items.append({"ticket_id": tid, "ticket_no": ticket_no, "success": 0, "error_reason": error_reason, "old_status": old_status, "new_status": None})
            continue

        new_status = ACTION_STATUS_MAP[data.action]
        new_version = ticket["version"] + 1
        conn.execute(
            "UPDATE inspection_tickets SET status=?, version=?, updated_at=datetime('now','localtime') WHERE id=?",
            (new_status, new_version, tid),
        )
        conn.execute(
            "INSERT INTO workflow_logs (ticket_id,action,from_status,to_status,operated_by,comment) VALUES (?,?,?,?,?,?)",
            (tid, data.action, ticket["status"], new_status, data.user_id, data.comment),
        )
        success_flag = 1
        results.append({"ticket_id": tid, "ticket_no": ticket_no, "new_status": new_status, "new_version": new_version})
        items.append({"ticket_id": tid, "ticket_no": ticket_no, "success": 1, "error_reason": None, "old_status": old_status, "new_status": new_status})

    batch_cur = conn.execute(
        "INSERT INTO batch_operations (batch_no,action,operated_by,total_count,success_count,error_count,comment) VALUES (?,?,?,?,?,?,?)",
        (batch_no, data.action, data.user_id, len(data.ticket_ids), len(results), len(errors), data.comment),
    )
    batch_id = batch_cur.lastrowid
    for it in items:
        conn.execute(
            "INSERT INTO batch_operation_items (batch_id,ticket_id,ticket_no,success,error_reason,old_status,new_status) VALUES (?,?,?,?,?,?,?)",
            (batch_id, it["ticket_id"], it["ticket_no"], it["success"], it["error_reason"], it["old_status"], it["new_status"]),
        )

    conn.commit()
    conn.close()
    return {"ok": True, "data": {"batch_id": batch_id, "batch_no": batch_no, "success": results, "errors": errors}}


@post("/api/tickets/{ticket_id:int}/evidence")
async def add_evidence(ticket_id: int, data: EvidenceAddRequest) -> dict:
    _validate_evidence_permission(data.user_id, ticket_id)

    conn = get_db()
    cur = conn.execute(
        "INSERT INTO evidence_attachments (ticket_id,evidence_type,reference_id,description,uploaded_by) VALUES (?,?,?,?,?)",
        (ticket_id, data.evidence_type, data.reference_id, data.description, data.user_id),
    )
    conn.execute(
        "UPDATE inspection_tickets SET updated_at=datetime('now','localtime') WHERE id=?",
        (ticket_id,),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "data": {"id": cur.lastrowid}}


@post("/api/tickets/{ticket_id:int}/pen-inspections")
async def add_pen_inspection(ticket_id: int, data: PenInspectionCreateRequest) -> dict:
    _validate_evidence_permission(data.user_id, ticket_id)

    conn = get_db()
    cur = conn.execute(
        "INSERT INTO pen_inspections (ticket_id,pen_area,cleanliness,ventilation,temperature,humidity,notes) VALUES (?,?,?,?,?,?,?)",
        (ticket_id, data.pen_area, data.cleanliness, data.ventilation, data.temperature, data.humidity, data.notes),
    )
    pi_id = cur.lastrowid
    conn.execute(
        "INSERT INTO evidence_attachments (ticket_id,evidence_type,reference_id,description,uploaded_by) VALUES (?,'pen_inspection',?,?,?)",
        (ticket_id, pi_id, f"{data.pen_area}栏舍巡检", data.user_id),
    )
    conn.execute(
        "UPDATE inspection_tickets SET updated_at=datetime('now','localtime') WHERE id=?",
        (ticket_id,),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "data": {"id": pi_id}}


@post("/api/tickets/{ticket_id:int}/health-reports")
async def add_health_report(ticket_id: int, data: HealthReportCreateRequest) -> dict:
    _validate_evidence_permission(data.user_id, ticket_id)

    conn = get_db()
    cur = conn.execute(
        "INSERT INTO health_reports (ticket_id,animal_id,animal_tag,health_status,symptoms,diagnosis,reporter_name) VALUES (?,?,?,?,?,?,?)",
        (ticket_id, data.animal_id, data.animal_tag, data.health_status, data.symptoms, data.diagnosis, data.reporter_name),
    )
    hr_id = cur.lastrowid
    conn.execute(
        "INSERT INTO evidence_attachments (ticket_id,evidence_type,reference_id,description,uploaded_by) VALUES (?,'health_report',?,?,?)",
        (ticket_id, hr_id, f"{data.animal_tag}健康上报", data.user_id),
    )
    conn.execute(
        "UPDATE inspection_tickets SET updated_at=datetime('now','localtime') WHERE id=?",
        (ticket_id,),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "data": {"id": hr_id}}


@post("/api/tickets/{ticket_id:int}/treatment-trackings")
async def add_treatment_tracking(ticket_id: int, data: TreatmentTrackingCreateRequest) -> dict:
    _validate_evidence_permission(data.user_id, ticket_id)

    conn = get_db()
    hr = conn.execute("SELECT id FROM health_reports WHERE id=? AND ticket_id=?", (data.health_report_id, ticket_id)).fetchone()
    if not hr:
        conn.close()
        raise HTTPException(status_code=400, detail="健康报告不存在或不属于该巡检单")

    cur = conn.execute(
        "INSERT INTO treatment_trackings (ticket_id,health_report_id,treatment_type,medication,dosage,administered_by,next_check_date) VALUES (?,?,?,?,?,?,?)",
        (ticket_id, data.health_report_id, data.treatment_type, data.medication, data.dosage, data.administered_by, data.next_check_date),
    )
    tt_id = cur.lastrowid
    conn.execute(
        "INSERT INTO evidence_attachments (ticket_id,evidence_type,reference_id,description,uploaded_by) VALUES (?,'treatment_tracking',?,?,?)",
        (ticket_id, tt_id, "治疗跟踪记录", data.user_id),
    )
    conn.execute(
        "UPDATE inspection_tickets SET updated_at=datetime('now','localtime') WHERE id=?",
        (ticket_id,),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "data": {"id": tt_id}}


@get("/api/stats")
async def get_stats() -> dict:
    conn = get_db()
    status_counts = {}
    for row in conn.execute("SELECT status, COUNT(*) as cnt FROM inspection_tickets GROUP BY status").fetchall():
        status_counts[row["status"]] = row["cnt"]
    total = conn.execute("SELECT COUNT(*) FROM inspection_tickets").fetchone()[0]
    pending_review = conn.execute("SELECT COUNT(*) FROM inspection_tickets WHERE status IN ('submitted','under_review')").fetchone()[0]
    supplement_total = conn.execute("SELECT COUNT(*) FROM supplement_records").fetchone()[0]
    conn.close()
    return {
        "ok": True,
        "data": {
            "total": total,
            "status_counts": status_counts,
            "pending_review": pending_review,
            "supplement_total": supplement_total,
        },
    }


def _http_exception_handler(request, exc):
    return Response(
        {"ok": False, "reason": exc.detail},
        status_code=exc.status_code,
    )


cors_config = CORSConfig(
    allow_origins=["http://localhost:3007"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app = Litestar(
    route_handlers=[
        list_users,
        login,
        list_tickets,
        get_ticket_detail,
        create_ticket,
        update_ticket,
        ticket_action,
        supplement_ticket,
        batch_action,
        add_evidence,
        add_pen_inspection,
        add_health_report,
        add_treatment_tracking,
        get_stats,
    ],
    cors_config=cors_config,
    on_startup=[init_db, seed_data],
    exception_handlers={HTTPException: _http_exception_handler},
)
