from django.contrib import admin
from django.urls import path
from ninja import NinjaAPI
from ninja.errors import HttpError
from trade_order.api import router as order_router, APIError


api = NinjaAPI(title="外贸订单管理 API", version="1.0.0")


@api.exception_handler(APIError)
def api_error_handler(request, exc):
    return api.create_response(
        request,
        {"code": exc.code, "message": exc.message},
        status=exc.status_code,
    )


@api.exception_handler(HttpError)
def http_error_handler(request, exc):
    data = {"code": "UNKNOWN_ERROR", "message": str(exc)}
    if exc.args:
        msg = exc.args[0]
        if isinstance(msg, dict):
            data = msg
        elif isinstance(msg, str):
            try:
                import json
                data = json.loads(msg)
            except Exception:
                data = {"code": "UNKNOWN_ERROR", "message": msg}
    return api.create_response(request, data, status=exc.status_code)


api.add_router("/orders", order_router)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]
