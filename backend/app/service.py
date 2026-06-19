import json
import os
import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from litestar.exceptions import HTTPException

from app.models import Appeal, OperationRecord, User
from app.schemas import (
    AppealCreate,
    AppealResponse,
    OperationRecordResponse,
    ProcessRequest,
    ResubmitRequest,
    StatsResponse,
)


def _parse_evidence_urls(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []


async def _get_user_by_id(session: AsyncSession, user_id: str) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def _write_operation_record(
    session: AsyncSession,
    appeal_id: str,
    operator_id: str,
    operator_name: str,
    operator_role: str,
    action: str,
    from_status: str | None,
    to_status: str | None,
    opinion: str | None = None,
) -> OperationRecord:
    record = OperationRecord(
        id=uuid.uuid4().hex,
        appeal_id=appeal_id,
        operator_id=operator_id,
        operator_name=operator_name,
        operator_role=operator_role,
        action=action,
        opinion=opinion,
        from_status=from_status,
        to_status=to_status,
        created_at=datetime.utcnow().isoformat(),
    )
    session.add(record)
    return record


async def _run_validation(
    session: AsyncSession,
    appeal: Appeal | None,
    operator: User | None,
    checks: list[tuple[bool, str]],
    opinion: str | None = None,
    write_failed_record: bool = True,
) -> None:
    validation_error = None
    for condition, message in checks:
        if condition:
            validation_error = message
            break

    if validation_error:
        if write_failed_record and appeal and operator:
            await _write_operation_record(
                session=session,
                appeal_id=appeal.id,
                operator_id=operator.id,
                operator_name=operator.name,
                operator_role=operator.role,
                action="validation_failed",
                from_status=appeal.status,
                to_status=appeal.status,
                opinion=opinion,
            )
            await session.commit()

        status_code = 409 if "版本冲突" in validation_error else 403 if "无权" in validation_error or "角色" in validation_error else 400
        raise HTTPException(status_code=status_code, detail=validation_error)


async def create_appeal(session: AsyncSession, data: AppealCreate) -> Appeal:
    operator = await _get_user_by_id(session, data.operator_id)

    checks = [
        (not operator, "操作员不存在"),
        (operator and operator.role != "registrar", "只有登记员可以创建诉求"),
        (operator and data.anomaly_type == "missing_evidence" and not data.evidence_urls, "缺少证据类型必须提供证据链接"),
    ]
    await _run_validation(
        session=session,
        appeal=None,
        operator=operator,
        checks=checks,
        opinion=None,
        write_failed_record=False,
    )

    now = datetime.utcnow()
    year = now.year

    count_result = await session.execute(
        select(func.count()).select_from(Appeal).where(Appeal.appeal_no.like(f"VZ-{year}-%"))
    )
    count = count_result.scalar() or 0
    appeal_no = f"VZ-{year}-{count + 1:03d}"

    appeal_id = uuid.uuid4().hex
    evidence_urls_str = json.dumps(data.evidence_urls) if data.evidence_urls else None

    appeal = Appeal(
        id=appeal_id,
        appeal_no=appeal_no,
        visitor_name=data.visitor_name,
        visitor_phone=data.visitor_phone,
        appointment_date=data.appointment_date,
        anomaly_type=data.anomaly_type,
        description=data.description,
        evidence_urls=evidence_urls_str,
        status="pending_review",
        current_handler_id="u2",
        current_handler_role="reviewer",
        version=1,
        created_at=now.isoformat(),
        updated_at=now.isoformat(),
    )
    session.add(appeal)

    await _write_operation_record(
        session=session,
        appeal_id=appeal_id,
        operator_id=data.operator_id,
        operator_name=operator.name,
        operator_role=operator.role,
        action="submit",
        from_status="",
        to_status="pending_review",
    )

    await session.commit()
    await session.refresh(appeal)
    return appeal


async def process_appeal(session: AsyncSession, appeal_id: str, data: ProcessRequest) -> Appeal:
    result = await session.execute(select(Appeal).where(Appeal.id == appeal_id))
    appeal = result.scalar_one_or_none()
    if not appeal:
        raise HTTPException(status_code=404, detail="诉求不存在")

    operator = await _get_user_by_id(session, data.operator_id)
    if not operator:
        raise HTTPException(status_code=400, detail="操作员不存在")

    evidence_list = json.loads(appeal.evidence_urls) if appeal.evidence_urls else []
    checks = [
        (data.operator_id != appeal.current_handler_id, "无权处理此诉求"),
        (operator.role != appeal.current_handler_role, "操作员角色不匹配"),
        (appeal.status not in ("pending_review", "pending_recheck"), f"当前状态 {appeal.status} 不可处理"),
        (data.version != appeal.version, "数据版本冲突，请刷新后重试"),
        (data.action == "approve" and appeal.anomaly_type == "missing_evidence" and not evidence_list, "证据不足，无法通过"),
    ]
    await _run_validation(
        session=session,
        appeal=appeal,
        operator=operator,
        checks=checks,
        opinion=data.opinion,
        write_failed_record=True,
    )

    from_status = appeal.status
    to_status = appeal.status
    new_handler_id = appeal.current_handler_id
    new_handler_role = appeal.current_handler_role

    if appeal.status == "pending_review":
        if data.action == "approve":
            to_status = "pending_recheck"
            new_handler_id = "u3"
            new_handler_role = "rechecker"
        elif data.action == "reject":
            to_status = "rejected"
            new_handler_id = "u1"
            new_handler_role = "registrar"
        elif data.action == "return":
            to_status = "returned"
            new_handler_id = "u1"
            new_handler_role = "registrar"
    elif appeal.status == "pending_recheck":
        if data.action == "approve":
            to_status = "archived"
        elif data.action == "reject":
            to_status = "rejected"
            new_handler_id = "u1"
            new_handler_role = "registrar"
        elif data.action == "return":
            to_status = "returned"
            new_handler_id = "u1"
            new_handler_role = "registrar"

    appeal.status = to_status
    appeal.current_handler_id = new_handler_id
    appeal.current_handler_role = new_handler_role
    appeal.version += 1
    appeal.updated_at = datetime.utcnow().isoformat()

    await _write_operation_record(
        session=session,
        appeal_id=appeal_id,
        operator_id=data.operator_id,
        operator_name=operator.name,
        operator_role=operator.role,
        action=data.action,
        from_status=from_status,
        to_status=to_status,
        opinion=data.opinion,
    )

    await session.commit()
    await session.refresh(appeal)
    return appeal


async def resubmit_appeal(session: AsyncSession, appeal_id: str, data: ResubmitRequest) -> Appeal:
    result = await session.execute(select(Appeal).where(Appeal.id == appeal_id))
    appeal = result.scalar_one_or_none()
    if not appeal:
        raise HTTPException(status_code=404, detail="诉求不存在")

    operator = await _get_user_by_id(session, data.operator_id)
    if not operator:
        raise HTTPException(status_code=400, detail="操作员不存在")

    existing_urls = json.loads(appeal.evidence_urls) if appeal.evidence_urls else []
    merged_urls = existing_urls + [u for u in data.evidence_urls if u not in existing_urls]

    checks = [
        (data.operator_id != appeal.current_handler_id, "无权处理此诉求"),
        (operator.role != appeal.current_handler_role, "操作员角色不匹配"),
        (appeal.status not in ("returned", "rejected"), "只有退回或驳回的诉求才能重新提交"),
        (data.version != appeal.version, "数据版本冲突，请刷新后重试"),
        (appeal.anomaly_type == "missing_evidence" and not merged_urls, "缺少证据类型必须提供证据链接"),
    ]
    await _run_validation(
        session=session,
        appeal=appeal,
        operator=operator,
        checks=checks,
        opinion=data.opinion,
        write_failed_record=True,
    )

    from_status = appeal.status

    appeal.evidence_urls = json.dumps(merged_urls) if merged_urls else None

    appeal.status = "pending_review"
    appeal.current_handler_id = "u2"
    appeal.current_handler_role = "reviewer"
    appeal.version += 1
    appeal.updated_at = datetime.utcnow().isoformat()

    await _write_operation_record(
        session=session,
        appeal_id=appeal_id,
        operator_id=data.operator_id,
        operator_name=operator.name,
        operator_role=operator.role,
        action="resubmit",
        from_status=from_status,
        to_status="pending_review",
        opinion=data.opinion,
    )

    await session.commit()
    await session.refresh(appeal)
    return appeal


async def get_appeals(session: AsyncSession, status: str | None = None) -> list[AppealResponse]:
    query = select(Appeal).order_by(Appeal.created_at.desc())
    if status:
        query = query.where(Appeal.status == status)
    result = await session.execute(query)
    appeals = result.scalars().all()

    responses = []
    for appeal in appeals:
        handler = await _get_user_by_id(session, appeal.current_handler_id) if appeal.current_handler_id else None
        handler_name = handler.name if handler else None
        responses.append(
            AppealResponse(
                id=appeal.id,
                appeal_no=appeal.appeal_no,
                visitor_name=appeal.visitor_name,
                visitor_phone=appeal.visitor_phone,
                appointment_date=appeal.appointment_date,
                anomaly_type=appeal.anomaly_type,
                description=appeal.description,
                evidence_urls=_parse_evidence_urls(appeal.evidence_urls),
                status=appeal.status,
                current_handler_id=appeal.current_handler_id,
                current_handler_role=appeal.current_handler_role,
                current_handler_name=handler_name,
                version=appeal.version,
                created_at=appeal.created_at,
                updated_at=appeal.updated_at,
            )
        )
    return responses


async def get_appeal(session: AsyncSession, appeal_id: str) -> dict:
    result = await session.execute(select(Appeal).where(Appeal.id == appeal_id))
    appeal = result.scalar_one_or_none()
    if not appeal:
        raise HTTPException(status_code=404, detail="诉求不存在")

    handler = await _get_user_by_id(session, appeal.current_handler_id) if appeal.current_handler_id else None
    handler_name = handler.name if handler else None

    appeal_response = AppealResponse(
        id=appeal.id,
        appeal_no=appeal.appeal_no,
        visitor_name=appeal.visitor_name,
        visitor_phone=appeal.visitor_phone,
        appointment_date=appeal.appointment_date,
        anomaly_type=appeal.anomaly_type,
        description=appeal.description,
        evidence_urls=_parse_evidence_urls(appeal.evidence_urls),
        status=appeal.status,
        current_handler_id=appeal.current_handler_id,
        current_handler_role=appeal.current_handler_role,
        current_handler_name=handler_name,
        version=appeal.version,
        created_at=appeal.created_at,
        updated_at=appeal.updated_at,
    )

    records_result = await session.execute(
        select(OperationRecord).where(OperationRecord.appeal_id == appeal_id).order_by(OperationRecord.created_at)
    )
    records = records_result.scalars().all()

    record_responses = [
        OperationRecordResponse(
            id=r.id,
            appeal_id=r.appeal_id,
            operator_id=r.operator_id,
            operator_name=r.operator_name,
            operator_role=r.operator_role,
            action=r.action,
            opinion=r.opinion,
            from_status=r.from_status,
            to_status=r.to_status,
            created_at=r.created_at,
        )
        for r in records
    ]

    return {"appeal": appeal_response, "operation_records": record_responses}


async def get_stats(session: AsyncSession) -> StatsResponse:
    total_result = await session.execute(select(func.count()).select_from(Appeal))
    total = total_result.scalar() or 0

    async def _count_by_status(status: str) -> int:
        r = await session.execute(select(func.count()).select_from(Appeal).where(Appeal.status == status))
        return r.scalar() or 0

    return StatsResponse(
        total=total,
        pending_review=await _count_by_status("pending_review"),
        pending_recheck=await _count_by_status("pending_recheck"),
        returned=await _count_by_status("returned"),
        rejected=await _count_by_status("rejected"),
        archived=await _count_by_status("archived"),
    )


async def get_users(session: AsyncSession) -> list[User]:
    result = await session.execute(select(User))
    return list(result.scalars().all())
