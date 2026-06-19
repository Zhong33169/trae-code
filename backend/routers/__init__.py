from routers.auth import router as auth_router
from routers.release_applications import router as release_router
from routers.rollback_plans import router as rollback_router
from routers.post_launch_reviews import router as review_router
from routers.shift_handovers import router as handover_router
from routers.common import router as common_router

__all__ = [
    "auth_router",
    "release_router",
    "rollback_router",
    "review_router",
    "handover_router",
    "common_router"
]
