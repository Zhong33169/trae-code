from django.db import models


class User(models.Model):
    ROLE_CHOICES = [
        ("community_worker", "社区专干"),
        ("clerk", "街道科员"),
        ("leader", "分管领导"),
    ]

    username = models.CharField(max_length=150, unique=True)
    password = models.CharField(max_length=128)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    display_name = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "custom_auth"
        db_table = "custom_auth_user"

    def __str__(self):
        return self.display_name
