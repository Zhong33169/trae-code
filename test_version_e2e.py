import sys
sys.path.insert(0, 'backend')

from app.models.database import (
    User, TransportOrder, OrderStatus, EvidenceType,
    AuditLog, BatchChange, BatchItem, BatchStatus, BatchItemStatus, RoleEnum
)
from app.services.order_service import OrderService, OrderValidationError
from app.services.batch_service import BatchService
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine('sqlite:///backend/transport.db')
Session = sessionmaker(bind=engine)
db = Session()

users = db.query(User).all()
u_initiator = [u for u in users if u.role == RoleEnum.INITIATOR][0]
u_handler = [u for u in users if u.role == RoleEnum.HANDLER][0]
u_reviewer = [u for u in users if u.role == RoleEnum.REVIEWER][0]

print("=" * 70)
print("📊 证据上传和批量重试版本一致性闭环验证")
print("=" * 70)

# ============================================================
# 测试1：证据上传版本冲突
# ============================================================
print("\n🔍 测试1：证据上传 expected_version 版本校验")
draft_order = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.DRAFT).first()
current_version = draft_order.version
print(f"  草稿订单 {draft_order.order_no} 当前版本: v{current_version}")

print(f"  [1.1] 传正确版本 v{current_version} → 应成功")
evidence = OrderService.add_evidence(db, draft_order.id, {
    "evidence_type": EvidenceType.ENTRUSTMENT,
    "file_name": "版本测试委托单.pdf",
    "file_ref": "/test/version_ok.pdf",
}, u_initiator, expected_version=current_version)
db.refresh(draft_order)
print(f"    ✅ 成功，版本 v{current_version} → v{draft_order.version}")

print(f"  [1.2] 传旧版本 v{current_version} → 应失败（版本冲突）")
try:
    OrderService.add_evidence(db, draft_order.id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "版本冲突测试.pdf",
        "file_ref": "/test/version_conflict.pdf",
    }, u_initiator, expected_version=current_version)
    print("    ❌ 居然成功了！")
except OrderValidationError as e:
    print(f"    ✅ 拦截成功：[{e.code}]")
    print(f"       {e.message}")

print(f"  [1.3] 不传 expected_version（默认 None）→ 应跳过版本校验")
try:
    OrderService.add_evidence(db, draft_order.id, {
        "evidence_type": EvidenceType.ENTRUSTMENT,
        "file_name": "无版本校验测试.pdf",
        "file_ref": "/test/no_version.pdf",
    }, u_initiator)
    db.refresh(draft_order)
    print(f"    ✅ 成功（跳过版本校验），版本 v{draft_order.version}")
except OrderValidationError as e:
    print(f"    ❌ 不应该失败：{e.message}")

# ============================================================
# 测试2：批量重试版本冲突
# ============================================================
print("\n🔍 测试2：批量重试 expected_versions 版本校验")

batch_with_failures = db.query(BatchChange).filter(
    BatchChange.failed_count > 0
).first()
if batch_with_failures:
    failed_item = db.query(BatchItem).filter(
        BatchItem.batch_id == batch_with_failures.id,
        BatchItem.status == BatchItemStatus.FAILED
    ).first()
    if failed_item:
        order = db.query(TransportOrder).filter(TransportOrder.id == failed_item.order_id).first()
        current_ver = order.version
        print(f"  失败项订单 {order.order_no} 当前版本: v{current_ver}")

        print(f"  [2.1] 传正确版本 → 应正常执行（虽然可能仍因状态/证据失败）")
        batch_result = BatchService.retry_failed_items(
            db, batch_with_failures.id, [failed_item.id], u_handler,
            "版本校验测试",
            expected_versions={str(order.id): current_ver}
        )
        db.refresh(failed_item)
        print(f"    ✅ 执行完成，状态: {failed_item.status.value}")

        # 重新获取失败项
        failed_item2 = db.query(BatchItem).filter(
            BatchItem.batch_id == batch_with_failures.id,
            BatchItem.status == BatchItemStatus.FAILED
        ).first()
        if failed_item2:
            order2 = db.query(TransportOrder).filter(TransportOrder.id == failed_item2.order_id).first()
            current_ver2 = order2.version
            fake_version = current_ver2 - 5

            print(f"  [2.2] 传旧版本 v{fake_version} → 应失败（版本冲突）")
            batch_result2 = BatchService.retry_failed_items(
                db, batch_with_failures.id, [failed_item2.id], u_handler,
                "版本冲突测试",
                expected_versions={str(order2.id): fake_version}
            )
            db.refresh(failed_item2)
            if failed_item2.status == BatchItemStatus.FAILED and 'VERSION_CONFLICT' in (failed_item2.error_message or ''):
                print(f"    ✅ 版本冲突拦截成功")
                print(f"       错误: {failed_item2.error_message}")
            else:
                print(f"    ⚠️  结果: {failed_item2.status.value} - {failed_item2.error_message}")
else:
    print("  ⚠️  没有含失败项的批次")

# ============================================================
# 测试3：审计日志版本追踪验证
# ============================================================
print("\n🔍 测试3：审计日志版本追踪完整验证")

version_logs = db.query(AuditLog).filter(
    AuditLog.old_version.isnot(None)
).order_by(AuditLog.id.desc()).limit(10).all()
print(f"\n  最近10条含版本信息的审计:")
for log in version_logs:
    rm = f" 📝{log.remark}" if log.remark else ""
    fail = f"\n         ❌ {log.failure_reason}" if log.failure_reason else ""
    print(f"    [{log.id:3d}] {log.action:25s} by {log.username:8s} "
          f"v{log.old_version}→v{log.new_version} "
          f"{log.old_status or '-'}→{log.new_status or '-'}{rm}{fail}")

# ============================================================
# 测试4：BatchItem order_version 验证
# ============================================================
print("\n🔍 测试4：BatchItem.order_version 字段验证")
all_items = db.query(BatchItem).all()
with_version = [i for i in all_items if i.order_version is not None]
print(f"  BatchItem 总数: {len(all_items)}，含 order_version: {len(with_version)}")
for item in with_version[:5]:
    print(f"    {item.order_no} - v{item.order_version} - {item.status.value}")

# ============================================================
# 测试5：重试成功与仍失败对照
# ============================================================
print("\n🔍 测试5：演示数据对照样例验证")

retry_audit = db.query(AuditLog).filter(
    AuditLog.action == 'retry_batch_items'
).all()
print(f"  重试操作审计: {len(retry_audit)} 次")
for a in retry_audit:
    print(f"    [{a.id}] by {a.username} - {a.detail}")
    if a.remark:
        print(f"         备注: {a.remark}")

batch_success = db.query(AuditLog).filter(AuditLog.action == 'batch_item_success').count()
batch_failed = db.query(AuditLog).filter(AuditLog.action == 'batch_item_failed').count()
print(f"\n  批量成功审计: {batch_success} 条")
print(f"  批量失败审计: {batch_failed} 条")
print(f"  成功/失败对照: {'✅' if batch_success > 0 and batch_failed > 0 else '⚠️'}")

version_conflict_fails = db.query(AuditLog).filter(
    AuditLog.action == 'batch_item_failed',
    AuditLog.failure_reason.like('%VERSION_CONFLICT%')
).count()
print(f"  版本冲突失败审计: {version_conflict_fails} 条 {'✅' if version_conflict_fails > 0 else '⚠️'}")

db.close()
print("\n" + "=" * 70)
print("✅ 版本一致性闭环验证完成！")
print("=" * 70)
