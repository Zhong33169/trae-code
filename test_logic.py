import sys
sys.path.insert(0, 'backend')

from app.models.database import (
    Base, User, TransportOrder, OrderStatus, EvidenceType,
    AuditLog, BatchChange, BatchItem
)
from app.services.order_service import OrderService, OrderValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine('sqlite:///backend/transport.db')
Session = sessionmaker(bind=engine)
db = Session()

users = db.query(User).all()
print(f"用户数: {len(users)}")
for u in users:
    print(f"  {u.id} - {u.username} ({u.role})")

orders = db.query(TransportOrder).order_by(TransportOrder.id).all()
print(f"\n订单总数: {len(orders)}")
for o in orders:
    print(f"  {o.order_no} - {o.status.value} - v{o.version} - {o.customer}")

status_counts = {}
for o in orders:
    s = o.status.value
    status_counts[s] = status_counts.get(s, 0) + 1
print(f"\n状态分布: {status_counts}")

audit_count = db.query(AuditLog).count()
print(f"\n审计记录总数: {audit_count}")

batch_count = db.query(BatchChange).count()
print(f"批次总数: {batch_count}")
batches = db.query(BatchChange).all()
for b in batches:
    print(f"  {b.batch_no} - {b.status.value} - 成功{b.success_count}/失败{b.failed_count}/共{b.total_count}")

u_initiator = db.query(User).filter(User.role == 'initiator').first()
u_handler = db.query(User).filter(User.role == 'handler').first()
u_reviewer = db.query(User).filter(User.role == 'reviewer').first()

print("\n" + "="*60)
print("[测试1] 办理岗上传委托单证据（应失败：角色错误）")
try:
    draft = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.DRAFT).first()
    ev = OrderService.add_evidence(db, draft.id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "test.pdf",
        "file_ref": "/test.pdf"
    }, u_handler)
    print("  ❌ 失败：居然成功了！")
except OrderValidationError as e:
    print(f"  ✅ 成功拦截：[{e.code}] {e.message}")

print("\n[测试2] 发起岗上传调度单证据（应失败：角色错误）")
try:
    entrusted = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.ENTRUSTED).first()
    ev = OrderService.add_evidence(db, entrusted.id, {
        "evidence_type": EvidenceType.DISPATCH,
        "file_name": "test.pdf",
        "file_ref": "/test.pdf"
    }, u_initiator)
    print("  ❌ 失败：居然成功了！")
except OrderValidationError as e:
    print(f"  ✅ 成功拦截：[{e.code}] {e.message}")

print("\n[测试3] 发起岗在已委托状态修改车牌（应失败：状态不允许）")
try:
    entrusted = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.ENTRUSTED).first()
    old_ver = entrusted.version
    OrderService.update_order_info(db, entrusted.id, {"plate_number": "测试123"}, u_initiator)
    print("  ❌ 失败：居然成功了！")
except OrderValidationError as e:
    print(f"  ✅ 成功拦截：[{e.code}] {e.message}")

print("\n[测试4] 办理岗在已委托状态修改车牌（应成功）")
entrusted = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.ENTRUSTED).first()
old_plate = entrusted.plate_number
old_ver = entrusted.version
result = OrderService.update_order_info(db, entrusted.id, {"plate_number": "京A测试001"}, u_handler)
db.refresh(entrusted)
print(f"  ✅ 成功：{old_plate} → {entrusted.plate_number}，版本 v{old_ver} → v{entrusted.version}")

print("\n[测试5] 办理岗在已委托状态修改签收人（应失败：状态不允许）")
try:
    entrusted2 = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.ENTRUSTED).first()
    OrderService.update_order_info(db, entrusted2.id, {"receiver": "测试签收人"}, u_handler)
    print("  ❌ 失败：居然成功了！")
except OrderValidationError as e:
    print(f"  ✅ 成功拦截：[{e.code}] {e.message}")

print("\n[测试6] 驳回已签收订单（复核岗操作）")
delivered = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.DELIVERED).first()
if delivered:
    old_status = delivered.status.value
    old_ver = delivered.version
    result = OrderService.transition_order(db, delivered.id, OrderStatus.REJECTED, u_reviewer, delivered.version, "信息有误，请重新核对")
    db.refresh(delivered)
    print(f"  ✅ 驳回成功：{old_status} → {delivered.status.value}，版本 v{old_ver} → v{delivered.version}")
else:
    print("  ⚠️  没有已签收的订单可测试")

rejected_after_delivery = db.query(TransportOrder).filter(
    TransportOrder.status == OrderStatus.REJECTED
).all()
print(f"\n驳回状态订单数: {len(rejected_after_delivery)}")

print("\n[测试7] 查看审计记录（证据上传/信息修改/驳回）")
recent_audits = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(10).all()
for a in recent_audits:
    fr = f"，失败原因: {a.failure_reason}" if a.failure_reason else ""
    op_name = a.username or "?"
    detail = f" - {a.detail}" if a.detail else ""
    print(f"  [{a.id}] {a.action} - {a.old_status or '-'}→{a.new_status or '-'} - by {op_name}{detail}{fr}")

db.close()
print("\n" + "="*60)
print("测试完成！")
