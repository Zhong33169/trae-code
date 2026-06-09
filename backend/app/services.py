import uuid
import aiosqlite
from datetime import datetime
from starlette.exceptions import HTTPException
from app.config import DB_PATH
from app.schemas import (
    ServiceOrderCreate, ServiceOrderUpdate, MaterialCreate,
    FeedbackCreate, StatisticsResponse
)

ORDER_STATUSES = {
    "draft": "草稿",
    "pending_review": "待审核",
    "reviewing": "审核中",
    "pending_finalize": "待复核",
    "finalizing": "复核中",
    "completed": "已完成",
    "rejected": "已驳回",
    "returned": "已退回"
}

ROLES = {
    "registrar": "课程服务登记员",
    "reviewer": "课程服务审核主管",
    "finalizer": "K12培训机构复核负责人"
}

MATERIAL_REQUIRED = {
    "makeup_class": ["补课申请单", "原课程考勤记录", "补课排班确认"],
    "drop_class": ["退课申请单", "缴费凭证", "学员档案"],
    "transfer_class": ["转课申请单", "原课程证明", "新课程排班"],
    "trial_class": ["试听申请单", "学员信息表", "课程安排"]
}

async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db

def generate_order_no():
    return f"SO{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"

def generate_qr_code():
    return f"QR{uuid.uuid4().hex[:16].upper()}"

async def add_audit_log(db, order_id, action, operator, operator_role, from_status=None, to_status=None, remark=None, ip=None):
    await db.execute(
        """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark, ip)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (order_id, action, operator, operator_role, from_status, to_status, remark, ip)
    )

async def check_materials_complete(db, order_id):
    cursor = await db.execute("SELECT service_type FROM service_orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        return False
    required = MATERIAL_REQUIRED.get(order["service_type"], [])
    if not required:
        return True
    cursor = await db.execute("SELECT material_name FROM service_materials WHERE order_id = ?", (order_id,))
    materials = [row["material_name"] for row in await cursor.fetchall()]
    for req in required:
        found = False
        for mat in materials:
            if req in mat or mat in req:
                found = True
                break
        if not found:
            return False
    return True

async def scan_qr_code(db, qr_code, current_user):
    cursor = await db.execute("SELECT * FROM service_orders WHERE qr_code = ?", (qr_code,))
    order = await cursor.fetchone()
    
    if not order:
        return {
            "valid": False,
            "message": "无效码：该二维码不存在或已被删除",
            "error_code": "INVALID_CODE",
            "order": None
        }
    
    if order["status"] == "completed":
        return {
            "valid": False,
            "message": "重复码：该课程服务单已完成归档，请勿重复扫码",
            "error_code": "DUPLICATE_CODE",
            "order": dict(order) if order else None
        }
    
    if order["status"] == "rejected":
        return {
            "valid": False,
            "message": "重复码：该课程服务单已被驳回，请勿重复扫码",
            "error_code": "DUPLICATE_CODE",
            "order": dict(order) if order else None
        }
    
    role = current_user["role"]
    
    if role == "registrar":
        if order["status"] not in ["draft", "returned"]:
            return {
                "valid": False,
                "message": f"非当前处理人：当前状态为「{ORDER_STATUSES.get(order['status'], order['status'])}」，登记员仅可处理草稿或退回状态的服务单",
                "error_code": "NOT_CURRENT_HANDLER",
                "order": dict(order) if order else None
            }
    elif role == "reviewer":
        if order["status"] not in ["pending_review", "reviewing"]:
            return {
                "valid": False,
                "message": f"非当前处理人：当前状态为「{ORDER_STATUSES.get(order['status'], order['status'])}」，审核主管仅可处理待审核状态的服务单",
                "error_code": "NOT_CURRENT_HANDLER",
                "order": dict(order) if order else None
            }
    elif role == "finalizer":
        if order["status"] not in ["pending_finalize", "finalizing"]:
            return {
                "valid": False,
                "message": f"非当前处理人：当前状态为「{ORDER_STATUSES.get(order['status'], order['status'])}」，复核负责人仅可处理待复核状态的服务单",
                "error_code": "NOT_CURRENT_HANDLER",
                "order": dict(order) if order else None
            }
    
    order_detail = await get_order_detail(db, order["id"])
    return {
        "valid": True,
        "message": "扫码成功",
        "error_code": None,
        "order": order_detail
    }

async def get_order_detail(db, order_id):
    cursor = await db.execute("SELECT * FROM service_orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        return None
    
    order_dict = dict(order)
    
    cursor = await db.execute("SELECT * FROM students WHERE id = ?", (order["student_id"],))
    student = await cursor.fetchone()
    order_dict["student"] = dict(student) if student else None
    
    cursor = await db.execute("SELECT * FROM courses WHERE id = ?", (order["course_id"],))
    course = await cursor.fetchone()
    order_dict["course"] = dict(course) if course else None
    
    if order["schedule_id"]:
        cursor = await db.execute("SELECT * FROM course_schedules WHERE id = ?", (order["schedule_id"],))
        schedule = await cursor.fetchone()
        order_dict["schedule"] = dict(schedule) if schedule else None
    else:
        order_dict["schedule"] = None
    
    cursor = await db.execute("SELECT * FROM service_materials WHERE order_id = ? ORDER BY uploaded_at DESC", (order_id,))
    materials = await cursor.fetchall()
    order_dict["materials"] = [dict(m) for m in materials]
    
    cursor = await db.execute("SELECT * FROM feedbacks WHERE order_id = ? ORDER BY created_at DESC LIMIT 1", (order_id,))
    feedback = await cursor.fetchone()
    order_dict["feedback"] = dict(feedback) if feedback else None
    
    cursor = await db.execute("SELECT * FROM audit_logs WHERE order_id = ? ORDER BY created_at DESC", (order_id,))
    audit_logs = await cursor.fetchall()
    order_dict["audit_logs"] = [dict(a) for a in audit_logs]
    
    return order_dict

async def create_service_order(db, order_data: ServiceOrderCreate, user):
    order_no = generate_order_no()
    qr_code = generate_qr_code()
    
    cursor = await db.execute("SELECT status FROM students WHERE id = ?", (order_data.student_id,))
    student = await cursor.fetchone()
    if not student:
        raise HTTPException(status_code=400, detail="学员不存在")
    if student["status"] != "active":
        raise HTTPException(status_code=400, detail="学员档案状态异常，无法创建服务单")
    
    cursor = await db.execute("SELECT status FROM courses WHERE id = ?", (order_data.course_id,))
    course = await cursor.fetchone()
    if not course:
        raise HTTPException(status_code=400, detail="课程不存在")
    if course["status"] != "active":
        raise HTTPException(status_code=400, detail="课程已停用，无法创建服务单")
    
    if order_data.schedule_id:
        cursor = await db.execute("SELECT * FROM course_schedules WHERE id = ?", (order_data.schedule_id,))
        schedule = await cursor.fetchone()
        if not schedule:
            raise HTTPException(status_code=400, detail="课程排班不存在")
        if schedule["status"] != "scheduled":
            raise HTTPException(status_code=400, detail="课程排班状态异常")
    
    cursor = await db.execute(
        """INSERT INTO service_orders 
           (order_no, qr_code, student_id, course_id, schedule_id, service_type, status, 
            current_handler, register_by, version)
           VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, 0)""",
        (order_no, qr_code, order_data.student_id, order_data.course_id, 
         order_data.schedule_id, order_data.service_type, user["username"], user["username"])
    )
    order_id = cursor.lastrowid
    
    await add_audit_log(db, order_id, "create", user["username"], user["role"], 
                       None, "draft", "创建课程服务单")
    
    await db.commit()
    return await get_order_detail(db, order_id)

async def submit_for_review(db, order_id, user, opinion=None, materials=None):
    cursor = await db.execute("SELECT * FROM service_orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        raise HTTPException(status_code=404, detail="服务单不存在")
    
    if order["status"] not in ["draft", "returned"]:
        raise HTTPException(status_code=400, detail=f"当前状态「{ORDER_STATUSES.get(order['status'])}」不可提交审核")
    
    current_version = order["version"]
    
    cursor = await db.execute("SELECT version FROM service_orders WHERE id = ?", (order_id,))
    check_order = await cursor.fetchone()
    if check_order["version"] != current_version:
        raise HTTPException(status_code=409, detail="数据已被他人修改，请刷新后重试")
    
    if materials:
        for mat in materials:
            await db.execute(
                """INSERT INTO service_materials (order_id, material_type, material_name, file_url, uploaded_by)
                   VALUES (?, ?, ?, ?, ?)""",
                (order_id, mat.material_type, mat.material_name, mat.file_url, user["username"])
            )
    
    materials_complete = await check_materials_complete(db, order_id)
    
    if not materials_complete:
        required = MATERIAL_REQUIRED.get(order["service_type"], [])
        raise HTTPException(
            status_code=400, 
            detail=f"材料不完整，提交审核前需上传以下材料：{', '.join(required)}"
        )
    
    await db.execute(
        """UPDATE service_orders 
           SET status = 'pending_review', current_handler = NULL, 
               register_opinion = ?, register_time = CURRENT_TIMESTAMP,
               material_complete = 1, version = version + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND version = ?""",
        (opinion or "", order_id, current_version)
    )
    
    cursor = await db.execute("SELECT changes() as cnt")
    result = await cursor.fetchone()
    if result["cnt"] == 0:
        raise HTTPException(status_code=409, detail="并发冲突：服务单已被他人修改，请刷新后重试")
    
    await add_audit_log(db, order_id, "submit", user["username"], user["role"],
                       order["status"], "pending_review", opinion or "提交审核")
    
    await db.commit()
    return await get_order_detail(db, order_id)

async def review_order(db, order_id, user, approved=True, opinion=None):
    cursor = await db.execute("SELECT * FROM service_orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        raise HTTPException(status_code=404, detail="服务单不存在")
    
    if order["status"] not in ["pending_review", "reviewing"]:
        raise HTTPException(status_code=400, detail=f"当前状态「{ORDER_STATUSES.get(order['status'])}」不可审核")
    
    current_version = order["version"]
    
    cursor = await db.execute("SELECT version FROM service_orders WHERE id = ?", (order_id,))
    check_order = await cursor.fetchone()
    if check_order["version"] != current_version:
        raise HTTPException(status_code=409, detail="数据已被他人修改，请刷新后重试")
    
    if approved:
        new_status = "pending_finalize"
        new_handler = None
        action = "review_pass"
        remark = opinion or "审核通过"
    else:
        new_status = "returned"
        new_handler = order["register_by"]
        action = "review_reject"
        remark = opinion or "审核驳回"
    
    await db.execute(
        """UPDATE service_orders 
           SET status = ?, current_handler = ?, 
               reviewer_by = ?, review_opinion = ?, review_time = CURRENT_TIMESTAMP,
               version = version + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND version = ?""",
        (new_status, new_handler, user["username"], opinion or "", order_id, current_version)
    )
    
    cursor = await db.execute("SELECT changes() as cnt")
    result = await cursor.fetchone()
    if result["cnt"] == 0:
        raise HTTPException(status_code=409, detail="并发冲突：服务单已被他人修改，请刷新后重试")
    
    await add_audit_log(db, order_id, action, user["username"], user["role"],
                       order["status"], new_status, remark)
    
    await db.commit()
    return await get_order_detail(db, order_id)

async def finalize_order(db, order_id, user, approved=True, opinion=None):
    cursor = await db.execute("SELECT * FROM service_orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        raise HTTPException(status_code=404, detail="服务单不存在")
    
    if order["status"] not in ["pending_finalize", "finalizing"]:
        raise HTTPException(status_code=400, detail=f"当前状态「{ORDER_STATUSES.get(order['status'])}」不可复核")
    
    current_version = order["version"]
    
    cursor = await db.execute("SELECT version FROM service_orders WHERE id = ?", (order_id,))
    check_order = await cursor.fetchone()
    if check_order["version"] != current_version:
        raise HTTPException(status_code=409, detail="数据已被他人修改，请刷新后重试")
    
    if approved:
        cursor = await db.execute("SELECT COUNT(*) as cnt FROM feedbacks WHERE order_id = ?", (order_id,))
        fb = await cursor.fetchone()
        if fb["cnt"] == 0 and order["service_type"] in ["makeup_class", "trial_class"]:
            raise HTTPException(status_code=400, detail="课后反馈缺失，复核归档前需提交课后反馈")
        
        new_status = "completed"
        new_handler = None
        action = "finalize_pass"
        remark = opinion or "复核通过并归档"
    else:
        new_status = "rejected"
        new_handler = None
        action = "finalize_reject"
        remark = opinion or "复核驳回"
    
    await db.execute(
        """UPDATE service_orders 
           SET status = ?, current_handler = ?, 
               finalizer_by = ?, finalize_opinion = ?, finalize_time = CURRENT_TIMESTAMP,
               version = version + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND version = ?""",
        (new_status, new_handler, user["username"], opinion or "", order_id, current_version)
    )
    
    cursor = await db.execute("SELECT changes() as cnt")
    result = await cursor.fetchone()
    if result["cnt"] == 0:
        raise HTTPException(status_code=409, detail="并发冲突：服务单已被他人修改，请刷新后重试")
    
    await add_audit_log(db, order_id, action, user["username"], user["role"],
                       order["status"], new_status, remark)
    
    await db.commit()
    return await get_order_detail(db, order_id)

async def add_feedback(db, order_id, feedback_data: FeedbackCreate, user):
    cursor = await db.execute("SELECT * FROM service_orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        raise HTTPException(status_code=404, detail="服务单不存在")
    
    if order["status"] not in ["pending_review", "pending_finalize", "reviewing", "finalizing"]:
        raise HTTPException(status_code=400, detail=f"当前状态「{ORDER_STATUSES.get(order['status'])}」不可添加反馈")
    
    await db.execute(
        """INSERT INTO feedbacks (order_id, attendance, performance, homework, teacher_comment, feedback_time, feedback_by)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)""",
        (order_id, feedback_data.attendance, feedback_data.performance, 
         feedback_data.homework, feedback_data.teacher_comment, user["username"])
    )
    
    await add_audit_log(db, order_id, "add_feedback", user["username"], user["role"],
                       order["status"], order["status"], "添加课后反馈")
    
    await db.commit()
    return await get_order_detail(db, order_id)

async def get_statistics(db, user):
    role = user["role"]
    base_query = "SELECT status, COUNT(*) as cnt FROM service_orders"
    
    if role == "registrar":
        base_query += " WHERE register_by = ?"
        params = (user["username"],)
    elif role == "reviewer":
        base_query += " WHERE status IN ('pending_review', 'reviewing', 'pending_finalize', 'completed', 'rejected', 'returned')"
        params = ()
    elif role == "finalizer":
        base_query += " WHERE status IN ('pending_finalize', 'finalizing', 'completed', 'rejected')"
        params = ()
    else:
        params = ()
    
    base_query += " GROUP BY status"
    
    cursor = await db.execute(base_query, params)
    rows = await cursor.fetchall()
    
    stats = StatisticsResponse()
    for row in rows:
        status = row["status"]
        cnt = row["cnt"]
        stats.total += cnt
        if hasattr(stats, status):
            setattr(stats, status, cnt)
    
    return stats

async def batch_review(db, order_ids, user, approved=True, opinion=None):
    results = {"success": [], "failed": []}
    for oid in order_ids:
        try:
            result = await review_order(db, oid, user, approved, opinion)
            results["success"].append(oid)
        except Exception as e:
            results["failed"].append({"id": oid, "error": str(e)})
    return results

async def batch_finalize(db, order_ids, user, approved=True, opinion=None):
    results = {"success": [], "failed": []}
    for oid in order_ids:
        try:
            result = await finalize_order(db, oid, user, approved, opinion)
            results["success"].append(oid)
        except Exception as e:
            results["failed"].append({"id": oid, "error": str(e)})
    return results
