from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from auth import get_current_user
from schemas import OperationLogResponse, OperationLogListResponse, StatisticsResponse, UserResponse
from crud import get_operation_logs, get_statistics, get_users

router = APIRouter(prefix="/api", tags=["通用"])


@router.get("/operation-logs", response_model=OperationLogListResponse)
def list_operation_logs(
    app_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = get_operation_logs(db, app_id=app_id, skip=skip, limit=limit)
    return result


@router.get("/statistics", response_model=StatisticsResponse)
def statistics(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return get_statistics(db)


@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return get_users(db)
