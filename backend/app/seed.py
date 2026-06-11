from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from .database import SessionLocal, engine, Base
from .models import User, MeetingReservation, AuditLog, BatchRecord, BlockLog


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
        offline_count=1,
        offline_status="archived",
        offline_attachment_list=["会议议程.pdf", "参会名单.xlsx"],
        offline_checked=True,
        offline_checked_at=now - timedelta(days=11),
        offline_checked_by="张登记",
        offline_check_diff={"is_consistent": True, "diff_count": 0, "diffs": []},
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
        offline_count=1,
        offline_status="pending_audit",
        offline_attachment_list=["需求文档.pdf"],
        offline_checked=True,
        offline_checked_at=now - timedelta(days=1),
        offline_checked_by="张登记",
        offline_check_diff={"is_consistent": True, "diff_count": 0, "diffs": []},
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
        offline_attachment_count=2,
        offline_count=1,
        offline_status="returned",
        offline_attachment_list=["培训议程.pdf", "参训名单.xlsx"],
        offline_checked=True,
        offline_checked_at=now - timedelta(days=1),
        offline_checked_by="李审核",
        offline_check_diff={
            "is_consistent": False, "diff_count": 1,
            "diffs": [{"field": "附件", "message": "附件数量不一致", "online_value": 0, "offline_value": 2}]
        },
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
    _add_block_log(
        db, missing_materials.id, "BATCH-20260611-01", "missing_fields",
        "缺少会议议程和参训人员名单等必要材料，请补正后重新提交",
        {"diffs": [{"field": "附件", "message": "线上附件0份，线下台账登记2份", "online_value": 0, "offline_value": 2}]},
        "李审核", "auditor",
        [{"reservation_no": "MR-20260611-003", "is_consistent": False,
          "attachment_diffs": [{"field": "附件", "message": "数量不一致", "online_value": 0, "offline_value": 2}],
          "status_diffs": []}]
    )

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
        offline_count=1,
        offline_status="archived",
        offline_attachment_list=["经营分析报告.pdf", "财务数据报表.xlsx"],
        offline_checked=True,
        offline_checked_at=now - timedelta(days=5),
        offline_checked_by="张登记",
        offline_check_diff={
            "is_consistent": False, "diff_count": 1,
            "diffs": [{"field": "附件", "message": "线下多出财务报表", "online_value": 1, "offline_value": 2}]
        },
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
        offline_count=1,
        offline_status="approved",
        offline_attachment_list=["供应商名单.xlsx", "报价单.pdf"],
        offline_checked=True,
        offline_checked_at=now - timedelta(days=3),
        offline_checked_by="李审核",
        offline_check_diff={
            "is_consistent": False, "diff_count": 2,
            "diffs": [
                {"field": "状态", "message": "线下台账登记审核通过，实际系统被退回", "online_value": "returned", "offline_value": "approved"},
                {"field": "附件", "message": "线下多出报价单", "online_value": 1, "offline_value": 2}
            ]
        },
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
    _add_block_log(
        db, returned.id, "BATCH-20260605-01", "status_mismatch",
        "会议室预约时间冲突，线下登记已审核通过，但系统实际已退回。请核对台账后重新录入。",
        {"diffs": [
            {"field": "状态", "message": "线上为退回，线下为审核通过", "online_value": "returned", "offline_value": "approved"}
        ]},
        "李审核", "auditor",
        [{"reservation_no": "MR-20260605-005", "is_consistent": False,
          "status_diffs": [{"field": "状态", "message": "不一致", "online_value": "returned", "offline_value": "approved"}],
          "attachment_diffs": [{"field": "附件", "message": "数量不一致", "online_value": 1, "offline_value": 2}]}]
    )

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
        offline_count=1,
        offline_status="approved",
        offline_attachment_list=["架构方案.pdf", "技术选型报告.docx"],
        offline_checked=True,
        offline_checked_at=now - timedelta(days=2),
        offline_checked_by="张登记",
        offline_check_diff={"is_consistent": True, "diff_count": 0, "diffs": []},
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
        offline_count=1,
        offline_status="usage_confirmed",
        offline_attachment_list=["安全报告.pdf", "应急预案.docx", "签到表.pdf"],
        offline_checked=True,
        offline_checked_at=now - timedelta(days=2),
        offline_checked_by="张登记",
        offline_check_diff={"is_consistent": True, "diff_count": 0, "diffs": []},
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
        offline_count=0,
        offline_status=None,
        offline_attachment_list=[],
        offline_checked=False,
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
        offline_count=1,
        offline_status="approved",
        offline_attachment_list=[],
        offline_checked=True,
        offline_checked_at=now - timedelta(days=1),
        offline_checked_by="张登记",
        offline_check_diff={
            "is_consistent": False, "diff_count": 1,
            "diffs": [{"field": "状态", "message": "批次内状态不一致", "online_value": "draft", "offline_value": "approved"}]
        },
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
        offline_count=1,
        offline_status="archived",
        offline_attachment_list=[],
        offline_checked=True,
        offline_checked_at=now - timedelta(days=1),
        offline_checked_by="张登记",
        offline_check_diff={
            "is_consistent": False, "diff_count": 1,
            "diffs": [{"field": "状态", "message": "批次内状态不一致", "online_value": "draft", "offline_value": "archived"}]
        },
        status="draft",
        created_by="张登记",
        created_at=now - timedelta(days=1),
    )
    db.add(duplicate_batch_2)
    db.flush()

    _add_block_log(
        db, duplicate_batch_1.id, "BATCH-DUP-001", "duplicate_batch",
        "批次号 BATCH-DUP-001 内存在状态不一致的预约单（MR-20260609-009 线下状态审核通过，MR-20260609-010 线下状态已归档）。请核对确认后或勾选强制提交继续。",
        {"diffs": [
            {"field": "批次号", "message": "重复批次号 BATCH-DUP-001", "online_value": 2, "offline_value": 2},
            {"field": "数量", "message": "线上2单 vs 线下2单，数量一致", "online_value": 2, "offline_value": 2},
            {"field": "状态", "message": "批次内状态不一致：线下登记审核通过/已归档，线上均为草稿",
             "online_value": ["draft", "draft"], "offline_value": ["approved", "archived"]}
        ]},
        "张登记", "registrar",
        [
            {"reservation_no": "MR-20260609-009", "is_consistent": False,
             "status_diffs": [{"field": "状态", "message": "不一致", "online_value": "draft", "offline_value": "approved"}],
             "attachment_diffs": []},
            {"reservation_no": "MR-20260609-010", "is_consistent": False,
             "status_diffs": [{"field": "状态", "message": "不一致", "online_value": "draft", "offline_value": "archived"}],
             "attachment_diffs": []}
        ]
    )

    batch1 = BatchRecord(
        batch_no="BATCH-20260601-01",
        total_count=1,
        processed_count=1,
        offline_count=1,
        check_status="checked",
        status="completed",
        created_by="张登记",
        created_at=now - timedelta(days=15),
        checked_at=now - timedelta(days=11),
        checked_by="张登记",
        check_diff={"is_consistent": True, "diff_count": 0, "diffs": []},
    )
    batch2 = BatchRecord(
        batch_no="BATCH-20260610-01",
        total_count=1,
        processed_count=1,
        offline_count=1,
        check_status="checked",
        status="processing",
        created_by="张登记",
        created_at=now - timedelta(days=2),
        checked_at=now - timedelta(days=1),
        checked_by="张登记",
        check_diff={"is_consistent": True, "diff_count": 0, "diffs": []},
    )
    batch3 = BatchRecord(
        batch_no="BATCH-20260611-01",
        total_count=1,
        processed_count=1,
        offline_count=1,
        check_status="has_diff",
        status="returned",
        created_by="张登记",
        created_at=now - timedelta(days=3),
        checked_at=now - timedelta(days=1),
        checked_by="李审核",
        check_diff={
            "is_consistent": False, "diff_count": 1,
            "diffs": [{"field": "附件", "message": "附件数量不一致", "online_value": 0, "offline_value": 2}]
        },
    )
    batch_dup = BatchRecord(
        batch_no="BATCH-DUP-001",
        total_count=2,
        processed_count=0,
        offline_count=2,
        check_status="blocked",
        status="processing",
        created_by="张登记",
        created_at=now - timedelta(days=1),
        checked_at=now - timedelta(days=1),
        checked_by="张登记",
        remark="该批次存在线下线上状态不一致，已暂停处理",
        check_diff={
            "is_consistent": False, "diff_count": 1,
            "diffs": [{"field": "状态", "message": "批次内状态不一致",
                        "online_value": ["draft", "draft"], "offline_value": ["approved", "archived"]}]
        },
    )
    batch5 = BatchRecord(
        batch_no="BATCH-20260605-01",
        total_count=1,
        processed_count=1,
        offline_count=1,
        check_status="has_diff",
        status="returned",
        created_by="张登记",
        created_at=now - timedelta(days=5),
        checked_at=now - timedelta(days=3),
        checked_by="李审核",
        check_diff={
            "is_consistent": False, "diff_count": 2,
            "diffs": [
                {"field": "状态", "message": "线上为退回，线下为审核通过", "online_value": "returned", "offline_value": "approved"},
                {"field": "附件", "message": "线下多出报价单", "online_value": 1, "offline_value": 2}
            ]
        },
    )
    batch6 = BatchRecord(
        batch_no="BATCH-20260603-01",
        total_count=1,
        processed_count=1,
        offline_count=1,
        check_status="checked",
        status="processing",
        created_by="张登记",
        created_at=now - timedelta(days=10),
        checked_at=now - timedelta(days=2),
        checked_by="张登记",
        check_diff={"is_consistent": True, "diff_count": 0, "diffs": []},
    )
    db.add_all([batch1, batch2, batch3, batch_dup, batch5, batch6])


def _add_audit_log(db, reservation_id, action, status_from, status_to, operator, operator_role, remark=None, batch_no=None, item_results=None):
    log = AuditLog(
        reservation_id=reservation_id,
        action=action,
        status_from=status_from,
        status_to=status_to,
        operator=operator,
        operator_role=operator_role,
        remark=remark,
        batch_no=batch_no,
        item_results=item_results,
    )
    db.add(log)


def _add_block_log(db, reservation_id, batch_no, block_type, reason, detail, operator, operator_role, item_results=None):
    log = BlockLog(
        reservation_id=reservation_id,
        batch_no=batch_no,
        block_type=block_type,
        reason=reason,
        detail=detail,
        operator=operator,
        operator_role=operator_role,
        item_results=item_results,
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
