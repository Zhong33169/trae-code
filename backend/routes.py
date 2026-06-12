import json
from datetime import datetime

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from database import get_db


def _parse_order(row_dict):
    if row_dict.get("evidence_descriptions"):
        try:
            row_dict["evidence_descriptions"] = json.loads(row_dict["evidence_descriptions"])
        except (json.JSONDecodeError, TypeError):
            row_dict["evidence_descriptions"] = []
    else:
        row_dict["evidence_descriptions"] = []
    return row_dict


async def get_users(request: Request):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM users ORDER BY id")
    rows = await cursor.fetchall()
    return JSONResponse([dict(r) for r in rows])


async def get_stats(request: Request):
    db = await get_db()
    cursor = await db.execute("SELECT status, COUNT(*) as cnt FROM repair_orders GROUP BY status")
    rows = await cursor.fetchall()
    counts = {r["status"]: r["cnt"] for r in rows}
    cursor = await db.execute("SELECT COUNT(*) as total FROM repair_orders")
    total = (await cursor.fetchone())["total"]
    return JSONResponse({
        "total": total,
        "draft": counts.get("draft", 0),
        "submitted": counts.get("submitted", 0),
        "under_review": counts.get("under_review", 0),
        "returned": counts.get("returned", 0),
        "review_approved": counts.get("review_approved", 0),
        "under_recheck": counts.get("under_recheck", 0),
        "archived": counts.get("archived", 0),
        "rejected": counts.get("rejected", 0),
    })


async def list_orders(request: Request):
    db = await get_db()
    status = request.query_params.get("status", "")
    handler_role = request.query_params.get("handler_role", "")
    keyword = request.query_params.get("keyword", "")
    offset = int(request.query_params.get("offset", "0"))
    limit = int(request.query_params.get("limit", "20"))

    conditions = []
    params = []

    if status:
        conditions.append("ro.status = ?")
        params.append(status)
    if handler_role:
        conditions.append("ro.current_handler_role = ?")
        params.append(handler_role)
    if keyword:
        conditions.append("(ro.title LIKE ? OR ro.enterprise_name LIKE ? OR ro.order_no LIKE ?)")
        params.extend([f"%{keyword}%", f"%{keyword}%", f"%{keyword}%"])

    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""

    count_cursor = await db.execute(f"SELECT COUNT(*) as total FROM repair_orders ro{where}", params)
    total = (await count_cursor.fetchone())["total"]

    query = f"""
        SELECT ro.id, ro.order_no, ro.title, ro.enterprise_name, ro.status,
               ro.urgency, ro.repair_type, ro.current_handler_role, ro.current_handler_id,
               u.name as current_handler_name, ro.created_at, ro.updated_at
        FROM repair_orders ro
        LEFT JOIN users u ON ro.current_handler_id = u.id
        {where}
        ORDER BY ro.updated_at DESC
        LIMIT ? OFFSET ?
    """
    cursor = await db.execute(query, params + [limit, offset])
    rows = await cursor.fetchall()
    items = []
    for r in rows:
        item = dict(r)
        items.append(item)

    return JSONResponse({"total": total, "items": items, "offset": offset, "limit": limit})


async def get_order(request: Request):
    order_id = request.path_params["id"]
    db = await get_db()
    cursor = await db.execute("SELECT * FROM repair_orders WHERE id = ?", [order_id])
    order = await cursor.fetchone()
    if not order:
        return JSONResponse({"error": "工单不存在"}, status_code=404)

    order_dict = _parse_order(dict(order))

    cursor = await db.execute(
        "SELECT * FROM operation_records WHERE order_id = ? ORDER BY created_at ASC",
        [order_id],
    )
    records = await cursor.fetchall()
    order_dict["operation_records"] = [dict(r) for r in records]

    return JSONResponse(order_dict)


async def _generate_order_no(db):
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"WXO-{today}-"
    cursor = await db.execute(
        "SELECT order_no FROM repair_orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1",
        [f"{prefix}%"],
    )
    row = await cursor.fetchone()
    if row:
        last_num = int(row["order_no"].split("-")[-1])
        return f"{prefix}{last_num + 1:03d}"
    return f"{prefix}001"


async def _write_validation_failed(db, order_id, operator_id, user, errors, from_status, from_version):
    safe_op_id = operator_id if operator_id is not None else 0
    safe_name = user["name"] if user else "未知用户"
    safe_role = user["role"] if user else ""
    try:
        await db.execute(
            """INSERT INTO operation_records
               (order_id, action, operator_id, operator_name, operator_role,
                from_status, to_status, from_version, to_version, reason, result)
               VALUES (?, 'validation_failed', ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [order_id, safe_op_id, safe_name, safe_role,
             from_status, from_status, from_version, from_version,
             "; ".join(errors) if errors else "校验失败", "failed"],
        )
        await db.commit()
    except Exception:
        try:
            await db.rollback()
        except Exception:
            pass


async def _write_success_record(db, order_id, action, operator_id, user, from_status, to_status,
                                from_version, to_version, opinion=None, reason=None, result=None):
    await db.execute(
        """INSERT INTO operation_records
           (order_id, action, operator_id, operator_name, operator_role,
            from_status, to_status, from_version, to_version, opinion, reason, result)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [order_id, action, operator_id, user["name"], user["role"],
         from_status, to_status, from_version, to_version, opinion, reason, result],
    )


async def _load_operator(db, operator_id):
    if operator_id is None:
        return None
    try:
        cursor = await db.execute("SELECT id, name, role FROM users WHERE id = ?", [operator_id])
        return await cursor.fetchone()
    except Exception:
        return None


async def create_order(request: Request):
    body = await request.json()
    required = ["title", "description", "enterprise_name", "contact_person",
                "contact_phone", "repair_type", "urgency", "location", "operator_id"]
    for field in required:
        if field not in body or not body[field]:
            return JSONResponse({"error": f"缺少必填字段: {field}"}, status_code=400)

    db = await get_db()
    order_no = await _generate_order_no(db)

    evidence = body.get("evidence_descriptions", [])
    if isinstance(evidence, list):
        evidence_json = json.dumps(evidence, ensure_ascii=False)
    else:
        evidence_json = json.dumps([], ensure_ascii=False)

    cursor = await db.execute(
        """INSERT INTO repair_orders
           (order_no, title, description, enterprise_name, contact_person, contact_phone,
            repair_type, urgency, location, evidence_descriptions, status,
            current_handler_id, current_handler_role, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, 'clerk', 1)""",
        [order_no, body["title"], body["description"], body["enterprise_name"],
         body["contact_person"], body["contact_phone"], body["repair_type"],
         body["urgency"], body["location"], evidence_json, body["operator_id"]],
    )
    order_id = cursor.lastrowid

    operator_id = body["operator_id"]
    user_cursor = await db.execute("SELECT name, role FROM users WHERE id = ?", [operator_id])
    user = await user_cursor.fetchone()

    await db.execute(
        """INSERT INTO operation_records
           (order_id, action, operator_id, operator_name, operator_role,
            from_status, to_status, from_version, to_version)
           VALUES (?, 'create', ?, ?, ?, NULL, 'draft', NULL, 1)""",
        [order_id, operator_id, user["name"], user["role"]],
    )
    await db.commit()

    return JSONResponse({"id": order_id, "order_no": order_no}, status_code=201)


async def update_order(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    db = await get_db()

    cursor = await db.execute("SELECT * FROM repair_orders WHERE id = ?", [order_id])
    order = await cursor.fetchone()
    if not order:
        return JSONResponse({"error": "工单不存在"}, status_code=404)

    operator_id = body.get("operator_id")
    version = body.get("version")

    user = await _load_operator(db, operator_id)

    errors = []
    if operator_id is None:
        errors.append("缺少操作者ID")
    if not user:
        errors.append("操作者不存在")
    if order["status"] not in ("draft", "returned"):
        errors.append("当前状态不允许编辑")
    if operator_id is not None and operator_id != order["current_handler_id"]:
        errors.append("非当前处理人无法编辑")
    if user and user["role"] not in ("clerk",):
        errors.append("仅登记员可编辑工单")
    if version is None:
        errors.append("缺少版本号")
    elif version != order["version"]:
        errors.append("版本冲突，请刷新后重试")

    updatable = ["title", "description", "enterprise_name", "contact_person",
                 "contact_phone", "repair_type", "urgency", "location", "evidence_descriptions"]
    has_update = any(field in body for field in updatable)
    if not has_update:
        errors.append("没有需要更新的字段")

    if errors:
        await _write_validation_failed(db, order_id, operator_id, user, errors,
                                        order["status"], order["version"])
        return JSONResponse({"error": "; ".join(errors)}, status_code=400)

    sets = []
    params = []
    for field in updatable:
        if field in body:
            value = body[field]
            if field == "evidence_descriptions":
                if isinstance(value, list):
                    value = json.dumps(value, ensure_ascii=False)
            sets.append(f"{field} = ?")
            params.append(value)

    from_ver = order["version"]
    to_ver = from_ver + 1

    sets.append("version = version + 1")
    sets.append("updated_at = datetime('now')")
    params.append(order_id)

    await db.execute(
        f"UPDATE repair_orders SET {', '.join(sets)} WHERE id = ?",
        params,
    )

    opinion = body.get("opinion") or "编辑补正工单内容"
    await _write_success_record(db, order_id, "update", operator_id, user,
                                 order["status"], order["status"],
                                 from_ver, to_ver, opinion=opinion)
    await db.commit()

    cursor = await db.execute("SELECT * FROM repair_orders WHERE id = ?", [order_id])
    updated = _parse_order(dict(await cursor.fetchone()))
    return JSONResponse(updated)


async def submit_order(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    db = await get_db()

    cursor = await db.execute("SELECT * FROM repair_orders WHERE id = ?", [order_id])
    order = await cursor.fetchone()
    if not order:
        return JSONResponse({"error": "工单不存在"}, status_code=404)

    operator_id = body.get("operator_id")
    version = body.get("version")
    opinion = body.get("opinion")

    user = await _load_operator(db, operator_id)

    errors = []
    if operator_id is None:
        errors.append("缺少操作者ID")
    if not user:
        errors.append("操作者不存在")
    if order["status"] not in ("draft", "returned"):
        errors.append("当前状态不允许提交")
    if operator_id is not None and operator_id != order["current_handler_id"]:
        errors.append("非当前处理人无法提交")
    if user and user["role"] != "clerk":
        errors.append("仅登记员可提交工单")
    if version is None:
        errors.append("缺少版本号")
    elif version != order["version"]:
        errors.append("版本冲突，请刷新后重试")
    if not opinion or not opinion.strip():
        errors.append("提交意见为必填项")
    if order["status"] == "returned":
        try:
            evidence = json.loads(order["evidence_descriptions"]) if order["evidence_descriptions"] else []
        except (json.JSONDecodeError, TypeError):
            evidence = []
        if not evidence:
            errors.append("退回工单必须补充证据描述后才能提交")

    if errors:
        await _write_validation_failed(db, order_id, operator_id, user, errors,
                                        order["status"], order["version"])
        return JSONResponse({"error": "; ".join(errors)}, status_code=400)

    from_ver = order["version"]
    to_ver = from_ver + 1
    new_status = "submitted"

    await db.execute(
        """UPDATE repair_orders
           SET status = ?, current_handler_role = 'supervisor', current_handler_id = NULL,
               version = version + 1, updated_at = datetime('now')
           WHERE id = ?""",
        [new_status, order_id],
    )
    await _write_success_record(db, order_id, "submit", operator_id, user,
                                 order["status"], new_status,
                                 from_ver, to_ver, opinion=opinion)
    await db.commit()

    cursor = await db.execute("SELECT * FROM repair_orders WHERE id = ?", [order_id])
    return JSONResponse(_parse_order(dict(await cursor.fetchone())))


async def accept_review(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    db = await get_db()

    cursor = await db.execute("SELECT * FROM repair_orders WHERE id = ?", [order_id])
    order = await cursor.fetchone()
    if not order:
        return JSONResponse({"error": "工单不存在"}, status_code=404)

    operator_id = body.get("operator_id")
    version = body.get("version")
    opinion = body.get("opinion")

    user = await _load_operator(db, operator_id)

    errors = []
    if operator_id is None:
        errors.append("缺少操作者ID")
    if not user:
        errors.append("操作者不存在")
    if order["status"] != "submitted":
        errors.append("当前状态不允许受理审核")
    if user and user["role"] != "supervisor":
        errors.append("仅主管可受理审核")
    if version is None:
        errors.append("缺少版本号")
    elif version != order["version"]:
        errors.append("版本冲突，请刷新后重试")
    if not opinion or not opinion.strip():
        errors.append("受理意见为必填项")

    if errors:
        await _write_validation_failed(db, order_id, operator_id, user, errors,
                                        order["status"], order["version"])
        return JSONResponse({"error": "; ".join(errors)}, status_code=400)

    from_ver = order["version"]
    to_ver = from_ver + 1
    new_status = "under_review"

    await db.execute(
        """UPDATE repair_orders
           SET status = ?, current_handler_id = ?, current_handler_role = 'supervisor',
               version = version + 1, updated_at = datetime('now')
           WHERE id = ?""",
        [new_status, operator_id, order_id],
    )
    await _write_success_record(db, order_id, "accept_review", operator_id, user,
                                 order["status"], new_status,
                                 from_ver, to_ver, opinion=opinion)
    await db.commit()

    cursor = await db.execute("SELECT * FROM repair_orders WHERE id = ?", [order_id])
    return JSONResponse(_parse_order(dict(await cursor.fetchone())))


async def review_order(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    db = await get_db()

    cursor = await db.execute("SELECT * FROM repair_orders WHERE id = ?", [order_id])
    order = await cursor.fetchone()
    if not order:
        return JSONResponse({"error": "工单不存在"}, status_code=404)

    operator_id = body.get("operator_id")
    version = body.get("version")
    result = body.get("result")
    opinion = body.get("opinion")
    reason = body.get("reason")

    user = await _load_operator(db, operator_id)

    errors = []
    if operator_id is None:
        errors.append("缺少操作者ID")
    if not user:
        errors.append("操作者不存在")
    if order["status"] != "under_review":
        errors.append("当前状态不允许审核")
    if operator_id is not None and operator_id != order["current_handler_id"]:
        errors.append("非当前处理人无法审核")
    if user and user["role"] != "supervisor":
        errors.append("仅主管可审核")
    if version is None:
        errors.append("缺少版本号")
    elif version != order["version"]:
        errors.append("版本冲突，请刷新后重试")
    if result not in ("approve", "return", "reject"):
        errors.append("审核结果无效")
    if not opinion or not opinion.strip():
        errors.append("审核意见为必填项")
    if result in ("return", "reject") and (not reason or not reason.strip()):
        errors.append("退回或驳回时必须填写原因")

    if errors:
        await _write_validation_failed(db, order_id, operator_id, user, errors,
                                        order["status"], order["version"])
        return JSONResponse({"error": "; ".join(errors)}, status_code=400)

    status_map = {
        "approve": ("review_approved", "rechecker"),
        "return": ("returned", "clerk"),
        "reject": ("rejected", None),
    }
    new_status, new_handler_role = status_map[result]

    if result == "return":
        cursor2 = await db.execute("SELECT id FROM users WHERE role = 'clerk' ORDER BY id LIMIT 1")
        clerk = await cursor2.fetchone()
        handler_id = clerk["id"] if clerk else None
        new_handler_role = "clerk"
    elif result == "reject":
        handler_id = None
    else:
        handler_id = None

    from_ver = order["version"]
    to_ver = from_ver + 1

    await db.execute(
        """UPDATE repair_orders
           SET status = ?, current_handler_id = ?, current_handler_role = ?,
               version = version + 1, updated_at = datetime('now')
           WHERE id = ?""",
        [new_status, handler_id, new_handler_role, order_id],
    )
    action_name = {"approve": "review_approve", "return": "review_return", "reject": "review_reject"}[result]
    await _write_success_record(db, order_id, action_name, operator_id, user,
                                 order["status"], new_status,
                                 from_ver, to_ver, opinion=opinion, reason=reason, result=result)
    await db.commit()

    cursor = await db.execute("SELECT * FROM repair_orders WHERE id = ?", [order_id])
    return JSONResponse(_parse_order(dict(await cursor.fetchone())))


async def accept_recheck(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    db = await get_db()

    cursor = await db.execute("SELECT * FROM repair_orders WHERE id = ?", [order_id])
    order = await cursor.fetchone()
    if not order:
        return JSONResponse({"error": "工单不存在"}, status_code=404)

    operator_id = body.get("operator_id")
    version = body.get("version")
    opinion = body.get("opinion")

    user = await _load_operator(db, operator_id)

    errors = []
    if operator_id is None:
        errors.append("缺少操作者ID")
    if not user:
        errors.append("操作者不存在")
    if order["status"] != "review_approved":
        errors.append("当前状态不允许受理复核")
    if user and user["role"] != "rechecker":
        errors.append("仅复核员可受理复核")
    if version is None:
        errors.append("缺少版本号")
    elif version != order["version"]:
        errors.append("版本冲突，请刷新后重试")
    if not opinion or not opinion.strip():
        errors.append("受理意见为必填项")

    if errors:
        await _write_validation_failed(db, order_id, operator_id, user, errors,
                                        order["status"], order["version"])
        return JSONResponse({"error": "; ".join(errors)}, status_code=400)

    from_ver = order["version"]
    to_ver = from_ver + 1
    new_status = "under_recheck"

    await db.execute(
        """UPDATE repair_orders
           SET status = ?, current_handler_id = ?, current_handler_role = 'rechecker',
               version = version + 1, updated_at = datetime('now')
           WHERE id = ?""",
        [new_status, operator_id, order_id],
    )
    await _write_success_record(db, order_id, "accept_recheck", operator_id, user,
                                 order["status"], new_status,
                                 from_ver, to_ver, opinion=opinion)
    await db.commit()

    cursor = await db.execute("SELECT * FROM repair_orders WHERE id = ?", [order_id])
    return JSONResponse(_parse_order(dict(await cursor.fetchone())))


async def recheck_order(request: Request):
    order_id = request.path_params["id"]
    body = await request.json()
    db = await get_db()

    cursor = await db.execute("SELECT * FROM repair_orders WHERE id = ?", [order_id])
    order = await cursor.fetchone()
    if not order:
        return JSONResponse({"error": "工单不存在"}, status_code=404)

    operator_id = body.get("operator_id")
    version = body.get("version")
    result = body.get("result")
    opinion = body.get("opinion")
    reason = body.get("reason")

    user = await _load_operator(db, operator_id)

    errors = []
    if operator_id is None:
        errors.append("缺少操作者ID")
    if not user:
        errors.append("操作者不存在")
    if order["status"] != "under_recheck":
        errors.append("当前状态不允许复核")
    if operator_id is not None and operator_id != order["current_handler_id"]:
        errors.append("非当前处理人无法复核")
    if user and user["role"] != "rechecker":
        errors.append("仅复核员可复核")
    if version is None:
        errors.append("缺少版本号")
    elif version != order["version"]:
        errors.append("版本冲突，请刷新后重试")
    if result not in ("archive", "return"):
        errors.append("复核结果无效")
    if not opinion or not opinion.strip():
        errors.append("复核意见为必填项")
    if result == "return" and (not reason or not reason.strip()):
        errors.append("退回时必须填写原因")

    if errors:
        await _write_validation_failed(db, order_id, operator_id, user, errors,
                                        order["status"], order["version"])
        return JSONResponse({"error": "; ".join(errors)}, status_code=400)

    if result == "archive":
        new_status = "archived"
        new_handler_role = None
        handler_id = None
    else:
        new_status = "returned"
        cursor2 = await db.execute("SELECT id FROM users WHERE role = 'clerk' ORDER BY id LIMIT 1")
        clerk = await cursor2.fetchone()
        handler_id = clerk["id"] if clerk else None
        new_handler_role = "clerk"

    from_ver = order["version"]
    to_ver = from_ver + 1

    await db.execute(
        """UPDATE repair_orders
           SET status = ?, current_handler_id = ?, current_handler_role = ?,
               version = version + 1, updated_at = datetime('now')
           WHERE id = ?""",
        [new_status, handler_id, new_handler_role, order_id],
    )
    action_name = {"archive": "recheck_archive", "return": "recheck_return"}[result]
    await _write_success_record(db, order_id, action_name, operator_id, user,
                                 order["status"], new_status,
                                 from_ver, to_ver, opinion=opinion, reason=reason, result=result)
    await db.commit()

    cursor = await db.execute("SELECT * FROM repair_orders WHERE id = ?", [order_id])
    return JSONResponse(_parse_order(dict(await cursor.fetchone())))


routes = [
    Route("/api/users", get_users),
    Route("/api/stats", get_stats),
    Route("/api/orders", list_orders),
    Route("/api/orders", create_order, methods=["POST"]),
    Route("/api/orders/{id:int}", get_order),
    Route("/api/orders/{id:int}", update_order, methods=["PUT"]),
    Route("/api/orders/{id:int}/submit", submit_order, methods=["POST"]),
    Route("/api/orders/{id:int}/accept_review", accept_review, methods=["POST"]),
    Route("/api/orders/{id:int}/review", review_order, methods=["POST"]),
    Route("/api/orders/{id:int}/accept_recheck", accept_recheck, methods=["POST"]),
    Route("/api/orders/{id:int}/recheck", recheck_order, methods=["POST"]),
]
