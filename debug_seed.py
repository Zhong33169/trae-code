import sys
sys.path.insert(0, 'backend')
from app.services.seed_service import seed_data, reset_and_seed
from app.models.db_config import SessionLocal

print('Resetting and seeding...')
reset_and_seed()
print('Done!')

db = SessionLocal()
from app.models.database import TransportOrder
orders = db.query(TransportOrder).order_by(TransportOrder.id).all()
print(f'\nTotal orders: {len(orders)}')
for o in orders:
    print(f'  {o.order_no} - {o.status.value} - v{o.version} - {o.customer}')
db.close()
