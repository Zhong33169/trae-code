import asyncio
from database import async_session
from models.user import User, UserRole
from models.inspection import InspectionOrder, InspectionStatus
from models.audit_log import AuditLog
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from routers.inspection import get_allowed_actions, get_statistics

async def verify():
    print("=" * 70)
    print("设备巡检单办理链路 - 完整验证")
    print("=" * 70)

    async with async_session() as session:
        users = {}
        for username in ["registrar", "supervisor", "reviewer"]:
            result = await session.execute(
                select(User).where(User.username == username)
            )
            users[username] = result.scalars().first()

        # 1. 验证 created_by 权限
        print("\n\n🔒 1. 登记员 created_by 权限验证")
        print("-" * 70)

        all_result = await session.execute(
            select(InspectionOrder).options(joinedload(InspectionOrder.charging_pile))
        )
        all_orders = all_result.scalars().all()

        # 找一条别人创建的单据（演示数据都是 registrar 创建的，模拟测试权限逻辑）
        registrar = users['registrar']
        supervisor = users['supervisor']

        # 用 supervisor 创建一个临时的 mock 订单来测试登记员
        class MockOrder:
            def __init__(self, status, created_by):
                self.status = status
                self.created_by = created_by

        mock_order_someone_else = MockOrder(InspectionStatus.DRAFT, 9999)  # 不是登记员创建的
        can_operate, actions = get_allowed_actions(mock_order_someone_else, registrar)
        print(f"  登记员查看别人的草稿单:")
        print(f"    can_operate: {can_operate}")
        print(f"    allowed_actions: {actions}")
        assert can_operate == False, "登记员对非本人单据应该不可操作"
        assert actions == ["view"], "登记员对非本人单据只能查看"
        print(f"    ✅ 验证通过：只能查看")

        mock_order_own = MockOrder(InspectionStatus.DRAFT, registrar.id)
        can_operate2, actions2 = get_allowed_actions(mock_order_own, registrar)
        print(f"  登记员查看自己的草稿单:")
        print(f"    can_operate: {can_operate2}")
        print(f"    allowed_actions: {actions2}")
        assert can_operate2 == True
        assert "submit" in actions2
        print(f"    ✅ 验证通过：可以提交")

        # 2. 验证各状态的 allowed_actions
        print("\n\n🔐 2. 各状态的 allowed_actions 验证")
        print("-" * 70)

        status_configs = [
            (InspectionStatus.PENDING_REVIEW, supervisor, ["view", "approve", "reject", "report_fault"]),
            (InspectionStatus.PENDING_FAULT_REPORT, supervisor, ["view", "submit_fault_report"]),
            (InspectionStatus.FAULT_REPORTED, supervisor, ["view", "mark_repair_start"]),
            (InspectionStatus.PENDING_REPAIR, supervisor, ["view", "mark_repair_complete"]),
            (InspectionStatus.REPAIR_COMPLETED, supervisor, ["view", "submit_acceptance"]),
            (InspectionStatus.PENDING_ACCEPTANCE, supervisor, ["view", "acceptance_pass", "acceptance_reject"]),
            (InspectionStatus.PENDING_FINAL_REVIEW, users['reviewer'], ["view", "archive", "final_reject"]),
        ]

        all_ok = True
        for status, user, expected_actions in status_configs:
            mock = MockOrder(status, registrar.id)
            can_operate, actions = get_allowed_actions(mock, user)
            ok = set(actions) == set(expected_actions)
            status_str = "✅" if ok else "❌"
            if not ok:
                all_ok = False
            print(f"  {status_str} {user.full_name} - {status.value}:")
            print(f"    实际: {actions}")
            print(f"    预期: {expected_actions}")

        print(f"\n  权限矩阵验证: {'全部通过 ✅' if all_ok else '存在错误 ❌'}")

        # 3. 验证统计数据
        print("\n\n📊 3. 统计数据验证")
        print("-" * 70)

        for username, user in users.items():
            stats = await get_statistics(session, user)
            print(f"  👤 {user.full_name}:")
            print(f"    my_todo: {stats['my_todo']}")
            print(f"    my_created: {stats['my_created']}")
            print(f"    all: {stats['all']}")

        # 4. 验证审计日志的新字段
        print("\n\n📝 4. 审计日志字段验证")
        print("-" * 70)

        result = await session.execute(
            select(AuditLog).order_by(AuditLog.created_at.desc()).limit(15)
        )
        logs = result.scalars().all()

        print(f"  最新 {len(logs)} 条审计日志:")
        field_count = {"opinion": 0, "signature": 0, "error_code": 0, "error_message": 0, "suggestion": 0, "next_step": 0}
        for log in logs:
            print(f"\n    [{log.action.value}] {log.operator_name} - {log.from_status or '-'} → {log.to_status or '-'}")
            if log.detail:
                print(f"      detail: {log.detail[:50]}...")
            if log.opinion:
                field_count["opinion"] += 1
                print(f"      opinion: {log.opinion[:40]}...")
            if log.signature:
                field_count["signature"] += 1
                print(f"      signature: {log.signature}")
            if log.error_code:
                field_count["error_code"] += 1
                print(f"      error_code: {log.error_code}")
            if log.error_message:
                field_count["error_message"] += 1
                print(f"      error_message: {log.error_message}")
            if log.suggestion:
                field_count["suggestion"] += 1
                print(f"      suggestion: {log.suggestion}")
            if log.next_step:
                field_count["next_step"] += 1
                print(f"      next_step: {log.next_step}")

        print(f"\n  字段统计:")
        for k, v in field_count.items():
            print(f"    {k}: {v} 条有值")

        # 5. 验证巡检单的签名和意见字段
        print("\n\n📋 5. 巡检单签名/意见字段验证")
        print("-" * 70)

        sample_statuses = [
            InspectionStatus.PENDING_FINAL_REVIEW,
            InspectionStatus.REVIEW_REJECTED,
            InspectionStatus.ARCHIVED,
            InspectionStatus.FINAL_REVIEW_REJECTED,
            InspectionStatus.ACCEPTANCE_REJECTED,
        ]

        for target_status in sample_statuses:
            result = await session.execute(
                select(InspectionOrder).where(InspectionOrder.status == target_status).limit(1)
            )
            order = result.scalars().first()
            if order:
                print(f"\n  状态: {target_status.value}")
                print(f"    单号: {order.order_no}")
                if order.registrar_signature:
                    print(f"    registrar_signature: {order.registrar_signature}")
                if order.supervisor_opinion:
                    print(f"    supervisor_opinion: {order.supervisor_opinion[:40]}...")
                if order.supervisor_signature:
                    print(f"    supervisor_signature: {order.supervisor_signature}")
                if order.reviewer_opinion:
                    print(f"    reviewer_opinion: {order.reviewer_opinion[:40]}...")
                if order.reviewer_signature:
                    print(f"    reviewer_signature: {order.reviewer_signature}")

        print("\n" + "=" * 70)
        print("✅ 全部验证完成")
        print("=" * 70)

asyncio.run(verify())
