from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from models.audit_log import AuditLog, AuditAction
from models.inspection import InspectionStatus
from models.user import User
from utils.label import get_status_label, get_action_label, get_role_label


async def create_audit_log(
    db: AsyncSession,
    inspection_order_id: Optional[int],
    action: AuditAction,
    operator: User,
    from_status: Optional[InspectionStatus] = None,
    to_status: Optional[InspectionStatus] = None,
    detail: Optional[str] = None,
    opinion: Optional[str] = None,
    signature: Optional[str] = None,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
    suggestion: Optional[str] = None,
    next_step: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    request_id: Optional[str] = None,
) -> AuditLog:
    log = AuditLog(
        inspection_order_id=inspection_order_id,
        action=action,
        from_status=from_status.value if from_status else None,
        to_status=to_status.value if to_status else None,
        operator_id=operator.id,
        operator_name=operator.full_name,
        operator_role=operator.role.value,
        detail=detail,
        opinion=opinion,
        signature=signature,
        error_code=error_code,
        error_message=error_message,
        suggestion=suggestion,
        next_step=next_step,
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=request_id,
    )
    db.add(log)
    await db.flush()
    return log
