import json
from datetime import datetime
from starlette.applications import Starlette
from starlette.routing import Route
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from .config import (
    CORS_ORIGINS, HOST, PORT, ROLES, ROLE_LABELS, STATUSES, STATUS_LABELS,
    EVENT_TYPES, EVENT_TYPE_LABELS, SEVERITIES, SEVERITY_LABELS,
    STATUS_HANDLER, VALID_TRANSITIONS,
)
from .database import (
    get_db, init_db, seed_data, generate_code, generate_scan_token, row_to_dict,
    verify_password,
)
from .auth import create_token, require_auth, require_role


def _json(body=None, status=200):
    return JSONResponse(body, status_code=status)


async def _body(request):
    raw = await request.body()
    if raw:
        return json.loads(raw)
    return {}


def _check_materials_required(event_type, materials):
    if event_type == "adverse_event" and len(materials) < 1:
        return "不良事件必须至少上传1份材料"
    if event_type == "incident_report" and len(materials) < 1:
        return "事件上报必须至少上传1份材料"
    if event_type == "rectification_tracking" and len(materials) < 2:
        return "整改追踪必须至少上传2份材料（整改方案及落实证据）"
    return None


def _check_deadline(deadline_str):
    if not deadline_str:
        return "必须设定处理时限"
    try:
        dl = datetime.fromisoformat(deadline_str)
        if dl < datetime.now():
            return "处理时限不能早于当前时间"
    except ValueError:
        return "处理时限格式无效"
    return None


def _validate_transition(user_role, current_status, target_status):
    key = (user_role, current_status)
    allowed = VALID_TRANSITIONS.get(key, [])
    if target_status not in allowed:
        handler = STATUS_HANDLER.get(current_status, "")
        handler_label = ROLE_LABELS.get(handler, handler)
        return f"状态流转无效：当前状态为「{STATUS_LABELS.get(current_status, current_status)}」，应由{handler_label}处理，无法变更为「{STATUS_LABELS.get(target_status, target_status)}」"
    return None


def _sync_db(func):
    async def wrapper(*args, **kwargs):
        return await run_in_threadpool(func, *args, **kwargs)
    return wrapper


async def login(request):
    body = await _body(request)
    username = body.get("username", "")
    password = body.get("password", "")
    if not username or not password:
        return _json({"error": "用户名和密码不能为空"}, 400)
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if not row:
            return _json({"error": "用户名或密码错误"}, 401)
        user = row_to_dict(row)
        if not verify_password(password, user["password_hash"]):
            return _json({"error": "用户名或密码错误"}, 401)
        token = create_token(user["id"], user["username"], user["role"])
        return _json({"user": {"id": user["id"], "username": user["username"], "name": user["name"], "role": user["role"]}, "token": token})
    finally:
        conn.close()


async def get_me(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    conn = get_db()
    try:
        row = conn.execute("SELECT id, username, name, role FROM users WHERE id = ?", (user["id"],)).fetchone()
        if not row:
            return _json({"error": "用户不存在"}, 404)
        u = row_to_dict(row)
        return _json({"user": u})
    finally:
        conn.close()


async def list_events(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    role = request.query_params.get("role", "")
    if not role:
        role = ""
    status = request.query_params.get("status", "")
    event_type = request.query_params.get("event_type", "")
    conn = get_db()
    try:
        query = "SELECT e.*, u.name as creator_name FROM events e LEFT JOIN users u ON e.created_by = u.id WHERE 1=1"
        params = []
        if role:
            query += " AND e.current_handler_role = ?"
            params.append(role)
        if status:
            query += " AND e.status = ?"
            params.append(status)
        if event_type:
            query += " AND e.event_type = ?"
            params.append(event_type)
        query += " ORDER BY e.updated_at DESC"
        rows = conn.execute(query, params).fetchall()
        events = []
        for r in rows:
            d = row_to_dict(r)
            events.append(d)
        return _json({"events": events})
    finally:
        conn.close()


async def get_event(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    event_id = request.path_params["id"]
    conn = get_db()
    try:
        row = conn.execute("SELECT e.*, u.name as creator_name FROM events e LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?", (event_id,)).fetchone()
        if not row:
            return _json({"error": "医疗事件单不存在"}, 404)
        event = row_to_dict(row)
        mats = conn.execute("SELECT * FROM materials WHERE event_id = ? ORDER BY uploaded_at", (event_id,)).fetchall()
        event["materials"] = [row_to_dict(m) for m in mats]
        acts = conn.execute("SELECT a.*, u.name as actor_name FROM actions a LEFT JOIN users u ON a.actor_id = u.id WHERE a.event_id = ? ORDER BY a.created_at", (event_id,)).fetchall()
        event["actions"] = [row_to_dict(a) for a in acts]
        return _json({"event": event})
    finally:
        conn.close()


async def create_event(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    if user["role"] != "registrar":
        return _json({"error": f"越权操作：仅医疗事件登记员可创建事件，当前角色为{ROLE_LABELS.get(user['role'], user['role'])}"}, 403)
    body = await _body(request)
    title = body.get("title", "").strip()
    description = body.get("description", "").strip()
    event_type = body.get("event_type", "")
    severity = body.get("severity", "")
    deadline = body.get("deadline", "")
    materials = body.get("materials", [])
    if not title:
        return _json({"error": "标题不能为空"}, 400)
    if event_type not in EVENT_TYPES:
        return _json({"error": f"事件类型无效，可选：{', '.join(EVENT_TYPE_LABELS.values())}"}, 400)
    if severity not in SEVERITIES:
        return _json({"error": f"严重程度无效，可选：{', '.join(SEVERITY_LABELS.values())}"}, 400)
    deadline_err = _check_deadline(deadline)
    if deadline_err:
        return _json({"error": deadline_err}, 400)
    mat_err = _check_materials_required(event_type, materials)
    if mat_err:
        return _json({"error": mat_err}, 400)
    now = datetime.now().isoformat()
    code = generate_code()
    scan_token = generate_scan_token()
    conn = get_db()
    try:
        c = conn.cursor()
        c.execute(
            "INSERT INTO events (code, scan_token, title, description, event_type, severity, status, current_handler_role, created_by, created_at, updated_at, deadline, version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (code, scan_token, title, description, event_type, severity, "draft", "registrar", user["id"], now, now, deadline, 1),
        )
        event_id = c.lastrowid
        for mat in materials:
            c.execute(
                "INSERT INTO materials (event_id, name, material_type, content, step, uploaded_at) VALUES (?,?,?,?,?,?)",
                (event_id, mat.get("name", ""), mat.get("material_type", "document"), mat.get("content", ""), "draft", now),
            )
        c.execute(
            "INSERT INTO audit_log (event_id, action, actor_id, actor_role, detail, created_at) VALUES (?,?,?,?,?,?)",
            (event_id, "create", user["id"], user["role"], f"登记员创建医疗事件：{title}", now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        event = row_to_dict(row)
        return _json({"event": event}, 201)
    finally:
        conn.close()


async def submit_event(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    event_id = int(request.path_params["id"])
    body = await _body(request)
    version = body.get("version")
    if version is None:
        return _json({"error": "必须提供当前版本号（version字段）用于并发检查"}, 400)
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if not row:
            return _json({"error": "医疗事件单不存在"}, 404)
        event = row_to_dict(row)
        if event["version"] != version:
            return _json({"error": f"版本冲突：该医疗事件单已被其他操作修改（当前版本{event['version']}，提交版本{version}），请刷新后重试"}, 409)
        if user["role"] != "registrar":
            return _json({"error": f"越权操作：仅医疗事件登记员可提交事件，当前角色为{ROLE_LABELS.get(user['role'], user['role'])}"}, 403)
        if event["status"] not in ("draft", "review_rejected"):
            return _json({"error": f"当前状态「{STATUS_LABELS.get(event['status'], event['status'])}」无法执行提交操作"}, 400)
        if event["current_handler_role"] != user["role"]:
            return _json({"error": f"非当前处理人：当前应由{ROLE_LABELS.get(event['current_handler_role'], event['current_handler_role'])}处理"}, 403)
        mats = conn.execute("SELECT COUNT(*) FROM materials WHERE event_id = ?", (event_id,)).fetchone()[0]
        if mats < 1:
            return _json({"error": "证据缺失：提交前必须至少上传1份材料"}, 400)
        now = datetime.now().isoformat()
        new_token = generate_scan_token()
        new_version = event["version"] + 1
        conn.execute(
            "UPDATE events SET status='submitted', current_handler_role='supervisor', updated_at=?, scan_token=?, version=? WHERE id=?",
            (now, new_token, new_version, event_id),
        )
        action_label = "补正后重新提交" if event["status"] == "review_rejected" else "提交"
        conn.execute(
            "INSERT INTO actions (event_id, action_type, opinion, result, actor_id, actor_role, created_at) VALUES (?,?,?,?,?,?,?)",
            (event_id, "submit", "", "", user["id"], user["role"], now),
        )
        conn.execute(
            "INSERT INTO audit_log (event_id, action, actor_id, actor_role, detail, created_at) VALUES (?,?,?,?,?,?)",
            (event_id, "submit", user["id"], user["role"], f"登记员{action_label}医疗事件", now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        return _json({"event": row_to_dict(row)})
    finally:
        conn.close()


async def supplement_event(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    event_id = int(request.path_params["id"])
    body = await _body(request)
    opinion = body.get("opinion", "").strip()
    materials = body.get("materials", [])
    version = body.get("version")
    if version is None:
        return _json({"error": "必须提供当前版本号（version字段）用于并发检查"}, 400)
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if not row:
            return _json({"error": "医疗事件单不存在"}, 404)
        event = row_to_dict(row)
        if event["version"] != version:
            return _json({"error": f"版本冲突：该医疗事件单已被其他操作修改（当前版本{event['version']}，提交版本{version}），请刷新后重试"}, 409)
        if user["role"] != "registrar":
            return _json({"error": f"越权操作：仅医疗事件登记员可补正事件，当前角色为{ROLE_LABELS.get(user['role'], user['role'])}"}, 403)
        if event["status"] != "review_rejected":
            return _json({"error": f"当前状态「{STATUS_LABELS.get(event['status'], event['status'])}」无法执行补正操作，仅「审核退回」状态可补正"}, 400)
        if event["current_handler_role"] != user["role"]:
            return _json({"error": f"非当前处理人：当前应由{ROLE_LABELS.get(event['current_handler_role'], event['current_handler_role'])}处理"}, 403)
        if not opinion:
            return _json({"error": "补正意见不能为空"}, 400)
        if len(materials) < 1:
            return _json({"error": "证据缺失：补正时必须至少上传1份补充材料"}, 400)
        now = datetime.now().isoformat()
        new_version = event["version"] + 1
        new_token = generate_scan_token()
        conn.execute(
            "UPDATE events SET status='submitted', current_handler_role='supervisor', updated_at=?, scan_token=?, version=? WHERE id=?",
            (now, new_token, new_version, event_id),
        )
        for mat in materials:
            conn.execute(
                "INSERT INTO materials (event_id, name, material_type, content, step, uploaded_at) VALUES (?,?,?,?,?,?)",
                (event_id, mat.get("name", ""), mat.get("material_type", "document"), mat.get("content", ""), "supplement", now),
            )
        conn.execute(
            "INSERT INTO actions (event_id, action_type, opinion, result, actor_id, actor_role, created_at) VALUES (?,?,?,?,?,?,?)",
            (event_id, "supplement", opinion, "", user["id"], user["role"], now),
        )
        conn.execute(
            "INSERT INTO audit_log (event_id, action, actor_id, actor_role, detail, created_at) VALUES (?,?,?,?,?,?)",
            (event_id, "supplement", user["id"], user["role"], f"登记员补正并重新提交：{opinion}", now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        return _json({"event": row_to_dict(row)})
    finally:
        conn.close()


async def review_event(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    event_id = int(request.path_params["id"])
    body = await _body(request)
    opinion = body.get("opinion", "").strip()
    result = body.get("result", "")
    version = body.get("version")
    if version is None:
        return _json({"error": "必须提供当前版本号（version字段）用于并发检查"}, 400)
    if result not in ("pass", "reject"):
        return _json({"error": "审核结果必须为 pass（通过）或 reject（退回）"}, 400)
    if not opinion:
        return _json({"error": "处理意见不能为空"}, 400)
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if not row:
            return _json({"error": "医疗事件单不存在"}, 404)
        event = row_to_dict(row)
        if event["version"] != version:
            return _json({"error": f"版本冲突：该医疗事件单已被其他操作修改（当前版本{event['version']}，提交版本{version}），请刷新后重试"}, 409)
        if user["role"] != "supervisor":
            return _json({"error": f"越权操作：仅医疗事件审核主管可审核事件，当前角色为{ROLE_LABELS.get(user['role'], user['role'])}"}, 403)
        expected_status = "submitted"
        if event["status"] == "archive_rejected":
            expected_status = "archive_rejected"
        elif event["status"] != "submitted":
            return _json({"error": f"当前状态「{STATUS_LABELS.get(event['status'], event['status'])}」无法执行审核操作"}, 400)
        if event["current_handler_role"] != user["role"]:
            return _json({"error": f"非当前处理人：当前应由{ROLE_LABELS.get(event['current_handler_role'], event['current_handler_role'])}处理"}, 403)
        mats = conn.execute("SELECT COUNT(*) FROM materials WHERE event_id = ?", (event_id,)).fetchone()[0]
        if mats < 1:
            return _json({"error": "证据缺失：无法审核没有材料的医疗事件单"}, 400)
        now = datetime.now().isoformat()
        new_version = event["version"] + 1
        new_token = generate_scan_token()
        if result == "pass":
            new_status = "review_passed"
            new_handler = "reviewer"
            action_label = "审核通过"
            audit_detail = f"审核主管通过审核：{opinion}"
        else:
            new_status = "review_rejected"
            new_handler = "registrar"
            action_label = "审核退回"
            audit_detail = f"审核主管退回：{opinion}"
        conn.execute(
            "UPDATE events SET status=?, current_handler_role=?, updated_at=?, scan_token=?, version=? WHERE id=?",
            (new_status, new_handler, now, new_token, new_version, event_id),
        )
        conn.execute(
            "INSERT INTO actions (event_id, action_type, opinion, result, actor_id, actor_role, created_at) VALUES (?,?,?,?,?,?,?)",
            (event_id, "review", opinion, result, user["id"], user["role"], now),
        )
        conn.execute(
            "INSERT INTO audit_log (event_id, action, actor_id, actor_role, detail, created_at) VALUES (?,?,?,?,?,?)",
            (event_id, f"review_{result}", user["id"], user["role"], audit_detail, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        return _json({"event": row_to_dict(row)})
    finally:
        conn.close()


async def archive_review_event(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    event_id = int(request.path_params["id"])
    body = await _body(request)
    opinion = body.get("opinion", "").strip()
    result = body.get("result", "")
    version = body.get("version")
    if version is None:
        return _json({"error": "必须提供当前版本号（version字段）用于并发检查"}, 400)
    if result not in ("archive", "reject"):
        return _json({"error": "复核结果必须为 archive（归档）或 reject（退回）"}, 400)
    if not opinion:
        return _json({"error": "处理意见不能为空"}, 400)
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if not row:
            return _json({"error": "医疗事件单不存在"}, 404)
        event = row_to_dict(row)
        if event["version"] != version:
            return _json({"error": f"版本冲突：该医疗事件单已被其他操作修改（当前版本{event['version']}，提交版本{version}），请刷新后重试"}, 409)
        if user["role"] != "reviewer":
            return _json({"error": f"越权操作：仅复核负责人可执行复核归档，当前角色为{ROLE_LABELS.get(user['role'], user['role'])}"}, 403)
        if event["status"] != "review_passed":
            return _json({"error": f"当前状态「{STATUS_LABELS.get(event['status'], event['status'])}」无法执行复核归档操作，仅「审核通过」状态可复核"}, 400)
        if event["current_handler_role"] != user["role"]:
            return _json({"error": f"非当前处理人：当前应由{ROLE_LABELS.get(event['current_handler_role'], event['current_handler_role'])}处理"}, 403)
        now = datetime.now().isoformat()
        new_version = event["version"] + 1
        new_token = generate_scan_token()
        if result == "archive":
            new_status = "archived"
            new_handler = None
            action_label = "复核归档"
            audit_detail = f"复核负责人归档：{opinion}"
        else:
            new_status = "archive_rejected"
            new_handler = "supervisor"
            action_label = "复核退回"
            audit_detail = f"复核负责人退回：{opinion}"
        conn.execute(
            "UPDATE events SET status=?, current_handler_role=?, updated_at=?, scan_token=?, version=? WHERE id=?",
            (new_status, new_handler, now, new_token, new_version, event_id),
        )
        conn.execute(
            "INSERT INTO actions (event_id, action_type, opinion, result, actor_id, actor_role, created_at) VALUES (?,?,?,?,?,?,?)",
            (event_id, "archive_review", opinion, result, user["id"], user["role"], now),
        )
        conn.execute(
            "INSERT INTO audit_log (event_id, action, actor_id, actor_role, detail, created_at) VALUES (?,?,?,?,?,?)",
            (event_id, f"archive_{result}", user["id"], user["role"], audit_detail, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        return _json({"event": row_to_dict(row)})
    finally:
        conn.close()


async def scan_code(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    body = await _body(request)
    code = body.get("code", "").strip()
    if not code:
        return _json({"error": "扫码内容不能为空"}, 400)
    conn = get_db()
    try:
        parts = code.split(":")
        event_code = parts[0] if len(parts) >= 1 else code
        scan_token = parts[1] if len(parts) >= 2 else ""
        row = conn.execute("SELECT * FROM events WHERE code = ?", (event_code,)).fetchone()
        now = datetime.now().isoformat()
        if not row:
            conn.execute(
                "INSERT INTO scan_records (code, event_id, scanner_id, scanner_role, success, message, scanned_at) VALUES (?,?,?,?,?,?,?)",
                (code, None, user["id"], user["role"], 0, "无效码：该编码不存在于系统中", now),
            )
            conn.commit()
            return _json({"success": False, "message": "无效码：该编码不存在于系统中"}, 400)
        event = row_to_dict(row)
        if scan_token and scan_token != event["scan_token"]:
            conn.execute(
                "INSERT INTO scan_records (code, event_id, scanner_id, scanner_role, success, message, scanned_at) VALUES (?,?,?,?,?,?,?)",
                (code, event["id"], user["id"], user["role"], 0, "重复码：该核验码已过期或已被使用，当前步骤可能已被处理", now),
            )
            conn.commit()
            return _json({"success": False, "message": "重复码：该核验码已过期或已被使用，当前步骤可能已被处理"}, 400)
        if event["status"] == "archived":
            conn.execute(
                "INSERT INTO scan_records (code, event_id, scanner_id, scanner_role, success, message, scanned_at) VALUES (?,?,?,?,?,?,?)",
                (code, event["id"], user["id"], user["role"], 0, "该医疗事件单已归档，无法操作", now),
            )
            conn.commit()
            return _json({"success": False, "message": "该医疗事件单已归档，无法操作"}, 400)
        if event["current_handler_role"] and event["current_handler_role"] != user["role"]:
            handler_label = ROLE_LABELS.get(event["current_handler_role"], event["current_handler_role"])
            scanner_label = ROLE_LABELS.get(user["role"], user["role"])
            msg = f"非当前处理人：当前应由{handler_label}处理，您是{scanner_label}"
            conn.execute(
                "INSERT INTO scan_records (code, event_id, scanner_id, scanner_role, success, message, scanned_at) VALUES (?,?,?,?,?,?,?)",
                (code, event["id"], user["id"], user["role"], 0, msg, now),
            )
            conn.commit()
            return _json({"success": False, "message": msg}, 403)
        conn.execute(
            "INSERT INTO scan_records (code, event_id, scanner_id, scanner_role, success, message, scanned_at) VALUES (?,?,?,?,?,?,?)",
            (code, event["id"], user["id"], user["role"], 1, "核验通过", now),
        )
        conn.execute(
            "INSERT INTO audit_log (event_id, action, actor_id, actor_role, detail, created_at) VALUES (?,?,?,?,?,?)",
            (event["id"], "scan", user["id"], user["role"], f"{ROLE_LABELS.get(user['role'], user['role'])}扫码核验通过", now),
        )
        conn.commit()
        mats = conn.execute("SELECT * FROM materials WHERE event_id = ? ORDER BY uploaded_at", (event["id"],)).fetchall()
        event["materials"] = [row_to_dict(m) for m in mats]
        acts = conn.execute("SELECT a.*, u.name as actor_name FROM actions a LEFT JOIN users u ON a.actor_id = u.id WHERE a.event_id = ? ORDER BY a.created_at", (event["id"],)).fetchall()
        event["actions"] = [row_to_dict(a) for a in acts]
        return _json({"success": True, "message": "核验通过", "event": event})
    finally:
        conn.close()


async def batch_process(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    body = await _body(request)
    event_ids = body.get("event_ids", [])
    action = body.get("action", "")
    result = body.get("result", "")
    opinion = body.get("opinion", "").strip()
    if not event_ids:
        return _json({"error": "事件ID列表不能为空"}, 400)
    if not action:
        return _json({"error": "操作类型不能为空"}, 400)
    results = []
    now = datetime.now().isoformat()
    conn = get_db()
    try:
        for eid in event_ids:
            row = conn.execute("SELECT * FROM events WHERE id = ?", (eid,)).fetchone()
            if not row:
                results.append({"id": eid, "success": False, "message": "医疗事件单不存在"})
                continue
            event = row_to_dict(row)
            if event["current_handler_role"] != user["role"]:
                handler_label = ROLE_LABELS.get(event["current_handler_role"], event["current_handler_role"])
                results.append({"id": eid, "success": False, "message": f"非当前处理人：应由{handler_label}处理"})
                continue
            if action == "review":
                if user["role"] != "supervisor":
                    results.append({"id": eid, "success": False, "message": "越权操作：仅审核主管可批量审核"})
                    continue
                if event["status"] not in ("submitted", "archive_rejected"):
                    results.append({"id": eid, "success": False, "message": f"状态「{STATUS_LABELS.get(event['status'], event['status'])}」不可审核"})
                    continue
                if not opinion:
                    results.append({"id": eid, "success": False, "message": "处理意见不能为空"})
                    continue
                if result == "pass":
                    new_status = "review_passed"
                    new_handler = "reviewer"
                elif result == "reject":
                    new_status = "review_rejected"
                    new_handler = "registrar"
                else:
                    results.append({"id": eid, "success": False, "message": "审核结果必须为 pass 或 reject"})
                    continue
                new_version = event["version"] + 1
                new_token = generate_scan_token()
                conn.execute(
                    "UPDATE events SET status=?, current_handler_role=?, updated_at=?, scan_token=?, version=? WHERE id=?",
                    (new_status, new_handler, now, new_token, new_version, eid),
                )
                conn.execute(
                    "INSERT INTO actions (event_id, action_type, opinion, result, actor_id, actor_role, created_at) VALUES (?,?,?,?,?,?,?)",
                    (eid, "batch_review", opinion, result, user["id"], user["role"], now),
                )
                conn.execute(
                    "INSERT INTO audit_log (event_id, action, actor_id, actor_role, detail, created_at) VALUES (?,?,?,?,?,?)",
                    (eid, f"batch_review_{result}", user["id"], user["role"], f"批量审核{'通过' if result == 'pass' else '退回'}：{opinion}", now),
                )
                results.append({"id": eid, "success": True, "message": f"审核{'通过' if result == 'pass' else '退回'}成功"})
            elif action == "archive_review":
                if user["role"] != "reviewer":
                    results.append({"id": eid, "success": False, "message": "越权操作：仅复核负责人可批量复核"})
                    continue
                if event["status"] != "review_passed":
                    results.append({"id": eid, "success": False, "message": f"状态「{STATUS_LABELS.get(event['status'], event['status'])}」不可复核归档"})
                    continue
                if not opinion:
                    results.append({"id": eid, "success": False, "message": "处理意见不能为空"})
                    continue
                if result == "archive":
                    new_status = "archived"
                    new_handler = None
                elif result == "reject":
                    new_status = "archive_rejected"
                    new_handler = "supervisor"
                else:
                    results.append({"id": eid, "success": False, "message": "复核结果必须为 archive 或 reject"})
                    continue
                new_version = event["version"] + 1
                new_token = generate_scan_token()
                conn.execute(
                    "UPDATE events SET status=?, current_handler_role=?, updated_at=?, scan_token=?, version=? WHERE id=?",
                    (new_status, new_handler, now, new_token, new_version, eid),
                )
                conn.execute(
                    "INSERT INTO actions (event_id, action_type, opinion, result, actor_id, actor_role, created_at) VALUES (?,?,?,?,?,?,?)",
                    (eid, "batch_archive_review", opinion, result, user["id"], user["role"], now),
                )
                conn.execute(
                    "INSERT INTO audit_log (event_id, action, actor_id, actor_role, detail, created_at) VALUES (?,?,?,?,?,?)",
                    (eid, f"batch_archive_{result}", user["id"], user["role"], f"批量复核{'归档' if result == 'archive' else '退回'}：{opinion}", now),
                )
                results.append({"id": eid, "success": True, "message": f"复核{'归档' if result == 'archive' else '退回'}成功"})
            else:
                results.append({"id": eid, "success": False, "message": f"不支持的操作类型：{action}"})
        conn.commit()
        return _json({"results": results})
    finally:
        conn.close()


async def get_statistics(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    conn = get_db()
    try:
        by_status = {}
        for s in STATUSES:
            count = conn.execute("SELECT COUNT(*) FROM events WHERE status = ?", (s,)).fetchone()[0]
            by_status[s] = count
        by_type = {}
        for t in EVENT_TYPES:
            count = conn.execute("SELECT COUNT(*) FROM events WHERE event_type = ?", (t,)).fetchone()[0]
            by_type[t] = count
        by_severity = {}
        for sev in SEVERITIES:
            count = conn.execute("SELECT COUNT(*) FROM events WHERE severity = ?", (sev,)).fetchone()[0]
            by_severity[sev] = count
        by_role_queue = {}
        for r in ROLES:
            count = conn.execute("SELECT COUNT(*) FROM events WHERE current_handler_role = ?", (r,)).fetchone()[0]
            by_role_queue[r] = count
        total = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
        archived = by_status.get("archived", 0)
        return _json({
            "by_status": by_status,
            "by_type": by_type,
            "by_severity": by_severity,
            "by_role_queue": by_role_queue,
            "total": total,
            "archived": archived,
            "active": total - archived,
        })
    finally:
        conn.close()


async def get_audit_log(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    event_id = request.query_params.get("event_id", "")
    conn = get_db()
    try:
        query = "SELECT a.*, e.code as event_code, e.title as event_title, u.name as actor_name FROM audit_log a LEFT JOIN events e ON a.event_id = e.id LEFT JOIN users u ON a.actor_id = u.id WHERE 1=1"
        params = []
        if event_id:
            query += " AND a.event_id = ?"
            params.append(int(event_id))
        query += " ORDER BY a.created_at DESC LIMIT 200"
        rows = conn.execute(query, params).fetchall()
        logs = [row_to_dict(r) for r in rows]
        return _json({"logs": logs})
    finally:
        conn.close()


async def get_config(request):
    return _json({
        "roles": [{"value": r, "label": ROLE_LABELS[r]} for r in ROLES],
        "statuses": [{"value": s, "label": STATUS_LABELS[s]} for s in STATUSES],
        "event_types": [{"value": t, "label": EVENT_TYPE_LABELS[t]} for t in EVENT_TYPES],
        "severities": [{"value": s, "label": SEVERITY_LABELS[s]} for s in SEVERITIES],
        "status_handler": STATUS_HANDLER,
        "valid_transitions": {f"{k[0]}:{k[1]}": v for k, v in VALID_TRANSITIONS.items()},
    })


routes = [
    Route("/api/auth/login", login, methods=["POST"]),
    Route("/api/auth/me", get_me, methods=["GET"]),
    Route("/api/events", list_events, methods=["GET"]),
    Route("/api/events", create_event, methods=["POST"]),
    Route("/api/events/batch", batch_process, methods=["POST"]),
    Route("/api/events/{id:int}", get_event, methods=["GET"]),
    Route("/api/events/{id:int}/submit", submit_event, methods=["POST"]),
    Route("/api/events/{id:int}/supplement", supplement_event, methods=["POST"]),
    Route("/api/events/{id:int}/review", review_event, methods=["POST"]),
    Route("/api/events/{id:int}/archive-review", archive_review_event, methods=["POST"]),
    Route("/api/scan", scan_code, methods=["POST"]),
    Route("/api/statistics", get_statistics, methods=["GET"]),
    Route("/api/audit-log", get_audit_log, methods=["GET"]),
    Route("/api/config", get_config, methods=["GET"]),
]

middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    ),
]

app = Starlette(
    routes=routes,
    middleware=middleware,
    on_startup=[init_db, seed_data],
)
