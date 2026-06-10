from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database import async_session
from models.user import User, UserRole
from models.charging_pile import ChargingPile
from models.inspection import InspectionOrder, InspectionStatus, InspectionType
from models.qr_record import QRCodeRecord, ScanResult
from models.fault_report import FaultReport
from models.repair_acceptance import RepairAcceptance
from models.audit_log import AuditLog, AuditAction
from utils import get_password_hash, generate_order_no


def to_value(enum_val):
    return enum_val.value if enum_val is not None else None


async def init_demo_data():
    async with async_session() as session:
        result = await session.execute(select(func.count()).select_from(User))
        user_count = result.scalar_one()
        if user_count > 0:
            print("演示数据已存在，跳过初始化")
            return

        print("开始初始化演示数据...")

        users = [
            User(
                username="registrar",
                hashed_password=get_password_hash("123456"),
                full_name="张巡检",
                role=UserRole.REGISTRAR,
            ),
            User(
                username="supervisor",
                hashed_password=get_password_hash("123456"),
                full_name="李主管",
                role=UserRole.SUPERVISOR,
            ),
            User(
                username="reviewer",
                hashed_password=get_password_hash("123456"),
                full_name="王站长",
                role=UserRole.REVIEWER,
            ),
        ]
        session.add_all(users)
        await session.flush()
        print(f"  - 创建 {len(users)} 个用户")

        user_map = {u.role: u for u in users}

        piles = [
            ChargingPile(
                pile_code="CP-A001",
                pile_name="A区1号充电桩",
                station_code="ST-C01",
                station_name="城东新能源充电站",
                qr_code="QR-CP-A001-2024",
                location="A区-01号位",
                power_rating="120kW",
            ),
            ChargingPile(
                pile_code="CP-A002",
                pile_name="A区2号充电桩",
                station_code="ST-C01",
                station_name="城东新能源充电站",
                qr_code="QR-CP-A002-2024",
                location="A区-02号位",
                power_rating="120kW",
            ),
            ChargingPile(
                pile_code="CP-B001",
                pile_name="B区1号充电桩",
                station_code="ST-C01",
                station_name="城东新能源充电站",
                qr_code="QR-CP-B001-2024",
                location="B区-01号位",
                power_rating="60kW",
            ),
            ChargingPile(
                pile_code="CP-B002",
                pile_name="B区2号充电桩",
                station_code="ST-C01",
                station_name="城东新能源充电站",
                qr_code="QR-CP-B002-2024",
                location="B区-02号位",
                power_rating="60kW",
            ),
            ChargingPile(
                pile_code="CP-C001",
                pile_name="C区1号充电桩",
                station_code="ST-C02",
                station_name="城西新能源充电站",
                qr_code="QR-CP-C001-2024",
                location="C区-01号位",
                power_rating="180kW",
            ),
            ChargingPile(
                pile_code="CP-C002",
                pile_name="C区2号充电桩",
                station_code="ST-C02",
                station_name="城西新能源充电站",
                qr_code="QR-CP-C002-2024",
                location="C区-02号位",
                power_rating="180kW",
            ),
        ]
        session.add_all(piles)
        await session.flush()
        print(f"  - 创建 {len(piles)} 个充电桩")

        pile_map = {p.pile_code: p for p in piles}

        now = datetime.now(timezone.utc)
        registrar_id = user_map[UserRole.REGISTRAR].id
        supervisor_id = user_map[UserRole.SUPERVISOR].id
        reviewer_id = user_map[UserRole.REVIEWER].id

        inspections_data = [
            {
                "status": InspectionStatus.DRAFT,
                "pile_code": "CP-A001",
                "days_ago": 0,
                "type": InspectionType.ROUTINE,
                "with_qr": False,
                "with_fault": False,
                "with_repair": False,
                "with_acceptance": False,
            },
            {
                "status": InspectionStatus.PENDING_REVIEW,
                "pile_code": "CP-A002",
                "days_ago": 1,
                "type": InspectionType.ROUTINE,
                "with_qr": True,
                "with_fault": False,
                "with_repair": False,
                "with_acceptance": False,
            },
            {
                "status": InspectionStatus.PENDING_REVIEW,
                "pile_code": "CP-B001",
                "days_ago": 2,
                "type": InspectionType.SPECIAL,
                "with_qr": True,
                "with_fault": False,
                "with_repair": False,
                "with_acceptance": False,
            },
            {
                "status": InspectionStatus.REVIEW_REJECTED,
                "pile_code": "CP-B002",
                "days_ago": 3,
                "type": InspectionType.ROUTINE,
                "with_qr": True,
                "with_fault": False,
                "with_repair": False,
                "with_acceptance": False,
                "supervisor_opinion": "检查项不完整，请补充外观检查和线缆检查的详细记录",
                "current_handler_id": registrar_id,
            },
            {
                "status": InspectionStatus.PENDING_FINAL_REVIEW,
                "pile_code": "CP-C001",
                "days_ago": 2,
                "type": InspectionType.SPECIAL,
                "with_qr": True,
                "with_fault": False,
                "with_repair": False,
                "with_acceptance": False,
                "supervisor_opinion": "巡检合格，各项检查均符合标准，提请复核",
                "supervisor_review_date_offset_days": 1,
            },
            {
                "status": InspectionStatus.PENDING_FINAL_REVIEW,
                "pile_code": "CP-C002",
                "days_ago": 4,
                "type": InspectionType.ROUTINE,
                "with_qr": True,
                "with_fault": False,
                "with_repair": False,
                "with_acceptance": False,
                "supervisor_opinion": "设备运行正常，检查齐全，提请复核归档",
                "supervisor_review_date_offset_days": 2,
            },
            {
                "status": InspectionStatus.ARCHIVED,
                "pile_code": "CP-A001",
                "days_ago": 7,
                "type": InspectionType.ROUTINE,
                "with_qr": True,
                "with_fault": False,
                "with_repair": False,
                "with_acceptance": False,
                "supervisor_opinion": "巡检合格",
                "supervisor_review_date_offset_days": 6,
                "reviewer_opinion": "同意归档",
                "reviewer_review_date_offset_days": 5,
            },
            {
                "status": InspectionStatus.PENDING_FAULT_REPORT,
                "pile_code": "CP-B001",
                "days_ago": 1,
                "type": InspectionType.ROUTINE,
                "with_qr": True,
                "with_fault": False,
                "with_repair": False,
                "with_acceptance": False,
                "supervisor_opinion": "发现设备异常，需进一步故障排查",
                "supervisor_review_date_offset_days": 0,
            },
            {
                "status": InspectionStatus.FAULT_REPORTED,
                "pile_code": "CP-B002",
                "days_ago": 3,
                "type": InspectionType.ROUTINE,
                "with_qr": True,
                "with_fault": True,
                "with_repair": False,
                "with_acceptance": False,
                "supervisor_opinion": "已上报故障，安排维修",
                "supervisor_review_date_offset_days": 2,
            },
            {
                "status": InspectionStatus.PENDING_REPAIR,
                "pile_code": "CP-C001",
                "days_ago": 2,
                "type": InspectionType.ROUTINE,
                "with_qr": True,
                "with_fault": True,
                "with_repair": False,
                "with_acceptance": False,
            },
            {
                "status": InspectionStatus.REPAIR_COMPLETED,
                "pile_code": "CP-C002",
                "days_ago": 5,
                "type": InspectionType.ROUTINE,
                "with_qr": True,
                "with_fault": True,
                "with_repair": False,
                "with_acceptance": False,
            },
            {
                "status": InspectionStatus.PENDING_ACCEPTANCE,
                "pile_code": "CP-A002",
                "days_ago": 4,
                "type": InspectionType.ROUTINE,
                "with_qr": True,
                "with_fault": True,
                "with_repair": True,
                "with_acceptance": False,
            },
            {
                "status": InspectionStatus.ACCEPTANCE_REJECTED,
                "pile_code": "CP-B001",
                "days_ago": 6,
                "type": InspectionType.SPECIAL,
                "with_qr": True,
                "with_fault": True,
                "with_repair": True,
                "with_acceptance": True,
                "current_handler_id": registrar_id,
            },
            {
                "status": InspectionStatus.FINAL_REVIEW_REJECTED,
                "pile_code": "CP-A001",
                "days_ago": 5,
                "type": InspectionType.SPECIAL,
                "with_qr": True,
                "with_fault": False,
                "with_repair": False,
                "with_acceptance": False,
                "supervisor_opinion": "巡检合格",
                "supervisor_review_date_offset_days": 4,
                "reviewer_opinion": "材料不齐全，缺少现场照片，请补充后重新提交",
                "reviewer_review_date_offset_days": 3,
                "current_handler_id": registrar_id,
            },
        ]

        created_inspections = []

        for idx, data in enumerate(inspections_data):
            created_at = now - timedelta(days=data["days_ago"])
            pile = pile_map[data["pile_code"]]

            inspection = InspectionOrder(
                order_no=generate_order_no(),
                type=data["type"],
                status=data["status"],
                charging_pile_id=pile.id,
                inspection_date=created_at.date(),
                inspector_name="张巡检",
                appearance_check="合格",
                appearance_note="外观整洁，无明显损坏",
                cable_check="合格",
                cable_note="线缆完好，无老化",
                connector_check="合格",
                connector_note="接头牢固，无松动",
                display_check="合格",
                display_note="显示屏清晰",
                charging_check="合格",
                charging_note="充电功能正常",
                emergency_stop_check="合格",
                emergency_stop_note="急停按钮功能正常",
                grounding_check="合格",
                grounding_note="接地良好",
                overall_result="合格",
                registrar_opinion="现场检查完成，设备运行正常",
                registrar_signature="张巡检" if data["status"] not in [InspectionStatus.DRAFT] else None,
                supervisor_opinion=data.get("supervisor_opinion"),
                supervisor_signature="李主管" if data.get("supervisor_opinion") else None,
                reviewer_opinion=data.get("reviewer_opinion"),
                reviewer_signature="王站长" if data.get("reviewer_opinion") else None,
                time_limit=created_at + timedelta(days=7),
                created_by=registrar_id,
                created_at=created_at,
                updated_at=created_at,
                version=idx + 1,
                current_handler_id=data.get("current_handler_id"),
            )

            if data.get("supervisor_review_date_offset_days") is not None:
                inspection.supervisor_review_date = now - timedelta(
                    days=data["supervisor_review_date_offset_days"]
                )
            if data.get("reviewer_review_date_offset_days") is not None:
                inspection.reviewer_review_date = now - timedelta(
                    days=data["reviewer_review_date_offset_days"]
                )

            session.add(inspection)
            await session.flush()
            created_inspections.append((inspection, data))

        print(f"  - 创建 {len(created_inspections)} 条巡检单")

        for inspection, data in created_inspections:
            if data["with_qr"]:
                qr_record = QRCodeRecord(
                    inspection_order_id=inspection.id,
                    charging_pile_id=pile_map[data["pile_code"]].id,
                    qr_code_content=pile_map[data["pile_code"]].qr_code,
                    scan_time=inspection.created_at + timedelta(hours=1),
                    result=ScanResult.SUCCESS,
                    scanned_by=registrar_id,
                    location_evidence=pile_map[data["pile_code"]].location,
                    note="现场扫码核验成功",
                )
                session.add(qr_record)

        await session.flush()
        print(f"  - 创建扫码记录")

        fault_count = 0
        for inspection, data in created_inspections:
            if data["with_fault"]:
                fault = FaultReport(
                    inspection_order_id=inspection.id,
                    fault_code=f"E{100 + fault_count}",
                    fault_level="major" if fault_count % 2 == 0 else "general",
                    fault_location="充电模块",
                    fault_description="充电输出不稳定，电压波动较大",
                    repair_deadline=now + timedelta(days=3),
                    repair_company="速修电力设备有限公司",
                    repair_contact="陈工",
                    repair_phone="13900139001",
                    report_opinion="已联系维修单位，预计3天内修复",
                    reported_by=supervisor_id,
                    reported_at=inspection.created_at + timedelta(days=1),
                )
                session.add(fault)
                fault_count += 1

        await session.flush()
        print(f"  - 创建 {fault_count} 条故障报告")

        acceptance_count = 0
        for inspection, data in created_inspections:
            if data["with_repair"]:
                result = (
                    "pass"
                    if data["status"] != InspectionStatus.ACCEPTANCE_REJECTED
                    else "fail"
                )
                acceptance = RepairAcceptance(
                    inspection_order_id=inspection.id,
                    repair_company="速修电力设备有限公司",
                    repair_person="李师傅",
                    repair_phone="13900139002",
                    repair_cost="1500.00" if acceptance_count % 2 == 0 else "800.00",
                    repair_start_date=inspection.created_at + timedelta(days=2),
                    repair_end_date=inspection.created_at + timedelta(days=4),
                    is_guarantee=False,
                    material_complete=True,
                    repair_content="更换充电模块，校准输出电压",
                    parts_replaced="充电控制板、滤波电容",
                    acceptance_check_items="外观检查、充电功能测试、绝缘测试",
                    acceptance_result=result,
                    acceptance_opinion="修复完成，测试合格"
                    if result == "pass"
                    else "修复质量不达标，需重新维修",
                    accepted_by=supervisor_id,
                    accepted_at=inspection.created_at + timedelta(days=5),
                )
                session.add(acceptance)
                acceptance_count += 1

        await session.flush()
        print(f"  - 创建 {acceptance_count} 条修复验收记录")

        audit_count = 0
        for inspection, data in created_inspections:
            audit_create = AuditLog(
                inspection_order_id=inspection.id,
                action=AuditAction.CREATE,
                operator_id=registrar_id,
                operator_name="张巡检",
                operator_role=UserRole.REGISTRAR.value,
                from_status=None,
                to_status=InspectionStatus.DRAFT.value,
                detail=f"创建巡检单 {inspection.order_no}",
                ip_address="192.168.1.100",
                user_agent="Mozilla/5.0",
                created_at=inspection.created_at,
            )
            session.add(audit_create)
            audit_count += 1

            if data["with_qr"]:
                audit_qr = AuditLog(
                    inspection_order_id=inspection.id,
                    action=AuditAction.SCAN_QR,
                    operator_id=registrar_id,
                    operator_name="张巡检",
                    operator_role=UserRole.REGISTRAR.value,
                    from_status=inspection.status.value,
                    to_status=inspection.status.value,
                    detail=f"扫码核验成功 - {pile_map[data['pile_code']].qr_code}",
                    ip_address="192.168.1.100",
                    user_agent="Mobile Safari",
                    created_at=inspection.created_at + timedelta(hours=1),
                )
                session.add(audit_qr)
                audit_count += 1

            if data["status"] not in [InspectionStatus.DRAFT]:
                audit_submit = AuditLog(
                    inspection_order_id=inspection.id,
                    action=AuditAction.SUBMIT,
                    operator_id=registrar_id,
                    operator_name="张巡检",
                    operator_role=UserRole.REGISTRAR.value,
                    from_status=InspectionStatus.DRAFT.value,
                    to_status=InspectionStatus.PENDING_REVIEW.value,
                    detail="提交审核",
                    opinion="现场检查完成，设备运行正常",
                    signature="张巡检",
                    ip_address="192.168.1.100",
                    user_agent="Mozilla/5.0",
                    created_at=inspection.created_at + timedelta(hours=2),
                )
                session.add(audit_submit)
                audit_count += 1

            if data.get("supervisor_opinion"):
                from_status_val = InspectionStatus.PENDING_REVIEW.value
                if data["status"] in [
                    InspectionStatus.PENDING_FINAL_REVIEW,
                    InspectionStatus.ARCHIVED,
                    InspectionStatus.FINAL_REVIEW_REJECTED,
                ]:
                    action = AuditAction.REVIEW
                    to_status = InspectionStatus.PENDING_FINAL_REVIEW.value
                elif data["status"] == InspectionStatus.REVIEW_REJECTED:
                    action = AuditAction.REJECT
                    to_status = InspectionStatus.REVIEW_REJECTED.value
                elif data["status"] == InspectionStatus.PENDING_FAULT_REPORT:
                    action = AuditAction.REPORT_FAULT
                    to_status = InspectionStatus.PENDING_FAULT_REPORT.value
                elif data["status"] in [
                    InspectionStatus.FAULT_REPORTED,
                    InspectionStatus.PENDING_REPAIR,
                    InspectionStatus.REPAIR_COMPLETED,
                    InspectionStatus.PENDING_ACCEPTANCE,
                    InspectionStatus.ACCEPTANCE_REJECTED,
                ]:
                    action = AuditAction.REVIEW
                    to_status = data["status"].value
                else:
                    action = AuditAction.REVIEW
                    to_status = data["status"].value

                audit_review = AuditLog(
                    inspection_order_id=inspection.id,
                    action=action,
                    operator_id=supervisor_id,
                    operator_name="李主管",
                    operator_role=UserRole.SUPERVISOR.value,
                    from_status=from_status_val,
                    to_status=to_status,
                    detail=data["supervisor_opinion"],
                    opinion=data["supervisor_opinion"],
                    signature="李主管",
                    ip_address="192.168.1.101",
                    user_agent="Mozilla/5.0",
                    created_at=inspection.created_at + timedelta(days=1),
                )
                session.add(audit_review)
                audit_count += 1

            if data["status"] == InspectionStatus.ACCEPTANCE_REJECTED:
                audit_accept_reject = AuditLog(
                    inspection_order_id=inspection.id,
                    action=AuditAction.ACCEPT,
                    operator_id=supervisor_id,
                    operator_name="李主管",
                    operator_role=UserRole.SUPERVISOR.value,
                    from_status=InspectionStatus.PENDING_ACCEPTANCE.value,
                    to_status=InspectionStatus.ACCEPTANCE_REJECTED.value,
                    detail="修复质量不达标，部分测试项未通过",
                    opinion="修复质量不达标，绝缘电阻测试不合格，需要重新维修",
                    signature="李主管",
                    error_code="ACCEPTANCE_FAILED",
                    error_message="绝缘电阻测试值低于标准值，充电模块温度过高",
                    suggestion="更换绝缘材料，检查散热系统",
                    next_step="退回维修单位重新处理，预计3个工作日完成",
                    ip_address="192.168.1.101",
                    user_agent="Mozilla/5.0",
                    created_at=inspection.created_at + timedelta(days=5),
                )
                session.add(audit_accept_reject)
                audit_count += 1

            if data.get("reviewer_opinion"):
                action = (
                    AuditAction.ARCHIVE
                    if data["status"] == InspectionStatus.ARCHIVED
                    else AuditAction.REJECT
                )
                audit_final = AuditLog(
                    inspection_order_id=inspection.id,
                    action=action,
                    operator_id=reviewer_id,
                    operator_name="王站长",
                    operator_role=UserRole.REVIEWER.value,
                    from_status=InspectionStatus.PENDING_FINAL_REVIEW.value,
                    to_status=data["status"].value,
                    detail=data["reviewer_opinion"],
                    opinion=data["reviewer_opinion"],
                    signature="王站长",
                    error_code="INCOMPLETE_MATERIALS" if data["status"] == InspectionStatus.FINAL_REVIEW_REJECTED else None,
                    error_message="材料不齐全，缺少现场照片" if data["status"] == InspectionStatus.FINAL_REVIEW_REJECTED else None,
                    suggestion="补充现场照片后重新提交" if data["status"] == InspectionStatus.FINAL_REVIEW_REJECTED else None,
                    next_step="请联系登记员补充材料" if data["status"] == InspectionStatus.FINAL_REVIEW_REJECTED else None,
                    ip_address="192.168.1.102",
                    user_agent="Mozilla/5.0",
                    created_at=inspection.created_at + timedelta(days=2),
                )
                session.add(audit_final)
                audit_count += 1

        await session.commit()
        print(f"  - 创建 {audit_count} 条审计日志")
        print("演示数据初始化完成！")


if __name__ == "__main__":
    import asyncio

    async def main():
        from database import init_db
        await init_db()
        await init_demo_data()

    asyncio.run(main())
