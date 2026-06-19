from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from auth import get_current_user
from models import User
from schemas import ShiftHandoverCreate, ShiftHandoverResponse
from crud import (
    create_shift_handover, confirm_shift_handover,
    get_shift_handovers
)

router = APIRouter(prefix="/api/shift-handovers", tags=["换班交接"])


@router.get("", response_model=List[ShiftHandoverResponse])
def list_handovers(
    app_id: Optional[int] = None,
    my: Optional[bool] = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id if my else None
    handovers = get_shift_handovers(db, app_id=app_id, user_id=user_id)
    return handovers


@router.post("", response_model=ShiftHandoverResponse)
def create_handover(
    handover_in: ShiftHandoverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        handover = create_shift_handover(db, handover_in, current_user.id)
        if not handover:
            raise HTTPException(status_code=404, detail="发布申请不存在")
        return handover
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{handover_id}/confirm", response_model=ShiftHandoverResponse)
def confirm_handover(
    handover_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        handover = confirm_shift_handover(db, handover_id, current_user.id)
        if not handover:
            raise HTTPException(status_code=404, detail="交接记录不存在")
        return handover
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
