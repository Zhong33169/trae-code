from django.apps import AppConfig


class CustomAuthConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.auth"
    label = "custom_auth"
    verbose_name = "用户认证"
