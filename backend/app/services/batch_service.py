from datetime import datetime
import random
import string
from typing import List, Tuple
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
    def execute_batch(db: Session, batch_id: int, user: User) -> BatchChange:
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

            try:
                old_status = order.status
                OrderService.validate_transition(db, order, batch.target_status, user, order.version)
                OrderService.transition_order(db, order.id, batch.target_status, user, order.version, f"批量变更批次: {batch.batch_no}")

                item.status = BatchItemStatus.SUCCESS
                item.error_message = None
                item.processed_at = datetime.utcnow()
                success_count += 1
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
                    detail=f"批量处理失败：目标状态 {batch.target_status.value}",
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
    def retry_failed_items(db: Session, batch_id: int, batch_item_ids: List[int], user: User) -> BatchChange:
        batch = db.query(BatchChange).filter(BatchChange.id == batch_id).first()
        if not batch:
            raise OrderValidationError(f"批次不存在：id={batch_id}", code="BATCH_NOT_FOUND")

        items = db.query(BatchItem).filter(
            BatchItem.batch_id == batch_id,
            BatchItem.id.in_(batch_item_ids)
        ).all()

        retry_count = 0
        for item in items:
            if item.status in [BatchItemStatus.FAILED, BatchItemStatus.RETRY_PENDING]:
                item.status = BatchItemStatus.RETRY_PENDING
                item.retry_count += 1
                item.processed_at = None
                item.error_message = None
                retry_count += 1

        if batch.success_count + batch.failed_count == batch.total_count:
            batch.failed_count = batch.failed_count - retry_count

        log = AuditLog(
            batch_id=batch.id,
            batch_no=batch.batch_no,
            user_id=user.id,
            username=user.username,
            action="retry_batch_items",
            detail=f"重新执行 {retry_count} 条失败项"
        )
        db.add(log)
        db.commit()
        db.refresh(batch)

        return BatchService.execute_batch(db, batch_id, user)
