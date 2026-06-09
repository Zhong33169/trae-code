from django.contrib import admin

from .models import GlassesOrder, OrderAttachment, AuditLog, SystemUser


@admin.register(GlassesOrder)
class GlassesOrderAdmin(admin.ModelAdmin):
    list_display = [
        'order_no', 'patient_name', 'batch_no', 'status',
        'is_overdue', 'registered_by', 'created_at',
    ]
    list_filter = ['status', 'is_overdue', 'offline_status']
    search_fields = ['order_no', 'batch_no', 'patient_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(OrderAttachment)
class OrderAttachmentAdmin(admin.ModelAdmin):
    list_display = ['file_name', 'order', 'file_type', 'uploaded_by', 'uploaded_at']
    list_filter = ['file_type']
    search_fields = ['file_name', 'order__order_no']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'actor', 'actor_role', 'order', 'is_failure', 'created_at']
    list_filter = ['action', 'actor_role', 'is_failure']
    search_fields = ['actor', 'detail', 'reason']


@admin.register(SystemUser)
class SystemUserAdmin(admin.ModelAdmin):
    list_display = ['name', 'username', 'role', 'created_at']
    list_filter = ['role']
    search_fields = ['name', 'username']
