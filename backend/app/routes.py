from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from .database import (
    get_db, init_db, check_timeouts, STATUS_LABELS, NODE_TIME_LIMITS,
    NEXT_STATUS_MAP, REJECT_MAP, ROLE_CLERK, ROLE_SUPERVISOR, ROLE_MANAGER, STATUSES,
)
from .models import (
    LoginRequest, LoginResponse, SchedulingFormCreate, SchedulingFormUpdate,
    StatusTransition, TimeoutHandle, CoursewareReview, EvaluationCreate,
    ScheduleCreate, BatchAction, SchedulingFormResponse, TimeoutRecordResponse,
    OperationLogResponse, StatisticsResponse, CoursewareReviewResponse,
    EvaluationResponse, InstructorScheduleResponse,
)
from .helpers import enrich_form, enrich_log, enrich_timeout, get_user_name

router = APIRouter()

active_sessions = {}

def get_current_user(token: str = Query(..., alias="token")):
    if token not in active_sessions:
        raise HTTPException(status_code=401, detail="未登录或会话已过期")
    return active_sessions[token]

def require_role(user: dict, *roles):
    if user["role"] not in roles:
        raise HTTPException(status_code=403, detail=f"当前岗位({user['role']})无此操作权限")

@router.post("/auth/login", response_model=LoginResponse)
def login(req: LoginRequest):
    conn = get_db()
    row = conn.execute(
        "SELECT id, username, role, display_name, password_hash FROM users WHERE username=?",
        (req.username,),
    ).fetchone()
    conn.close()
    if not row or row["password_hash"] != req.password:
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    token = f"token-{row['id']}-{row['username']}"
    user_data = {"id": row["id"], "username": row["username"], "role": row["role"], "display_name": row["display_name"]}
    active_sessions[token] = user_data
    return LoginResponse(
        id=row["id"], username=row["username"], role=row["role"],
        display_name=row["display_name"], token=token,
    )

@router.get("/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    return user

@router.get("/roles")
def get_roles():
    from .database import ROLES, ROLE_LABELS
    return [{"role": r, "label": ROLE_LABELS[r]} for r in ROLES]

@router.get("/statuses")
def get_statuses():
    return [{"status": s, "label": STATUS_LABELS.get(s, s)} for s in STATUSES]

@router.get("/node-time-limits")
def get_node_time_limits():
    conn = get_db()
    rows = conn.execute("SELECT * FROM node_time_limits ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.get("/forms", response_model=list[SchedulingFormResponse])
def list_forms(
    status: Optional[str] = None,
    keyword: Optional[str] = None,
    timeout_only: bool = False,
    user: dict = Depends(get_current_user),
):
    check_timeouts()
    conn = get_db()
    query = "SELECT * FROM scheduling_forms WHERE 1=1"
    params = []
    if status:
        query += " AND status=?"
        params.append(status)
    if keyword:
        query += " AND (title LIKE ? OR instructor_name LIKE ? OR course_name LIKE ? OR form_no LIKE ?)"
        kw = f"%{keyword}%"
        params.extend([kw, kw, kw, kw])

    query += " ORDER BY updated_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()

    results = [enrich_form(r) for r in rows]
    if timeout_only:
        results = [r for r in results if r["is_timeout"]]
    return results

@router.get("/forms/{form_id}", response_model=SchedulingFormResponse)
def get_form(form_id: int, user: dict = Depends(get_current_user)):
    check_timeouts()
    conn = get_db()
    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="排课单不存在")
    return enrich_form(row)

@router.post("/forms", response_model=SchedulingFormResponse)
def create_form(req: SchedulingFormCreate, user: dict = Depends(get_current_user)):
    require_role(user, ROLE_CLERK)
    conn = get_db()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    count = conn.execute("SELECT COUNT(*) FROM scheduling_forms").fetchone()[0]
    form_no = f"PK-{datetime.now().year}-{count + 1:03d}"
    current_node_entered_at = now

    cursor = conn.execute(
        """INSERT INTO scheduling_forms
        (form_no, title, instructor_name, instructor_id, course_name, course_type,
         training_company, start_date, end_date, location, student_count, description,
         status, created_by, current_node_entered_at, courseware_status, evaluation_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, 'pending', 'pending')""",
        (
            form_no, req.title, req.instructor_name, req.instructor_id, req.course_name,
            req.course_type, req.training_company, req.start_date, req.end_date,
            req.location, req.student_count, req.description, user["id"], current_node_entered_at,
        ),
    )
    form_id = cursor.lastrowid

    conn.execute(
        """INSERT INTO operation_logs (form_id, operator_id, action, from_status, to_status, remark)
        VALUES (?, ?, '创建排课单', NULL, 'pending_review', ?)""",
        (form_id, user["id"], f"创建排课单 {form_no}"),
    )
    conn.commit()

    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    conn.close()
    return enrich_form(row)

@router.put("/forms/{form_id}", response_model=SchedulingFormResponse)
def update_form(form_id: int, req: SchedulingFormUpdate, user: dict = Depends(get_current_user)):
    require_role(user, ROLE_CLERK)
    conn = get_db()
    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="排课单不存在")
    if row["status"] not in ("draft", "rejected", "timeout_handling"):
        conn.close()
        raise HTTPException(status_code=400, detail=f"当前状态({STATUS_LABELS.get(row['status'], row['status'])})不允许编辑")

    updates = []
    params = []
    for field in ["title", "instructor_name", "instructor_id", "course_name", "course_type",
                   "training_company", "start_date", "end_date", "location", "student_count", "description"]:
        val = getattr(req, field, None)
        if val is not None:
            updates.append(f"{field}=?")
            params.append(val)
    if updates:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        updates.append("updated_at=?")
        params.append(now)
        params.append(form_id)
        conn.execute(f"UPDATE scheduling_forms SET {', '.join(updates)} WHERE id=?", params)
        conn.execute(
            """INSERT INTO operation_logs (form_id, operator_id, action, from_status, to_status, remark)
            VALUES (?, ?, '编辑排课单', ?, ?, '补正修改')""",
            (form_id, user["id"], row["status"], row["status"]),
        )
        conn.commit()

    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    conn.close()
    return enrich_form(row)

@router.post("/forms/{form_id}/transition", response_model=SchedulingFormResponse)
def transition_status(form_id: int, req: StatusTransition, user: dict = Depends(get_current_user)):
    conn = get_db()
    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="排课单不存在")

    current_status = row["status"]
    role = user["role"]

    if req.action == "reject":
        if role not in REJECT_MAP or current_status not in REJECT_MAP[role]:
            conn.close()
            raise HTTPException(status_code=403, detail=f"当前岗位无权驳回状态为'{STATUS_LABELS.get(current_status, current_status)}'的排课单")
        new_status = "rejected"
    elif req.action == "submit":
        if role not in NEXT_STATUS_MAP or current_status not in NEXT_STATUS_MAP[role]:
            conn.close()
            raise HTTPException(status_code=403, detail=f"当前岗位无权提交状态为'{STATUS_LABELS.get(current_status, current_status)}'的排课单")
        new_status = NEXT_STATUS_MAP[role][current_status]
    elif req.action == "timeout_handle":
        if role != ROLE_CLERK or current_status != "timeout_handling":
            conn.close()
            raise HTTPException(status_code=403, detail="只有登记员可以处理超时状态的排课单")
        new_status = "pending_review"
    elif req.action == "archive":
        if role != ROLE_MANAGER or current_status != "pending_archive":
            conn.close()
            raise HTTPException(status_code=403, detail="只有复核负责人可以归档排课单")
        new_status = "archived"
    else:
        conn.close()
        raise HTTPException(status_code=400, detail=f"不支持的操作: {req.action}")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        "UPDATE scheduling_forms SET status=?, updated_at=?, current_node_entered_at=? WHERE id=?",
        (new_status, now, now, form_id),
    )

    if new_status == "rejected":
        conn.execute(
            "UPDATE timeout_records SET status='cancelled' WHERE form_id=? AND status='pending'",
            (form_id,),
        )

    _update_linked_status(conn, form_id, new_status)

    conn.execute(
        """INSERT INTO operation_logs (form_id, operator_id, action, from_status, to_status, remark)
        VALUES (?, ?, ?, ?, ?, ?)""",
        (form_id, user["id"], req.action, current_status, new_status, req.remark),
    )
    conn.commit()

    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    conn.close()
    return enrich_form(row)

def _update_linked_status(conn, form_id: int, new_status: str):
    if new_status == "pending_courseware":
        conn.execute(
            "UPDATE scheduling_forms SET courseware_status='pending' WHERE id=?",
            (form_id,),
        )
    elif new_status == "courseware_reviewing":
        conn.execute(
            "UPDATE scheduling_forms SET courseware_status='reviewing' WHERE id=?",
            (form_id,),
        )
    elif new_status == "pending_evaluation":
        conn.execute(
            "UPDATE scheduling_forms SET evaluation_status='pending' WHERE id=?",
            (form_id,),
        )
    elif new_status == "evaluating":
        conn.execute(
            "UPDATE scheduling_forms SET evaluation_status='evaluating' WHERE id=?",
            (form_id,),
        )

@router.post("/forms/{form_id}/courseware-review", response_model=SchedulingFormResponse)
def review_courseware(form_id: int, req: CoursewareReview, user: dict = Depends(get_current_user)):
    require_role(user, ROLE_MANAGER)
    conn = get_db()
    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="排课单不存在")
    if row["status"] not in ("pending_courseware", "courseware_reviewing"):
        conn.close()
        raise HTTPException(status_code=400, detail="当前状态不允许课件审核")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        """INSERT INTO courseware_reviews (form_id, reviewer_id, result, comment)
        VALUES (?, ?, ?, ?)""",
        (form_id, user["id"], req.result, req.comment),
    )

    if req.result == "approved":
        new_status = "pending_teaching"
        new_cw_status = "approved"
    else:
        new_status = "rejected"
        new_cw_status = "rejected"

    conn.execute(
        "UPDATE scheduling_forms SET status=?, courseware_status=?, updated_at=?, current_node_entered_at=? WHERE id=?",
        (new_status, new_cw_status, now, now, form_id),
    )
    conn.execute(
        """INSERT INTO operation_logs (form_id, operator_id, action, from_status, to_status, remark)
        VALUES (?, ?, 'courseware_review', ?, ?, ?)""",
        (form_id, user["id"], row["status"], new_status, f"课件审核{('通过' if req.result=='approved' else '驳回')}: {req.comment or ''}"),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    conn.close()
    return enrich_form(row)

@router.post("/forms/{form_id}/evaluation", response_model=SchedulingFormResponse)
def create_evaluation(form_id: int, req: EvaluationCreate, user: dict = Depends(get_current_user)):
    require_role(user, ROLE_MANAGER)
    conn = get_db()
    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="排课单不存在")
    if row["status"] not in ("pending_evaluation", "evaluating"):
        conn.close()
        raise HTTPException(status_code=400, detail="当前状态不允许课后评价")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        """INSERT INTO evaluations (form_id, evaluator_id, score, comment)
        VALUES (?, ?, ?, ?)""",
        (form_id, user["id"], req.score, req.comment),
    )

    new_status = "pending_archive"
    conn.execute(
        "UPDATE scheduling_forms SET status=?, evaluation_status='completed', updated_at=?, current_node_entered_at=? WHERE id=?",
        (new_status, now, now, form_id),
    )
    conn.execute(
        """INSERT INTO operation_logs (form_id, operator_id, action, from_status, to_status, remark)
        VALUES (?, ?, 'evaluate', ?, ?, ?)""",
        (form_id, user["id"], row["status"], new_status, f"课后评价: 分数{req.score}, {req.comment or ''}"),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    conn.close()
    return enrich_form(row)

@router.post("/forms/{form_id}/confirm-teaching", response_model=SchedulingFormResponse)
def confirm_teaching(form_id: int, user: dict = Depends(get_current_user)):
    require_role(user, ROLE_MANAGER)
    conn = get_db()
    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="排课单不存在")
    if row["status"] != "pending_teaching":
        conn.close()
        raise HTTPException(status_code=400, detail="当前状态不允许确认授课完成")

    schedules = conn.execute(
        "SELECT id FROM instructor_schedules WHERE form_id=? AND status != 'completed'",
        (form_id,),
    ).fetchall()
    for s in schedules:
        conn.execute(
            "UPDATE instructor_schedules SET status='completed' WHERE id=?",
            (s["id"],),
        )

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_status = "teaching_completed"
    conn.execute(
        "UPDATE scheduling_forms SET status=?, updated_at=?, current_node_entered_at=? WHERE id=?",
        (new_status, now, now, form_id),
    )

    schedules_completed = conn.execute(
        "SELECT COUNT(*) FROM instructor_schedules WHERE form_id=? AND status='completed'",
        (form_id,),
    ).fetchone()[0]
    total_schedules = conn.execute(
        "SELECT COUNT(*) FROM instructor_schedules WHERE form_id=?",
        (form_id,),
    ).fetchone()[0]

    if schedules_completed == total_schedules and total_schedules > 0:
        eval_status = "pending_evaluation"
        conn.execute(
            "UPDATE scheduling_forms SET status=?, evaluation_status=?, updated_at=?, current_node_entered_at=? WHERE id=?",
            (eval_status, "pending", now, now, form_id),
        )
        conn.execute(
            """INSERT INTO operation_logs (form_id, operator_id, action, from_status, to_status, remark)
            VALUES (?, ?, 'confirm_teaching', ?, ?, '授课完成，自动进入待评价')""",
            (form_id, user["id"], "pending_teaching", eval_status),
        )
    else:
        conn.execute(
            """INSERT INTO operation_logs (form_id, operator_id, action, from_status, to_status, remark)
            VALUES (?, ?, 'confirm_teaching', ?, ?, '授课完成')""",
            (form_id, user["id"], "pending_teaching", new_status),
        )

    conn.commit()
    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    conn.close()
    return enrich_form(row)

@router.get("/forms/{form_id}/schedules", response_model=list[InstructorScheduleResponse])
def get_schedules(form_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM instructor_schedules WHERE form_id=? ORDER BY schedule_date, time_slot",
        (form_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/forms/{form_id}/schedules", response_model=InstructorScheduleResponse)
def add_schedule(form_id: int, req: ScheduleCreate, user: dict = Depends(get_current_user)):
    require_role(user, ROLE_CLERK, ROLE_MANAGER)
    conn = get_db()
    row = conn.execute("SELECT instructor_name FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="排课单不存在")
    cursor = conn.execute(
        """INSERT INTO instructor_schedules (form_id, instructor_name, schedule_date, time_slot, status, remark)
        VALUES (?, ?, ?, ?, 'planned', ?)""",
        (form_id, row["instructor_name"], req.schedule_date, req.time_slot, req.remark),
    )
    conn.commit()
    sched = conn.execute("SELECT * FROM instructor_schedules WHERE id=?", (cursor.lastrowid,)).fetchone()
    conn.close()
    return dict(sched)

@router.get("/forms/{form_id}/courseware-reviews", response_model=list[CoursewareReviewResponse])
def get_courseware_reviews(form_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM courseware_reviews WHERE form_id=? ORDER BY reviewed_at DESC",
        (form_id,),
    ).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        d["reviewer_name"] = get_user_name(r["reviewer_id"])
        results.append(d)
    return results

@router.get("/forms/{form_id}/evaluations", response_model=list[EvaluationResponse])
def get_evaluations(form_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM evaluations WHERE form_id=? ORDER BY evaluated_at DESC",
        (form_id,),
    ).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        d["evaluator_name"] = get_user_name(r["evaluator_id"])
        results.append(d)
    return results

@router.get("/forms/{form_id}/logs", response_model=list[OperationLogResponse])
def get_logs(form_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM operation_logs WHERE form_id=? ORDER BY created_at DESC",
        (form_id,),
    ).fetchall()
    conn.close()
    return [enrich_log(r) for r in rows]

@router.get("/forms/{form_id}/timeout-records", response_model=list[TimeoutRecordResponse])
def get_timeout_records(form_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM timeout_records WHERE form_id=? ORDER BY created_at DESC",
        (form_id,),
    ).fetchall()
    conn.close()
    return [enrich_timeout(r) for r in rows]

@router.post("/forms/{form_id}/timeout-handle", response_model=TimeoutRecordResponse)
def handle_timeout(form_id: int, req: TimeoutHandle, user: dict = Depends(get_current_user)):
    require_role(user, ROLE_CLERK)
    conn = get_db()
    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="排课单不存在")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    pending_timeouts = conn.execute(
        "SELECT * FROM timeout_records WHERE form_id=? AND status='pending'",
        (form_id,),
    ).fetchall()

    for t in pending_timeouts:
        conn.execute(
            """UPDATE timeout_records SET reason=?, follow_up=?, handled_by=?, handled_at=?, status='handled'
            WHERE id=?""",
            (req.reason, req.follow_up, user["id"], now, t["id"]),
        )

    conn.execute(
        "UPDATE scheduling_forms SET status='timeout_handling', updated_at=?, current_node_entered_at=? WHERE id=?",
        (now, now, form_id),
    )

    conn.execute(
        """INSERT INTO operation_logs (form_id, operator_id, action, from_status, to_status, remark)
        VALUES (?, ?, 'timeout_handle', ?, 'timeout_handling', ?)""",
        (form_id, user["id"], row["status"], f"超时处理: 原因={req.reason}, 后续处理={req.follow_up}"),
    )
    conn.commit()

    t_row = conn.execute(
        "SELECT * FROM timeout_records WHERE form_id=? AND status='handled' ORDER BY handled_at DESC LIMIT 1",
        (form_id,),
    ).fetchone()
    conn.close()
    return enrich_timeout(t_row)

@router.get("/timeout-records", response_model=list[TimeoutRecordResponse])
def list_timeout_records(user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM timeout_records ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [enrich_timeout(r) for r in rows]

@router.get("/statistics", response_model=StatisticsResponse)
def get_statistics(user: dict = Depends(get_current_user)):
    check_timeouts()
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM scheduling_forms").fetchone()[0]
    by_status = {}
    for s in STATUSES:
        count = conn.execute("SELECT COUNT(*) FROM scheduling_forms WHERE status=?", (s,)).fetchone()[0]
        if count > 0:
            by_status[s] = count
    timeout_count = conn.execute("SELECT COUNT(*) FROM timeout_records WHERE status='pending'").fetchone()[0]
    pending_statuses = ["pending_review", "reviewing", "pending_courseware", "courseware_reviewing",
                        "pending_teaching", "pending_evaluation", "evaluating", "pending_archive", "timeout_handling"]
    placeholders = ",".join(["?"] * len(pending_statuses))
    pending_count = conn.execute(
        f"SELECT COUNT(*) FROM scheduling_forms WHERE status IN ({placeholders})",
        pending_statuses,
    ).fetchone()[0]
    conn.close()
    return StatisticsResponse(
        total=total, by_status=by_status, timeout_count=timeout_count, pending_count=pending_count,
    )

@router.post("/batch/action")
def batch_action(req: BatchAction, user: dict = Depends(get_current_user)):
    results = []
    errors = []
    for fid in req.form_ids:
        try:
            result = transition_status(
                fid,
                StatusTransition(action=req.action, remark=req.remark),
                user=user,
            )
            results.append({"form_id": fid, "status": "success", "new_status": result.status})
        except HTTPException as e:
            errors.append({"form_id": fid, "status": "error", "detail": e.detail})
        except Exception as e:
            errors.append({"form_id": fid, "status": "error", "detail": str(e)})
    return {"success": results, "errors": errors}

@router.get("/forms/{form_id}/available-actions")
def get_available_actions(form_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="排课单不存在")

    actions = []
    role = user["role"]
    current = row["status"]

    if role == ROLE_CLERK:
        if current in ("draft", "rejected", "timeout_handling"):
            actions.append({"action": "submit", "label": "提交审核"})
        if current == "timeout_handling":
            actions.append({"action": "timeout_handle", "label": "超时处理"})
    elif role == ROLE_SUPERVISOR:
        if current in NEXT_STATUS_MAP.get(role, {}):
            actions.append({"action": "submit", "label": "审核通过"})
        if current in REJECT_MAP.get(role, []):
            actions.append({"action": "reject", "label": "驳回"})
    elif role == ROLE_MANAGER:
        if current in NEXT_STATUS_MAP.get(role, {}):
            label_map = {
                "pending_courseware": "开始课件审核",
                "courseware_reviewing": "课件审核通过",
                "pending_teaching": "确认授课完成",
                "teaching_completed": "进入课后评价",
                "pending_evaluation": "开始评价",
                "evaluating": "评价完成",
                "pending_archive": "归档",
            }
            actions.append({"action": "submit", "label": label_map.get(current, "通过")})
        if current in REJECT_MAP.get(role, []):
            actions.append({"action": "reject", "label": "驳回"})
        if current == "pending_courseware":
            actions.append({"action": "courseware_review_reject", "label": "课件审核驳回"})
        if current in ("pending_courseware", "courseware_reviewing"):
            actions.append({"action": "courseware_review", "label": "课件审核"})
        if current in ("pending_evaluation", "evaluating"):
            actions.append({"action": "evaluate", "label": "提交评价"})

    return actions

@router.post("/init-db")
def init_db_endpoint():
    init_db()
    return {"message": "数据库初始化完成"}
