from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user, require_role
from models import RoleEnum
from schemas import (
    RollbackPlanCreate, RollbackPlanUpdate, RollbackPlanResponse
)
from crud import (
    get_rollback_plan, create_rollback_plan, update_rollback_plan,
    approve_rollback_plan, get_release_application
)

router = APIRouter(prefix="/api/rollback-plans", tags=["回滚预案"])


@router.get("/{app_id}", response_model=RollbackPlanResponse)
def get_plan(app_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    plan = get_rollback_plan(db, app_id)
    if not plan:
        raise HTTPException(status_code=404, detail="回滚预案不存在")
    return plan


@router.post("", response_model=RollbackPlanResponse)
def create_plan(
    plan_in: RollbackPlanCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role([RoleEnum.REGISTRAR, RoleEnum.SUPERVISOR]))
):
    app = get_release_application(db, plan_in.release_application_id)
    if not app:
        raise HTTPException(status_code=404, detail="发布申请不存在")
    try:
        plan = create_rollback_plan(db, plan_in, current_user.id)
        return plan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{plan_id}", response_model=RollbackPlanResponse)
def update_plan(
    plan_id: int,
    plan_in: RollbackPlanUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    try:
        plan = update_rollback_plan(db, plan_id, plan_in, current_user.id)
        if not plan:
            raise HTTPException(status_code=404, detail="回滚预案不存在")
        return plan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{plan_id}/approve", response_model=RollbackPlanResponse)
def approve_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role([RoleEnum.SUPERVISOR]))
):
    plan = approve_rollback_plan(db, plan_id, current_user.id)
    if not plan:
        raise HTTPException(status_code=404, detail="回滚预案不存在")
    return plan
