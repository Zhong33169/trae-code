import asyncio
from database import async_session
from models.user import User
from models.inspection import InspectionOrder
from models.qr_record import QRCodeRecord
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload
from routers.inspection import build_inspection_response
from schemas.inspection import InspectionOrderWithDetails

async def test():
    async with async_session() as session:
        user_result = await session.execute(select(User).where(User.username == 'supervisor'))
        user = user_result.scalars().first()
        print(f'User: {user.username}')
        
        query = select(InspectionOrder).options(
            joinedload(InspectionOrder.charging_pile),
            selectinload(InspectionOrder.qr_records).joinedload(QRCodeRecord.scanner),
            joinedload(InspectionOrder.fault_report),
            joinedload(InspectionOrder.repair_acceptance),
        ).where(InspectionOrder.id == 2)
        result = await session.execute(query)
        order = result.scalars().first()
        
        if order:
            print(f'Order: {order.order_no}')
            print(f'QR records: {order.qr_records}')
            print(f'Fault report: {order.fault_report}')
            print(f'Repair acceptance: {order.repair_acceptance}')
            
            try:
                base = build_inspection_response(order, user)
                print('Base response OK')
                
                detail = InspectionOrderWithDetails(
                    **base.model_dump(),
                    qr_records=order.qr_records,
                    fault_report=order.fault_report,
                    repair_acceptance=order.repair_acceptance,
                )
                print('Detail response OK')
                print(f'Allowed actions: {detail.allowed_actions}')
            except Exception as e:
                print(f'Error: {e}')
                import traceback
                traceback.print_exc()

asyncio.run(test())
