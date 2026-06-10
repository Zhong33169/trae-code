import asyncio
from database import async_session
from models.user import User, UserRole
from models.inspection import InspectionOrder, InspectionStatus
from models.audit_log import AuditLog
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload
from models.qr_record import QRCodeRecord
from routers.inspection import build_inspection_response, get_statistics, get_allowed_actions

async def verify_consistency():
    print("=" * 70)
    print("设备巡检单办理链路 - 数据一致性验证")
    print("=" * 70)

    async with async_session() as session:
        # 1. 获取三个用户
        users = {}
        for username in ["registrar", "supervisor", "reviewer"]:
            result = await session.execute(
                select(User).where(User.username == username)
            )
            users[username] = result.scalars().first()

        print("\n📊 统计数据验证")
        print("-" * 70)

        for username, user in users.items():
            stats = await get_statistics(session, user)
            print(f"\n  👤 {user.full_name} ({user.role_label})")
            print(f"     my_todo: {stats['my_todo']}")
            print(f"     my_created: {stats['my_created']}")
            print(f"     all: {stats['all']}")

        # 2. 验证各角色的 allowed_actions
        print("\n\n🔐 权限与动作验证")
        print("-" * 70)

        statuses_to_test = [
            InspectionStatus.DRAFT,
            InspectionStatus.PENDING_REVIEW,
            InspectionStatus.REVIEW_REJECTED,
            InspectionStatus.PENDING_FAULT_REPORT,
            InspectionStatus.FAULT_REPORTED,
            InspectionStatus.PENDING_REPAIR,
            InspectionStatus.REPAIR_COMPLETED,
            InspectionStatus.PENDING_ACCEPTANCE,
            InspectionStatus.ACCEPTANCE_REJECTED,
            InspectionStatus.PENDING_FINAL_REVIEW,
            InspectionStatus.FINAL_REVIEW_REJECTED,
            InspectionStatus.ARCHIVED,
        ]

        for username, user in users.items():
            print(f"\n  👤 {user.full_name} ({user.role_label}):")
            for status in statuses_to_test:
                mock_order = InspectionOrder(status=status, created_by=users['registrar'].id)
                can_operate, actions = get_allowed_actions(mock_order, user)
                if can_operate:
                    print(f"    ✅ {status.value}: {actions}")

        # 3. 验证实际数据的一致性
        print("\n\n📋 实际数据验证")
        print("-" * 70)

        for username, user in users.items():
            print(f"\n  👤 {user.full_name} - my_todo 列表:")
            from routers.inspection import get_role_queues
            role_queues = get_role_queues(user.role)

            query = select(InspectionOrder).options(
                joinedload(InspectionOrder.charging_pile),
            ).where(InspectionOrder.status.in_(role_queues))

            if user.role == UserRole.REGISTRAR:
                query = query.where(InspectionOrder.created_by == user.id)

            query = query.order_by(InspectionOrder.created_at.desc())
            result = await session.execute(query)
            orders = result.scalars().all()

            stats = await get_statistics(session, user)
            print(f"    统计 my_todo: {stats['my_todo']}, 实际查询: {len(orders)}")

            if len(orders) > 0:
                order = orders[0]
                response = build_inspection_response(order, user)
                print(f"    第一条: {order.order_no} ({order.status.value})")
                print(f"      can_operate: {response.can_operate}")
                print(f"      allowed_actions: {response.allowed_actions}")

        # 4. 验证审计日志
        print("\n\n📝 审计日志验证")
        print("-" * 70)

        result = await session.execute(
            select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10)
        )
        logs = result.scalars().all()
        print(f"\n  最新 10 条审计日志 (共 {len(logs)} 条):")
        for log in logs:
            status_info = f"{log.from_status or '-'} → {log.to_status or '-'}"
            print(f"    [{log.action.value}] {log.operator_name} - {status_info}")
            print(f"      {log.detail[:60]}")

        # 5. 验证登记员只能看到自己的单
        print("\n\n🔒 权限边界验证")
        print("-" * 70)

        # 模拟登记员操作别人的单
        other_user_order = None
        result = await session.execute(
            select(InspectionOrder).where(InspectionOrder.created_by != users['registrar'].id).limit(1)
        )
        other_order = result.scalars().first()

        if other_order:
            can_operate, actions = get_allowed_actions(other_order, users['registrar'])
            print(f"\n  登记员操作非本人单据:")
            print(f"    单据: {other_order.order_no} (创建人ID: {other_order.created_by})")
            print(f"    can_operate: {can_operate}")
            print(f"    allowed_actions: {actions}")
        else:
            # 所有单都是登记员创建的，验证一下
            result = await session.execute(select(InspectionOrder))
            all_orders = result.scalars().all()
            all_same_creator = all(o.created_by == users['registrar'].id for o in all_orders)
            print(f"\n  所有 {len(all_orders)} 条巡检单都是登记员创建的: {all_same_creator}")

        print("\n" + "=" * 70)
        print("✅ 验证完成")
        print("=" * 70)

if __name__ == "__main__":
    asyncio.run(verify_consistency())
