from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from .database import SessionLocal, engine, Base
from .models import User, MeetingReservation, AuditLog, BatchRecord


USERS = [
    {"username": "registrar", "name": "张登记", "role": "registrar", "department": "行政后勤中心-预约登记组"},
    {"username": "auditor", "name": "李审核", "role": "auditor", "department": "行政后勤中心-审核组"},
    {"username": "reviewer", "name": "王复核", "role": "reviewer", "department": "行政后勤中心-复核归档组"},
]


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _seed_users(db)
        _seed_reservations(db)
        db.commit()
    finally:
        db.close()


def _seed_users(db: Session):
    existing = db.query(User).count()
    if existing > 0:
        return
    for u in USERS:
        user = User(**u)
        db.add(user)


def _seed_reservations(db: Session):
    existing = db.query(MeetingReservation).count()
    if existing > 0:
        return

    now = datetime.now()

    normal = MeetingReservation(
        reservation_no="MR-20260601-001",
        batch_no="BATCH-20260601-01",
        title="二季度部门工作例会",
        meeting_room="3楼第一会议室",
        meeting_date="2026-06-15",
        start_time="09:00",
        end_time="11:00",
        participants=25,
        organizer="陈明",
        organizer_dept="综合管理部",
        contact_phone="13800138001",
        equipment="投影仪、白板、音响系统",
        equipment_ready=True,
        attachment_names="会议议程.pdf,参会名单.xlsx",
        offline_attachment_count=2,
        status="archived",
        result="会议顺利召开，设备运行正常",
        usage_confirm=True,
        usage_confirm_time=now - timedelta(days=10),
        usage_confirm_user="张登记",
        created_by="张登记",
        created_at=now - timedelta(days=15),
        submitted_at=now - timedelta(days=14),
        audit_by="李审核",
        audit_at=now - timedelta(days=13),
        review_by="王复核",
        review_at=now - timedelta(days=12),
        archived_at=now - timedelta(days=10),
    )
    db.add(normal)
    db.flush()
    _add_audit_logs_normal(db, normal)

    pending_audit = MeetingReservation(
        reservation_no="MR-20260610-002",
        batch_no="BATCH-20260610-01",
        title="产品需求评审会",
        meeting_room="5楼多功能厅",
        meeting_date="2026-06-20",
        start_time="14:00",
        end_time="17:00",
        participants=40,
        organizer="林华",
        organizer_dept="产品研发部",
        contact_phone="13800138002",
        equipment="投影仪、视频会议终端、白板",
        equipment_ready=False,
        attachment_names="需求文档.pdf",
        offline_attachment_count=1,
        status="pending_audit",
        created_by="张登记",
        created_at=now - timedelta(days=2),
        submitted_at=now - timedelta(days=1),
    )
    db.add(pending_audit)
    db.flush()
    _add_audit_log(db, pending_audit.id, "submit", "draft", "pending_audit", "张登记", "registrar", "提交审核")

    missing_materials = MeetingReservation(
        reservation_no="MR-20260611-003",
        batch_no="BATCH-20260611-01",
        title="新员工入职培训会",
        meeting_room="2楼培训室A",
        meeting_date="2026-06-25",
        start_time="09:00",
        end_time="12:00",
        participants=50,
        organizer="赵芳",
        organizer_dept="人力资源部",
        contact_phone="13800138003",
        equipment="投影仪、音响、麦克风",
        equipment_ready=False,
        attachment_names="",
        offline_attachment_count=0,
        status="returned",
        exception_type="missing_materials",
        exception_desc="缺少培训议程、参训人员名单等必要材料",
        return_reason="缺少会议议程和参训人员名单，请补充后重新提交。线下台账第3页第2项未填写。",
        created_by="张登记",
        created_at=now - timedelta(days=3),
        submitted_at=now - timedelta(days=2),
        audit_by="李审核",
        audit_at=now - timedelta(days=1),
    )
    db.add(missing_materials)
    db.flush()
    _add_audit_log(db, missing_materials.id, "submit", "draft", "pending_audit", "张登记", "registrar", "提交审核")
    _add_audit_log(db, missing_materials.id, "return", "pending_audit", "returned", "李审核", "auditor",
                    "缺少会议议程和参训人员名单，请补充后重新提交")

    overdue = MeetingReservation(
        reservation_no="MR-20260520-004",
        batch_no="BATCH-20260520-01",
        title="月度经营分析会",
        meeting_room="1楼大会议室",
        meeting_date="2026-05-28",
        start_time="10:00",
        end_time="12:00",
        participants=30,
        organizer="周涛",
        organizer_dept="财务部",
        contact_phone="13800138004",
        equipment="投影仪、白板",
        equipment_ready=True,
        attachment_names="经营分析报告.pdf",
        offline_attachment_count=1,
        status="overdue",
        exception_type="overdue",
        exception_desc="会议已结束但未进行使用确认，超时未归档",
        created_by="张登记",
        created_at=now - timedelta(days=20),
        submitted_at=now - timedelta(days=19),
        audit_by="李审核",
        audit_at=now - timedelta(days=18),
    )
    db.add(overdue)
    db.flush()
    _add_audit_log(db, overdue.id, "submit", "draft", "pending_audit", "张登记", "registrar", "提交审核")
    _add_audit_log(db, overdue.id, "audit_pass", "pending_audit", "approved", "李审核", "auditor", "审核通过")

    returned = MeetingReservation(
        reservation_no="MR-20260605-005",
        batch_no="BATCH-20260605-01",
        title="供应商洽谈会",
        meeting_room="4楼VIP会议室",
        meeting_date="2026-06-18",
        start_time="15:00",
        end_time="17:30",
        participants=10,
        organizer="孙强",
        organizer_dept="采购部",
        contact_phone="13800138005",
        equipment="投影仪、视频会议终端",
        equipment_ready=False,
        attachment_names="供应商名单.xlsx",
        offline_attachment_count=2,
        status="returned",
        exception_type="info_error",
        exception_desc="会议时间与4楼VIP会议室已有预约冲突",
        return_reason="会议时间与4楼VIP会议室已有的董事会预约冲突，请调整时间或更换会议室后重新提交。",
        audit_remark="需与综合管理部确认会议室可用时段",
        created_by="张登记",
        created_at=now - timedelta(days=5),
        submitted_at=now - timedelta(days=4),
        audit_by="李审核",
        audit_at=now - timedelta(days=3),
    )
    db.add(returned)
    db.flush()
    _add_audit_log(db, returned.id, "submit", "draft", "pending_audit", "张登记", "registrar", "提交审核")
    _add_audit_log(db, returned.id, "return", "pending_audit", "returned", "李审核", "auditor",
                    "会议室时间冲突，请调整后重新提交")

    approved = MeetingReservation(
        reservation_no="MR-20260608-006",
        batch_no="BATCH-20260608-01",
        title="技术架构研讨会",
        meeting_room="3楼第二会议室",
        meeting_date="2026-06-22",
        start_time="09:30",
        end_time="11:30",
        participants=15,
        organizer="吴磊",
        organizer_dept="技术部",
        contact_phone="13800138006",
        equipment="投影仪、白板、服务器演示环境",
        equipment_ready=True,
        attachment_names="架构方案.pdf,技术选型报告.docx",
        offline_attachment_count=2,
        status="approved",
        result="",
        created_by="张登记",
        created_at=now - timedelta(days=4),
        submitted_at=now - timedelta(days=3),
        audit_by="李审核",
        audit_at=now - timedelta(days=2),
    )
    db.add(approved)
    db.flush()
    _add_audit_log(db, approved.id, "submit", "draft", "pending_audit", "张登记", "registrar", "提交审核")
    _add_audit_log(db, approved.id, "audit_pass", "pending_audit", "approved", "李审核", "auditor", "审核通过")

    pending_review = MeetingReservation(
        reservation_no="MR-20260603-007",
        batch_no="BATCH-20260603-01",
        title="安全生产会议",
        meeting_room="1楼多功能厅",
        meeting_date="2026-06-10",
        start_time="14:00",
        end_time="16:00",
        participants=60,
        organizer="郑建国",
        organizer_dept="安全环保部",
        contact_phone="13800138007",
        equipment="投影仪、音响系统、应急演示设备",
        equipment_ready=True,
        attachment_names="安全报告.pdf,应急预案.docx",
        offline_attachment_count=3,
        status="usage_confirmed",
        result="会议圆满召开，全员参与安全培训，现场演练效果良好",
        usage_confirm=True,
        usage_confirm_time=now - timedelta(days=2),
        usage_confirm_user="张登记",
        created_by="张登记",
        created_at=now - timedelta(days=10),
        submitted_at=now - timedelta(days=9),
        audit_by="李审核",
        audit_at=now - timedelta(days=8),
    )
    db.add(pending_review)
    db.flush()
    _add_audit_log(db, pending_review.id, "submit", "draft", "pending_audit", "张登记", "registrar", "提交审核")
    _add_audit_log(db, pending_review.id, "audit_pass", "pending_audit", "approved", "李审核", "auditor", "审核通过")
    _add_audit_log(db, pending_review.id, "usage_confirm", "approved", "usage_confirmed", "张登记", "registrar", "使用确认完成")

    draft = MeetingReservation(
        reservation_no="MR-20260612-008",
        batch_no="BATCH-20260612-01",
        title="项目启动会",
        meeting_room="2楼会议室B",
        meeting_date="2026-06-28",
        start_time="10:00",
        end_time="12:00",
        participants=20,
        organizer="黄敏",
        organizer_dept="项目管理部",
        contact_phone="13800138008",
        equipment="",
        equipment_ready=False,
        attachment_names="",
        offline_attachment_count=0,
        status="draft",
        created_by="张登记",
        created_at=now - timedelta(hours=2),
    )
    db.add(draft)

    duplicate_batch_1 = MeetingReservation(
        reservation_no="MR-20260609-009",
        batch_no="BATCH-DUP-001",
        title="重复批次测试-会议1",
        meeting_room="3楼第一会议室",
        meeting_date="2026-06-30",
        start_time="09:00",
        end_time="10:00",
        participants=10,
        organizer="测试员A",
        organizer_dept="测试部",
        contact_phone="13800138009",
        equipment="投影仪",
        equipment_ready=False,
        attachment_names="",
        offline_attachment_count=0,
        status="draft",
        created_by="张登记",
        created_at=now - timedelta(days=1),
    )
    db.add(duplicate_batch_1)

    duplicate_batch_2 = MeetingReservation(
        reservation_no="MR-20260609-010",
        batch_no="BATCH-DUP-001",
        title="重复批次测试-会议2",
        meeting_room="3楼第一会议室",
        meeting_date="2026-06-30",
        start_time="10:30",
        end_time="11:30",
        participants=10,
        organizer="测试员B",
        organizer_dept="测试部",
        contact_phone="13800138010",
        equipment="投影仪",
        equipment_ready=False,
        attachment_names="",
        offline_attachment_count=0,
        status="draft",
        created_by="张登记",
        created_at=now - timedelta(days=1),
    )
    db.add(duplicate_batch_2)

    batch1 = BatchRecord(
        batch_no="BATCH-20260601-01",
        total_count=1,
        processed_count=1,
        status="completed",
        created_by="张登记",
        created_at=now - timedelta(days=15),
    )
    batch2 = BatchRecord(
        batch_no="BATCH-20260610-01",
        total_count=1,
        processed_count=1,
        status="processing",
        created_by="张登记",
        created_at=now - timedelta(days=2),
    )
    batch3 = BatchRecord(
        batch_no="BATCH-20260611-01",
        total_count=1,
        processed_count=1,
        status="returned",
        created_by="张登记",
        created_at=now - timedelta(days=3),
    )
    batch_dup = BatchRecord(
        batch_no="BATCH-DUP-001",
        total_count=2,
        processed_count=0,
        status="processing",
        created_by="张登记",
        created_at=now - timedelta(days=1),
        remark="该批次存在线下线上状态不一致，已暂停处理",
    )
    db.add_all([batch1, batch2, batch3, batch_dup])


def _add_audit_log(db, reservation_id, action, status_from, status_to, operator, operator_role, remark=None):
    log = AuditLog(
        reservation_id=reservation_id,
        action=action,
        status_from=status_from,
        status_to=status_to,
        operator=operator,
        operator_role=operator_role,
        remark=remark,
    )
    db.add(log)


def _add_audit_logs_normal(db, reservation):
    rid = reservation.id
    logs = [
        AuditLog(reservation_id=rid, action="create", status_from=None, status_to="draft",
                 operator="张登记", operator_role="registrar", remark="创建预约单"),
        AuditLog(reservation_id=rid, action="submit", status_from="draft", status_to="pending_audit",
                 operator="张登记", operator_role="registrar", remark="提交审核"),
        AuditLog(reservation_id=rid, action="audit_pass", status_from="pending_audit", status_to="approved",
                 operator="李审核", operator_role="auditor", remark="审核通过，材料齐全"),
        AuditLog(reservation_id=rid, action="usage_confirm", status_from="approved", status_to="usage_confirmed",
                 operator="张登记", operator_role="registrar", remark="使用确认完成，设备正常"),
        AuditLog(reservation_id=rid, action="review", status_from="usage_confirmed", status_to="reviewed",
                 operator="王复核", operator_role="reviewer", remark="复核通过"),
        AuditLog(reservation_id=rid, action="archive", status_from="reviewed", status_to="archived",
                 operator="王复核", operator_role="reviewer", remark="已归档"),
    ]
    for log in logs:
        db.add(log)


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully!")
