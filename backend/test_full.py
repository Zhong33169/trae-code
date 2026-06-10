import asyncio
from database import async_session
from models.user import User, UserRole
from models.inspection import InspectionOrder, InspectionStatus
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload
from models.qr_record import QRCodeRecord
from routers.inspection import (
    get_allowed_actions,
    build_inspection_response,
    get_statistics,
    get_role_queues,
)

async def test():
    async with async_session() as session:
        print("=" * 60)
        print("测试 1: get_role_queues")
        print("=" * 60)
        for role in [UserRole.REGISTRAR, UserRole.SUPERVISOR, UserRole.REVIEWER]:
            queues = get_role_queues(role)
            print(f"  {role.value}: {[q.value for q in queues]}")

        print("\n" + "=" * 60)
        print("测试 2: get_statistics")
        print("=" * 60)
        for username in ["registrar", "supervisor", "reviewer"]:
            user_result = await session.execute(
                select(User).where(User.username == username)
            )
            user = user_result.scalars().first()
            stats = await get_statistics(session, user)
            print(f"  {username} ({user.role_label}):")
            print(f"    my_todo: {stats['my_todo']}")
            print(f"    my_created: {stats['my_created']}")
            print(f"    all: {stats['all']}")

        print("\n" + "=" * 60)
        print("测试 3: get_allowed_actions")
        print("=" * 60)
        statuses = [
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
        
        for username in ["registrar", "supervisor", "reviewer"]:
            user_result = await session.execute(
                select(User).where(User.username == username)
            )
            user = user_result.scalars().first()
            print(f"\n  {username} ({user.role_label}):")
            
            for status in statuses:
                mock_order = InspectionOrder(status=status, created_by=user.id)
                can_operate, actions = get_allowed_actions(mock_order, user)
                if can_operate:
                    print(f"    {status.value}: {actions} (can_operate={can_operate})")

        print("\n" + "=" * 60)
        print("测试 4: build_inspection_response")
        print("=" * 60)
        user_result = await session.execute(
            select(User).where(User.username == "supervisor")
        )
        user = user_result.scalars().first()
        
        query = select(InspectionOrder).options(
            joinedload(InspectionOrder.charging_pile),
        ).where(InspectionOrder.status == InspectionStatus.PENDING_REVIEW).limit(1)
        result = await session.execute(query)
        order = result.scalars().first()
        
        if order:
            response = build_inspection_response(order, user)
            print(f"  订单: {response.order_no}")
            print(f"  状态: {response.status_label}")
            print(f"  可操作: {response.can_operate}")
            print(f"  允许的动作: {response.allowed_actions}")

        print("\n" + "=" * 60)
        print("所有测试完成!")
        print("=" * 60)

asyncio.run(test())
