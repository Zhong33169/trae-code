from django.contrib import admin
from django.urls import path
from ninja import NinjaAPI

from glasses.api import router as glasses_router

api = NinjaAPI(
    title='眼科诊所配镜订单系统 API',
    description='离线台账回填配镜订单系统后端接口',
    version='1.0.0',
)

api.add_router('/glasses', glasses_router)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', api.urls),
]
