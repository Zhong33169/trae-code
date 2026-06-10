import asyncio
from database import async_session
from models.user import User
from models.inspection import InspectionOrder
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from routers.inspection import build_inspection_response, get_statistics

async def test():
    async with async_session() as session:
        user_result = await session.execute(select(User).where(User.username == 'registrar'))
        user = user_result.scalars().first()
        print(f'User: {user.username}, role: {user.role}')
        
        query = select(InspectionOrder).options(joinedload(InspectionOrder.charging_pile)).limit(1)
        result = await session.execute(query)
        order = result.scalars().first()
        
        if order:
            print(f'Order: {order.order_no}, status: {order.status}')
            print(f'Charging pile type: {type(order.charging_pile)}')
            try:
                response = build_inspection_response(order, user)
                print(f'Response OK, allowed_actions: {response.allowed_actions}')
                print(f'can_operate: {response.can_operate}')
            except Exception as e:
                print(f'Error building response: {e}')
                import traceback
                traceback.print_exc()
        
        print("\n--- Testing statistics ---")
        try:
            stats = await get_statistics(session, user)
            print(f'Statistics OK: {stats}')
        except Exception as e:
            print(f'Error getting statistics: {e}')
            import traceback
            traceback.print_exc()

asyncio.run(test())
