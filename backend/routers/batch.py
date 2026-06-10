from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from typing import List, Dict, Any
from datetime import datetime, timezone

from database import get_db
from deps import (
    allow_registrar,
    allow_supervisor,
    allow_reviewer,
    allow_all_authenticated,
)
from models.user import User, UserRole
from models.inspection import InspectionOrder, InspectionStatus
from models.audit_log import AuditAction
from schemas.batch import (
    BatchProcessRequest,
    BatchProcessResult,
    BatchItemResult,
    BatchStatistics,
)
from utils import (
    create_audit_log,
    validate_inspection_materials,
    acquire_lock,
    release_lock,
    check_version,
    generate_request_id,
    get_status_label,
    get_role_label,
    get_action_label,
)

router = APIRouter()


def get_batch_suggestion(error_code: str, error_message: str) -> tuple[str, str]:
    if error_code == "NOT_FOUND":
        return "巡检单不存在", "请检查巡检单ID是否正确"
    elif error_code == "VERSION_CONFLICT":
        return "版本冲突", "巡检单已被修改，请刷新后重试"
    elif error_code == "INVALID_TRANSITION":
        return "状态流转不合法", "请检查巡检单当前状态是否允许该操作"
    elif error_code == "MATERIALS_INCOMPLETE":
        return "材料不完整", "请补充完整巡检材料后再提交"
    elif error_code == "PERMISSION_DENIED":
        return "权限不足", "您没有权限操作该巡检单"
    elif error_code == "LOCK_FAILED":
        return "系统繁忙", "资源被占用，请稍后重试"
    elif error_code == "NOT_CREATOR":
        return "非创建人", "只能批量提交自己创建的巡检单"
    return "处理失败", error_message


async def process_single_item(
    item,
    current_user: User,
    db: AsyncSession,
    request: Request,
    request_id: str,
) -> BatchItemResult:
    result = BatchItemResult(
        inspection_order_id=item.inspection_order_id,
        order_no=item.order_no,
        success=False,
    )

    lock_acquired = False
    try:
        lock_acquired, lock_error = await acquire_lock(item.inspection_order_id, timeout=3.0)
        if not lock_acquired:
            result.error_code = "LOCK_FAILED"
            result.error_message = lock_error
            suggestion, next_step = get_batch_suggestion("LOCK_FAILED", lock_error)
            result.suggestion = suggestion
            result.next_step = next_step
            return result

        query = select(InspectionOrder).options(
            joinedload(InspectionOrder.charging_pile)
        ).where(InspectionOrder.id == item.inspection_order_id)
        result_set = await db.execute(query)
        inspection = result_set.scalar_one_or_none()

        if not inspection:
            result.error_code = "NOT_FOUND"
            result.error_message = f"巡检单ID {item.inspection_order_id} 不存在"
            suggestion, next_step = get_batch_suggestion("NOT_FOUND", result.error_message)
            result.suggestion = suggestion
            result.next_step = next_step
            return result

        result.previous_status = inspection.status

        if item.current_version is not None:
            try:
                check_version(inspection.version, item.current_version, inspection.order_no)
            except HTTPException as e:
                result.error_code = "VERSION_CONFLICT"
                result.error_message = str(e.detail)
                suggestion, next_step = get_batch_suggestion("VERSION_CONFLICT", result.error_message)
                result.suggestion = suggestion
                result.next_step = next_step
                return result

        valid_transitions = {
            (UserRole.REGISTRAR, InspectionStatus.DRAFT): [InspectionStatus.PENDING_REVIEW],
            (UserRole.REGISTRAR, InspectionStatus.REVIEW_REJECTED): [InspectionStatus.PENDING_REVIEW],
            (UserRole.REGISTRAR, InspectionStatus.FINAL_REVIEW_REJECTED): [InspectionStatus.PENDING_REVIEW],
            (UserRole.REGISTRAR, InspectionStatus.ACCEPTANCE_REJECTED): [InspectionStatus.PENDING_REVIEW],
            (UserRole.SUPERVISOR, InspectionStatus.PENDING_REVIEW): [
                InspectionStatus.PENDING_FINAL_REVIEW,
                InspectionStatus.PENDING_FAULT_REPORT,
                InspectionStatus.REVIEW_REJECTED,
            ],
            (UserRole.SUPERVISOR, InspectionStatus.PENDING_FAULT_REPORT): [InspectionStatus.FAULT_REPORTED],
            (UserRole.SUPERVISOR, InspectionStatus.FAULT_REPORTED): [InspectionStatus.PENDING_REPAIR],
            (UserRole.SUPERVISOR, InspectionStatus.PENDING_REPAIR): [InspectionStatus.REPAIR_COMPLETED],
            (UserRole.SUPERVISOR, InspectionStatus.REPAIR_COMPLETED): [InspectionStatus.PENDING_ACCEPTANCE],
            (UserRole.SUPERVISOR, InspectionStatus.PENDING_ACCEPTANCE): [
                InspectionStatus.PENDING_FINAL_REVIEW,
                InspectionStatus.ACCEPTANCE_REJECTED,
            ],
            (UserRole.REVIEWER, InspectionStatus.PENDING_FINAL_REVIEW): [
                InspectionStatus.ARCHIVED,
                InspectionStatus.FINAL_REVIEW_REJECTED,
            ],
        }

        key = (current_user.role, inspection.status)
        if key not in valid_transitions or item.target_status not in valid_transitions[key]:
            result.error_code = "INVALID_TRANSITION"
            result.error_message = (
                f"角色 [{get_role_label(current_user.role)}] 不允许从 "
                f"[{get_status_label(inspection.status)}] 流转到 [{get_status_label(item.target_status)}]"
            )
            suggestion, next_step = get_batch_suggestion("INVALID_TRANSITION", result.error_message)
            result.suggestion = suggestion
            result.next_step = next_step
            return result

        if current_user.role == UserRole.REGISTRAR and inspection.created_by != current_user.id:
            result.error_code = "NOT_CREATOR"
            result.error_message = "只能批量提交自己创建的巡检单"
            suggestion, next_step = get_batch_suggestion("NOT_CREATOR", result.error_message)
            result.suggestion = suggestion
            result.next_step = next_step
            return result

        materials_ok, materials_error, _ = validate_inspection_materials(inspection, item.target_status)
        if not materials_ok:
            result.error_code = "MATERIALS_INCOMPLETE"
            result.error_message = materials_error
            suggestion, next_step = get_batch_suggestion("MATERIALS_INCOMPLETE", result.error_message)
            result.suggestion = suggestion
            result.next_step = next_step
            return result

        from_status = inspection.status

        if item.target_status in [InspectionStatus.PENDING_FINAL_REVIEW, InspectionStatus.REVIEW_REJECTED]:
            inspection.supervisor_opinion = item.opinion
            inspection.supervisor_signature = item.signature
            inspection.supervisor_review_date = datetime.now(timezone.utc)

        elif item.target_status in [InspectionStatus.ARCHIVED, InspectionStatus.FINAL_REVIEW_REJECTED]:
            inspection.reviewer_opinion = item.opinion
            inspection.reviewer_signature = item.signature
            inspection.reviewer_review_date = datetime.now(timezone.utc)

        elif item.target_status == InspectionStatus.PENDING_REVIEW:
            inspection.registrar_signature = item.signature

        inspection.status = item.target_status
        inspection.version += 1

        action_map = {
            InspectionStatus.PENDING_REVIEW: AuditAction.SUBMIT,
            InspectionStatus.PENDING_FINAL_REVIEW: AuditAction.REVIEW,
            InspectionStatus.REVIEW_REJECTED: AuditAction.REJECT,
            InspectionStatus.FINAL_REVIEW_REJECTED: AuditAction.REJECT,
            InspectionStatus.ARCHIVED: AuditAction.ARCHIVE,
        }
        action = action_map.get(item.target_status, AuditAction.BATCH_PROCESS)

        await create_audit_log(
            db=db,
            inspection_order_id=inspection.id,
            action=action,
            operator=current_user,
            from_status=from_status,
            to_status=item.target_status,
            detail=item.opinion or f"批量操作: 状态从 [{get_status_label(from_status)}] 变更为 [{get_status_label(item.target_status)}]",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            request_id=request_id,
        )

        result.success = True
        result.current_status = inspection.status
        result.next_step = "操作成功"

        return result

    finally:
        if lock_acquired:
            release_lock(item.inspection_order_id)


@router.post("/process", response_model=BatchProcessResult, summary="批量处理巡检单", description="批量处理巡检单，支持批量提交、批量审核、批量归档等")
async def batch_process(
    batch_data: BatchProcessRequest,
    request: Request,
    current_user: User = Depends(allow_all_authenticated),
    db: AsyncSession = Depends(get_db)
):
    if not batch_data.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请选择要处理的巡检单"
        )

    if len(batch_data.items) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="单次批量处理最多50条"
        )

    request_id = batch_data.request_id or generate_request_id()

    results: List[BatchItemResult] = []
    success_count = 0
    failed_count = 0

    for item in batch_data.items:
        item_result = await process_single_item(item, current_user, db, request, request_id)
        results.append(item_result)
        if item_result.success:
            success_count += 1
        else:
            failed_count += 1

    await db.commit()

    statistics = BatchStatistics(
        total_count=len(batch_data.items),
        success_count=success_count,
        failed_count=failed_count,
        skipped_count=0,
    )

    message = f"批量处理完成: 成功 {success_count} 条，失败 {failed_count} 条"
    if failed_count > 0:
        message += "，请查看失败详情"

    return BatchProcessResult(
        success=(failed_count == 0),
        message=message,
        statistics=statistics,
        results=results,
        request_id=request_id,
        completed_at=datetime.now(timezone.utc),
    )
