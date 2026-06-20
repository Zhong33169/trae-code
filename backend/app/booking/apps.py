from django.apps import AppConfig as BaseAppConfig


class BookingConfig(BaseAppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'app.booking'
    verbose_name = '订舱管理'

    def ready(self):
        from . import signals  # noqa
