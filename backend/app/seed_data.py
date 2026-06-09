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
            "version": 0,
            "materials": [
                ("document", "补课申请单", None, "registrar1"),
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
            "register_opinion": "材料齐全，申请试听",
            "material_complete": 1,
            "version": 1,
            "materials": [
                ("document", "试听申请单", None, "registrar1"),
                ("document", "学员信息表", None, "registrar1"),
                ("document", "课程安排", None, "registrar1"),
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
            "register_opinion": "家长申请退课",
            "review_opinion": "情况属实，同意退课",
            "material_complete": 1,
            "version": 2,
            "materials": [
                ("document", "退课申请单", None, "registrar1"),
                ("document", "缴费凭证", None, "registrar1"),
                ("document", "学员档案", None, "registrar1"),
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
            "register_opinion": "申请转班",
            "review_opinion": "同意转班",
            "finalize_opinion": "复核通过",
            "material_complete": 1,
            "version": 3,
            "materials": [
                ("document", "转课申请单", None, "registrar1"),
                ("document", "原课程证明", None, "registrar1"),
                ("document", "新课程排班", None, "registrar1"),
            ],
            "feedback": {
                "attendance": "attended",
                "performance": "good",
                "homework": "completed",
                "teacher_comment": "学生表现良好，适应新环境",
                "feedback_by": "reviewer1",
            }
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
            "register_opinion": "申请补课",
            "review_opinion": "材料不全，缺少原课程考勤记录",
            "material_complete": 0,
            "version": 2,
            "materials": [
                ("document", "补课申请单", None, "registrar1"),
            ]
        },
    ]
    
    for order_data in orders:
        materials = order_data.pop("materials", [])
        feedback = order_data.pop("feedback", None)
        
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
        
        if order_data["status"] == "completed":
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, 'create', ?, 'registrar', NULL, 'draft', '创建服务单')""",
                (order_id, order_data["register_by"])
            )
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, 'submit', ?, 'registrar', 'draft', 'pending_review', ?)""",
                (order_id, order_data["register_by"], order_data.get("register_opinion", ""))
            )
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, 'review_pass', ?, 'reviewer', 'pending_review', 'pending_finalize', ?)""",
                (order_id, order_data["reviewer_by"], order_data.get("review_opinion", ""))
            )
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, 'finalize_pass', ?, 'finalizer', 'pending_finalize', 'completed', ?)""",
                (order_id, order_data["finalizer_by"], order_data.get("finalize_opinion", ""))
            )
        elif order_data["status"] == "pending_finalize":
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, 'create', ?, 'registrar', NULL, 'draft', '创建服务单')""",
                (order_id, order_data["register_by"])
            )
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, 'submit', ?, 'registrar', 'draft', 'pending_review', ?)""",
                (order_id, order_data["register_by"], order_data.get("register_opinion", ""))
            )
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, 'review_pass', ?, 'reviewer', 'pending_review', 'pending_finalize', ?)""",
                (order_id, order_data["reviewer_by"], order_data.get("review_opinion", ""))
            )
        elif order_data["status"] == "pending_review":
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, 'create', ?, 'registrar', NULL, 'draft', '创建服务单')""",
                (order_id, order_data["register_by"])
            )
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, 'submit', ?, 'registrar', 'draft', 'pending_review', ?)""",
                (order_id, order_data["register_by"], order_data.get("register_opinion", ""))
            )
        elif order_data["status"] == "returned":
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, 'create', ?, 'registrar', NULL, 'draft', '创建服务单')""",
                (order_id, order_data["register_by"])
            )
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, 'submit', ?, 'registrar', 'draft', 'pending_review', ?)""",
                (order_id, order_data["register_by"], order_data.get("register_opinion", ""))
            )
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, 'review_reject', ?, 'reviewer', 'pending_review', 'returned', ?)""",
                (order_id, order_data["reviewer_by"], order_data.get("review_opinion", ""))
            )
        else:
            await db.execute(
                """INSERT INTO audit_logs (order_id, action, operator, operator_role, from_status, to_status, remark)
                   VALUES (?, 'create', ?, 'registrar', NULL, 'draft', '创建服务单')""",
                (order_id, order_data["register_by"])
            )
