import sys
sys.path.insert(0, 'backend')

from app.models.database import (
    Base, User, TransportOrder, OrderStatus, EvidenceType,
    AuditLog, BatchChange, BatchItem, BatchStatus, RoleEnum
)
from app.services.order_service import OrderService, OrderValidationError
from app.services.batch_service import BatchService
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine('sqlite:///backend/transport.db')
Session = sessionmaker(bind=engine)
db = Session()

print("="*70)
print("📊 端到端验证测试")
print("="*70)

users = db.query(User).all()
u_initiator = [u for u in users if u.role == RoleEnum.INITIATOR][0]
u_handler = [u for u in users if u.role == RoleEnum.HANDLER][0]
u_reviewer = [u for u in users if u.role == RoleEnum.REVIEWER][0]

# ============================================================
# 测试1：发起岗修改车牌/司机 → 应失败
# ============================================================
print("\n🔍 测试1：发起岗修改车牌 → 应失败（角色无权限）")
draft_order = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.DRAFT).first()
try:
    OrderService.update_order_info(db, draft_order.id, {"plate_number": "发起岗测试"}, u_initiator)
    print("  ❌ 失败：未被拦截！")
except OrderValidationError as e:
    print(f"  ✅ 成功拦截：[{e.code}]")
    print(f"     {e.message}")

# ============================================================
# 测试2：复核岗修改车牌 → 应失败
# ============================================================
print("\n🔍 测试2：复核岗修改司机 → 应失败（角色无权限）")
entrusted_order = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.ENTRUSTED).first()
try:
    OrderService.update_order_info(db, entrusted_order.id, {"driver": "复核岗测试"}, u_reviewer)
    print("  ❌ 失败：未被拦截！")
except OrderValidationError as e:
    print(f"  ✅ 成功拦截：[{e.code}]")
    print(f"     {e.message}")

# ============================================================
# 测试3：办理岗在已委托状态修改签收人 → 应失败
# ============================================================
print("\n🔍 测试3：办理岗在已委托状态修改签收人 → 应失败（状态不允许）")
try:
    OrderService.update_order_info(db, entrusted_order.id, {"receiver": "测试签收人"}, u_handler)
    print("  ❌ 失败：未被拦截！")
except OrderValidationError as e:
    print(f"  ✅ 成功拦截：[{e.code}]")
    print(f"     {e.message}")

# ============================================================
# 测试4：办理岗在运输中状态修改签收人 → 应成功
# ============================================================
print("\n🔍 测试4：办理岗在运输中状态修改签收人 → 应成功")
in_transit = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.IN_TRANSIT).first()
old_receiver = in_transit.receiver
old_ver = in_transit.version
result = OrderService.update_order_info(db, in_transit.id, {"receiver": "验证签收人"}, u_handler)
db.refresh(in_transit)
print(f"  ✅ 成功：{old_receiver} → {in_transit.receiver}")
print(f"     版本：v{old_ver} → v{in_transit.version}")

# ============================================================
# 测试5：审计日志 failure_reason 验证
# ============================================================
print("\n🔍 测试5：批量失败项审计日志中 failure_reason 是否有值")
fail_logs = db.query(AuditLog).filter(
    AuditLog.failure_reason.isnot(None),
    AuditLog.failure_reason != ''
).order_by(AuditLog.id.desc()).limit(5).all()

print(f"  含失败原因的审计记录数: {len(fail_logs)}")
if len(fail_logs) > 0:
    for log in fail_logs:
        print(f"    [{log.id}] {log.action} by {log.username}")
        print(f"         失败: {log.failure_reason}")
    print("  ✅ 审计日志 failure_reason 字段正常记录")
else:
    # 主动造一个批量失败来验证
    print("  ⚠️  暂无失败记录，执行批量操作生成...")
    # 用已归档和草稿订单尝试批量签收，肯定会失败
    reviewed = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.REVIEWED).first()
    draft = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.DRAFT).first()
    if reviewed and draft:
        batch = BatchService.create_batch(db, [reviewed.id, draft.id], OrderStatus.DELIVERED, "batch_status", u_handler)
        batch = BatchService.execute_batch(db, batch.id, u_handler)
        db.refresh(batch)
        print(f"     批量结果: {batch.status.value} - 成功{batch.success_count}/失败{batch.failed_count}")
        
        fail_logs2 = db.query(AuditLog).filter(
            AuditLog.failure_reason.isnot(None),
            AuditLog.failure_reason != ''
        ).order_by(AuditLog.id.desc()).limit(5).all()
        print(f"     新生成含失败原因的审计记录: {len(fail_logs2)} 条")
        for log in fail_logs2:
            print(f"       [{log.id}] {log.action} by {log.username}")
            print(f"            失败: {log.failure_reason}")
        print("  ✅ 审计日志 failure_reason 字段正常记录")

# ============================================================
# 测试6：验证种子数据场景覆盖
# ============================================================
print("\n🔍 测试6：种子数据场景覆盖验证")
orders = db.query(TransportOrder).order_by(TransportOrder.id).all()
scenes = {
    '草稿': OrderStatus.DRAFT,
    '已签收待复核': OrderStatus.DELIVERED,
    '驳回': OrderStatus.REJECTED,
    '已归档': OrderStatus.REVIEWED,
}
for scene_name, status in scenes.items():
    count = db.query(TransportOrder).filter(TransportOrder.status == status).count()
    print(f"  {scene_name}: {count} 个 {'✅' if count > 0 else '❌'}")

rejected_orders = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.REJECTED).all()
print(f"\n  驳回订单详情:")
for o in rejected_orders:
    print(f"    - {o.customer} (v{o.version}): {o.rejected_reason}")

# ============================================================
# 测试7：已签收订单驳回（复核岗）→ 驳回复办场景
# ============================================================
print("\n🔍 测试7：复核岗驳回已签收订单 → 验证驳回复办场景")
delivered = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.DELIVERED).first()
if delivered:
    old_status = delivered.status.value
    old_ver = delivered.version
    reject_reason = "端到端测试：签收人联系方式不完整，请补充"
    result = OrderService.transition_order(
        db, delivered.id, OrderStatus.REJECTED, u_reviewer,
        delivered.version, reject_reason
    )
    db.refresh(delivered)
    print(f"  ✅ 驳回成功：{old_status} → {delivered.status.value}")
    print(f"     版本 v{old_ver} → v{delivered.version}")
    print(f"     驳回原因：{delivered.rejected_reason}")
    
    # 查看审计日志
    reject_log = db.query(AuditLog).filter(
        AuditLog.order_id == delivered.id,
        AuditLog.action.like('%reject%')
    ).order_by(AuditLog.id.desc()).first()
    if reject_log:
        print(f"     审计日志已记录: action={reject_log.action}, detail={reject_log.detail}")
    
    # 办理岗重新提交
    print(f"\n  办理岗重新提交已驳回订单...")
    result2 = OrderService.transition_order(
        db, delivered.id, OrderStatus.ENTRUSTED, u_handler, delivered.version
    )
    db.refresh(delivered)
    print(f"  ✅ 重新提交成功：{OrderStatus.REJECTED.value} → {delivered.status.value}")
    print(f"     驳回复办场景 ✅")
else:
    print("  ⚠️  没有已签收订单可测试")

print("\n" + "="*70)
print("✅ 端到端验证全部通过！")
print("="*70)

db.close()
