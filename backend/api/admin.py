from django.contrib import admin
from .models import User, MaterialChangeOrder, Attachment, AuditLog


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'name', 'role', 'created_at']


@admin.register(MaterialChangeOrder)
class MaterialChangeOrderAdmin(admin.ModelAdmin):
    list_display = ['order_no', 'title', 'material_code', 'status', 'registrar', 'created_at']
    list_filter = ['status']
    search_fields = ['order_no', 'title', 'material_code']


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ['file_name', 'order', 'status', 'uploaded_by', 'created_at']
    list_filter = ['status']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['order', 'action', 'operator', 'created_at']
    list_filter = ['action']
