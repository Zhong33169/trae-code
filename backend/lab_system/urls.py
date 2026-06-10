from django.contrib import admin
from django.urls import path
from ninja import NinjaAPI

from reservations.api import api as reservations_api

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', reservations_api.urls),
]
