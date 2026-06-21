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
    verify_password, consume_scan_credential,
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


def _write_audit(conn, event_id, action, user, detail, now, scan_record_id=None, version_before=None, version_after=None, before_status=None, after_status=None, batch_id=None):
    conn.execute(
        "INSERT INTO audit_log (event_id, action, actor_id, actor_role, actor_name, detail, created_at, scan_record_id, version_before, version_after, before_status, after_status, batch_id, filter_role, filter_status, filter_event_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (event_id, action, user["id"], user["role"], user.get("name", ""), detail, now, scan_record_id, version_before, version_after, before_status, after_status, batch_id, None, None, None),
    )


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
        token = create_token(user["id"], user["username"], user["role"], user.get("name", ""))
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
        conn.execute("BEGIN IMMEDIATE")
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
        _write_audit(conn, event_id, "create", user, f"登记员创建医疗事件：{title}", now, None, None, 1, None, "draft")
        conn.execute("COMMIT")
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        event = row_to_dict(row)
        return _json({"event": event}, 201)
    except Exception as e:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


async def submit_event(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    event_id = int(request.path_params["id"])
    body = await _body(request)
    version = body.get("version")
    scan_record_id = body.get("scan_record_id")
    if scan_record_id is None:
        return _json({"error": "必须携带核验凭证（scan_record_id），请先完成现场扫码核验"}, 400)
    if version is None:
        return _json({"error": "必须提供当前版本号（version字段）用于并发检查"}, 400)
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        # 0. 原子消费扫码凭证（更新凭证为已消费，锁定scan_record行，并生成新token/新版本号）
        cred = consume_scan_credential(conn, event_id, int(scan_record_id), user, "submit")
        if not cred["ok"]:
            conn.execute("ROLLBACK")
            return _json({"error": cred["error"]}, 400)
        # 1. 版本与事件校验
        ev = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if not ev:
            conn.execute("ROLLBACK")
            return _json({"error": "医疗事件单不存在"}, 404)
        event = row_to_dict(ev)
        if event["version"] != version:
            conn.execute("ROLLBACK")
            return _json({"error": f"版本冲突：该医疗事件单已被其他操作修改（当前版本{event['version']}，提交版本{version}），请刷新后重新扫码"}, 409)
        if cred["new_version"] != version + 1:
            conn.execute("ROLLBACK")
            return _json({"error": "凭证计算错误，请重新扫码"}, 400)
        # 2. 角色/状态/处理人
        if user["role"] != "registrar":
            conn.execute("ROLLBACK")
            return _json({"error": f"越权操作：仅医疗事件登记员可提交事件，当前角色为{ROLE_LABELS.get(user['role'], user['role'])}"}, 403)
        if event["status"] not in ("draft", "review_rejected"):
            conn.execute("ROLLBACK")
            return _json({"error": f"当前状态「{STATUS_LABELS.get(event['status'], event['status'])}」无法执行提交操作"}, 400)
        if event["current_handler_role"] != user["role"]:
            conn.execute("ROLLBACK")
            return _json({"error": f"非当前处理人：当前应由{ROLE_LABELS.get(event['current_handler_role'], event['current_handler_role'])}处理"}, 403)
        # 3. 材料完整性
        mats = conn.execute("SELECT COUNT(*) FROM materials WHERE event_id = ?", (event_id,)).fetchone()[0]
        if mats < 1:
            conn.execute("ROLLBACK")
            return _json({"error": "证据缺失：提交前必须至少上传1份材料"}, 400)
        # 4. 流转
        now = datetime.now().isoformat()
        conn.execute(
            "UPDATE events SET status='submitted', current_handler_role='supervisor', updated_at=?, scan_token=?, version=? WHERE id=? AND version=?",
            (now, cred["new_token"], cred["new_version"], event_id, version),
        )
        action_label = "补正后重新提交" if event["status"] == "review_rejected" else "提交"
        conn.execute(
            "INSERT INTO actions (event_id, action_type, opinion, result, actor_id, actor_role, created_at) VALUES (?,?,?,?,?,?,?)",
            (event_id, "submit", "", "", user["id"], user["role"], now),
        )
        _write_audit(conn, event_id, "submit", user, f"登记员{action_label}医疗事件（已消费扫码凭证#{cred['scan_record_id']}）", now, cred["scan_record_id"], cred["old_version"], cred["new_version"], event["status"], "submitted")
        conn.execute("COMMIT")
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        return _json({"event": row_to_dict(row)})
    except Exception as e:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass
        raise
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
    scan_record_id = body.get("scan_record_id")
    if scan_record_id is None:
        return _json({"error": "必须携带核验凭证（scan_record_id），请先完成现场扫码核验"}, 400)
    if version is None:
        return _json({"error": "必须提供当前版本号（version字段）用于并发检查"}, 400)
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cred = consume_scan_credential(conn, event_id, int(scan_record_id), user, "supplement")
        if not cred["ok"]:
            conn.execute("ROLLBACK")
            return _json({"error": cred["error"]}, 400)
        ev = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if not ev:
            conn.execute("ROLLBACK")
            return _json({"error": "医疗事件单不存在"}, 404)
        event = row_to_dict(ev)
        if event["version"] != version:
            conn.execute("ROLLBACK")
            return _json({"error": f"版本冲突：该医疗事件单已被其他操作修改（当前版本{event['version']}，提交版本{version}），请刷新后重新扫码"}, 409)
        if user["role"] != "registrar":
            conn.execute("ROLLBACK")
            return _json({"error": f"越权操作：仅医疗事件登记员可补正事件，当前角色为{ROLE_LABELS.get(user['role'], user['role'])}"}, 403)
        if event["status"] != "review_rejected":
            conn.execute("ROLLBACK")
            return _json({"error": f"当前状态「{STATUS_LABELS.get(event['status'], event['status'])}」无法执行补正操作，仅「审核退回」状态可补正"}, 400)
        if event["current_handler_role"] != user["role"]:
            conn.execute("ROLLBACK")
            return _json({"error": f"非当前处理人：当前应由{ROLE_LABELS.get(event['current_handler_role'], event['current_handler_role'])}处理"}, 403)
        if not opinion:
            conn.execute("ROLLBACK")
            return _json({"error": "补正意见不能为空"}, 400)
        if len(materials) < 1:
            conn.execute("ROLLBACK")
            return _json({"error": "证据缺失：补正时必须至少上传1份补充材料"}, 400)
        now = datetime.now().isoformat()
        conn.execute(
            "UPDATE events SET status='submitted', current_handler_role='supervisor', updated_at=?, scan_token=?, version=? WHERE id=? AND version=?",
            (now, cred["new_token"], cred["new_version"], event_id, version),
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
        _write_audit(conn, event_id, "supplement", user, f"登记员补正并重新提交：{opinion}（已消费扫码凭证#{cred['scan_record_id']}）", now, cred["scan_record_id"], cred["old_version"], cred["new_version"], event["status"], "submitted")
        conn.execute("COMMIT")
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        return _json({"event": row_to_dict(row)})
    except Exception as e:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass
        raise
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
    scan_record_id = body.get("scan_record_id")
    if scan_record_id is None:
        return _json({"error": "必须携带核验凭证（scan_record_id），请先完成现场扫码核验"}, 400)
    if version is None:
        return _json({"error": "必须提供当前版本号（version字段）用于并发检查"}, 400)
    if result not in ("pass", "reject"):
        return _json({"error": "审核结果必须为 pass（通过）或 reject（退回）"}, 400)
    if not opinion:
        return _json({"error": "处理意见不能为空"}, 400)
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cred = consume_scan_credential(conn, event_id, int(scan_record_id), user, "review")
        if not cred["ok"]:
            conn.execute("ROLLBACK")
            return _json({"error": cred["error"]}, 400)
        ev = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if not ev:
            conn.execute("ROLLBACK")
            return _json({"error": "医疗事件单不存在"}, 404)
        event = row_to_dict(ev)
        if event["version"] != version:
            conn.execute("ROLLBACK")
            return _json({"error": f"版本冲突：该医疗事件单已被其他操作修改（当前版本{event['version']}，提交版本{version}），请刷新后重新扫码"}, 409)
        if user["role"] != "supervisor":
            conn.execute("ROLLBACK")
            return _json({"error": f"越权操作：仅医疗事件审核主管可审核事件，当前角色为{ROLE_LABELS.get(user['role'], user['role'])}"}, 403)
        if event["status"] not in ("submitted", "archive_rejected"):
            conn.execute("ROLLBACK")
            return _json({"error": f"当前状态「{STATUS_LABELS.get(event['status'], event['status'])}」无法执行审核操作"}, 400)
        if event["current_handler_role"] != user["role"]:
            conn.execute("ROLLBACK")
            return _json({"error": f"非当前处理人：当前应由{ROLE_LABELS.get(event['current_handler_role'], event['current_handler_role'])}处理"}, 403)
        mats = conn.execute("SELECT COUNT(*) FROM materials WHERE event_id = ?", (event_id,)).fetchone()[0]
        if mats < 1:
            conn.execute("ROLLBACK")
            return _json({"error": "证据缺失：无法审核没有材料的医疗事件单"}, 400)
        now = datetime.now().isoformat()
        if result == "pass":
            new_status = "review_passed"
            new_handler = "reviewer"
            audit_detail = f"审核主管通过审核：{opinion}（已消费扫码凭证#{cred['scan_record_id']}）"
        else:
            new_status = "review_rejected"
            new_handler = "registrar"
            audit_detail = f"审核主管退回：{opinion}（已消费扫码凭证#{cred['scan_record_id']}）"
        conn.execute(
            "UPDATE events SET status=?, current_handler_role=?, updated_at=?, scan_token=?, version=? WHERE id=? AND version=?",
            (new_status, new_handler, now, cred["new_token"], cred["new_version"], event_id, version),
        )
        conn.execute(
            "INSERT INTO actions (event_id, action_type, opinion, result, actor_id, actor_role, created_at) VALUES (?,?,?,?,?,?,?)",
            (event_id, "review", opinion, result, user["id"], user["role"], now),
        )
        _write_audit(conn, event_id, f"review_{result}", user, audit_detail, now, cred["scan_record_id"], cred["old_version"], cred["new_version"], event["status"], new_status)
        conn.execute("COMMIT")
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        return _json({"event": row_to_dict(row)})
    except Exception as e:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass
        raise
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
    scan_record_id = body.get("scan_record_id")
    if scan_record_id is None:
        return _json({"error": "必须携带核验凭证（scan_record_id），请先完成现场扫码核验"}, 400)
    if version is None:
        return _json({"error": "必须提供当前版本号（version字段）用于并发检查"}, 400)
    if result not in ("archive", "reject"):
        return _json({"error": "复核结果必须为 archive（归档）或 reject（退回）"}, 400)
    if not opinion:
        return _json({"error": "处理意见不能为空"}, 400)
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cred = consume_scan_credential(conn, event_id, int(scan_record_id), user, "archive_review")
        if not cred["ok"]:
            conn.execute("ROLLBACK")
            return _json({"error": cred["error"]}, 400)
        ev = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if not ev:
            conn.execute("ROLLBACK")
            return _json({"error": "医疗事件单不存在"}, 404)
        event = row_to_dict(ev)
        if event["version"] != version:
            conn.execute("ROLLBACK")
            return _json({"error": f"版本冲突：该医疗事件单已被其他操作修改（当前版本{event['version']}，提交版本{version}），请刷新后重新扫码"}, 409)
        if user["role"] != "reviewer":
            conn.execute("ROLLBACK")
            return _json({"error": f"越权操作：仅复核负责人可执行复核归档，当前角色为{ROLE_LABELS.get(user['role'], user['role'])}"}, 403)
        if event["status"] != "review_passed":
            conn.execute("ROLLBACK")
            return _json({"error": f"当前状态「{STATUS_LABELS.get(event['status'], event['status'])}」无法执行复核归档操作，仅「审核通过」状态可复核"}, 400)
        if event["current_handler_role"] != user["role"]:
            conn.execute("ROLLBACK")
            return _json({"error": f"非当前处理人：当前应由{ROLE_LABELS.get(event['current_handler_role'], event['current_handler_role'])}处理"}, 403)
        now = datetime.now().isoformat()
        if result == "archive":
            new_status = "archived"
            new_handler = None
            audit_detail = f"复核负责人归档：{opinion}（已消费扫码凭证#{cred['scan_record_id']}）"
        else:
            new_status = "archive_rejected"
            new_handler = "supervisor"
            audit_detail = f"复核负责人退回：{opinion}（已消费扫码凭证#{cred['scan_record_id']}）"
        conn.execute(
            "UPDATE events SET status=?, current_handler_role=?, updated_at=?, scan_token=?, version=? WHERE id=? AND version=?",
            (new_status, new_handler, now, cred["new_token"], cred["new_version"], event_id, version),
        )
        conn.execute(
            "INSERT INTO actions (event_id, action_type, opinion, result, actor_id, actor_role, created_at) VALUES (?,?,?,?,?,?,?)",
            (event_id, "archive_review", opinion, result, user["id"], user["role"], now),
        )
        _write_audit(conn, event_id, f"archive_{result}", user, audit_detail, now, cred["scan_record_id"], cred["old_version"], cred["new_version"], event["status"], new_status)
        conn.execute("COMMIT")
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        return _json({"event": row_to_dict(row)})
    except Exception as e:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass
        raise
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
        conn.execute("BEGIN IMMEDIATE")
        parts = code.split(":")
        event_code = parts[0] if len(parts) >= 1 else code
        scan_token = parts[1] if len(parts) >= 2 else ""
        row = conn.execute("SELECT * FROM events WHERE code = ?", (event_code,)).fetchone()
        now = datetime.now().isoformat()
        if not row:
            cur = conn.execute(
                "INSERT INTO scan_records (code, event_id, scanner_id, scanner_role, success, message, scanned_at, scan_token, consumed_at, consumed_by, consumed_by_user_id, event_version_before, event_version_after) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (code, None, user["id"], user["role"], 0, "无效码：该编码不存在于系统中", now, "", None, "", None, None, None),
            )
            scan_record_id = cur.lastrowid
            conn.execute("COMMIT")
            return _json({"success": False, "message": "无效码：该编码不存在于系统中", "scan_record_id": scan_record_id}, 400)
        event = row_to_dict(row)
        # 2. 重复码检测：scan_token != 当前事件scan_token
        if scan_token and scan_token != event["scan_token"]:
            cur = conn.execute(
                "INSERT INTO scan_records (code, event_id, scanner_id, scanner_role, success, message, scanned_at, scan_token, consumed_at, consumed_by, consumed_by_user_id, event_version_before, event_version_after) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (code, event["id"], user["id"], user["role"], 0, "重复码：该核验码已过期或已被使用，当前步骤可能已被处理", now, scan_token, None, "", None, None, None),
            )
            scan_record_id = cur.lastrowid
            conn.execute("COMMIT")
            return _json({"success": False, "message": "重复码：该核验码已过期或已被使用，当前步骤可能已被处理", "scan_record_id": scan_record_id}, 400)
        if event["status"] == "archived":
            cur = conn.execute(
                "INSERT INTO scan_records (code, event_id, scanner_id, scanner_role, success, message, scanned_at, scan_token, consumed_at, consumed_by, consumed_by_user_id, event_version_before, event_version_after) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (code, event["id"], user["id"], user["role"], 0, "该医疗事件单已归档，无法操作", now, event["scan_token"], None, "", None, None, None),
            )
            scan_record_id = cur.lastrowid
            conn.execute("COMMIT")
            return _json({"success": False, "message": "该医疗事件单已归档，无法操作", "scan_record_id": scan_record_id}, 400)
        # 3. 非当前处理人检测
        if event["current_handler_role"] and event["current_handler_role"] != user["role"]:
            handler_label = ROLE_LABELS.get(event["current_handler_role"], event["current_handler_role"])
            scanner_label = ROLE_LABELS.get(user["role"], user["role"])
            msg = f"非当前处理人：当前应由{handler_label}处理，您是{scanner_label}"
            cur = conn.execute(
                "INSERT INTO scan_records (code, event_id, scanner_id, scanner_role, success, message, scanned_at, scan_token, consumed_at, consumed_by, consumed_by_user_id, event_version_before, event_version_after) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (code, event["id"], user["id"], user["role"], 0, msg, now, event["scan_token"], None, "", None, None, None),
            )
            scan_record_id = cur.lastrowid
            _write_audit(conn, event["id"], "scan_reject", user, msg, now, scan_record_id, event["version"], event["version"], event["status"], event["status"])
            conn.execute("COMMIT")
            return _json({"success": False, "message": msg, "scan_record_id": scan_record_id}, 403)
        # 4. 核验通过
        cur = conn.execute(
            "INSERT INTO scan_records (code, event_id, scanner_id, scanner_role, success, message, scanned_at, scan_token, consumed_at, consumed_by, consumed_by_user_id, event_version_before, event_version_after) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (code, event["id"], user["id"], user["role"], 1, "核验通过", now, event["scan_token"], None, "", None, event["version"], event["version"]),
        )
        scan_record_id = cur.lastrowid
        _write_audit(conn, event["id"], "scan", user, f"{ROLE_LABELS.get(user['role'], user['role'])}扫码核验通过，生成凭证#{scan_record_id}", now, scan_record_id, event["version"], event["version"], event["status"], event["status"])
        conn.execute("COMMIT")
        mats = conn.execute("SELECT * FROM materials WHERE event_id = ? ORDER BY uploaded_at", (event["id"],)).fetchall()
        event["materials"] = [row_to_dict(m) for m in mats]
        acts = conn.execute("SELECT a.*, u.name as actor_name FROM actions a LEFT JOIN users u ON a.actor_id = u.id WHERE a.event_id = ? ORDER BY a.created_at", (event["id"],)).fetchall()
        event["actions"] = [row_to_dict(a) for a in acts]
        return _json({
            "success": True,
            "message": "核验通过",
            "event": event,
            "scan_record_id": scan_record_id,
            "scan_token": event["scan_token"],
            "scanner": {"id": user["id"], "name": user.get("name", ""), "role": user["role"]},
        })
    except Exception as e:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass
        raise
    finally:
        conn.close()


async def batch_process(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    body = await _body(request)
    # 支持两种格式：[{event_id, scan_record_id, opinion}] 或 {event_ids:[], scan_record_ids:[], action, result, opinion}
    items = body.get("items") or []
    if not items:
        # 兼容旧格式
        event_ids = body.get("event_ids", [])
        scan_record_ids = body.get("scan_record_ids", [])
        action = body.get("action", "")
        result = body.get("result", "")
        opinion = body.get("opinion", "").strip()
        if not event_ids:
            return _json({"error": "事件ID列表不能为空"}, 400)
        if not action:
            return _json({"error": "操作类型不能为空"}, 400)
        if len(scan_record_ids) != len(event_ids):
            return _json({"error": "批量处理要求每个事件必须有独立的核验凭证（scan_record_ids 与 event_ids 数量不一致）"}, 400)
        for i, eid in enumerate(event_ids):
            items.append({
                "event_id": eid,
                "scan_record_id": scan_record_ids[i],
                "opinion": opinion,
                "result": result,
                "action": action,
            })
    else:
        if len({(it.get("action"), it.get("result")) for it in items}) > 1:
            return _json({"error": "批量处理同一批次操作与结果必须一致"}, 400)
        items = list(items)

    action = items[0].get("action", "")
    result = items[0].get("result", "")

    results = []
    conn = get_db()
    try:
        import uuid
        batch_id = f"BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
        for it in items:
            eid = int(it.get("event_id"))
            sr_id = it.get("scan_record_id")
            opinion = (it.get("opinion") or "").strip()
            if sr_id is None:
                results.append({"id": eid, "success": False, "message": "必须携带核验凭证（scan_record_id），请先完成现场扫码核验"})
                continue
            try:
                conn.execute("BEGIN IMMEDIATE")
                # 消费凭证
                cred = consume_scan_credential(conn, eid, int(sr_id), user, f"batch_{action}")
                if not cred["ok"]:
                    conn.execute("ROLLBACK")
                    results.append({"id": eid, "success": False, "message": cred["error"]})
                    continue
                ev = conn.execute("SELECT * FROM events WHERE id = ?", (eid,)).fetchone()
                if not ev:
                    conn.execute("ROLLBACK")
                    results.append({"id": eid, "success": False, "message": "医疗事件单不存在"})
                    continue
                event = row_to_dict(ev)

                if action == "review":
                    if user["role"] != "supervisor":
                        conn.execute("ROLLBACK")
                        results.append({"id": eid, "success": False, "message": "越权操作：仅审核主管可批量审核"})
                        continue
                    if event["status"] not in ("submitted", "archive_rejected"):
                        conn.execute("ROLLBACK")
                        results.append({"id": eid, "success": False, "message": f"状态「{STATUS_LABELS.get(event['status'], event['status'])}」不可审核"})
                        continue
                    if event["current_handler_role"] != user["role"]:
                        conn.execute("ROLLBACK")
                        handler_label = ROLE_LABELS.get(event["current_handler_role"], event["current_handler_role"])
                        results.append({"id": eid, "success": False, "message": f"非当前处理人：应由{handler_label}处理"})
                        continue
                    if not opinion:
                        conn.execute("ROLLBACK")
                        results.append({"id": eid, "success": False, "message": "处理意见不能为空"})
                        continue
                    if result == "pass":
                        new_status = "review_passed"
                        new_handler = "reviewer"
                    elif result == "reject":
                        new_status = "review_rejected"
                        new_handler = "registrar"
                    else:
                        conn.execute("ROLLBACK")
                        results.append({"id": eid, "success": False, "message": "审核结果必须为 pass 或 reject"})
                        continue
                    mats = conn.execute("SELECT COUNT(*) FROM materials WHERE event_id = ?", (eid,)).fetchone()[0]
                    if mats < 1:
                        conn.execute("ROLLBACK")
                        results.append({"id": eid, "success": False, "message": "证据缺失：无法审核没有材料的医疗事件单"})
                        continue
                    now = datetime.now().isoformat()
                    conn.execute(
                        "UPDATE events SET status=?, current_handler_role=?, updated_at=?, scan_token=?, version=? WHERE id=? AND version=?",
                        (new_status, new_handler, now, cred["new_token"], cred["new_version"], eid, event["version"]),
                    )
                    conn.execute(
                        "INSERT INTO actions (event_id, action_type, opinion, result, actor_id, actor_role, created_at) VALUES (?,?,?,?,?,?,?)",
                        (eid, "batch_review", opinion, result, user["id"], user["role"], now),
                    )
                    _write_audit(conn, eid, f"batch_review_{result}", user, f"批量审核{'通过' if result == 'pass' else '退回'}：{opinion}（批次{batch_id}，已消费扫码凭证#{cred['scan_record_id']}）", now, cred["scan_record_id"], cred["old_version"], cred["new_version"], event["status"], new_status, batch_id)
                    conn.execute("COMMIT")
                    results.append({"id": eid, "success": True, "message": f"审核{'通过' if result == 'pass' else '退回'}成功"})

                elif action == "archive_review":
                    if user["role"] != "reviewer":
                        conn.execute("ROLLBACK")
                        results.append({"id": eid, "success": False, "message": "越权操作：仅复核负责人可批量复核"})
                        continue
                    if event["status"] != "review_passed":
                        conn.execute("ROLLBACK")
                        results.append({"id": eid, "success": False, "message": f"状态「{STATUS_LABELS.get(event['status'], event['status'])}」不可复核归档"})
                        continue
                    if event["current_handler_role"] != user["role"]:
                        conn.execute("ROLLBACK")
                        handler_label = ROLE_LABELS.get(event["current_handler_role"], event["current_handler_role"])
                        results.append({"id": eid, "success": False, "message": f"非当前处理人：应由{handler_label}处理"})
                        continue
                    if not opinion:
                        conn.execute("ROLLBACK")
                        results.append({"id": eid, "success": False, "message": "处理意见不能为空"})
                        continue
                    if result == "archive":
                        new_status = "archived"
                        new_handler = None
                    elif result == "reject":
                        new_status = "archive_rejected"
                        new_handler = "supervisor"
                    else:
                        conn.execute("ROLLBACK")
                        results.append({"id": eid, "success": False, "message": "复核结果必须为 archive 或 reject"})
                        continue
                    now = datetime.now().isoformat()
                    conn.execute(
                        "UPDATE events SET status=?, current_handler_role=?, updated_at=?, scan_token=?, version=? WHERE id=? AND version=?",
                        (new_status, new_handler, now, cred["new_token"], cred["new_version"], eid, event["version"]),
                    )
                    conn.execute(
                        "INSERT INTO actions (event_id, action_type, opinion, result, actor_id, actor_role, created_at) VALUES (?,?,?,?,?,?,?)",
                        (eid, "batch_archive_review", opinion, result, user["id"], user["role"], now),
                    )
                    _write_audit(conn, eid, f"batch_archive_{result}", user, f"批量复核{'归档' if result == 'archive' else '退回'}：{opinion}（批次{batch_id}，已消费扫码凭证#{cred['scan_record_id']}）", now, cred["scan_record_id"], cred["old_version"], cred["new_version"], event["status"], new_status, batch_id)
                    conn.execute("COMMIT")
                    results.append({"id": eid, "success": True, "message": f"复核{'归档' if result == 'archive' else '退回'}成功"})
                else:
                    conn.execute("ROLLBACK")
                    results.append({"id": eid, "success": False, "message": f"不支持的操作类型：{action}"})
            except Exception as e:
                try:
                    conn.execute("ROLLBACK")
                except Exception:
                    pass
                results.append({"id": eid, "success": False, "message": f"内部错误：{str(e)}"})

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


async def queue_summary(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    conn = get_db()
    try:
        role = user["role"]
        def _events(query, params):
            rows = conn.execute(query, params).fetchall()
            return [row_to_dict(r) for r in rows]

        base = "SELECT e.*, u.name as creator_name FROM events e LEFT JOIN users u ON e.created_by = u.id"

        actionable = []
        supplement_pending = []
        review_pending = []
        not_actionable = []

        all_rows = _events(f"{base} ORDER BY e.updated_at DESC", ())

        for ev in all_rows:
            if ev["status"] == "archived":
                not_actionable.append({
                    "event_id": ev["id"],
                    "event_code": ev["code"],
                    "event_title": ev["title"],
                    "reason": "事件已归档，不可处理",
                })
                continue

            if ev["current_handler_role"] != role:
                handler_label = ROLE_LABELS.get(ev["current_handler_role"], ev["current_handler_role"]) if ev["current_handler_role"] else "归档处理中"
                not_actionable.append({
                    "event_id": ev["id"],
                    "event_code": ev["code"],
                    "event_title": ev["title"],
                    "reason": f"当前处理人为{handler_label}，非你的岗位",
                })
                continue

            if role == "registrar":
                if ev["status"] == "draft":
                    actionable.append({
                        "event_id": ev["id"], "event_code": ev["code"],
                        "event_title": ev["title"], "status": ev["status"],
                        "event_type": ev["event_type"], "version": ev["version"],
                        "updated_at": ev["updated_at"], "creator_name": ev.get("creator_name"),
                    })
                elif ev["status"] == "review_rejected":
                    supplement_pending.append({
                        "event_id": ev["id"], "event_code": ev["code"],
                        "event_title": ev["title"], "status": ev["status"],
                        "event_type": ev["event_type"], "version": ev["version"],
                        "updated_at": ev["updated_at"], "creator_name": ev.get("creator_name"),
                    })
                else:
                    not_actionable.append({
                        "event_id": ev["id"],
                        "event_code": ev["code"],
                        "event_title": ev["title"],
                        "reason": f"登记员在状态「{STATUS_LABELS.get(ev['status'], ev['status'])}」下不可操作",
                    })
            elif role == "supervisor":
                if ev["status"] in ("submitted", "archive_rejected"):
                    review_pending.append({
                        "event_id": ev["id"], "event_code": ev["code"],
                        "event_title": ev["title"], "status": ev["status"],
                        "event_type": ev["event_type"], "version": ev["version"],
                        "updated_at": ev["updated_at"], "creator_name": ev.get("creator_name"),
                    })
                else:
                    not_actionable.append({
                        "event_id": ev["id"],
                        "event_code": ev["code"],
                        "event_title": ev["title"],
                        "reason": f"审核主管在状态「{STATUS_LABELS.get(ev['status'], ev['status'])}」下不可操作",
                    })
            elif role == "reviewer":
                if ev["status"] == "review_passed":
                    actionable.append({
                        "event_id": ev["id"], "event_code": ev["code"],
                        "event_title": ev["title"], "status": ev["status"],
                        "event_type": ev["event_type"], "version": ev["version"],
                        "updated_at": ev["updated_at"], "creator_name": ev.get("creator_name"),
                    })
                else:
                    not_actionable.append({
                        "event_id": ev["id"],
                        "event_code": ev["code"],
                        "event_title": ev["title"],
                        "reason": f"复核负责人在状态「{STATUS_LABELS.get(ev['status'], ev['status'])}」下不可操作",
                    })
            else:
                not_actionable.append({
                    "event_id": ev["id"],
                    "event_code": ev["code"],
                    "event_title": ev["title"],
                    "reason": f"未知岗位 {role}",
                })

        return _json({
            "role": role,
            "role_label": ROLE_LABELS.get(role, role),
            "actionable": actionable,
            "actionable_count": len(actionable),
            "supplement_pending": supplement_pending,
            "supplement_pending_count": len(supplement_pending),
            "review_pending": review_pending,
            "review_pending_count": len(review_pending),
            "not_actionable": not_actionable,
            "not_actionable_count": len(not_actionable),
            "total": len(all_rows),
        })
    finally:
        conn.close()


async def log_filter_change(request):
    user = await require_auth(request)
    if isinstance(user, JSONResponse):
        return user
    body = await _body(request)
    role = body.get("filter_role", "") or ""
    status = body.get("filter_status", "") or ""
    event_type = body.get("filter_event_type", "") or ""
    now = datetime.now().isoformat()
    detail_parts = []
    if role: detail_parts.append(f"岗位={ROLE_LABELS.get(role, role)}")
    if status: detail_parts.append(f"状态={STATUS_LABELS.get(status, status)}")
    if event_type: detail_parts.append(f"类型={EVENT_TYPE_LABELS.get(event_type, event_type)}")
    detail = "；".join(detail_parts) if detail_parts else "清除所有筛选"
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO audit_log (event_id, action, actor_id, actor_role, actor_name, detail, created_at, filter_role, filter_status, filter_event_type) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (None, "filter_change", user["id"], user["role"], user.get("name", ""), f"筛选变更：{detail}", now, role or None, status or None, event_type or None),
        )
        return _json({"ok": True})
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
    Route("/api/queue-summary", queue_summary, methods=["GET"]),
    Route("/api/audit-log", get_audit_log, methods=["GET"]),
    Route("/api/audit-log/filter-change", log_filter_change, methods=["POST"]),
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
