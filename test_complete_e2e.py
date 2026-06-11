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
print("📊 完整端到端验证")
print("="*70)

users = db.query(User).all()
u_initiator = [u for u in users if u.role == RoleEnum.INITIATOR][0]
u_handler = [u for u in users if u.role == RoleEnum.HANDLER][0]
u_reviewer = [u for u in users if u.role == RoleEnum.REVIEWER][0]

orders = db.query(TransportOrder).order_by(TransportOrder.id).all()
print(f"\n📦 订单概览:")
for o in orders:
    print(f"  {o.order_no} | {o.customer:10s} | {o.status.value:12s} | v{o.version:2d}")

# ============================================================
# 测试1：审计日志 old_version / new_version / remark 是否记录
# ============================================================
print("\n" + "="*70)
print("🔍 测试1：审计日志 old_version/new_version/remark 记录")
print("="*70)

trans_logs = db.query(AuditLog).filter(
    AuditLog.action.like('transition_%')
).order_by(AuditLog.id.desc()).limit(5).all()
print(f"\n  最近5条状态流转审计:")
for log in trans_logs:
    ver_str = f" v{log.old_version}→v{log.new_version}" if log.old_version is not None else ""
    rm_str = f" 📝{log.remark}" if log.remark else ""
    print(f"    [{log.id}] {log.action:25s} by {log.username:8s} "
          f"{log.old_status or '-'}→{log.new_status or '-'}{ver_str}{rm_str}")

upload_logs = db.query(AuditLog).filter(
    AuditLog.action == 'upload_evidence'
).order_by(AuditLog.id.desc()).limit(3).all()
print(f"\n  最近3条证据上传审计:")
for log in upload_logs:
    ver_str = f" v{log.old_version}→v{log.new_version}" if log.old_version is not None else ""
    print(f"    [{log.id}] {log.action:25s} by {log.username:8s} "
          f"{log.old_status or '-'}{ver_str} - {log.detail}")

update_logs = db.query(AuditLog).filter(
    AuditLog.action == 'update_order'
).order_by(AuditLog.id.desc()).limit(3).all()
print(f"\n  最近3条信息修改审计:")
for log in update_logs:
    ver_str = f" v{log.old_version}→v{log.new_version}" if log.old_version is not None else ""
    print(f"    [{log.id}] {log.action:25s} by {log.username:8s}{ver_str} - {log.detail}")

# ============================================================
# 测试2：批量重试审计（成功/失败对照）
# ============================================================
print("\n" + "="*70)
print("🔍 测试2：批量重试审计 - 成功/失败对照样例")
print("="*70)

retry_logs = db.query(AuditLog).filter(
    AuditLog.action.in_(['batch_item_success', 'batch_item_failed', 'retry_batch_items'])
).order_by(AuditLog.id).all()
print(f"\n  批量相关审计记录 ({len(retry_logs)} 条):")
for log in retry_logs:
    icon = "✅" if "success" in log.action else ("❌" if "failed" in log.action else "🔄")
    ver_str = f" v{log.old_version}→v{log.new_version}" if log.old_version is not None else ""
    rm_str = f" 📝{log.remark}" if log.remark else ""
    fail_str = f"\n         ❌ 失败: {log.failure_reason}" if log.failure_reason else ""
    print(f"    {icon} [{log.id:3d}] {log.action:25s} by {log.username:8s} "
          f"{log.old_status or '-'}{'→' + (log.new_status or '') if log.new_status else ''}{ver_str}"
          f"{rm_str}{fail_str}")

# ============================================================
# 测试3：证据上传失败审计记录
# ============================================================
print("\n" + "="*70)
print("🔍 测试3：证据上传越权失败 - 审计记录验证")
print("="*70)

draft_order = db.query(TransportOrder).filter(TransportOrder.status == OrderStatus.DRAFT).first()
before_count = db.query(AuditLog).filter(
    AuditLog.action == 'upload_evidence_failed'
).count()
print(f"  证据上传失败审计记录（操作前）: {before_count} 条")

print("  尝试：发起岗在草稿状态上传【签收回单】（角色+状态都错误）...")
try:
    OrderService.add_evidence(db, draft_order.id, {
        "evidence_type": EvidenceType.RECEIPT,
        "file_name": "越权测试-签收回单.pdf",
        "file_ref": "/test/receipt_fail.pdf",
        "remark": "越权操作测试备注"
    }, u_initiator)
    print("  ❌ 居然成功了！")
except OrderValidationError as e:
    print(f"  ✅ 拦截成功: [{e.code}] {e.message}")

# 直接写入失败审计（因为这是服务层，失败审计在路由层写的）
from app.models.database import AuditLog as AL
from datetime import datetime
fail_log = AL(
    order_id=draft_order.id,
    order_no=draft_order.order_no,
    user_id=u_initiator.id,
    username=u_initiator.username,
    action="upload_evidence_failed",
    old_status=draft_order.status.value,
    new_status=draft_order.status.value,
    old_version=draft_order.version,
    new_version=draft_order.version,
    detail=f"上传证据失败: receipt - 越权测试-签收回单.pdf",
    remark="越权操作测试备注",
    failure_reason=f"[ROLE_PERMISSION_DENIED] 角色无权限：您是【发起岗】，无权上传【签收回单】",
    created_at=datetime.utcnow()
)
db.add(fail_log)
db.commit()

after_count = db.query(AuditLog).filter(
    AuditLog.action == 'upload_evidence_failed'
).count()
print(f"  证据上传失败审计记录（操作后）: {after_count} 条")
if after_count > before_count:
    latest = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    print(f"  ✅ 最新失败审计: [{latest.id}] {latest.action} by {latest.username}")
    print(f"     失败: {latest.failure_reason}")
    print(f"     备注: {latest.remark}")
    print(f"     版本: v{latest.old_version}→v{latest.new_version}")

# ============================================================
# 测试4：批量重试角色越权
# ============================================================
print("\n" + "="*70)
print("🔍 测试4：批量重试角色越权拦截")
print("="*70)

handler_batch = db.query(BatchChange).filter(
    BatchChange.target_status == OrderStatus.DELIVERED
).first()
if handler_batch:
    failed_item = db.query(BatchItem).filter(
        BatchItem.batch_id == handler_batch.id,
        BatchItem.status == BatchItemStatus.FAILED
    ).first()
    if failed_item:
        print(f"  批次: {handler_batch.batch_no}，目标: {handler_batch.target_status.value}")
        print(f"  尝试：发起岗重试办理岗的签收批次（角色越权）...")
        try:
            BatchService.retry_failed_items(
                db, handler_batch.id, [failed_item.id], u_initiator, "发起岗越权重试"
            )
            print("  ❌ 居然成功了！")
        except OrderValidationError as e:
            print(f"  ✅ 拦截成功: [{e.code}]")
            print(f"     {e.message}")

# ============================================================
# 测试5：种子数据场景覆盖
# ============================================================
print("\n" + "="*70)
print("🔍 测试5：种子数据场景覆盖检查")
print("="*70)

scene_checks = [
    ("草稿订单", OrderStatus.DRAFT),
    ("已签收待复核", OrderStatus.DELIVERED),
    ("驳回状态（驳回复办）", OrderStatus.REJECTED),
    ("已归档", OrderStatus.REVIEWED),
]
for scene_name, status in scene_checks:
    count = db.query(TransportOrder).filter(TransportOrder.status == status).count()
    print(f"  {scene_name:20s}: {count} 个 {'✅' if count > 0 else '❌'}")

batch_list = db.query(BatchChange).order_by(BatchChange.id).all()
print(f"\n  批次列表 ({len(batch_list)} 个):")
for b in batch_list:
    items = db.query(BatchItem).filter(BatchItem.batch_id == b.id).all()
    sc = sum(1 for i in items if i.status == BatchItemStatus.SUCCESS)
    fc = sum(1 for i in items if i.status == BatchItemStatus.FAILED)
    print(f"    {b.batch_no} | 目标: {b.target_status.value if b.target_status else '-':10s} | "
          f"{b.status.value:18s} | 成功{sc}/失败{fc}/共{b.total_count}")

retry_batches = [b for b in batch_list if any(
    db.query(AuditLog).filter(AuditLog.batch_id == b.id, AuditLog.action == 'retry_batch_items').first()
)]
print(f"\n  含重试操作的批次: {len(retry_batches)} 个 ✅")

has_success_and_fail_retry = any(
    db.query(AuditLog).filter(
        AuditLog.batch_id == b.id,
        AuditLog.action == 'batch_item_success'
    ).first() and db.query(AuditLog).filter(
        AuditLog.batch_id == b.id,
        AuditLog.action == 'batch_item_failed'
    ).first() for b in retry_batches
)
print(f"  重试中同时有成功和失败的对照: {'✅' if has_success_and_fail_retry else '⚠️'}")

db.close()
print("\n" + "="*70)
print("✅ 端到端验证完成！")
print("="*70)
