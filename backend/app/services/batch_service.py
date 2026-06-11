from datetime import datetime
import random
import string
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.database import (
    User, TransportOrder, BatchChange, BatchItem, AuditLog,
    BatchStatus, BatchItemStatus, OrderStatus
)
from app.services.order_service import OrderService, OrderValidationError


class BatchService:
    @staticmethod
    def generate_batch_no() -> str:
        rand = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        return f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}{rand}"

    @staticmethod
    def create_batch(db: Session, order_ids: List[int], target_status: OrderStatus,
                     change_type: str, user: User) -> BatchChange:
        batch = BatchChange(
            batch_no=BatchService.generate_batch_no(),
            operator_id=user.id,
            change_type=change_type,
            target_status=target_status,
            status=BatchStatus.PENDING,
            total_count=len(order_ids),
            success_count=0,
            failed_count=0,
        )
        db.add(batch)
        db.flush()

        for oid in order_ids:
            order = db.query(TransportOrder).filter(TransportOrder.id == oid).first()
            item = BatchItem(
                batch_id=batch.id,
                order_id=oid,
                order_no=order.order_no if order else f"UNKNOWN_{oid}",
                status=BatchItemStatus.PENDING,
                retry_count=0,
            )
            db.add(item)

        log = AuditLog(
            batch_id=batch.id,
            batch_no=batch.batch_no,
            user_id=user.id,
            username=user.username,
            action="create_batch",
            detail=f"创建批量变更批次，共 {len(order_ids)} 条订单，目标状态: {target_status.value}"
        )
        db.add(log)
        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def execute_batch(db: Session, batch_id: int, user: User, remark: Optional[str] = None, expected_versions: Optional[dict] = None) -> BatchChange:
        batch = db.query(BatchChange).filter(BatchChange.id == batch_id).first()
        if not batch:
            raise OrderValidationError(f"批次不存在：id={batch_id}", code="BATCH_NOT_FOUND")

        if batch.status in [BatchStatus.ALL_SUCCESS]:
            raise OrderValidationError("批次已全部成功，无需重复执行", code="BATCH_FINISHED")

        batch.status = BatchStatus.PROCESSING
        db.flush()

        items_to_process = db.query(BatchItem).filter(
            BatchItem.batch_id == batch_id,
            BatchItem.status.in_([BatchItemStatus.PENDING, BatchItemStatus.RETRY_PENDING])
        ).all()

        success_count = batch.success_count
        failed_count = batch.failed_count

        for item in items_to_process:
            order = db.query(TransportOrder).filter(TransportOrder.id == item.order_id).first()
            if not order:
                item.status = BatchItemStatus.FAILED
                item.error_message = f"订单不存在：id={item.order_id}"
                item.processed_at = datetime.utcnow()
                failed_count += 1
                fail_log = AuditLog(
                    order_id=item.order_id,
                    order_no=item.order_no,
                    batch_id=batch.id,
                    batch_no=batch.batch_no,
                    user_id=user.id,
                    username=user.username,
                    action="batch_item_failed",
                    old_status=None,
                    new_status=None,
                    detail=f"批量处理失败（订单不存在）：目标状态 {batch.target_status.value}",
                    failure_reason=item.error_message,
                )
                db.add(fail_log)
                continue

            if expected_versions and str(item.order_id) in expected_versions:
                exp_ver = expected_versions[str(item.order_id)]
                if order.version != exp_ver:
                    item.status = BatchItemStatus.FAILED
                    item.error_message = f"[VERSION_CONFLICT] 版本冲突：订单 {order.order_no} 已由其他操作修改（当前版本 v{order.version}，您持有版本 v{exp_ver}），请刷新后重试"
                    item.processed_at = datetime.utcnow()
                    failed_count += 1
                    fail_log = AuditLog(
                        order_id=order.id,
                        order_no=order.order_no,
                        batch_id=batch.id,
                        batch_no=batch.batch_no,
                        user_id=user.id,
                        username=user.username,
                        action="batch_item_failed",
                        old_status=order.status.value if order.status else None,
                        new_status=None,
                        old_version=order.version,
                        new_version=order.version,
                        detail=f"批量处理失败（版本冲突）：目标状态 {batch.target_status.value}",
                        remark=remark,
                        failure_reason=item.error_message,
                    )
                    db.add(fail_log)
                    continue

            try:
                old_status = order.status
                old_version_val = order.version
                OrderService.validate_transition(db, order, batch.target_status, user, order.version)
                OrderService.transition_order(db, order.id, batch.target_status, user, order.version, remark or f"批量变更批次: {batch.batch_no}")
                db.refresh(order)

                item.status = BatchItemStatus.SUCCESS
                item.error_message = None
                item.processed_at = datetime.utcnow()
                success_count += 1

                success_log = AuditLog(
                    order_id=order.id,
                    order_no=order.order_no,
                    batch_id=batch.id,
                    batch_no=batch.batch_no,
                    user_id=user.id,
                    username=user.username,
                    action="batch_item_success",
                    old_status=old_status.value if old_status else None,
                    new_status=batch.target_status.value,
                    old_version=old_version_val,
                    new_version=order.version,
                    detail=f"批量处理成功：{old_status.value if old_status else '-'} → {batch.target_status.value}",
                    remark=remark,
                )
                db.add(success_log)
            except OrderValidationError as e:
                item.status = BatchItemStatus.FAILED
                item.error_message = f"[{e.code}] {e.message}"
                item.processed_at = datetime.utcnow()
                failed_count += 1
                fail_log = AuditLog(
                    order_id=order.id,
                    order_no=order.order_no,
                    batch_id=batch.id,
                    batch_no=batch.batch_no,
                    user_id=user.id,
                    username=user.username,
                    action="batch_item_failed",
                    old_status=old_status.value if old_status else None,
                    new_status=None,
                    old_version=order.version,
                    new_version=order.version,
                    detail=f"批量处理失败：目标状态 {batch.target_status.value}",
                    remark=remark,
                    failure_reason=item.error_message,
                )
                db.add(fail_log)

        batch.success_count = success_count
        batch.failed_count = failed_count

        if success_count > 0 and failed_count > 0:
            batch.status = BatchStatus.PARTIAL_SUCCESS
        elif success_count > 0 and failed_count == 0:
            batch.status = BatchStatus.ALL_SUCCESS
        elif success_count == 0 and failed_count > 0:
            batch.status = BatchStatus.ALL_FAILED

        batch.finished_at = datetime.utcnow()

        log = AuditLog(
            batch_id=batch.id,
            batch_no=batch.batch_no,
            user_id=user.id,
            username=user.username,
            action="execute_batch",
            detail=f"批次执行完成：成功 {success_count} 条，失败 {failed_count} 条，结果状态: {batch.status.value}"
        )
        db.add(log)
        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def retry_failed_items(db: Session, batch_id: int, batch_item_ids: List[int], user: User, remark: Optional[str] = None, expected_versions: Optional[dict] = None) -> BatchChange:
        batch = db.query(BatchChange).filter(BatchChange.id == batch_id).first()
        if not batch:
            raise OrderValidationError(f"批次不存在：id={batch_id}", code="BATCH_NOT_FOUND")

        from app.services.order_service import ROLE_LABELS, OrderStatus, RoleEnum

        allowed_target_statuses = {
            RoleEnum.HANDLER: [OrderStatus.DISPATCHED, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED],
            RoleEnum.REVIEWER: [OrderStatus.REVIEWED, OrderStatus.REJECTED],
            RoleEnum.INITIATOR: [OrderStatus.ENTRUSTED],
        }
        allowed = allowed_target_statuses.get(user.role, [])
        if batch.target_status not in allowed:
            role_name = ROLE_LABELS.get(user.role, user.role.value)
            target_label = {
                OrderStatus.DISPATCHED: "已调度", OrderStatus.IN_TRANSIT: "运输中",
                OrderStatus.DELIVERED: "已签收", OrderStatus.REVIEWED: "已归档",
                OrderStatus.REJECTED: "驳回", OrderStatus.ENTRUSTED: "已委托"
            }.get(batch.target_status, batch.target_status.value)
            allowed_labels = [
                {OrderStatus.DISPATCHED: "已调度", OrderStatus.IN_TRANSIT: "运输中",
                 OrderStatus.DELIVERED: "已签收", OrderStatus.REVIEWED: "已归档",
                 OrderStatus.REJECTED: "驳回", OrderStatus.ENTRUSTED: "已委托"}.get(s, s.value)
                for s in allowed
            ]
            raise OrderValidationError(
                f"角色无权限：您是【{role_name}】，无权将订单批量变更为【{target_label}】，仅可批量变更 {', '.join(allowed_labels)}",
                code="ROLE_PERMISSION_DENIED"
            )

        items = db.query(BatchItem).filter(
            BatchItem.batch_id == batch_id,
            BatchItem.id.in_(batch_item_ids)
        ).all()

        retry_count = 0
        retry_order_ids = []
        for item in items:
            if item.status in [BatchItemStatus.FAILED, BatchItemStatus.RETRY_PENDING]:
                item.status = BatchItemStatus.RETRY_PENDING
                item.retry_count += 1
                item.processed_at = None
                item.error_message = None
                retry_count += 1
                retry_order_ids.append(item.order_id)

        if batch.success_count + batch.failed_count == batch.total_count:
            batch.failed_count = batch.failed_count - retry_count

        log = AuditLog(
            batch_id=batch.id,
            batch_no=batch.batch_no,
            user_id=user.id,
            username=user.username,
            action="retry_batch_items",
            detail=f"重新执行 {retry_count} 条失败项，涉及订单: {', '.join([str(i) for i in retry_order_ids])}",
            remark=remark
        )
        db.add(log)
        db.commit()
        db.refresh(batch)

        return BatchService.execute_batch(db, batch_id, user, remark=remark, expected_versions=expected_versions)
