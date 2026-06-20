from __future__ import annotations

import sys
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func

from .database import SessionLocal, Base, engine
from .models import (
    User, Equipment, InspectionOrder, OperationRecord,
    RiskLevelChange, FaultReport, RecoveryConfirm,
    UserRole, InspectionStatus, RiskLevel, InspectionResult, OperationType
)


def seed_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("开始初始化数据...")

        if db.query(User).count() == 0:
            print("创建用户...")
            users = [
                User(username="inspector1", name="张巡检", role=UserRole.INSPECTOR),
                User(username="handler1", name="李办理", role=UserRole.HANDLER),
                User(username="reviewer1", name="王复核", role=UserRole.REVIEWER),
            ]
            db.add_all(users)
            db.flush()
            print(f"已创建 {len(users)} 个用户")

        if db.query(Equipment).count() == 0:
            print("创建设备...")
            equipments = [
                Equipment(code="EQ-001", name="跑步机A1", location="社区健身房-有氧区", specification="商用级 120kg承重"),
                Equipment(code="EQ-002", name="椭圆机B2", location="社区健身房-有氧区", specification="电磁控阻力"),
                Equipment(code="EQ-003", name="动感单车C3", location="社区健身房-有氧区", specification="静音磁控"),
                Equipment(code="EQ-004", name="史密斯架D4", location="社区健身房-力量区", specification="200kg承重"),
                Equipment(code="EQ-005", name="哑铃组E5", location="社区健身房-力量区", specification="2.5kg-25kg"),
                Equipment(code="EQ-006", name="卧推架F6", location="社区健身房-力量区", specification="150kg承重"),
            ]
            db.add_all(equipments)
            db.flush()
            print(f"已创建 {len(equipments)} 个设备")

        users = db.query(User).all()
        equipments = db.query(Equipment).all()
        user_map = {u.role: u for u in users}
        eq_map = {eq.code: eq for eq in equipments}

        inspector = user_map[UserRole.INSPECTOR]
        handler = user_map[UserRole.HANDLER]
        reviewer = user_map[UserRole.REVIEWER]

        now = datetime.utcnow()

        if db.query(InspectionOrder).count() == 0:
            print("创建巡检单样例数据...")

            orders = []

            order1 = InspectionOrder(
                order_no="INSP202606200001",
                equipment_id=eq_map["EQ-001"].id,
                initiator_id=inspector.id,
                current_handler_id=handler.id,
                status=InspectionStatus.ARCHIVED,
                risk_level=RiskLevel.LOW,
                inspection_result=InspectionResult.NORMAL,
                inspection_date=now - timedelta(days=7),
                due_date=now - timedelta(days=5),
                appearance_check=True,
                appearance_remark="外观完好，无磨损",
                function_check=True,
                function_remark="运行平稳，无异响",
                safety_check=True,
                safety_remark="安全锁正常，急停有效",
                maintenance_check=True,
                maintenance_remark="已按计划维护",
                last_handler_opinion="检查完成，各项正常",
                last_handler_result="通过",
                handler_opinion="经核实，设备状态良好",
                handler_result="通过",
                handled_at=now - timedelta(days=6),
                reviewer_opinion="复核通过，材料齐全",
                reviewer_result="通过",
                reviewed_at=now - timedelta(days=5),
                version=3,
                created_at=now - timedelta(days=7),
                updated_at=now - timedelta(days=5),
            )
            orders.append(order1)

            order2 = InspectionOrder(
                order_no="INSP202606200002",
                equipment_id=eq_map["EQ-002"].id,
                initiator_id=inspector.id,
                current_handler_id=handler.id,
                status=InspectionStatus.PENDING_REVIEW,
                risk_level=RiskLevel.MEDIUM,
                inspection_result=InspectionResult.ABNORMAL,
                inspection_date=now - timedelta(days=3),
                due_date=now - timedelta(days=1),
                appearance_check=True,
                appearance_remark="外观有轻微划痕",
                function_check=False,
                function_evidence="/evidences/eq002_function.jpg",
                function_remark="电磁控阻力调节失灵，3档以上无法调整",
                safety_check=True,
                safety_remark="安全防护正常",
                maintenance_check=True,
                maintenance_remark="距上次维护已45天",
                handler_opinion="阻力调节系统故障，需联系厂家维修",
                handler_result="异常待修",
                handled_at=now - timedelta(days=2),
                version=2,
                created_at=now - timedelta(days=3),
                updated_at=now - timedelta(days=2),
            )
            orders.append(order2)

            order3 = InspectionOrder(
                order_no="INSP202606200003",
                equipment_id=eq_map["EQ-003"].id,
                initiator_id=inspector.id,
                current_handler_id=handler.id,
                status=InspectionStatus.PENDING_HANDLING,
                risk_level=RiskLevel.HIGH,
                inspection_result=InspectionResult.MISSING_EVIDENCE,
                inspection_date=now - timedelta(days=1),
                due_date=now + timedelta(days=2),
                appearance_check=False,
                appearance_evidence="/evidences/eq003_appearance.jpg",
                appearance_remark="脚踏板断裂，金属外露",
                function_check=None,
                function_remark="因外观问题未进行功能测试",
                safety_check=False,
                safety_remark="存在安全隐患",
                maintenance_check=None,
                version=1,
                created_at=now - timedelta(days=1),
                updated_at=now - timedelta(days=1),
            )
            orders.append(order3)

            order4 = InspectionOrder(
                order_no="INSP202606200004",
                equipment_id=eq_map["EQ-004"].id,
                initiator_id=inspector.id,
                current_handler_id=handler.id,
                status=InspectionStatus.RETURNED,
                risk_level=RiskLevel.MEDIUM,
                inspection_result=InspectionResult.RETURNED,
                inspection_date=now - timedelta(days=5),
                due_date=now - timedelta(days=3),
                appearance_check=True,
                function_check=True,
                safety_check=True,
                safety_remark="钢索有轻微起毛",
                maintenance_check=True,
                last_handler_opinion="初次检查完成，建议维护",
                last_handler_result="通过",
                handler_opinion="钢索磨损情况需进一步核实，建议更换",
                handler_result="异常",
                handled_at=now - timedelta(days=4),
                reviewer_opinion="证据不足，钢索磨损照片不清晰，需重新提交",
                reviewer_result="退回补正",
                reviewed_at=now - timedelta(days=3),
                version=3,
                created_at=now - timedelta(days=5),
                updated_at=now - timedelta(days=3),
            )
            orders.append(order4)

            order5 = InspectionOrder(
                order_no="INSP202606200005",
                equipment_id=eq_map["EQ-005"].id,
                initiator_id=inspector.id,
                current_handler_id=handler.id,
                status=InspectionStatus.ARCHIVED,
                risk_level=RiskLevel.HIGH,
                inspection_result=InspectionResult.OVERDUE,
                inspection_date=now - timedelta(days=15),
                due_date=now - timedelta(days=12),
                appearance_check=False,
                appearance_evidence="/evidences/eq005_appearance.jpg",
                appearance_remark="5kg哑铃手柄松动",
                function_check=True,
                safety_check=False,
                safety_evidence="/evidences/eq005_safety.jpg",
                safety_remark="哑铃片固定螺栓缺失2个",
                maintenance_check=True,
                handler_opinion="安全隐患严重，需立即停用并报修",
                handler_result="高风险异常",
                handled_at=now - timedelta(days=14),
                reviewer_opinion="已逾期1天完成，情况属实，需立即处理",
                reviewer_result="通过",
                reviewed_at=now - timedelta(days=11),
                version=3,
                created_at=now - timedelta(days=15),
                updated_at=now - timedelta(days=11),
            )
            orders.append(order5)

            order6 = InspectionOrder(
                order_no="INSP202606200006",
                equipment_id=eq_map["EQ-006"].id,
                initiator_id=inspector.id,
                current_handler_id=handler.id,
                status=InspectionStatus.IN_PROGRESS,
                risk_level=RiskLevel.MEDIUM,
                inspection_result=InspectionResult.STATUS_CONFLICT,
                inspection_date=now - timedelta(days=2),
                due_date=now + timedelta(days=1),
                appearance_check=True,
                function_check=None,
                safety_check=True,
                maintenance_check=True,
                version=1,
                created_at=now - timedelta(days=2),
                updated_at=now - timedelta(days=1),
            )
            orders.append(order6)

            order7 = InspectionOrder(
                order_no="INSP202606200007",
                equipment_id=eq_map["EQ-001"].id,
                initiator_id=inspector.id,
                current_handler_id=handler.id,
                status=InspectionStatus.PENDING_HANDLING,
                risk_level=RiskLevel.LOW,
                inspection_date=now,
                due_date=now + timedelta(days=3),
                appearance_check=True,
                appearance_remark="运行正常",
                function_check=True,
                function_remark="正常",
                safety_check=True,
                safety_remark="正常",
                maintenance_check=True,
                maintenance_remark="正常",
                version=1,
                created_at=now,
                updated_at=now,
            )
            orders.append(order7)

            for order in orders:
                db.add(order)
            db.flush()
            print(f"已创建 {len(orders)} 个巡检单")

            print("创建操作记录...")
            op_records = []

            ord1 = db.query(InspectionOrder).filter(InspectionOrder.order_no == "INSP202606200001").first()
            if ord1:
                op_records.extend([
                    OperationRecord(
                        inspection_order_id=ord1.id,
                        operator_id=inspector.id,
                        operation_type=OperationType.INITIATE,
                        from_status=InspectionStatus.DRAFT,
                        to_status=InspectionStatus.PENDING_HANDLING,
                        opinion="发起巡检",
                        result="提交成功",
                        version=1,
                        operated_at=now - timedelta(days=7),
                    ),
                    OperationRecord(
                        inspection_order_id=ord1.id,
                        operator_id=handler.id,
                        operation_type=OperationType.HANDLE,
                        from_status=InspectionStatus.PENDING_HANDLING,
                        to_status=InspectionStatus.PENDING_REVIEW,
                        opinion="经核实，设备状态良好",
                        result="通过",
                        version=2,
                        operated_at=now - timedelta(days=6),
                    ),
                    OperationRecord(
                        inspection_order_id=ord1.id,
                        operator_id=reviewer.id,
                        operation_type=OperationType.ARCHIVE,
                        from_status=InspectionStatus.PENDING_REVIEW,
                        to_status=InspectionStatus.ARCHIVED,
                        opinion="复核通过，材料齐全",
                        result="通过",
                        version=3,
                        operated_at=now - timedelta(days=5),
                    ),
                ])

            ord2 = db.query(InspectionOrder).filter(InspectionOrder.order_no == "INSP202606200002").first()
            if ord2:
                op_records.extend([
                    OperationRecord(
                        inspection_order_id=ord2.id,
                        operator_id=inspector.id,
                        operation_type=OperationType.INITIATE,
                        from_status=InspectionStatus.DRAFT,
                        to_status=InspectionStatus.PENDING_HANDLING,
                        from_risk_level=RiskLevel.LOW,
                        to_risk_level=RiskLevel.MEDIUM,
                        opinion="发现功能异常，升级为中风险",
                        result="提交成功",
                        version=1,
                        operated_at=now - timedelta(days=3),
                    ),
                    OperationRecord(
                        inspection_order_id=ord2.id,
                        operator_id=handler.id,
                        operation_type=OperationType.HANDLE,
                        from_status=InspectionStatus.PENDING_HANDLING,
                        to_status=InspectionStatus.PENDING_REVIEW,
                        opinion="阻力调节系统故障，需联系厂家维修",
                        result="异常待修",
                        version=2,
                        operated_at=now - timedelta(days=2),
                    ),
                ])

            ord3 = db.query(InspectionOrder).filter(InspectionOrder.order_no == "INSP202606200003").first()
            if ord3:
                op_records.extend([
                    OperationRecord(
                        inspection_order_id=ord3.id,
                        operator_id=inspector.id,
                        operation_type=OperationType.INITIATE,
                        from_status=InspectionStatus.DRAFT,
                        to_status=InspectionStatus.PENDING_HANDLING,
                        from_risk_level=RiskLevel.LOW,
                        to_risk_level=RiskLevel.HIGH,
                        opinion="发现脚踏板断裂，自动升级为高风险",
                        result="高风险需紧急处理",
                        version=1,
                        operated_at=now - timedelta(days=1),
                    ),
                ])

            ord4 = db.query(InspectionOrder).filter(InspectionOrder.order_no == "INSP202606200004").first()
            if ord4:
                op_records.extend([
                    OperationRecord(
                        inspection_order_id=ord4.id,
                        operator_id=inspector.id,
                        operation_type=OperationType.INITIATE,
                        from_status=InspectionStatus.DRAFT,
                        to_status=InspectionStatus.PENDING_HANDLING,
                        opinion="发起巡检",
                        result="提交成功",
                        version=1,
                        operated_at=now - timedelta(days=5),
                    ),
                    OperationRecord(
                        inspection_order_id=ord4.id,
                        operator_id=handler.id,
                        operation_type=OperationType.HANDLE,
                        from_status=InspectionStatus.PENDING_HANDLING,
                        to_status=InspectionStatus.PENDING_REVIEW,
                        opinion="钢索磨损情况需进一步核实",
                        result="异常",
                        version=2,
                        operated_at=now - timedelta(days=4),
                    ),
                    OperationRecord(
                        inspection_order_id=ord4.id,
                        operator_id=reviewer.id,
                        operation_type=OperationType.RETURN,
                        from_status=InspectionStatus.PENDING_REVIEW,
                        to_status=InspectionStatus.RETURNED,
                        opinion="证据不足，钢索磨损照片不清晰，需重新提交",
                        result="退回补正",
                        version=3,
                        operated_at=now - timedelta(days=3),
                    ),
                ])

            ord5 = db.query(InspectionOrder).filter(InspectionOrder.order_no == "INSP202606200005").first()
            if ord5:
                op_records.extend([
                    OperationRecord(
                        inspection_order_id=ord5.id,
                        operator_id=inspector.id,
                        operation_type=OperationType.INITIATE,
                        from_status=InspectionStatus.DRAFT,
                        to_status=InspectionStatus.PENDING_HANDLING,
                        from_risk_level=RiskLevel.LOW,
                        to_risk_level=RiskLevel.HIGH,
                        opinion="哑铃安全隐患严重，升级为高风险",
                        result="高风险",
                        version=1,
                        operated_at=now - timedelta(days=15),
                    ),
                    OperationRecord(
                        inspection_order_id=ord5.id,
                        operator_id=handler.id,
                        operation_type=OperationType.HANDLE,
                        from_status=InspectionStatus.PENDING_HANDLING,
                        to_status=InspectionStatus.PENDING_REVIEW,
                        opinion="安全隐患严重，需立即停用并报修",
                        result="高风险异常",
                        version=2,
                        operated_at=now - timedelta(days=14),
                    ),
                    OperationRecord(
                        inspection_order_id=ord5.id,
                        operator_id=reviewer.id,
                        operation_type=OperationType.ARCHIVE,
                        from_status=InspectionStatus.PENDING_REVIEW,
                        to_status=InspectionStatus.ARCHIVED,
                        opinion="已逾期1天完成，情况属实，需立即处理",
                        result="通过（逾期）",
                        version=3,
                        operated_at=now - timedelta(days=11),
                    ),
                ])

            ord6 = db.query(InspectionOrder).filter(InspectionOrder.order_no == "INSP202606200006").first()
            if ord6:
                op_records.extend([
                    OperationRecord(
                        inspection_order_id=ord6.id,
                        operator_id=inspector.id,
                        operation_type=OperationType.INITIATE,
                        from_status=InspectionStatus.DRAFT,
                        to_status=InspectionStatus.PENDING_HANDLING,
                        opinion="发起巡检",
                        result="提交成功",
                        version=1,
                        operated_at=now - timedelta(days=2),
                    ),
                    OperationRecord(
                        inspection_order_id=ord6.id,
                        operator_id=handler.id,
                        operation_type=OperationType.HANDLE,
                        from_status=InspectionStatus.PENDING_HANDLING,
                        to_status=InspectionStatus.IN_PROGRESS,
                        opinion="正在核实功能异常情况",
                        result="办理中",
                        version=1,
                        operated_at=now - timedelta(days=1),
                    ),
                ])

            ord7 = db.query(InspectionOrder).filter(InspectionOrder.order_no == "INSP202606200007").first()
            if ord7:
                op_records.extend([
                    OperationRecord(
                        inspection_order_id=ord7.id,
                        operator_id=inspector.id,
                        operation_type=OperationType.INITIATE,
                        from_status=InspectionStatus.DRAFT,
                        to_status=InspectionStatus.PENDING_HANDLING,
                        opinion="发起巡检，各项检查正常",
                        result="提交成功",
                        version=1,
                        operated_at=now,
                    ),
                ])

            for rec in op_records:
                db.add(rec)
            db.flush()
            print(f"已创建 {len(op_records)} 条操作记录")

            print("创建风险等级变更记录...")
            risk_changes = []
            if ord3:
                risk_changes.append(RiskLevelChange(
                    inspection_order_id=ord3.id,
                    operator_id=inspector.id,
                    from_level=RiskLevel.LOW,
                    to_level=RiskLevel.HIGH,
                    reason="发现脚踏板断裂，金属外露，存在严重安全隐患",
                    changed_at=now - timedelta(days=1),
                ))

            if ord5:
                risk_changes.append(RiskLevelChange(
                    inspection_order_id=ord5.id,
                    operator_id=inspector.id,
                    from_level=RiskLevel.LOW,
                    to_level=RiskLevel.HIGH,
                    reason="哑铃片固定螺栓缺失，手柄松动，使用时可能脱落伤人",
                    changed_at=now - timedelta(days=15),
                ))

            for rc in risk_changes:
                db.add(rc)
            print(f"已创建 {len(risk_changes)} 条风险变更记录")

            print("创建故障报修记录...")
            faults = []
            if ord2:
                faults.append(FaultReport(
                    inspection_order_id=ord2.id,
                    fault_description="椭圆机电磁控阻力调节系统失灵，3档以上无法调整",
                    fault_level=RiskLevel.MEDIUM,
                    reported_by=handler.id,
                    reported_at=now - timedelta(days=2),
                ))
            if ord3:
                faults.append(FaultReport(
                    inspection_order_id=ord3.id,
                    fault_description="动感单车脚踏板断裂，金属外露，需立即更换",
                    fault_level=RiskLevel.HIGH,
                    reported_by=inspector.id,
                    reported_at=now - timedelta(days=1),
                    is_resolved=False,
                ))
            if ord5:
                faults.append(FaultReport(
                    inspection_order_id=ord5.id,
                    fault_description="5kg哑铃手柄松动，哑铃片固定螺栓缺失2个",
                    fault_level=RiskLevel.HIGH,
                    reported_by=inspector.id,
                    reported_at=now - timedelta(days=15),
                    is_resolved=True,
                    resolved_by=handler.id,
                    resolved_at=now - timedelta(days=12),
                    resolution="已更换手柄并补充螺栓，经测试使用正常",
                ))

            for f in faults:
                db.add(f)
            db.flush()
            print(f"已创建 {len(faults)} 条故障报修记录")

            print("创建恢复确认记录...")
            recoveries = []
            eq005_fault = db.query(FaultReport).filter(
                FaultReport.inspection_order_id == ord5.id if ord5 else None
            ).first()
            if eq005_fault and eq005_fault.is_resolved:
                recoveries.append(RecoveryConfirm(
                    fault_report_id=eq005_fault.id,
                    inspection_order_id=ord5.id if ord5 else None,
                    confirmed_by=handler.id,
                    confirmed_at=now - timedelta(days=12),
                    confirmation_remark="已更换新手柄，补充缺失的螺栓，经多人测试使用正常，无安全隐患",
                    evidence_path="/evidences/eq005_recovery.jpg",
                    is_successful=True,
                ))

            for rc in recoveries:
                db.add(rc)
            print(f"已创建 {len(recoveries)} 条恢复确认记录")

        db.commit()
        print("\n数据初始化完成！")
        print("\n=== 用户账号 ===")
        for u in users:
            print(f"  ID: {u.id}, 姓名: {u.name}, 角色: {u.role.value}")
        print("\n=== 设备列表 ===")
        for eq in equipments:
            print(f"  {eq.code}: {eq.name} - {eq.location}")
        print("\n=== 巡检单状态概览 ===")
        status_counts = db.query(
            InspectionOrder.status,
            func.count(InspectionOrder.id)
        ).group_by(InspectionOrder.status).all()
        for status, count in status_counts:
            print(f"  {status.value}: {count} 单")
        print("\n=== 风险等级分布 ===")
        risk_counts = db.query(
            InspectionOrder.risk_level,
            func.count(InspectionOrder.id)
        ).group_by(InspectionOrder.risk_level).all()
        for risk, count in risk_counts:
            print(f"  {risk.value}: {count} 单")

    except Exception as e:
        db.rollback()
        print(f"数据初始化失败: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
