from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user, require_role
from models import RoleEnum
from schemas import (
    PostLaunchReviewCreate, PostLaunchReviewUpdate, PostLaunchReviewResponse
)
from crud import (
    get_post_launch_review, create_post_launch_review,
    update_post_launch_review, complete_post_launch_review,
    get_release_application
)

router = APIRouter(prefix="/api/post-launch-reviews", tags=["上线复盘"])


@router.get("/{app_id}", response_model=PostLaunchReviewResponse)
def get_review(app_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    review = get_post_launch_review(db, app_id)
    if not review:
        raise HTTPException(status_code=404, detail="上线复盘不存在")
    return review


@router.post("", response_model=PostLaunchReviewResponse)
def create_review(
    review_in: PostLaunchReviewCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role([RoleEnum.REVIEWER]))
):
    app = get_release_application(db, review_in.release_application_id)
    if not app:
        raise HTTPException(status_code=404, detail="发布申请不存在")
    try:
        review = create_post_launch_review(db, review_in, current_user.id)
        return review
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{review_id}", response_model=PostLaunchReviewResponse)
def update_review(
    review_id: int,
    review_in: PostLaunchReviewUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    try:
        review = update_post_launch_review(db, review_id, review_in, current_user.id)
        if not review:
            raise HTTPException(status_code=404, detail="上线复盘不存在")
        return review
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{review_id}/complete", response_model=PostLaunchReviewResponse)
def complete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role([RoleEnum.REVIEWER]))
):
    try:
        review = complete_post_launch_review(db, review_id, current_user.id)
        if not review:
            raise HTTPException(status_code=404, detail="上线复盘不存在")
        return review
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
