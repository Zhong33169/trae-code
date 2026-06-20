from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from .database import (
    get_db, init_db, check_timeouts, STATUS_LABELS, NODE_TIME_LIMITS,
    NEXT_STATUS_MAP, REJECT_MAP, ROLE_CLERK, ROLE_SUPERVISOR, ROLE_MANAGER, STATUSES,
    apply_visibility, get_visible_fields, get_submit_actions, state_machine_transition,
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

@router.get("/visibility-policy")
def get_visibility_policy(user: dict = Depends(get_current_user)):
    return {
        "role": user["role"],
        "visible_fields": get_visible_fields(user["role"]),
        "submit_actions_template": get_submit_actions.__doc__,
    }

def _build_query(params):
    query = "SELECT * FROM scheduling_forms WHERE 1=1"
    args = []
    if params.get("status"):
        query += " AND status=?"
        args.append(params["status"])
    if params.get("keyword"):
        kw = f"%{params['keyword']}%"
        query += " AND (title LIKE ? OR instructor_name LIKE ? OR course_name LIKE ? OR form_no LIKE ?)"
        args.extend([kw, kw, kw, kw])
    if params.get("instructor_id"):
        query += " AND instructor_id=?"
        args.append(params["instructor_id"])
    if params.get("training_company"):
        query += " AND training_company=?"
        args.append(params["training_company"])
    query += " ORDER BY updated_at DESC"
    return query, args

def _enrich_and_filter(conn, row, role):
    from .database import enrich_form, apply_visibility
    form_dict = dict(row)
    form_dict["status_label"] = STATUS_LABELS.get(form_dict["status"], form_dict["status"])
    form_dict = enrich_form(conn, form_dict)
    form_dict = apply_visibility(form_dict, role)
    return form_dict

@router.get("/forms")
def list_forms(
    status: Optional[str] = None,
    keyword: Optional[str] = None,
    timeout_only: bool = False,
    instructor_id: Optional[str] = None,
    training_company: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    check_timeouts()
    conn = get_db()
    params = {
        "status": status,
        "keyword": keyword,
        "instructor_id": instructor_id,
        "training_company": training_company,
        "timeout_only": timeout_only,
    }
    query, args = _build_query(params)
    rows = conn.execute(query, args).fetchall()

    results = []
    for r in rows:
        enriched = _enrich_and_filter(conn, r, user["role"])
        if timeout_only and not enriched.get("is_timeout"):
            continue
        results.append(enriched)

    conn.close()
    return {
        "items": results,
        "total": len(results),
        "filter": params,
    }

@router.get("/forms/{form_id}")
def get_form(form_id: int, user: dict = Depends(get_current_user)):
    check_timeouts()
    conn = get_db()
    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="排课单不存在")
    form_data = _enrich_and_filter(conn, row, user["role"])
    submit_actions = get_submit_actions(user["role"], row["status"], form_id, conn)
    conn.close()
    return {
        "form": form_data,
        "submit_actions": submit_actions,
    }

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

@router.post("/forms/{form_id}/transition")
def transition_status(form_id: int, req: StatusTransition, user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        state_machine_transition(
            conn, form_id, user["role"], req.action,
            operator_id=user["id"], remark=req.remark or "",
        )
        conn.commit()
    except ValueError as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))

    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    form_data = _enrich_and_filter(conn, row, user["role"])
    submit_actions = get_submit_actions(user["role"], row["status"], form_id, conn)
    conn.close()
    return {
        "form": form_data,
        "submit_actions": submit_actions,
    }

@router.post("/forms/{form_id}/courseware-review")
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

    conn.execute(
        """INSERT INTO courseware_reviews (form_id, reviewer_id, result, comment)
        VALUES (?, ?, ?, ?)""",
        (form_id, user["id"], req.result, req.comment),
    )

    try:
        state_machine_transition(
            conn, form_id, user["role"], "courseware_review",
            operator_id=user["id"], result=req.result, comment=req.comment or "",
        )
        conn.commit()
    except ValueError as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))

    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    form_data = _enrich_and_filter(conn, row, user["role"])
    submit_actions = get_submit_actions(user["role"], row["status"], form_id, conn)
    conn.close()
    return {
        "form": form_data,
        "submit_actions": submit_actions,
    }

@router.post("/forms/{form_id}/evaluation")
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
    if req.score < 1 or req.score > 100:
        conn.close()
        raise HTTPException(status_code=400, detail="评分必须在1-100之间")

    conn.execute(
        """INSERT INTO evaluations (form_id, evaluator_id, score, comment)
        VALUES (?, ?, ?, ?)""",
        (form_id, user["id"], req.score, req.comment),
    )

    try:
        state_machine_transition(
            conn, form_id, user["role"], "evaluate",
            operator_id=user["id"], score=req.score, comment=req.comment or "",
        )
        conn.commit()
    except ValueError as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))

    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    form_data = _enrich_and_filter(conn, row, user["role"])
    submit_actions = get_submit_actions(user["role"], row["status"], form_id, conn)
    conn.close()
    return {
        "form": form_data,
        "submit_actions": submit_actions,
    }

@router.post("/forms/{form_id}/confirm-teaching")
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

    try:
        state_machine_transition(
            conn, form_id, user["role"], "confirm_teaching",
            operator_id=user["id"],
        )
        conn.commit()
    except ValueError as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))

    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    form_data = _enrich_and_filter(conn, row, user["role"])
    submit_actions = get_submit_actions(user["role"], row["status"], form_id, conn)
    conn.close()
    return {
        "form": form_data,
        "submit_actions": submit_actions,
    }

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

@router.post("/forms/{form_id}/timeout-handle")
def handle_timeout(form_id: int, req: TimeoutHandle, user: dict = Depends(get_current_user)):
    require_role(user, ROLE_CLERK)
    if not req.reason or not req.follow_up:
        raise HTTPException(status_code=400, detail="超时原因和后续处理记录为必填项")

    conn = get_db()
    row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="排课单不存在")

    try:
        state_machine_transition(
            conn, form_id, user["role"], "timeout_handle",
            operator_id=user["id"],
            reason=req.reason,
            follow_up=req.follow_up,
            remark=f"超时处理: 原因={req.reason}, 后续处理={req.follow_up}",
        )
        conn.commit()
    except ValueError as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))

    t_row = conn.execute(
        "SELECT * FROM timeout_records WHERE form_id=? AND status='handled' ORDER BY handled_at DESC LIMIT 1",
        (form_id,),
    ).fetchone()
    form_row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    form_data = _enrich_and_filter(conn, form_row, user["role"])
    submit_actions = get_submit_actions(user["role"], form_row["status"], form_id, conn)
    conn.close()
    return {
        "timeout_record": enrich_timeout(t_row),
        "form": form_data,
        "submit_actions": submit_actions,
    }

@router.get("/timeout-records")
def list_timeout_records(user: dict = Depends(get_current_user)):
    check_timeouts()
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM timeout_records ORDER BY created_at DESC"
    ).fetchall()
    results = []
    for r in rows:
        record = enrich_timeout(r)
        form_row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (r["form_id"],)).fetchone()
        if form_row:
            record["form_no"] = form_row["form_no"]
            record["form_title"] = form_row["title"]
            record["form_status"] = form_row["status"]
            record["form_status_label"] = STATUS_LABELS.get(form_row["status"], form_row["status"])
            enriched = _enrich_and_filter(conn, form_row, user["role"])
            record["has_pending_timeout"] = enriched.get("has_pending_timeout", False)
            record["submit_actions"] = get_submit_actions(user["role"], form_row["status"], r["form_id"], conn)
        else:
            record["form_no"] = None
            record["form_title"] = None
            record["form_status"] = None
            record["form_status_label"] = None
            record["has_pending_timeout"] = False
            record["submit_actions"] = []
        results.append(record)
    conn.close()
    return results

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
        conn = get_db()
        try:
            state_machine_transition(
                conn, fid, user["role"], req.action,
                operator_id=user["id"], remark=req.remark or "",
            )
            conn.commit()
            row = conn.execute("SELECT * FROM scheduling_forms WHERE id=?", (fid,)).fetchone()
            form_data = _enrich_and_filter(conn, row, user["role"])
            results.append({
                "form_id": fid,
                "status": "success",
                "new_status": row["status"],
                "new_status_label": STATUS_LABELS.get(row["status"], row["status"]),
                "form": form_data,
            })
        except HTTPException as e:
            conn.close()
            errors.append({"form_id": fid, "status": "error", "detail": e.detail})
        except ValueError as e:
            conn.rollback()
            conn.close()
            errors.append({"form_id": fid, "status": "error", "detail": str(e)})
        except Exception as e:
            conn.rollback()
            conn.close()
            errors.append({"form_id": fid, "status": "error", "detail": str(e)})
        finally:
            try:
                conn.close()
            except:
                pass
    return {"success": results, "errors": errors, "total": len(req.form_ids), "success_count": len(results), "error_count": len(errors)}

@router.get("/forms/{form_id}/available-actions")
def get_available_actions(form_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    row = conn.execute("SELECT status FROM scheduling_forms WHERE id=?", (form_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="排课单不存在")
    actions = get_submit_actions(user["role"], row["status"], form_id, conn)
    conn.close()
    return actions

@router.post("/init-db")
def init_db_endpoint():
    init_db()
    return {"message": "数据库初始化完成"}
