from django.urls import path
from ninja import NinjaAPI

api = NinjaAPI(csrf=False, title="街道办事处帮扶申请系统", version="1.0.0")

from apps.auth.api import router as auth_router
from apps.applications.api import router as applications_router

api.add_router("auth", auth_router)
api.add_router("", applications_router)

urlpatterns = [
    path("api/", api.urls),
]
