from django.urls import path
from apps.loan.api import api

urlpatterns = [
    path('api/', api.urls),
]
