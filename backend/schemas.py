from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from models import RoleEnum, ReleaseStatusEnum, ShiftEnum


class UserBase(BaseModel):
    username: str
    full_name: str
    role: RoleEnum


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class ReleaseApplicationBase(BaseModel):
    title: str
    project_name: str
    version: str
    description: Optional[str] = None
    release_content: Optional[str] = None
    impact_scope: Optional[str] = None
    planned_release_time: Optional[datetime] = None


class ReleaseApplicationCreate(ReleaseApplicationBase):
    pass


class ReleaseApplicationUpdate(BaseModel):
    title: Optional[str] = None
    project_name: Optional[str] = None
    version: Optional[str] = None
    description: Optional[str] = None
    release_content: Optional[str] = None
    impact_scope: Optional[str] = None
    planned_release_time: Optional[datetime] = None


class ReleaseApplicationResponse(ReleaseApplicationBase):
    id: int
    status: ReleaseStatusEnum
    creator_id: Optional[int] = None
    reviewer_id: Optional[int] = None
    rechecker_id: Optional[int] = None
    review_comment: Optional[str] = None
    recheck_comment: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    creator: Optional[UserResponse] = None
    reviewer: Optional[UserResponse] = None
    rechecker: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class ReleaseApplicationListResponse(BaseModel):
    total: int
    items: List[ReleaseApplicationResponse]


class StatusUpdateRequest(BaseModel):
    comment: Optional[str] = None


class RollbackPlanBase(BaseModel):
    trigger_condition: str
    rollback_steps: str
    rollback_person: Optional[str] = None
    expected_duration: Optional[str] = None


class RollbackPlanCreate(RollbackPlanBase):
    release_application_id: int


class RollbackPlanUpdate(BaseModel):
    trigger_condition: Optional[str] = None
    rollback_steps: Optional[str] = None
    rollback_person: Optional[str] = None
    expected_duration: Optional[str] = None
    is_approved: Optional[bool] = None


class RollbackPlanResponse(RollbackPlanBase):
    id: int
    release_application_id: int
    is_approved: bool
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PostLaunchReviewBase(BaseModel):
    review_content: Optional[str] = None
    issues_found: Optional[str] = None
    improvement_measures: Optional[str] = None
    release_result: Optional[str] = None


class PostLaunchReviewCreate(PostLaunchReviewBase):
    release_application_id: int


class PostLaunchReviewUpdate(PostLaunchReviewBase):
    pass


class PostLaunchReviewResponse(PostLaunchReviewBase):
    id: int
    release_application_id: int
    reviewer_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ShiftHandoverBase(BaseModel):
    release_application_id: int
    to_user_id: int
    shift: ShiftEnum
    handover_content: Optional[str] = None


class ShiftHandoverCreate(ShiftHandoverBase):
    pass


class ShiftHandoverResponse(BaseModel):
    id: int
    release_application_id: int
    from_user_id: int
    to_user_id: int
    shift: ShiftEnum
    handover_content: Optional[str] = None
    is_confirmed: bool
    confirmed_at: Optional[datetime] = None
    created_at: datetime
    from_user: Optional[UserResponse] = None
    to_user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class OperationLogResponse(BaseModel):
    id: int
    release_application_id: Optional[int] = None
    operator_id: int
    operation_type: str
    operation_detail: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    created_at: datetime
    operator: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class OperationLogListResponse(BaseModel):
    total: int
    items: List[OperationLogResponse]


class StatisticsResponse(BaseModel):
    total: int
    draft: int
    pending_review: int
    review_approved: int
    review_rejected: int
    pending_recheck: int
    recheck_approved: int
    recheck_rejected: int
    published: int
    rolled_back: int
    reviewed_post_launch: int
    archived: int
    by_project: dict
    by_creator: dict


class BatchOperationRequest(BaseModel):
    ids: List[int]
    operation: str
    comment: Optional[str] = None


class BatchOperationResult(BaseModel):
    success: List[int]
    failed: List[int]
    messages: dict
