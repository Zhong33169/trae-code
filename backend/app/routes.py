from starlette.routing import Route, Mount
from starlette.responses import JSONResponse
from starlette.requests import Request
import aiosqlite

from app.config import DB_PATH
from app.auth import create_access_token, verify_password, hash_password, get_current_user
from app.schemas import LoginRequest, MaterialCreate, FeedbackCreate
from app.services import (
    get_order_detail, scan_qr_code, create_service_order,
    submit_for_review, review_order, finalize_order,
    add_feedback, get_statistics, batch_review, batch_finalize,
    add_material, delete_material,
    check_time_limit, check_materials_complete,
    MATERIAL_REQUIRED, ORDER_STATUSES, ROLES, MATERIAL_TYPES
)

async def login(request: Request):
    body = await request.json()
    req = LoginRequest(**body)
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    cursor = await db.execute("SELECT * FROM users WHERE username = ?", (req.username,))
    user = await cursor.fetchone()
    
    if not user or not verify_password(req.password, user["password_hash"]):
        await db.close()
        return JSONResponse(
            {"detail": "用户名或密码错误"},
            status_code=401
        )
    
    token = create_access_token(
        data={"sub": user["username"], "role": user["role"], "name": user["name"]}
    )
    
    await db.close()
    return JSONResponse({
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "role": user["role"],
            "name": user["name"]
        }
    })

async def me(request: Request):
    user = await get_current_user(request)
    return JSONResponse(user)

async def list_orders(request: Request):
    user = await get_current_user(request)
    
    status = request.query_params.get("status")
    page = int(request.query_params.get("page", 1))
    page_size = int(request.query_params.get("page_size", 20))
    keyword = request.query_params.get("keyword", "")
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    query = "SELECT * FROM service_orders WHERE 1=1"
    params = []
    
    role = user["role"]
    if role == "registrar":
        query += " AND register_by = ?"
        params.append(user["username"])
    elif role == "reviewer":
        pass
    elif role == "finalizer":
        pass
    
    if status:
        query += " AND status = ?"
        params.append(status)
    
    if keyword:
        query += " AND (order_no LIKE ? OR qr_code LIKE ?)"
        params.extend([f"%{keyword}%", f"%{keyword}%"])
    
    count_query = query.replace("SELECT *", "SELECT COUNT(*) as cnt")
    cursor = await db.execute(count_query, params)
    total = (await cursor.fetchone())["cnt"]
    
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([page_size, (page - 1) * page_size])
    
    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    
    orders = []
    for row in rows:
        order_dict = dict(row)
        cursor = await db.execute("SELECT name, student_no FROM students WHERE id = ?", (row["student_id"],))
        student = await cursor.fetchone()
        if student:
            order_dict["student_name"] = student["name"]
            order_dict["student_no"] = student["student_no"]
        
        cursor = await db.execute("SELECT name, subject FROM courses WHERE id = ?", (row["course_id"],))
        course = await cursor.fetchone()
        if course:
            order_dict["course_name"] = course["name"]
            order_dict["course_subject"] = course["subject"]
        
        material_complete = await check_materials_complete(db, row["id"])
        order_dict["material_complete"] = material_complete
        
        time_info = await check_time_limit(db, row["id"])
        order_dict["time_info"] = time_info
        
        orders.append(order_dict)
    
    await db.close()
    return JSONResponse({
        "items": orders,
        "total": total,
        "page": page,
        "page_size": page_size
    })

async def get_order(request: Request):
    user = await get_current_user(request)
    order_id = int(request.path_params["order_id"])
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    detail = await get_order_detail(db, order_id)
    await db.close()
    
    if not detail:
        return JSONResponse({"detail": "服务单不存在"}, status_code=404)
    
    return JSONResponse(detail)

async def scan(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    qr_code = body.get("qr_code", "")
    
    if not qr_code:
        return JSONResponse(
            {"valid": False, "message": "请提供二维码内容", "error_code": "EMPTY_CODE"},
            status_code=400
        )
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    result = await scan_qr_code(db, qr_code, user)
    await db.close()
    
    status_code = 200 if result["valid"] else 400
    return JSONResponse(result, status_code=status_code)

async def create_order(request: Request):
    user = await get_current_user(request)
    if user["role"] != "registrar":
        return JSONResponse({"detail": "只有登记员可以创建服务单"}, status_code=403)
    
    body = await request.json()
    from app.schemas import ServiceOrderCreate
    order_data = ServiceOrderCreate(**body)
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    try:
        result = await create_service_order(db, order_data, user)
        await db.close()
        return JSONResponse(result)
    except Exception as e:
        await db.close()
        raise

async def submit_order(request: Request):
    user = await get_current_user(request)
    if user["role"] != "registrar":
        return JSONResponse({"detail": "只有登记员可以提交审核"}, status_code=403)
    
    order_id = int(request.path_params["order_id"])
    body = await request.json()
    opinion = body.get("opinion")
    materials = body.get("materials", [])
    
    material_objs = [MaterialCreate(**m) for m in materials]
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    try:
        result = await submit_for_review(db, order_id, user, opinion, material_objs)
        await db.close()
        return JSONResponse(result)
    except Exception as e:
        await db.close()
        raise

async def review_order_endpoint(request: Request):
    user = await get_current_user(request)
    if user["role"] != "reviewer":
        return JSONResponse({"detail": "只有审核主管可以审核"}, status_code=403)
    
    order_id = int(request.path_params["order_id"])
    body = await request.json()
    approved = body.get("approved", True)
    opinion = body.get("opinion")
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    try:
        result = await review_order(db, order_id, user, approved, opinion)
        await db.close()
        return JSONResponse(result)
    except Exception as e:
        await db.close()
        raise

async def finalize_order_endpoint(request: Request):
    user = await get_current_user(request)
    if user["role"] != "finalizer":
        return JSONResponse({"detail": "只有复核负责人可以复核"}, status_code=403)
    
    order_id = int(request.path_params["order_id"])
    body = await request.json()
    approved = body.get("approved", True)
    opinion = body.get("opinion")
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    try:
        result = await finalize_order(db, order_id, user, approved, opinion)
        await db.close()
        return JSONResponse(result)
    except Exception as e:
        await db.close()
        raise

async def add_feedback_endpoint(request: Request):
    user = await get_current_user(request)
    order_id = int(request.path_params["order_id"])
    body = await request.json()
    
    feedback_data = FeedbackCreate(**body)
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    try:
        result = await add_feedback(db, order_id, feedback_data, user)
        await db.close()
        return JSONResponse(result)
    except Exception as e:
        await db.close()
        raise

async def add_material_endpoint(request: Request):
    user = await get_current_user(request)
    order_id = int(request.path_params["order_id"])
    body = await request.json()
    
    material_data = MaterialCreate(**body)
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    try:
        result = await add_material(db, order_id, material_data, user)
        await db.close()
        return JSONResponse(result)
    except Exception as e:
        await db.close()
        raise

async def delete_material_endpoint(request: Request):
    user = await get_current_user(request)
    order_id = int(request.path_params["order_id"])
    material_id = int(request.path_params["material_id"])
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    try:
        result = await delete_material(db, order_id, material_id, user)
        await db.close()
        return JSONResponse(result)
    except Exception as e:
        await db.close()
        raise

async def statistics_endpoint(request: Request):
    user = await get_current_user(request)
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    stats = await get_statistics(db, user)
    await db.close()
    
    return JSONResponse(stats.model_dump())

async def batch_review_endpoint(request: Request):
    user = await get_current_user(request)
    if user["role"] != "reviewer":
        return JSONResponse({"detail": "只有审核主管可以批量审核"}, status_code=403)
    
    body = await request.json()
    order_ids = body.get("order_ids", [])
    approved = body.get("approved", True)
    opinion = body.get("opinion")
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    result = await batch_review(db, order_ids, user, approved, opinion)
    await db.close()
    
    return JSONResponse(result)

async def batch_finalize_endpoint(request: Request):
    user = await get_current_user(request)
    if user["role"] != "finalizer":
        return JSONResponse({"detail": "只有复核负责人可以批量复核"}, status_code=403)
    
    body = await request.json()
    order_ids = body.get("order_ids", [])
    approved = body.get("approved", True)
    opinion = body.get("opinion")
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    result = await batch_finalize(db, order_ids, user, approved, opinion)
    await db.close()
    
    return JSONResponse(result)

async def list_students(request: Request):
    user = await get_current_user(request)
    
    keyword = request.query_params.get("keyword", "")
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    query = "SELECT * FROM students WHERE status = 'active'"
    params = []
    
    if keyword:
        query += " AND (name LIKE ? OR student_no LIKE ?)"
        params.extend([f"%{keyword}%", f"%{keyword}%"])
    
    query += " ORDER BY created_at DESC LIMIT 50"
    
    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    
    students = [dict(r) for r in rows]
    await db.close()
    
    return JSONResponse(students)

async def list_courses(request: Request):
    user = await get_current_user(request)
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    cursor = await db.execute("SELECT * FROM courses WHERE status = 'active' ORDER BY created_at DESC")
    rows = await cursor.fetchall()
    
    courses = [dict(r) for r in rows]
    await db.close()
    
    return JSONResponse(courses)

async def list_schedules(request: Request):
    user = await get_current_user(request)
    course_id = request.query_params.get("course_id")
    
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    query = "SELECT * FROM course_schedules WHERE status = 'scheduled'"
    params = []
    
    if course_id:
        query += " AND course_id = ?"
        params.append(int(course_id))
    
    query += " ORDER BY schedule_date DESC LIMIT 50"
    
    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    
    schedules = [dict(r) for r in rows]
    await db.close()
    
    return JSONResponse(schedules)

async def get_constants(request: Request):
    return JSONResponse({
        "order_statuses": ORDER_STATUSES,
        "roles": ROLES,
        "material_required": MATERIAL_REQUIRED,
        "material_types": MATERIAL_TYPES,
        "service_types": {
            "makeup_class": "补课",
            "drop_class": "退课",
            "transfer_class": "转课",
            "trial_class": "试听"
        }
    })

routes = [
    Route("/api/auth/login", login, methods=["POST"]),
    Route("/api/auth/me", me, methods=["GET"]),
    
    Route("/api/orders", list_orders, methods=["GET"]),
    Route("/api/orders", create_order, methods=["POST"]),
    Route("/api/orders/{order_id:int}", get_order, methods=["GET"]),
    Route("/api/orders/{order_id:int}/submit", submit_order, methods=["POST"]),
    Route("/api/orders/{order_id:int}/review", review_order_endpoint, methods=["POST"]),
    Route("/api/orders/{order_id:int}/finalize", finalize_order_endpoint, methods=["POST"]),
    Route("/api/orders/{order_id:int}/feedback", add_feedback_endpoint, methods=["POST"]),
    
    Route("/api/orders/{order_id:int}/materials", add_material_endpoint, methods=["POST"]),
    Route("/api/orders/{order_id:int}/materials/{material_id:int}", delete_material_endpoint, methods=["DELETE"]),
    
    Route("/api/orders/scan", scan, methods=["POST"]),
    Route("/api/orders/batch/review", batch_review_endpoint, methods=["POST"]),
    Route("/api/orders/batch/finalize", batch_finalize_endpoint, methods=["POST"]),
    
    Route("/api/statistics", statistics_endpoint, methods=["GET"]),
    Route("/api/students", list_students, methods=["GET"]),
    Route("/api/courses", list_courses, methods=["GET"]),
    Route("/api/schedules", list_schedules, methods=["GET"]),
    Route("/api/constants", get_constants, methods=["GET"]),
]
