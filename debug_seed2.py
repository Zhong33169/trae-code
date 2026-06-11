import sys
sys.path.insert(0, 'backend')
from app.models.database import TransportOrder, OrderEvidence, User, RoleEnum, OrderStatus, EvidenceType
from app.services.seed_service import _get_user, _add_evidence, SAMPLE_ORDERS, DEMO_USERS
from app.services.order_service import OrderService, OrderValidationError
from app.models.db_config import SessionLocal, init_db
import traceback

init_db()
db = SessionLocal()

db.query(OrderEvidence).delete()
db.query(TransportOrder).delete()
db.query(User).delete()
db.commit()

for u in DEMO_USERS:
    user = User(**u)
    db.add(user)
db.commit()

u_initiator = _get_user(db, "fqr")
u_handler = _get_user(db, "bl")
u_reviewer = _get_user(db, "fhr")
print(f"Users: {u_initiator.username}, {u_handler.username}, {u_reviewer.username}")

orders = []
for i, so in enumerate(SAMPLE_ORDERS[:3]):
    order = OrderService.create_order(db, so, u_initiator)
    orders.append(order)
    print(f"Created order {i}: {order.order_no} - {order.status.value} - v{order.version}")

print("\n--- Processing order 1 (should become entrusted) ---")
try:
    _add_evidence(db, orders[1], EvidenceType.ENTRUSTMENT, "测试委托单.pdf", u_initiator)
    print(f"  Evidence added via append. evidences count on obj: {len(orders[1].evidences)}")

    order_check = db.query(TransportOrder).filter(TransportOrder.id == orders[1].id).first()
    print(f"  Re-query evidences count: {len(order_check.evidences)}")
    for ev in order_check.evidences:
        print(f"    - {ev.evidence_type.value}: {ev.file_name}")

    result = OrderService.transition_order(db, orders[1].id, OrderStatus.ENTRUSTED, u_initiator, 1, "测试")
    print(f"  Transition result: {result.status.value} v{result.version}")
except OrderValidationError as e:
    print(f"  ERROR [{e.code}] {e.message}")
except Exception as e:
    print(f"  UNEXPECTED ERROR: {e}")
    traceback.print_exc()

db.close()
