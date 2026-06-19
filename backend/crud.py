from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from models import (
    User, ReleaseApplication, RollbackPlan, PostLaunchReview,
    ShiftHandover, OperationLog, ReleaseStatusEnum, RoleEnum
)
from schemas import (
    ReleaseApplicationCreate, ReleaseApplicationUpdate,
    RollbackPlanCreate, RollbackPlanUpdate,
    PostLaunchReviewCreate, PostLaunchReviewUpdate,
    ShiftHandoverCreate
)
from auth import get_password_hash


def create_user(db: Session, username: str, full_name: str, password: str, role: RoleEnum):
    hashed_password = get_password_hash(password)
    db_user = User(
        username=username,
        full_name=full_name,
        hashed_password=hashed_password,
        role=role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(User).offset(skip).limit(limit).all()


def create_operation_log(db: Session, operator_id: int, operation_type: str,
                         release_application_id: Optional[int] = None,
                         operation_detail: Optional[str] = None,
                         old_status: Optional[str] = None,
                         new_status: Optional[str] = None):
    log = OperationLog(
        release_application_id=release_application_id,
        operator_id=operator_id,
        operation_type=operation_type,
        operation_detail=operation_detail,
        old_status=old_status,
        new_status=new_status
    )
    db.add(log)
    db.commit()
    return log


def get_release_applications(db: Session, skip: int = 0, limit: int = 100,
                              status: Optional[ReleaseStatusEnum] = None,
                              project_name: Optional[str] = None,
                              keyword: Optional[str] = None,
                              creator_id: Optional[int] = None):
    query = db.query(ReleaseApplication)
    if status:
        query = query.filter(ReleaseApplication.status == status)
    if project_name:
        query = query.filter(ReleaseApplication.project_name.like(f"%{project_name}%"))
    if keyword:
        query = query.filter(
            (ReleaseApplication.title.like(f"%{keyword}%")) |
            (ReleaseApplication.project_name.like(f"%{keyword}%")) |
            (ReleaseApplication.version.like(f"%{keyword}%"))
        )
    if creator_id:
        query = query.filter(ReleaseApplication.creator_id == creator_id)
    query = query.order_by(ReleaseApplication.created_at.desc())
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return {"total": total, "items": items}


def get_release_application(db: Session, app_id: int):
    return db.query(ReleaseApplication).filter(ReleaseApplication.id == app_id).first()


def create_release_application(db: Session, app_in: ReleaseApplicationCreate, creator_id: int):
    db_app = ReleaseApplication(**app_in.model_dump(), creator_id=creator_id)
    db.add(db_app)
    db.commit()
    db.refresh(db_app)
    create_operation_log(
        db, creator_id, "create", db_app.id,
        f"创建发布申请: {db_app.title}",
        new_status=ReleaseStatusEnum.DRAFT.value
    )
    return db_app


def update_release_application(db: Session, app_id: int, app_in: ReleaseApplicationUpdate, operator_id: int):
    db_app = get_release_application(db, app_id)
    if not db_app:
        return None
    update_data = app_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_app, key, value)
    db.commit()
    db.refresh(db_app)
    create_operation_log(
        db, operator_id, "update", app_id,
        f"更新发布申请信息"
    )
    return db_app


def submit_for_review(db: Session, app_id: int, operator_id: int):
    db_app = get_release_application(db, app_id)
    if not db_app:
        return None
    old_status = db_app.status
    if db_app.status not in [ReleaseStatusEnum.DRAFT, ReleaseStatusEnum.REVIEW_REJECTED, ReleaseStatusEnum.RECHECK_REJECTED]:
        raise ValueError("当前状态不允许提交审核，仅草稿、审核驳回或复核驳回状态可提交")
    db_app.status = ReleaseStatusEnum.PENDING_REVIEW
    db.commit()
    db.refresh(db_app)
    create_operation_log(
        db, operator_id, "submit_review", app_id,
        f"提交审核",
        old_status=old_status.value,
        new_status=ReleaseStatusEnum.PENDING_REVIEW.value
    )
    return db_app


def review_approve(db: Session, app_id: int, operator_id: int, comment: Optional[str] = None):
    db_app = get_release_application(db, app_id)
    if not db_app:
        return None
    old_status = db_app.status
    if db_app.status != ReleaseStatusEnum.PENDING_REVIEW:
        raise ValueError("当前状态不允许审核通过，需先提交审核")
    db_app.status = ReleaseStatusEnum.REVIEW_APPROVED
    db_app.reviewer_id = operator_id
    db_app.review_comment = comment
    db.commit()
    db.refresh(db_app)
    create_operation_log(
        db, operator_id, "review_approve", app_id,
        f"审核通过: {comment or ''}",
        old_status=old_status.value,
        new_status=ReleaseStatusEnum.REVIEW_APPROVED.value
    )
    return db_app


def review_reject(db: Session, app_id: int, operator_id: int, comment: Optional[str] = None):
    db_app = get_release_application(db, app_id)
    if not db_app:
        return None
    old_status = db_app.status
    if db_app.status != ReleaseStatusEnum.PENDING_REVIEW:
        raise ValueError("当前状态不允许审核驳回，需先提交审核")
    db_app.status = ReleaseStatusEnum.REVIEW_REJECTED
    db_app.reviewer_id = operator_id
    db_app.review_comment = comment
    db.commit()
    db.refresh(db_app)
    create_operation_log(
        db, operator_id, "review_reject", app_id,
        f"审核驳回: {comment or ''}",
        old_status=old_status.value,
        new_status=ReleaseStatusEnum.REVIEW_REJECTED.value
    )
    return db_app


def submit_for_recheck(db: Session, app_id: int, operator_id: int):
    db_app = get_release_application(db, app_id)
    if not db_app:
        return None
    old_status = db_app.status
    if db_app.status != ReleaseStatusEnum.REVIEW_APPROVED:
        raise ValueError("当前状态不允许提交复核，需先审核通过")
    db_app.status = ReleaseStatusEnum.PENDING_RECHECK
    db.commit()
    db.refresh(db_app)
    create_operation_log(
        db, operator_id, "submit_recheck", app_id,
        f"提交复核",
        old_status=old_status.value,
        new_status=ReleaseStatusEnum.PENDING_RECHECK.value
    )
    return db_app


def recheck_approve(db: Session, app_id: int, operator_id: int, comment: Optional[str] = None):
    db_app = get_release_application(db, app_id)
    if not db_app:
        return None
    old_status = db_app.status
    if db_app.status != ReleaseStatusEnum.PENDING_RECHECK:
        raise ValueError("当前状态不允许复核通过，需先提交复核")
    db_app.status = ReleaseStatusEnum.RECHECK_APPROVED
    db_app.rechecker_id = operator_id
    db_app.recheck_comment = comment
    db.commit()
    db.refresh(db_app)
    create_operation_log(
        db, operator_id, "recheck_approve", app_id,
        f"复核通过: {comment or ''}",
        old_status=old_status.value,
        new_status=ReleaseStatusEnum.RECHECK_APPROVED.value
    )
    return db_app


def recheck_reject(db: Session, app_id: int, operator_id: int, comment: Optional[str] = None):
    db_app = get_release_application(db, app_id)
    if not db_app:
        return None
    old_status = db_app.status
    if db_app.status != ReleaseStatusEnum.PENDING_RECHECK:
        raise ValueError("当前状态不允许复核驳回，需先提交复核")
    db_app.status = ReleaseStatusEnum.RECHECK_REJECTED
    db_app.rechecker_id = operator_id
    db_app.recheck_comment = comment
    db.commit()
    db.refresh(db_app)
    create_operation_log(
        db, operator_id, "recheck_reject", app_id,
        f"复核驳回: {comment or ''}",
        old_status=old_status.value,
        new_status=ReleaseStatusEnum.RECHECK_REJECTED.value
    )
    return db_app


def publish_release(db: Session, app_id: int, operator_id: int):
    db_app = get_release_application(db, app_id)
    if not db_app:
        return None
    old_status = db_app.status
    if db_app.status != ReleaseStatusEnum.RECHECK_APPROVED:
        raise ValueError("当前状态不允许发布，需先完成复核通过")
    rollback_plan = db.query(RollbackPlan).filter(RollbackPlan.release_application_id == app_id).first()
    if not rollback_plan:
        raise ValueError("发布前必须创建回滚预案")
    if not rollback_plan.is_approved:
        raise ValueError("回滚预案尚未审核通过，无法发布")
    unconfirmed = db.query(ShiftHandover).filter(
        ShiftHandover.release_application_id == app_id,
        ShiftHandover.is_confirmed == False
    ).count()
    if unconfirmed > 0:
        raise ValueError(f"存在 {unconfirmed} 条未确认的换班交接，所有交接确认后方可发布")
    confirmed = db.query(ShiftHandover).filter(
        ShiftHandover.release_application_id == app_id,
        ShiftHandover.is_confirmed == True
    ).count()
    if confirmed == 0:
        raise ValueError("发布前必须至少有一条已确认的换班交接，交接是发布就绪的必经证据链")
    db_app.status = ReleaseStatusEnum.PUBLISHED
    db.commit()
    db.refresh(db_app)
    create_operation_log(
        db, operator_id, "publish", app_id,
        f"版本已发布（回滚预案已审核、交接已全部确认）",
        old_status=old_status.value,
        new_status=ReleaseStatusEnum.PUBLISHED.value
    )
    return db_app


def rollback_release(db: Session, app_id: int, operator_id: int, reason: Optional[str] = None):
    db_app = get_release_application(db, app_id)
    if not db_app:
        return None
    old_status = db_app.status
    if db_app.status not in [ReleaseStatusEnum.PUBLISHED, ReleaseStatusEnum.REVIEWED_POST_LAUNCH]:
        raise ValueError("仅已发布或已复盘状态可以回滚")
    db_app.status = ReleaseStatusEnum.ROLLED_BACK
    db.commit()
    db.refresh(db_app)
    create_operation_log(
        db, operator_id, "rollback", app_id,
        f"版本回滚: {reason or ''}",
        old_status=old_status.value,
        new_status=ReleaseStatusEnum.ROLLED_BACK.value
    )
    return db_app


def archive_release(db: Session, app_id: int, operator_id: int):
    db_app = get_release_application(db, app_id)
    if not db_app:
        return None
    old_status = db_app.status
    if db_app.status not in [ReleaseStatusEnum.REVIEWED_POST_LAUNCH, ReleaseStatusEnum.ROLLED_BACK]:
        raise ValueError("仅已完成上线复盘或已回滚的发布申请可以归档")
    db_app.status = ReleaseStatusEnum.ARCHIVED
    db.commit()
    db.refresh(db_app)
    create_operation_log(
        db, operator_id, "archive", app_id,
        f"归档发布申请",
        old_status=old_status.value,
        new_status=ReleaseStatusEnum.ARCHIVED.value
    )
    return db_app


def get_rollback_plan(db: Session, app_id: int):
    return db.query(RollbackPlan).filter(RollbackPlan.release_application_id == app_id).first()


def create_rollback_plan(db: Session, plan_in: RollbackPlanCreate, operator_id: int):
    db_app = get_release_application(db, plan_in.release_application_id)
    if not db_app:
        return None
    existing = get_rollback_plan(db, plan_in.release_application_id)
    if existing:
        raise ValueError("回滚预案已存在")
    db_plan = RollbackPlan(**plan_in.model_dump())
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    create_operation_log(
        db, operator_id, "create_rollback_plan", plan_in.release_application_id,
        f"创建回滚预案"
    )
    return db_plan


def update_rollback_plan(db: Session, plan_id: int, plan_in: RollbackPlanUpdate, operator_id: int):
    db_plan = db.query(RollbackPlan).filter(RollbackPlan.id == plan_id).first()
    if not db_plan:
        return None
    update_data = plan_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_plan, key, value)
    db.commit()
    db.refresh(db_plan)
    create_operation_log(
        db, operator_id, "update_rollback_plan", db_plan.release_application_id,
        f"更新回滚预案"
    )
    return db_plan


def approve_rollback_plan(db: Session, plan_id: int, operator_id: int):
    db_plan = db.query(RollbackPlan).filter(RollbackPlan.id == plan_id).first()
    if not db_plan:
        return None
    db_plan.is_approved = True
    db_plan.approved_by = operator_id
    from datetime import datetime
    db_plan.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(db_plan)
    create_operation_log(
        db, operator_id, "approve_rollback_plan", db_plan.release_application_id,
        f"审核通过回滚预案"
    )
    return db_plan


def get_post_launch_review(db: Session, app_id: int):
    return db.query(PostLaunchReview).filter(PostLaunchReview.release_application_id == app_id).first()


def create_post_launch_review(db: Session, review_in: PostLaunchReviewCreate, operator_id: int):
    db_app = get_release_application(db, review_in.release_application_id)
    if not db_app:
        return None
    if db_app.status != ReleaseStatusEnum.PUBLISHED:
        raise ValueError("仅已发布状态可以创建上线复盘")
    existing = get_post_launch_review(db, review_in.release_application_id)
    if existing:
        raise ValueError("上线复盘已存在")
    db_review = PostLaunchReview(**review_in.model_dump())
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    create_operation_log(
        db, operator_id, "create_post_launch_review", review_in.release_application_id,
        f"创建上线复盘"
    )
    return db_review


def update_post_launch_review(db: Session, review_id: int, review_in: PostLaunchReviewUpdate, operator_id: int):
    db_review = db.query(PostLaunchReview).filter(PostLaunchReview.id == review_id).first()
    if not db_review:
        return None
    update_data = review_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_review, key, value)
    db.commit()
    db.refresh(db_review)
    create_operation_log(
        db, operator_id, "update_post_launch_review", db_review.release_application_id,
        f"更新上线复盘"
    )
    return db_review


def complete_post_launch_review(db: Session, review_id: int, operator_id: int):
    db_review = db.query(PostLaunchReview).filter(PostLaunchReview.id == review_id).first()
    if not db_review:
        return None
    db_app = get_release_application(db, db_review.release_application_id)
    if not db_app or db_app.status != ReleaseStatusEnum.PUBLISHED:
        raise ValueError("发布申请状态不允许完成上线复盘，需先发布")
    from datetime import datetime
    db_review.reviewer_id = operator_id
    db_review.reviewed_at = datetime.utcnow()
    old_status = db_app.status
    db_app.status = ReleaseStatusEnum.REVIEWED_POST_LAUNCH
    db.commit()
    db.refresh(db_review)
    db.refresh(db_app)
    create_operation_log(
        db, operator_id, "complete_post_launch_review", db_review.release_application_id,
        f"完成上线复盘，状态变更为已复盘",
        old_status=old_status.value,
        new_status=ReleaseStatusEnum.REVIEWED_POST_LAUNCH.value
    )
    return db_review


def create_shift_handover(db: Session, handover_in: ShiftHandoverCreate, from_user_id: int):
    db_app = get_release_application(db, handover_in.release_application_id)
    if not db_app:
        return None
    db_handover = ShiftHandover(
        release_application_id=handover_in.release_application_id,
        from_user_id=from_user_id,
        to_user_id=handover_in.to_user_id,
        shift=handover_in.shift,
        handover_content=handover_in.handover_content
    )
    db.add(db_handover)
    db.commit()
    db.refresh(db_handover)
    create_operation_log(
        db, from_user_id, "create_handover", handover_in.release_application_id,
        f"发起换班交接，班次: {handover_in.shift.value}"
    )
    return db_handover


def confirm_shift_handover(db: Session, handover_id: int, to_user_id: int):
    db_handover = db.query(ShiftHandover).filter(ShiftHandover.id == handover_id).first()
    if not db_handover:
        return None
    if db_handover.to_user_id != to_user_id:
        raise ValueError("只有接收人可以确认交接")
    if db_handover.is_confirmed:
        raise ValueError("该交接已确认")
    from datetime import datetime
    db_handover.is_confirmed = True
    db_handover.confirmed_at = datetime.utcnow()
    db.commit()
    db.refresh(db_handover)
    create_operation_log(
        db, to_user_id, "confirm_handover", db_handover.release_application_id,
        f"确认换班交接，班次: {db_handover.shift.value}"
    )
    return db_handover


def get_shift_handovers(db: Session, app_id: Optional[int] = None, user_id: Optional[int] = None):
    query = db.query(ShiftHandover)
    if app_id:
        query = query.filter(ShiftHandover.release_application_id == app_id)
    if user_id:
        query = query.filter(
            (ShiftHandover.from_user_id == user_id) | (ShiftHandover.to_user_id == user_id)
        )
    query = query.order_by(ShiftHandover.created_at.desc())
    return query.all()


def get_operation_logs(db: Session, app_id: Optional[int] = None, operator_id: Optional[int] = None,
                        skip: int = 0, limit: int = 100):
    query = db.query(OperationLog)
    if app_id:
        query = query.filter(OperationLog.release_application_id == app_id)
    if operator_id:
        query = query.filter(OperationLog.operator_id == operator_id)
    query = query.order_by(OperationLog.created_at.desc())
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return {"total": total, "items": items}


def get_statistics(db: Session):
    stats = {
        "total": db.query(ReleaseApplication).count(),
        "draft": db.query(ReleaseApplication).filter(ReleaseApplication.status == ReleaseStatusEnum.DRAFT).count(),
        "pending_review": db.query(ReleaseApplication).filter(ReleaseApplication.status == ReleaseStatusEnum.PENDING_REVIEW).count(),
        "review_approved": db.query(ReleaseApplication).filter(ReleaseApplication.status == ReleaseStatusEnum.REVIEW_APPROVED).count(),
        "review_rejected": db.query(ReleaseApplication).filter(ReleaseApplication.status == ReleaseStatusEnum.REVIEW_REJECTED).count(),
        "pending_recheck": db.query(ReleaseApplication).filter(ReleaseApplication.status == ReleaseStatusEnum.PENDING_RECHECK).count(),
        "recheck_approved": db.query(ReleaseApplication).filter(ReleaseApplication.status == ReleaseStatusEnum.RECHECK_APPROVED).count(),
        "recheck_rejected": db.query(ReleaseApplication).filter(ReleaseApplication.status == ReleaseStatusEnum.RECHECK_REJECTED).count(),
        "published": db.query(ReleaseApplication).filter(ReleaseApplication.status == ReleaseStatusEnum.PUBLISHED).count(),
        "rolled_back": db.query(ReleaseApplication).filter(ReleaseApplication.status == ReleaseStatusEnum.ROLLED_BACK).count(),
        "reviewed_post_launch": db.query(ReleaseApplication).filter(ReleaseApplication.status == ReleaseStatusEnum.REVIEWED_POST_LAUNCH).count(),
        "archived": db.query(ReleaseApplication).filter(ReleaseApplication.status == ReleaseStatusEnum.ARCHIVED).count(),
    }

    by_project = db.query(
        ReleaseApplication.project_name,
        func.count(ReleaseApplication.id)
    ).group_by(ReleaseApplication.project_name).all()
    stats["by_project"] = {name: count for name, count in by_project}

    by_creator = db.query(
        User.full_name,
        func.count(ReleaseApplication.id)
    ).join(ReleaseApplication, ReleaseApplication.creator_id == User.id
    ).group_by(User.id, User.full_name).all()
    stats["by_creator"] = {name: count for name, count in by_creator}

    return stats


def batch_submit_for_review(db: Session, ids: List[int], operator_id: int):
    success = []
    failed = []
    messages = {}
    for app_id in ids:
        try:
            submit_for_review(db, app_id, operator_id)
            success.append(app_id)
            messages[str(app_id)] = "提交成功"
        except ValueError as e:
            failed.append(app_id)
            messages[str(app_id)] = str(e)
    return {"success": success, "failed": failed, "messages": messages}


def batch_archive(db: Session, ids: List[int], operator_id: int):
    success = []
    failed = []
    messages = {}
    for app_id in ids:
        try:
            archive_release(db, app_id, operator_id)
            success.append(app_id)
            messages[str(app_id)] = "归档成功"
        except ValueError as e:
            failed.append(app_id)
            messages[str(app_id)] = str(e)
    return {"success": success, "failed": failed, "messages": messages}
