from typing import Optional, List
from litestar import Controller, get, post, put, Request
from litestar.di import Provide
from sqlalchemy.orm import Session
from app.models.db_config import get_db
from app.models.database import User, TransportOrder, OrderEvidence, AuditLog, BatchChange, OrderStatus, RoleEnum, EvidenceType
from app.schemas.order_schemas import (
    UserOut, TransportOrderOut, TransportOrderCreate, TransportOrderUpdate,
    EvidenceOut, EvidenceUpload, OrderTransition, BatchChangeOut,
    BatchCreateRequest, BatchRetryRequest, AuditLogOut
)
from app.services.order_service import OrderService, OrderValidationError
from app.services.batch_service import BatchService
from litestar.exceptions import HTTPException


def provide_current_user(request: Request, db: Session) -> User:
    x_user_id = request.headers.get("X-User-Id")
    if not x_user_id:
        raise HTTPException(status_code=401, detail="请先选择登录角色 (X-User-Id header)")
    try:
        uid = int(x_user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail=f"无效的用户ID: {x_user_id}")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=401, detail=f"用户不存在: id={uid}")
    return user


deps_base = {"db": Provide(get_db)}
deps_auth = {"db": Provide(get_db), "current_user": Provide(provide_current_user)}


class AuthController(Controller):
    path = "/api/auth"
    dependencies = deps_base

    @get("/users")
    async def list_users(self, db: Session) -> List[UserOut]:
        users = db.query(User).all()
        return [UserOut.model_validate(u) for u in users]

    @get("/me")
    async def get_me(self, db: Session, request: Request) -> UserOut:
        user = provide_current_user(request, db)
        return UserOut.model_validate(user)


class OrderController(Controller):
    path = "/api/orders"
    dependencies = deps_auth

    @get()
    async def list_orders(
        self,
        db: Session,
        current_user: User,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> List[TransportOrderOut]:
        query = db.query(TransportOrder)
        if status:
            try:
                query = query.filter(TransportOrder.status == OrderStatus(status))
            except ValueError:
                pass
        if keyword:
            kw = f"%{keyword}%"
            query = query.filter(
                (TransportOrder.order_no.like(kw)) |
                (TransportOrder.customer.like(kw)) |
                (TransportOrder.cargo_name.like(kw))
            )
        orders = query.order_by(TransportOrder.updated_at.desc()).all()
        return [TransportOrderOut.model_validate(o) for o in orders]

    @get("/{order_id:int}")
    async def get_order(self, db: Session, current_user: User, order_id: int) -> TransportOrderOut:
        order = db.query(TransportOrder).filter(TransportOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail=f"订单不存在: id={order_id}")
        return TransportOrderOut.model_validate(order)

    @post()
    async def create_order(
        self, db: Session, current_user: User, data: TransportOrderCreate
    ) -> TransportOrderOut:
        try:
            order = OrderService.create_order(db, data.model_dump(), current_user)
            return TransportOrderOut.model_validate(order)
        except OrderValidationError as e:
            raise HTTPException(status_code=400, detail={"error": e.message, "code": e.code})

    @put("/{order_id:int}")
    async def update_order(
        self, db: Session, current_user: User, order_id: int, data: TransportOrderUpdate
    ) -> TransportOrderOut:
        order = db.query(TransportOrder).filter(TransportOrder.id == order_id).first()
        try:
            order = OrderService.update_order_info(db, order_id, data.model_dump(exclude_unset=True), current_user)
            return TransportOrderOut.model_validate(order)
        except OrderValidationError as e:
            if order:
                fail_log = AuditLog(
                    order_id=order.id,
                    order_no=order.order_no,
                    user_id=current_user.id,
                    username=current_user.username,
                    action="update_order_failed",
                    old_status=order.status.value,
                    new_status=order.status.value,
                    old_version=order.version,
                    new_version=order.version,
                    detail=f"更新订单信息失败",
                    remark=data.remark,
                    failure_reason=f"[{e.code}] {e.message}",
                )
                db.add(fail_log)
                db.commit()
            raise HTTPException(status_code=400, detail={"error": e.message, "code": e.code})

    @post("/{order_id:int}/transition")
    async def transition_order(
        self, db: Session, current_user: User, order_id: int, data: OrderTransition
    ) -> TransportOrderOut:
        try:
            order = OrderService.transition_order(
                db, order_id, data.target_status, current_user,
                data.expected_version, data.remark
            )
            return TransportOrderOut.model_validate(order)
        except OrderValidationError as e:
            raise HTTPException(status_code=400, detail={"error": e.message, "code": e.code})

    @post("/{order_id:int}/evidences")
    async def upload_evidence(
        self, db: Session, current_user: User, order_id: int, data: EvidenceUpload
    ) -> EvidenceOut:
        order = db.query(TransportOrder).filter(TransportOrder.id == order_id).first()
        try:
            evidence = OrderService.add_evidence(db, order_id, data.model_dump(), current_user)
            return EvidenceOut.model_validate(evidence)
        except OrderValidationError as e:
            if order:
                from app.models.database import AuditLog
                fail_log = AuditLog(
                    order_id=order.id,
                    order_no=order.order_no,
                    user_id=current_user.id,
                    username=current_user.username,
                    action="upload_evidence_failed",
                    old_status=order.status.value,
                    new_status=order.status.value,
                    old_version=order.version,
                    new_version=order.version,
                    detail=f"上传证据失败: {data.evidence_type} - {data.file_name}",
                    remark=data.remark,
                    failure_reason=f"[{e.code}] {e.message}",
                )
                db.add(fail_log)
                db.commit()
            raise HTTPException(status_code=400, detail={"error": e.message, "code": e.code})

    @get("/{order_id:int}/evidences")
    async def list_evidences(self, db: Session, current_user: User, order_id: int) -> List[EvidenceOut]:
        order = db.query(TransportOrder).filter(TransportOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail=f"订单不存在: id={order_id}")
        return [EvidenceOut.model_validate(e) for e in order.evidences]


class BatchController(Controller):
    path = "/api/batches"
    dependencies = deps_auth

    @get()
    async def list_batches(self, db: Session, current_user: User) -> List[BatchChangeOut]:
        batches = db.query(BatchChange).order_by(BatchChange.created_at.desc()).all()
        return [BatchChangeOut.model_validate(b) for b in batches]

    @get("/{batch_id:int}")
    async def get_batch(self, db: Session, current_user: User, batch_id: int) -> BatchChangeOut:
        batch = db.query(BatchChange).filter(BatchChange.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail=f"批次不存在: id={batch_id}")
        return BatchChangeOut.model_validate(batch)

    @post()
    async def create_batch(
        self, db: Session, current_user: User, data: BatchCreateRequest
    ) -> BatchChangeOut:
        try:
            batch = BatchService.create_batch(
                db, data.order_ids, data.target_status, data.change_type, current_user
            )
            return BatchChangeOut.model_validate(batch)
        except OrderValidationError as e:
            raise HTTPException(status_code=400, detail={"error": e.message, "code": e.code})

    @post("/{batch_id:int}/execute")
    async def execute_batch(
        self, db: Session, current_user: User, batch_id: int
    ) -> BatchChangeOut:
        try:
            batch = BatchService.execute_batch(db, batch_id, current_user)
            return BatchChangeOut.model_validate(batch)
        except OrderValidationError as e:
            raise HTTPException(status_code=400, detail={"error": e.message, "code": e.code})

    @post("/{batch_id:int}/retry")
    async def retry_batch(
        self, db: Session, current_user: User, batch_id: int, data: BatchRetryRequest
    ) -> BatchChangeOut:
        try:
            batch = BatchService.retry_failed_items(
                db, batch_id, data.batch_item_ids, current_user, data.remark
            )
            return BatchChangeOut.model_validate(batch)
        except OrderValidationError as e:
            raise HTTPException(status_code=400, detail={"error": e.message, "code": e.code})


class AuditController(Controller):
    path = "/api/audit"
    dependencies = deps_auth

    @get()
    async def list_audit_logs(
        self,
        db: Session,
        current_user: User,
        order_id: Optional[int] = None,
        batch_id: Optional[int] = None,
    ) -> List[AuditLogOut]:
        query = db.query(AuditLog)
        if order_id:
            query = query.filter(AuditLog.order_id == order_id)
        if batch_id:
            query = query.filter(AuditLog.batch_id == batch_id)
        logs = query.order_by(AuditLog.created_at.desc()).all()
        return [AuditLogOut.model_validate(l) for l in logs]
