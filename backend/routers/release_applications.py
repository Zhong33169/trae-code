from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from database import get_db
from auth import get_current_user, require_role
from models import RoleEnum, ReleaseStatusEnum, User
from schemas import (
    ReleaseApplicationCreate, ReleaseApplicationUpdate,
    ReleaseApplicationResponse, ReleaseApplicationListResponse,
    StatusUpdateRequest, BatchOperationRequest, BatchOperationResult
)
from crud import (
    get_release_applications, get_release_application,
    create_release_application, update_release_application,
    submit_for_review, review_approve, review_reject,
    submit_for_recheck, recheck_approve, recheck_reject,
    publish_release, rollback_release, archive_release,
    batch_submit_for_review, batch_archive
)

router = APIRouter(prefix="/api/release-applications", tags=["发布申请"])


@router.get("", response_model=ReleaseApplicationListResponse)
def list_applications(
    skip: int = 0,
    limit: int = 20,
    status: Optional[ReleaseStatusEnum] = None,
    project_name: Optional[str] = None,
    keyword: Optional[str] = None,
    my: Optional[bool] = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    creator_id = current_user.id if my else None
    result = get_release_applications(db, skip=skip, limit=limit, status=status,
                                       project_name=project_name, keyword=keyword,
                                       creator_id=creator_id)
    return result


@router.get("/{app_id}", response_model=ReleaseApplicationResponse)
def get_application(app_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    app = get_release_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="发布申请不存在")
    return app


@router.post("", response_model=ReleaseApplicationResponse)
def create_application(
    app_in: ReleaseApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.REGISTRAR]))
):
    app = create_release_application(db, app_in, current_user.id)
    return app


@router.put("/{app_id}", response_model=ReleaseApplicationResponse)
def update_application(
    app_id: int,
    app_in: ReleaseApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = get_release_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="发布申请不存在")
    if current_user.role == RoleEnum.REGISTRAR and app.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能编辑自己创建的申请")
    if app.status not in [ReleaseStatusEnum.DRAFT, ReleaseStatusEnum.REVIEW_REJECTED, ReleaseStatusEnum.RECHECK_REJECTED]:
        raise HTTPException(status_code=400, detail="当前状态不允许编辑")
    updated_app = update_release_application(db, app_id, app_in, current_user.id)
    return updated_app


@router.post("/{app_id}/submit-review", response_model=ReleaseApplicationResponse)
def submit_review(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.REGISTRAR]))
):
    app = get_release_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="发布申请不存在")
    if app.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能提交自己创建的申请")
    try:
        result = submit_for_review(db, app_id, current_user.id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{app_id}/review-approve", response_model=ReleaseApplicationResponse)
def approve_review(
    app_id: int,
    body: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.SUPERVISOR]))
):
    app = get_release_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="发布申请不存在")
    try:
        result = review_approve(db, app_id, current_user.id, body.comment)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{app_id}/review-reject", response_model=ReleaseApplicationResponse)
def reject_review(
    app_id: int,
    body: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.SUPERVISOR]))
):
    app = get_release_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="发布申请不存在")
    try:
        result = review_reject(db, app_id, current_user.id, body.comment)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{app_id}/submit-recheck", response_model=ReleaseApplicationResponse)
def submit_recheck(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.SUPERVISOR]))
):
    app = get_release_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="发布申请不存在")
    try:
        result = submit_for_recheck(db, app_id, current_user.id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{app_id}/recheck-approve", response_model=ReleaseApplicationResponse)
def approve_recheck(
    app_id: int,
    body: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.REVIEWER]))
):
    app = get_release_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="发布申请不存在")
    try:
        result = recheck_approve(db, app_id, current_user.id, body.comment)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{app_id}/recheck-reject", response_model=ReleaseApplicationResponse)
def reject_recheck(
    app_id: int,
    body: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.REVIEWER]))
):
    app = get_release_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="发布申请不存在")
    try:
        result = recheck_reject(db, app_id, current_user.id, body.comment)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{app_id}/publish", response_model=ReleaseApplicationResponse)
def publish(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.REVIEWER]))
):
    app = get_release_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="发布申请不存在")
    try:
        result = publish_release(db, app_id, current_user.id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{app_id}/rollback", response_model=ReleaseApplicationResponse)
def rollback(
    app_id: int,
    body: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.REVIEWER]))
):
    app = get_release_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="发布申请不存在")
    try:
        result = rollback_release(db, app_id, current_user.id, body.comment)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{app_id}/archive", response_model=ReleaseApplicationResponse)
def archive(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.REVIEWER]))
):
    app = get_release_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="发布申请不存在")
    try:
        result = archive_release(db, app_id, current_user.id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch", response_model=BatchOperationResult)
def batch_operation(
    body: BatchOperationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if body.operation == "submit_review":
        if current_user.role != RoleEnum.REGISTRAR:
            raise HTTPException(status_code=403, detail="权限不足")
        result = batch_submit_for_review(db, body.ids, current_user.id)
        return result
    elif body.operation == "archive":
        if current_user.role != RoleEnum.REVIEWER:
            raise HTTPException(status_code=403, detail="权限不足")
        result = batch_archive(db, body.ids, current_user.id)
        return result
    else:
        raise HTTPException(status_code=400, detail=f"不支持的批量操作: {body.operation}")
