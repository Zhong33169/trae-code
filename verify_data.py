import sys
sys.path.insert(0, 'backend')

from app.models.database import (
    User, TransportOrder, OrderStatus, EvidenceType,
    AuditLog, BatchChange, BatchItem
)
from app.services.order_service import OrderService, OrderValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine('sqlite:///backend/transport.db')
Session = sessionmaker(bind=engine)
db = Session()

print("="*70)
print("📊 最终数据验证")
print("="*70)

orders = db.query(TransportOrder).order_by(TransportOrder.id).all()
print(f"\n订单总数: {len(orders)}")

status_map = {}
for o in orders:
    s = o.status.value
    if s not in status_map:
        status_map[s] = []
    status_map[s].append(o)

for status, os in sorted(status_map.items()):
    print(f"\n  【{status}】 ({len(os)} 个)")
    for o in os:
        reject_info = f" - 驳回原因: {o.rejected_reason}" if o.rejected_reason else ""
        print(f"    - {o.order_no} | {o.customer} | v{o.version}{reject_info}")

audit_count = db.query(AuditLog).count()
print(f"\n审计记录总数: {audit_count}")

batch_count = db.query(BatchChange).count()
print(f"批次总数: {batch_count}")
batches = db.query(BatchChange).all()
for b in batches:
    items = db.query(BatchItem).filter(BatchItem.batch_id == b.id).all()
    print(f"\n  【{b.batch_no}】 {b.status.value}")
    print(f"     成功{b.success_count}/失败{b.failed_count}/共{b.total_count}")
    for item in items:
        fail_info = f" - 失败: {item.failure_reason}" if item.failure_reason else ""
        print(f"       - {item.status.value:10s} | {item.order_no}{fail_info}")

print("\n" + "="*70)
print("🔍 关键场景验证")
print("="*70)

delivered = status_map.get('delivered', [])
print(f"\n  已签收订单数: {len(delivered)}")
if delivered:
    print(f"    用于演示【复核岗双按钮】：{delivered[0].customer} ({delivered[0].order_no})")

rejected = status_map.get('rejected', [])
print(f"\n  驳回状态订单数: {len(rejected)}")
for o in rejected:
    print(f"    - {o.customer}: {o.rejected_reason}")

recent_audits = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(10).all()
print(f"\n  最近10条审计记录（验证驳回/重试/证据上传/信息修改都有记录）:")
for a in recent_audits:
    status_part = f" {a.old_status or '-'}→{a.new_status or '-'}" if a.old_status or a.new_status else ""
    fail_part = f" 失败" if a.failure_reason else ""
    batch_part = f" 批次" if a.batch_no else ""
    print(f"    [{a.id:3d}] {a.action:20s} by {a.username:8s}{status_part}{fail_part}{batch_part}")

print("\n" + "="*70)
print("✅ 验证完成！")
print("="*70)

db.close()
