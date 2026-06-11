import sys
sys.path.insert(0, 'backend')

from app.models.database import (
    Base, User, TransportOrder, OrderStatus, EvidenceType,
    AuditLog, BatchChange, BatchItem, BatchStatus
)
from app.services.order_service import OrderService, OrderValidationError
from app.services.batch_service import BatchService
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine('sqlite:///backend/transport.db')
Session = sessionmaker(bind=engine)
db = Session()

print("="*70)
print("📊 数据概览")
print("="*70)

users = db.query(User).all()
print(f"用户数: {len(users)}")
u_initiator = [u for u in users if u.role.value == 'initiator'][0]
u_handler = [u for u in users if u.role.value == 'handler'][0]
u_reviewer = [u for u in users if u.role.value == 'reviewer'][0]
print(f"  发起岗: {u_initiator.display_name}")
print(f"  办理岗: {u_handler.display_name}")
print(f"  复核岗: {u_reviewer.display_name}")

orders = db.query(TransportOrder).order_by(TransportOrder.id).all()
print(f"\n订单总数: {len(orders)}")
for o in orders:
    ev_count = len(o.evidences)
    print(f"  {o.order_no} - {o.status.value:12s} v{o.version:2d} - {o.customer:10s} - 证据{ev_count}个")

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
    items = db.query(BatchItem).filter(BatchItem.batch_id == b.id).all()
    print(f"  {b.batch_no} - {b.status.value:15s} - 成功{b.success_count}/失败{b.failed_count}/共{b.total_count}")

print("\n" + "="*70)
print("🔍 测试1：证据上传 - 角色权限校验")
print("="*70)

draft_order = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.DRAFT).first()
print(f"\n测试订单: {draft_order.order_no} (状态: {draft_order.status.value})")

print("\n  [1.1] 办理岗上传运输委托单 → 应失败（角色错误）")
try:
    OrderService.add_evidence(db, draft_order.id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "test.pdf",
        "file_ref": "/test.pdf"
    }, u_handler)
    print("    ❌ 失败：未被拦截")
except OrderValidationError as e:
    print(f"    ✅ 成功拦截：[{e.code}]")
    print(f"       {e.message}")

print("\n  [1.2] 发起岗上传车辆调度单 → 应失败（角色错误）")
try:
    OrderService.add_evidence(db, draft_order.id, {
        "evidence_type": EvidenceType.DISPATCH,
        "file_name": "test.pdf",
        "file_ref": "/test.pdf"
    }, u_initiator)
    print("    ❌ 失败：未被拦截")
except OrderValidationError as e:
    print(f"    ✅ 成功拦截：[{e.code}]")
    print(f"       {e.message}")

print("\n" + "="*70)
print("🔍 测试2：证据上传 - 状态校验")
print("="*70)

entrusted_order = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.ENTRUSTED).first()
print(f"\n测试订单: {entrusted_order.order_no} (状态: {entrusted_order.status.value})")

print("\n  [2.1] 发起岗在已委托状态上传签收回单 → 应失败（角色+状态都不对）")
try:
    OrderService.add_evidence(db, entrusted_order.id, {
        "evidence_type": EvidenceType.RECEIPT,
        "file_name": "test.pdf",
        "file_ref": "/test.pdf"
    }, u_initiator)
    print("    ❌ 失败：未被拦截")
except OrderValidationError as e:
    print(f"    ✅ 成功拦截：[{e.code}]")
    print(f"       {e.message}")

print("\n  [2.2] 办理岗在已委托状态上传运输委托单 → 应失败（角色错误）")
try:
    OrderService.add_evidence(db, entrusted_order.id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "test.pdf",
        "file_ref": "/test.pdf"
    }, u_handler)
    print("    ❌ 失败：未被拦截")
except OrderValidationError as e:
    print(f"    ✅ 成功拦截：[{e.code}]")
    print(f"       {e.message}")

print("\n" + "="*70)
print("🔍 测试3：信息修改 - 角色/状态校验")
print("="*70)

print(f"\n测试订单: {entrusted_order.order_no} (状态: {entrusted_order.status.value})")

print("\n  [3.1] 发起岗在已委托状态修改车牌号 → 应失败（状态不允许）")
try:
    OrderService.update_order_info(db, entrusted_order.id, {"plate_number": "测试001"}, u_initiator)
    print("    ❌ 失败：未被拦截")
except OrderValidationError as e:
    print(f"    ✅ 成功拦截：[{e.code}]")
    print(f"       {e.message}")

print("\n  [3.2] 办理岗在已委托状态修改车牌号 → 应成功")
old_plate = entrusted_order.plate_number
old_ver = entrusted_order.version
result = OrderService.update_order_info(db, entrusted_order.id, {"plate_number": "京A测试001"}, u_handler)
db.refresh(entrusted_order)
print(f"    ✅ 成功: {old_plate} → {entrusted_order.plate_number}")
print(f"       版本: v{old_ver} → v{entrusted_order.version}")

print("\n  [3.3] 办理岗在已委托状态修改签收人 → 应失败（状态不允许）")
try:
    OrderService.update_order_info(db, entrusted_order.id, {"receiver": "测试签收人"}, u_handler)
    print("    ❌ 失败：未被拦截")
except OrderValidationError as e:
    print(f"    ✅ 成功拦截：[{e.code}]")
    print(f"       {e.message}")

in_transit_order = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.IN_TRANSIT).first()
print(f"\n测试订单: {in_transit_order.order_no} (状态: {in_transit_order.status.value})")

print("\n  [3.4] 办理岗在运输中状态修改签收人 → 应成功")
old_receiver = in_transit_order.receiver
old_ver2 = in_transit_order.version
result = OrderService.update_order_info(db, in_transit_order.id, {"receiver": "测试签收人王经理"}, u_handler)
db.refresh(in_transit_order)
print(f"    ✅ 成功: {old_receiver} → {in_transit_order.receiver}")
print(f"       版本: v{old_ver2} → v{in_transit_order.version}")

print("\n" + "="*70)
print("🔍 测试4：复核岗驳回已签收订单")
print("="*70)

delivered_orders = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.DELIVERED).all()
print(f"\n已签收订单数: {len(delivered_orders)}")

if delivered_orders:
    test_order = delivered_orders[0]
    print(f"测试订单: {test_order.order_no} (状态: {test_order.status.value}, 版本: v{test_order.version})")
    
    old_status = test_order.status.value
    old_ver = test_order.version
    reject_reason = "签收单信息不完整，请补充签收人联系方式"
    
    print(f"\n  [4.1] 复核岗驳回已签收订单 → 应成功")
    result = OrderService.transition_order(db, test_order.id, OrderStatus.REJECTED, u_reviewer, test_order.version, reject_reason)
    db.refresh(test_order)
    print(f"    ✅ 驳回成功: {old_status} → {test_order.status.value}")
    print(f"       版本: v{old_ver} → v{test_order.version}")
    print(f"       驳回原因: {test_order.rejected_reason}")
    
    print(f"\n  [4.2] 驳回后办理岗重新提交 → 应成功")
    old_status2 = test_order.status.value
    old_ver2 = test_order.version
    result2 = OrderService.transition_order(db, test_order.id, OrderStatus.ENTRUSTED, u_handler, test_order.version)
    db.refresh(test_order)
    print(f"    ✅ 重新提交成功: {old_status2} → {test_order.status.value}")
    print(f"       版本: v{old_ver2} → v{test_order.version}")
else:
    print("  ⚠️  没有已签收的订单，跳过驳回测试")

print("\n" + "="*70)
print("🔍 测试5：审计日志验证")
print("="*70)

recent_audits = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(15).all()
print(f"\n最近15条审计记录：")
for a in recent_audits:
    status_part = f" {a.old_status or '-'}→{a.new_status or '-'}" if a.old_status or a.new_status else ""
    fail_part = f" 失败原因: {a.failure_reason}" if a.failure_reason else ""
    batch_part = f" 批次: {a.batch_no}" if a.batch_no else ""
    detail_part = f" - {a.detail}" if a.detail else ""
    print(f"  [{a.id:3d}] {a.action:20s} by {a.username:10s}{status_part}{detail_part}{batch_part}{fail_part}")

print("\n" + "="*70)
print("🔍 测试6：批量操作验证")
print("="*70)

batch2 = db.query(BatchChange).filter(BatchChange.status == BatchStatus.ALL_FAILED).first()
if batch2:
    print(f"\n批量失败批次: {batch2.batch_no}")
    items = db.query(BatchItem).filter(BatchItem.batch_id == batch2.id).all()
    print(f"  包含 {len(items)} 个订单项")
    
    failed_items = [i for i in items if i.status.value == 'failed']
    print(f"  失败项: {len(failed_items)} 个")
    
    if len(failed_items) >= 1:
        print(f"\n  [6.1] 重试失败的订单项（部分仍可能失败）")
        failed_ids = [i.order_id for i in failed_items[:2]]
        print(f"       重试订单ID: {failed_ids}")
        
        from app.services.batch_service import BatchService
        retry_batch = BatchService.retry_batch(db, batch2.id, failed_ids, u_reviewer)
        db.refresh(retry_batch)
        print(f"       新批次: {retry_batch.batch_no}")
        print(f"       结果: 成功{retry_batch.success_count}/失败{retry_batch.failed_count}/共{retry_batch.total_count}")
        
        retry_items = db.query(BatchItem).filter(BatchItem.batch_id == retry_batch.id).all()
        for item in retry_items:
            fail_reason = f" - 失败: {item.failure_reason}" if item.failure_reason else ""
            print(f"         - {item.order_no}: {item.status.value}{fail_reason}")

print("\n" + "="*70)
print("✅ 所有测试完成！")
print("="*70)

db.close()
