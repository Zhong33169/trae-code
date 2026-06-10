import aiosqlite
from app.config import DB_PATH
from app.auth import hash_password

async def seed_all():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    await seed_users(db)
    await seed_students(db)
    await seed_courses(db)
    await seed_schedules(db)
    await seed_service_orders(db)
    
    await db.commit()
    await db.close()

async def seed_users(db):
    cursor = await db.execute("SELECT COUNT(*) as cnt FROM users")
    result = await cursor.fetchone()
    if result["cnt"] > 0:
        return
    
    users = [
        ("registrar1", hash_password("123456"), "registrar", "张登记"),
        ("reviewer1", hash_password("123456"), "reviewer", "李审核"),
        ("finalizer1", hash_password("123456"), "finalizer", "王复核"),
    ]
    
    for username, password_hash, role, name in users:
        await db.execute(
            "INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)",
            (username, password_hash, role, name)
        )

async def seed_students(db):
    cursor = await db.execute("SELECT COUNT(*) as cnt FROM students")
    result = await cursor.fetchone()
    if result["cnt"] > 0:
        return
    
    students = [
        ("S2024001", "小明", "男", "三年级", "第一小学", "13800138001", "大明", "13900139001", "active", "数学成绩优秀"),
        ("S2024002", "小红", "女", "四年级", "第二小学", "13800138002", "大红", "13900139002", "active", "英语基础薄弱"),
        ("S2024003", "小刚", "男", "五年级", "第三小学", "13800138003", "大刚", "13900139003", "active", "对物理感兴趣"),
        ("S2024004", "小丽", "女", "六年级", "第四小学", "13800138004", "大丽", "13900139004", "active", "语文作文需要提升"),
        ("S2024005", "小华", "男", "初二", "第一中学", "13800138005", "大华", "13900139005", "inactive", "已结业"),
    ]
    
    for student_no, name, gender, grade, school, phone, guardian_name, guardian_phone, status, remark in students:
        await db.execute(
            """INSERT INTO students 
               (student_no, name, gender, grade, school, phone, guardian_name, guardian_phone, status, remark)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (student_no, name, gender, grade, school, phone, guardian_name, guardian_phone, status, remark)
        )

async def seed_courses(db):
    cursor = await db.execute("SELECT COUNT(*) as cnt FROM courses")
    result = await cursor.fetchone()
    if result["cnt"] > 0:
        return
    
    courses = [
        ("MATH001", "小学数学提高班", "数学", "三年级", 48, "陈老师", "A101教室", "active"),
        ("ENG001", "小学英语基础班", "英语", "四年级", 36, "林老师", "A102教室", "active"),
        ("PHY001", "初中物理入门班", "物理", "初二", 60, "黄老师", "B201教室", "active"),
        ("CHI001", "语文作文专项班", "语文", "六年级", 24, "周老师", "A103教室", "active"),
        ("MATH002", "奥数竞赛班", "数学", "五年级", 72, "吴老师", "B202教室", "inactive"),
    ]
    
    for course_code, name, subject, grade, total_hours, teacher, classroom, status in courses:
        await db.execute(
            """INSERT INTO courses 
               (course_code, name, subject, grade, total_hours, teacher, classroom, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (course_code, name, subject, grade, total_hours, teacher, classroom, status)
        )

async def seed_schedules(db):
    cursor = await db.execute("SELECT COUNT(*) as cnt FROM course_schedules")
    result = await cursor.fetchone()
    if result["cnt"] > 0:
        return
    
    schedules = [
        (1, "2026-06-10", "09:00", "11:00", "陈老师", "A101教室", 30, "scheduled"),
        (1, "2026-06-12", "14:00", "16:00", "陈老师", "A101教室", 30, "scheduled"),
        (1, "2026-06-15", "09:00", "11:00", "陈老师", "A101教室", 30, "scheduled"),
        (2, "2026-06-11", "10:00", "12:00", "林老师", "A102教室", 25, "scheduled"),
        (2, "2026-06-13", "15:00", "17:00", "林老师", "A102教室", 25, "scheduled"),
        (3, "2026-06-14", "08:30", "11:30", "黄老师", "B201教室", 20, "scheduled"),
        (4, "2026-06-16", "13:00", "15:00", "周老师", "A103教室", 35, "scheduled"),
    ]
    
    for course_id, schedule_date, start_time, end_time, teacher, classroom, capacity, status in schedules:
        await db.execute(
            """INSERT INTO course_schedules 
               (course_id, schedule_date, start_time, end_time, teacher, classroom, capacity, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (course_id, schedule_date, start_time, end_time, teacher, classroom, capacity, status)
        )

async def seed_service_orders(db):
    cursor = await db.execute("SELECT COUNT(*) as cnt FROM service_orders")
    result = await cursor.fetchone()
    if result["cnt"] > 0:
        return
    
    import uuid
    from datetime import datetime
    
    orders = [
        {
            "order_no": "SO202606090001",
            "qr_code": "QRA1B2C3D4E5F6G7",
            "student_id": 1,
            "course_id": 1,
            "schedule_id": 1,
            "service_type": "makeup_class",
            "status": "draft",
            "current_handler": "registrar1",
            "register_by": "registrar1",
            "time_limit_hours": 24,
            "version": 2,
            "register_opinion": "学生因病请假，申请补下周同一时段课程",
            "materials": [
                ("application", "补课申请单", None, "registrar1"),
                ("certificate", "医院诊断证明", None, "registrar1"),
            ],
            "audit_logs": [
                ("create", "registrar1", "registrar", None, "draft", "创建补课服务单（v0）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：补课申请单（v0→v1）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：医院诊断证明（v1→v2）"),
            ]
        },
        {
            "order_no": "SO202606090002",
            "qr_code": "QRB2C3D4E5F6G7H8",
            "student_id": 2,
            "course_id": 2,
            "schedule_id": 4,
            "service_type": "trial_class",
            "status": "pending_review",
            "current_handler": None,
            "register_by": "registrar1",
            "register_time": "2026-06-08 10:00:00",
            "register_opinion": "新生预约试听英语基础班，家长已确认时间",
            "material_complete": 1,
            "time_limit_hours": 48,
            "version": 4,
            "materials": [
                ("application", "试听申请单", None, "registrar1"),
                ("document", "学员信息表", None, "registrar1"),
                ("schedule", "课程安排", None, "registrar1"),
                ("certificate", "家长知情同意书", None, "registrar1"),
            ],
            "audit_logs": [
                ("create", "registrar1", "registrar", None, "draft", "创建试听服务单（v0）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：试听申请单（v0→v1）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：学员信息表（v1→v2）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：课程安排（v2→v3）"),
                ("submit", "registrar1", "registrar", "draft", "pending_review", "材料齐全，提交审核。时限48小时（v3→v4）"),
            ]
        },
        {
            "order_no": "SO202606090003",
            "qr_code": "QRC3D4E5F6G7H8I9",
            "student_id": 3,
            "course_id": 3,
            "schedule_id": 6,
            "service_type": "drop_class",
            "status": "pending_finalize",
            "current_handler": None,
            "register_by": "registrar1",
            "reviewer_by": "reviewer1",
            "register_time": "2026-06-07 09:00:00",
            "review_time": "2026-06-08 14:00:00",
            "register_opinion": "家长因学生升学压力大，申请退还剩余课程费用",
            "review_opinion": "情况属实，按协议扣除已上课时费后退还。审核时限24小时，实际耗时5小时",
            "material_complete": 1,
            "time_limit_hours": 24,
            "version": 6,
            "materials": [
                ("application", "退课申请单", None, "registrar1"),
                ("certificate", "缴费凭证", None, "registrar1"),
                ("document", "学员档案", None, "registrar1"),
                ("certificate", "家长身份证复印件", None, "registrar1"),
            ],
            "audit_logs": [
                ("create", "registrar1", "registrar", None, "draft", "创建退课服务单（v0）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：退课申请单（v0→v1）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：缴费凭证（v1→v2）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：学员档案（v2→v3）"),
                ("submit", "registrar1", "registrar", "draft", "pending_review", "提交审核（v3→v4）"),
                ("review_pass", "reviewer1", "reviewer", "pending_review", "pending_finalize", "审核通过，同意退课（v4→v5）"),
                ("add_material", "reviewer1", "reviewer", "pending_finalize", "pending_finalize", "补充材料：家长身份证复印件（v5→v6）"),
            ]
        },
        {
            "order_no": "SO202606090004",
            "qr_code": "QRD4E5F6G7H8I9J0",
            "student_id": 4,
            "course_id": 4,
            "schedule_id": 7,
            "service_type": "transfer_class",
            "status": "completed",
            "current_handler": None,
            "register_by": "registrar1",
            "reviewer_by": "reviewer1",
            "finalizer_by": "finalizer1",
            "register_time": "2026-06-05 08:00:00",
            "review_time": "2026-06-06 10:00:00",
            "finalize_time": "2026-06-07 16:00:00",
            "register_opinion": "学生程度较好，申请从基础班转入提高班",
            "review_opinion": "经测评确认学生水平达标，同意转班",
            "finalize_opinion": "复核通过，已通知学员下周起进入新班上课",
            "material_complete": 1,
            "time_limit_hours": 72,
            "version": 8,
            "materials": [
                ("application", "转课申请单", None, "registrar1"),
                ("certificate", "原课程证明", None, "registrar1"),
                ("schedule", "新课程排班", None, "registrar1"),
                ("certificate", "水平测试成绩单", None, "reviewer1"),
            ],
            "feedback": {
                "attendance": "attended",
                "performance": "good",
                "homework": "completed",
                "teacher_comment": "学生表现良好，适应新环境，能跟上课程进度",
                "feedback_by": "reviewer1",
            },
            "audit_logs": [
                ("create", "registrar1", "registrar", None, "draft", "创建转班服务单（v0）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：转课申请单（v0→v1）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：原课程证明（v1→v2）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：新课程排班（v2→v3）"),
                ("submit", "registrar1", "registrar", "draft", "pending_review", "提交审核（v3→v4）"),
                ("review_pass", "reviewer1", "reviewer", "pending_review", "pending_finalize", "审核通过，附水平测试成绩单（v4→v5）"),
                ("add_material", "reviewer1", "reviewer", "pending_finalize", "pending_finalize", "补充材料：水平测试成绩单（v5→v6）"),
                ("finalize_pass", "finalizer1", "finalizer", "pending_finalize", "completed", "复核通过，服务单完成（v6→v7）"),
                ("add_feedback", "reviewer1", "reviewer", "completed", "completed", "录入课后反馈，学生表现良好（v7→v8）"),
            ]
        },
        {
            "order_no": "SO202606090005",
            "qr_code": "QRE5F6G7H8I9J0K1",
            "student_id": 1,
            "course_id": 1,
            "schedule_id": 2,
            "service_type": "makeup_class",
            "status": "returned",
            "current_handler": "registrar1",
            "register_by": "registrar1",
            "reviewer_by": "reviewer1",
            "register_time": "2026-06-08 11:00:00",
            "review_time": "2026-06-08 15:00:00",
            "register_opinion": "学生请假申请补课，已初步核实",
            "review_opinion": "材料不全，缺少原课程考勤记录。请补充后重新提交",
            "material_complete": 0,
            "time_limit_hours": 24,
            "version": 3,
            "materials": [
                ("application", "补课申请单", None, "registrar1"),
            ],
            "audit_logs": [
                ("create", "registrar1", "registrar", None, "draft", "创建补课服务单（v0）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：补课申请单（v0→v1）"),
                ("submit", "registrar1", "registrar", "draft", "pending_review", "提交审核（v1→v2）"),
                ("review_reject", "reviewer1", "reviewer", "pending_review", "returned", "审核退回：材料不全，缺少考勤记录（v2→v3）"),
            ]
        },
        {
            "order_no": "SO202606090006",
            "qr_code": "QRF6G7H8I9J0K1L2",
            "student_id": 2,
            "course_id": 1,
            "schedule_id": 3,
            "service_type": "makeup_class",
            "status": "draft",
            "current_handler": "registrar1",
            "register_by": "registrar1",
            "time_limit_hours": 24,
            "version": 4,
            "register_opinion": "并发冲突演示单：登记员与审核主管同时操作",
            "materials": [
                ("application", "补课申请单", None, "registrar1"),
                ("certificate", "请假证明", None, "registrar1"),
                ("document", "原课程考勤记录", None, "registrar1"),
            ],
            "audit_logs": [
                ("create", "registrar1", "registrar", None, "draft", "创建服务单（v0）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：补课申请单（v0→v1）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：请假证明（v1→v2）"),
                ("add_material", "registrar1", "registrar", "draft", "draft", "添加材料：原课程考勤记录（v2→v3）"),
                ("version_conflict_note", "system", "system", "draft", "draft", "【演示】并发冲突场景：两用户同时基于 v2 提交，后提交者返回 409，材料未写入，版本未变更（v3→v4 为正常操作递增）"),
                ("submit_attempt", "registrar1", "registrar", "draft", "draft", "【演示】尝试基于 v2 提交审核，检测到版本冲突（当前 v3），返回 409，请刷新后重试"),
            ]
        },
    ]
    
    for order_data in orders:
        materials = order_data.pop("materials", [])
        feedback = order_data.pop("feedback", None)
        audit_logs = order_data.pop("audit_logs", [])
        
        columns = list(order_data.keys())
        placeholders = ", ".join(["?"] * len(columns))
        values = [order_data[k] for k in columns]
        
        cursor = await db.execute(
            f"""INSERT INTO service_orders ({', '.join(columns)}) VALUES ({placeholders})""",
            values
        )
        order_id = cursor.lastrowid
        
        for mat_type, mat_name, file_url, uploaded_by in materials:
            await db.execute(
                """INSERT INTO service_materials (order_id, material_type, material_name, file_url, uploaded_by)
                   VALUES (?, ?, ?, ?, ?)""",
                (order_id, mat_type, mat_name, file_url, uploaded_by)
            )
        
        if feedback:
            await db.execute(
                """INSERT INTO feedbacks (order_id, attendance, performance, homework, teacher_comment, feedback_time, feedback_by)
                   VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)""",
                (order_id, feedback["attendance"], feedback["performance"], 
                 feedback["homework"], feedback["teacher_comment"], feedback["feedback_by"])
            )
        
        for action, operator, operator_role, from_status, to_status, remark in audit_logs:
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (order_id, action, operator, operator_role, from_status, to_status, remark)
            )
