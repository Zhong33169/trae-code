import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import Base, engine, SessionLocal
from models import (
    Role, User, RepairTicket, Attachment, WorkOrderLog, AuditLog,
    RoleEnum, TicketStatusEnum, AttachmentTypeEnum
)
from security import hash_password


def init_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("数据库表已创建")

    db = SessionLocal()
    try:
        _seed_roles(db)
        users = _seed_users(db)
        _seed_tickets(db, users)
        db.commit()
        print("种子数据已插入完成")
    except Exception as e:
        db.rollback()
        print(f"种子数据插入失败: {e}")
        raise
    finally:
        db.close()


def _seed_roles(db):
    roles = [
        Role(id=1, name="报修登记员", code=RoleEnum.REGISTRAR.value,
             description="负责业主报修登记和附件缺失补正发起"),
        Role(id=2, name="报修审核主管", code=RoleEnum.SUPERVISOR.value,
             description="负责审核报修工单、办理派单和退回"),
        Role(id=3, name="物业服务中心复核负责人", code=RoleEnum.REVIEWER.value,
             description="负责完工复核、回访评估和归档"),
    ]
    db.add_all(roles)
    db.flush()
    print("角色数据已初始化")


def _seed_users(db):
    users = [
        User(
            id=1, username="registrar01",
            password_hash=hash_password("123456"),
            full_name="李登记", phone="13800000001",
            role_id=1
        ),
        User(
            id=2, username="supervisor01",
            password_hash=hash_password("123456"),
            full_name="王主管", phone="13800000002",
            role_id=2
        ),
        User(
            id=3, username="reviewer01",
            password_hash=hash_password("123456"),
            full_name="张复核", phone="13800000003",
            role_id=3
        ),
    ]
    db.add_all(users)
    db.flush()
    print("用户数据已初始化")
    return {
        "registrar": users[0],
        "supervisor": users[1],
        "reviewer": users[2],
    }


def _seed_tickets(db, users):
    now = datetime.utcnow()
    registrar = users["registrar"]
    supervisor = users["supervisor"]
    reviewer = users["reviewer"]

    tickets_data = [
        _create_normal_ticket(db, registrar, supervisor, reviewer, now),
        _create_missing_attachments_ticket(db, registrar, supervisor, now),
        _create_overdue_ticket(db, registrar, supervisor, now),
        _create_rejected_ticket(db, registrar, supervisor, now),
        _create_completed_ticket(db, registrar, supervisor, reviewer, now),
    ]

    for ticket in tickets_data:
        db.add(ticket)
    db.flush()
    print(f"工单数据已初始化: {len(tickets_data)} 条")


def _generate_ticket_no(seq):
    return f"RP{datetime.utcnow().strftime('%Y%m%d')}{seq:04d}"


def _create_normal_ticket(db, registrar, supervisor, reviewer, now):
    ticket = RepairTicket(
        ticket_no=_generate_ticket_no(1),
        title="A栋302厨房水管漏水",
        owner_name="陈业主", owner_phone="13911112222",
        address="阳光花园A栋3单元302",
        repair_type="水电维修", priority="high",
        description="厨房主水管接口处漏水严重，已影响楼下住户，需紧急处理。",
        status=TicketStatusEnum.PENDING_REVIEW,
        deadline_at=now + timedelta(hours=4),
        created_by_id=registrar.id,
        created_at=now - timedelta(hours=1),
    )
    db.flush()

    ticket.attachments.extend([
        Attachment(
            ticket_id=ticket.id,
            file_name="漏水现场照片1.jpg",
            file_path="/uploads/leak_1.jpg",
            file_size=1024000, mime_type="image/jpeg",
            attachment_type=AttachmentTypeEnum.REQUIRED,
            is_required=True, uploaded_by_id=registrar.id,
            uploaded_at=now - timedelta(hours=1),
        ),
        Attachment(
            ticket_id=ticket.id,
            file_name="漏水现场照片2.jpg",
            file_path="/uploads/leak_2.jpg",
            file_size=950000, mime_type="image/jpeg",
            attachment_type=AttachmentTypeEnum.REQUIRED,
            is_required=True, uploaded_by_id=registrar.id,
            uploaded_at=now - timedelta(hours=1),
        ),
    ])

    ticket.work_logs.append(WorkOrderLog(
        ticket_id=ticket.id,
        from_status=None, to_status="pending_review",
        action="提交审核",
        remark="业主上门报修，已登记并上传现场照片",
        operator_id=registrar.id, operator_name=registrar.full_name,
        created_at=now - timedelta(hours=1),
    ))

    ticket.audit_logs.append(AuditLog(
        ticket_id=ticket.id,
        user_id=registrar.id, user_name=registrar.full_name,
        action="创建工单并提交", module="报修登记",
        detail="业主陈先生厨房漏水报修，已上传2张现场照片",
        is_success=True,
        created_at=now - timedelta(hours=1),
    ))

    return ticket


def _create_missing_attachments_ticket(db, registrar, supervisor, now):
    ticket = RepairTicket(
        ticket_no=_generate_ticket_no(2),
        title="B栋501客厅空调不制冷",
        owner_name="刘业主", owner_phone="13933334444",
        address="阳光花园B栋2单元501",
        repair_type="家电维修", priority="normal",
        description="客厅中央空调制冷效果差，室温28度以上，怀疑缺氟。",
        status=TicketStatusEnum.REVISION_REQUIRED,
        deadline_at=now + timedelta(hours=8),
        created_by_id=registrar.id,
        handled_by_id=supervisor.id,
        reject_reason="缺少空调铭牌照片和购机发票扫描件，无法判断是否在保修期内，请补正后重新提交。",
        created_at=now - timedelta(hours=2),
    )
    db.flush()

    ticket.attachments.extend([
        Attachment(
            ticket_id=ticket.id,
            file_name="空调外观照片.jpg",
            file_path="/uploads/ac_1.jpg",
            file_size=870000, mime_type="image/jpeg",
            attachment_type=AttachmentTypeEnum.REQUIRED,
            is_required=True, uploaded_by_id=registrar.id,
            uploaded_at=now - timedelta(hours=2),
        ),
        Attachment(
            ticket_id=ticket.id,
            file_name="空调铭牌.jpg",
            file_path="/uploads/ac_rejected.jpg",
            file_size=520000, mime_type="image/jpeg",
            attachment_type=AttachmentTypeEnum.REJECTED,
            is_required=True, is_rejected=True,
            reject_reason="照片模糊不清，铭牌型号参数无法辨识，请重新拍摄清晰照片",
            uploaded_by_id=registrar.id,
            uploaded_at=now - timedelta(hours=2),
            review_note="被王主管驳回: 2024-01-15 14:30",
        ),
    ])

    ticket.work_logs.extend([
        WorkOrderLog(
            ticket_id=ticket.id,
            from_status=None, to_status="pending_review",
            action="提交审核",
            remark="业主电话报修空调不制冷，已登记",
            operator_id=registrar.id, operator_name=registrar.full_name,
            created_at=now - timedelta(hours=2),
        ),
        WorkOrderLog(
            ticket_id=ticket.id,
            from_status="pending_review", to_status="revision_required",
            action="退回补正",
            remark=ticket.reject_reason,
            operator_id=supervisor.id, operator_name=supervisor.full_name,
            created_at=now - timedelta(minutes=30),
        ),
    ])

    ticket.audit_logs.extend([
        AuditLog(
            ticket_id=ticket.id,
            user_id=registrar.id, user_name=registrar.full_name,
            action="创建工单", module="报修登记",
            detail="业主刘先生空调故障报修",
            is_success=True,
            created_at=now - timedelta(hours=2),
        ),
        AuditLog(
            ticket_id=ticket.id,
            user_id=supervisor.id, user_name=supervisor.full_name,
            action="退回工单", module="工单审核",
            detail="材料缺失，附件铭牌照片被驳回",
            failure_reason="缺少空调铭牌清晰照片和购机发票扫描件",
            is_success=False,
            created_at=now - timedelta(minutes=30),
        ),
    ])

    return ticket


def _create_overdue_ticket(db, registrar, supervisor, now):
    ticket = RepairTicket(
        ticket_no=_generate_ticket_no(3),
        title="C栋102电梯故障停运",
        owner_name="赵业主", owner_phone="13955556666",
        address="阳光花园C栋1单元102",
        repair_type="公共设施", priority="urgent",
        description="C栋电梯按钮面板失效，无法正常呼叫，多位业主出行受阻。",
        status=TicketStatusEnum.IN_PROGRESS,
        is_overdue=True,
        deadline_at=now - timedelta(hours=1),
        created_by_id=registrar.id,
        handled_by_id=supervisor.id,
        assigned_at=now - timedelta(hours=5),
        created_at=now - timedelta(hours=6),
    )
    db.flush()

    ticket.attachments.extend([
        Attachment(
            ticket_id=ticket.id,
            file_name="电梯按钮损坏照片.jpg",
            file_path="/uploads/elevator_1.jpg",
            file_size=760000, mime_type="image/jpeg",
            attachment_type=AttachmentTypeEnum.REQUIRED,
            is_required=True, uploaded_by_id=registrar.id,
            uploaded_at=now - timedelta(hours=6),
        ),
        Attachment(
            ticket_id=ticket.id,
            file_name="电梯维修补充照片.jpg",
            file_path="/uploads/elevator_supp.jpg",
            file_size=680000, mime_type="image/jpeg",
            attachment_type=AttachmentTypeEnum.SUPPLEMENTARY,
            is_supplementary=True, uploaded_by_id=supervisor.id,
            uploaded_at=now - timedelta(hours=3),
            review_note="维修人员现场补充上传的内部电路板损坏图",
        ),
    ])

    ticket.work_logs.extend([
        WorkOrderLog(
            ticket_id=ticket.id,
            from_status=None, to_status="pending_review",
            action="提交审核", remark="物业巡逻发现电梯故障并登记",
            operator_id=registrar.id, operator_name=registrar.full_name,
            created_at=now - timedelta(hours=6),
        ),
        WorkOrderLog(
            ticket_id=ticket.id,
            from_status="pending_review", to_status="assigned",
            action="派单处理",
            remark="已联系电梯维保公司，预计2小时内到场",
            operator_id=supervisor.id, operator_name=supervisor.full_name,
            created_at=now - timedelta(hours=5),
        ),
        WorkOrderLog(
            ticket_id=ticket.id,
            from_status="assigned", to_status="in_progress",
            action="开始维修", remark="维保人员已到场，正在排查故障",
            operator_id=supervisor.id, operator_name=supervisor.full_name,
            created_at=now - timedelta(hours=3),
        ),
    ])

    ticket.audit_logs.extend([
        AuditLog(
            ticket_id=ticket.id,
            user_id=registrar.id, user_name=registrar.full_name,
            action="登记电梯故障", module="报修登记",
            detail="C栋电梯按钮损坏，紧急工单",
            is_success=True,
            created_at=now - timedelta(hours=6),
        ),
        AuditLog(
            ticket_id=ticket.id,
            user_id=supervisor.id, user_name=supervisor.full_name,
            action="超时预警", module="工单处理",
            detail="维修时限已过，仍未完成",
            failure_reason="维保单位零件不足，需等待调货，预计延迟2小时",
            is_success=False,
            created_at=now - timedelta(minutes=10),
        ),
    ])

    return ticket


def _create_rejected_ticket(db, registrar, supervisor, now):
    ticket = RepairTicket(
        ticket_no=_generate_ticket_no(4),
        title="D栋203阳台瓷砖脱落申请维修",
        owner_name="孙业主", owner_phone="13977778888",
        address="阳光花园D栋3单元203",
        repair_type="土建维修", priority="normal",
        description="阳台外墙瓷砖脱落一块，担心高空坠物伤人。",
        status=TicketStatusEnum.REJECTED,
        deadline_at=now + timedelta(days=1),
        created_by_id=registrar.id,
        handled_by_id=supervisor.id,
        reject_reason="经核实，阳台瓷砖为人为改造装修时造成的损坏，不属于物业公共维修范围，请业主联系原装修单位处理。",
        created_at=now - timedelta(hours=4),
    )
    db.flush()

    ticket.attachments.extend([
        Attachment(
            ticket_id=ticket.id,
            file_name="阳台瓷砖脱落照片.jpg",
            file_path="/uploads/tile_1.jpg",
            file_size=920000, mime_type="image/jpeg",
            attachment_type=AttachmentTypeEnum.REQUIRED,
            is_required=True, uploaded_by_id=registrar.id,
            uploaded_at=now - timedelta(hours=4),
        ),
        Attachment(
            ticket_id=ticket.id,
            file_name="业主装修合同.jpg",
            file_path="/uploads/contract_rejected.jpg",
            file_size=2100000, mime_type="image/jpeg",
            attachment_type=AttachmentTypeEnum.REJECTED,
            is_required=True, is_rejected=True,
            reject_reason="合同明确阳台为业主自行改造范围，物业不承担维修责任",
            uploaded_by_id=registrar.id,
            uploaded_at=now - timedelta(hours=4),
        ),
    ])

    ticket.work_logs.extend([
        WorkOrderLog(
            ticket_id=ticket.id,
            from_status=None, to_status="pending_review",
            action="提交审核", remark="业主微信报修",
            operator_id=registrar.id, operator_name=registrar.full_name,
            created_at=now - timedelta(hours=4),
        ),
        WorkOrderLog(
            ticket_id=ticket.id,
            from_status="pending_review", to_status="rejected",
            action="驳回工单", remark=ticket.reject_reason,
            operator_id=supervisor.id, operator_name=supervisor.full_name,
            created_at=now - timedelta(hours=2),
        ),
    ])

    ticket.audit_logs.extend([
        AuditLog(
            ticket_id=ticket.id,
            user_id=registrar.id, user_name=registrar.full_name,
            action="创建工单", module="报修登记",
            detail="业主孙先生阳台瓷砖问题报修",
            is_success=True,
            created_at=now - timedelta(hours=4),
        ),
        AuditLog(
            ticket_id=ticket.id,
            user_id=supervisor.id, user_name=supervisor.full_name,
            action="驳回工单", module="工单审核",
            detail="审核不通过，非物业维修范围",
            failure_reason=ticket.reject_reason,
            is_success=False,
            created_at=now - timedelta(hours=2),
        ),
    ])

    return ticket


def _create_completed_ticket(db, registrar, supervisor, reviewer, now):
    ticket = RepairTicket(
        ticket_no=_generate_ticket_no(5),
        title="E栋1205户内照明跳闸",
        owner_name="周业主", owner_phone="13988889999",
        address="阳光花园E栋1单元1205",
        repair_type="水电维修", priority="high",
        description="户内总闸频繁跳闸，特别是开空调时，怀疑线路过载或短路。",
        status=TicketStatusEnum.ARCHIVED,
        deadline_at=now - timedelta(days=1),
        created_by_id=registrar.id,
        handled_by_id=supervisor.id,
        reviewed_by_id=reviewer.id,
        assigned_at=now - timedelta(days=1, hours=20),
        completed_at=now - timedelta(days=1, hours=5),
        archived_at=now - timedelta(days=1),
        repair_result="经检查，空调插座线路接触不良导致过热跳闸，已重新压接端子并加固插座，试机正常。建议业主更换更大功率的空调专线。",
        review_note="工单处理规范，维修结果说明详细，业主回访满意，同意归档。",
        visit_feedback="非常满意",
        visit_remark="业主表示维修师傅非常专业，当天就解决了问题，值得表扬。",
        created_at=now - timedelta(days=2),
    )
    db.flush()

    ticket.attachments.extend([
        Attachment(
            ticket_id=ticket.id,
            file_name="跳闸电箱照片.jpg",
            file_path="/uploads/trip_1.jpg",
            file_size=820000, mime_type="image/jpeg",
            attachment_type=AttachmentTypeEnum.REQUIRED,
            is_required=True, uploaded_by_id=registrar.id,
            uploaded_at=now - timedelta(days=2),
        ),
        Attachment(
            ticket_id=ticket.id,
            file_name="维修后接线照片.jpg",
            file_path="/uploads/trip_result_1.jpg",
            file_size=780000, mime_type="image/jpeg",
            attachment_type=AttachmentTypeEnum.REQUIRED,
            is_required=True, uploaded_by_id=supervisor.id,
            uploaded_at=now - timedelta(days=1, hours=5),
        ),
        Attachment(
            ticket_id=ticket.id,
            file_name="业主签字确认单.jpg",
            file_path="/uploads/trip_sign.jpg",
            file_size=1500000, mime_type="image/jpeg",
            attachment_type=AttachmentTypeEnum.SUPPLEMENTARY,
            is_supplementary=True, uploaded_by_id=reviewer.id,
            uploaded_at=now - timedelta(days=1),
            review_note="复核阶段补充的完工确认材料",
        ),
    ])

    ticket.work_logs.extend([
        WorkOrderLog(
            ticket_id=ticket.id,
            from_status=None, to_status="pending_review",
            action="提交审核", remark="业主紧急报修",
            operator_id=registrar.id, operator_name=registrar.full_name,
            created_at=now - timedelta(days=2),
        ),
        WorkOrderLog(
            ticket_id=ticket.id,
            from_status="pending_review", to_status="assigned",
            action="派单处理", remark="已安排水电组李师傅上门",
            operator_id=supervisor.id, operator_name=supervisor.full_name,
            created_at=now - timedelta(days=1, hours=20),
        ),
        WorkOrderLog(
            ticket_id=ticket.id,
            from_status="assigned", to_status="completed",
            action="完工登记", remark=ticket.repair_result,
            operator_id=supervisor.id, operator_name=supervisor.full_name,
            created_at=now - timedelta(days=1, hours=5),
        ),
        WorkOrderLog(
            ticket_id=ticket.id,
            from_status="completed", to_status="archived",
            action="复核归档", remark=ticket.review_note,
            operator_id=reviewer.id, operator_name=reviewer.full_name,
            created_at=now - timedelta(days=1),
        ),
    ])

    ticket.audit_logs.extend([
        AuditLog(
            ticket_id=ticket.id,
            user_id=registrar.id, user_name=registrar.full_name,
            action="创建工单", module="报修登记",
            detail="业主周先生跳闸故障报修",
            is_success=True,
            created_at=now - timedelta(days=2),
        ),
        AuditLog(
            ticket_id=ticket.id,
            user_id=supervisor.id, user_name=supervisor.full_name,
            action="派单处理", module="工单审核",
            detail="派单水电组李师傅",
            is_success=True,
            created_at=now - timedelta(days=1, hours=20),
        ),
        AuditLog(
            ticket_id=ticket.id,
            user_id=supervisor.id, user_name=supervisor.full_name,
            action="完工登记", module="维修处理",
            detail="维修完成并上传结果照片",
            is_success=True,
            created_at=now - timedelta(days=1, hours=5),
        ),
        AuditLog(
            ticket_id=ticket.id,
            user_id=reviewer.id, user_name=reviewer.full_name,
            action="复核归档", module="中心复核",
            detail="复核通过，业主非常满意，工单归档",
            is_success=True,
            created_at=now - timedelta(days=1),
        ),
    ])

    return ticket


if __name__ == "__main__":
    init_database()
