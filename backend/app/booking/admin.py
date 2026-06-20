from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, BookingApplication, OperationLog, AuditLog,
    Attachment, OfflineLedgerRecord,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'real_name', 'role', 'is_active', 'date_joined')
    list_filter = ('role', 'is_active')
    search_fields = ('username', 'real_name')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('扩展信息', {'fields': ('real_name', 'role', 'phone')}),
    )


@admin.register(BookingApplication)
class BookingApplicationAdmin(admin.ModelAdmin):
    list_display = (
        'form_no', 'batch_no', 'customer', 'booking_status',
        'loading_status', 'bl_status', 'submitter', 'created_at',
    )
    list_filter = ('booking_status', 'loading_status', 'bl_status', 'is_exception')
    search_fields = ('form_no', 'batch_no', 'customer', 'bl_no')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'updated_at')


@admin.register(OperationLog)
class OperationLogAdmin(admin.ModelAdmin):
    list_display = (
        'booking', 'action', 'operator', 'role',
        'from_status', 'to_status', 'created_at',
    )
    list_filter = ('action', 'role', 'created_at')
    search_fields = ('booking__form_no', 'operator__username', 'remark')
    date_hierarchy = 'created_at'


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        'booking', 'audit_type', 'auditor', 'result', 'created_at',
    )
    list_filter = ('audit_type', 'result', 'created_at')
    search_fields = ('booking__form_no', 'auditor__username', 'fail_reason')
    date_hierarchy = 'created_at'


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ('booking', 'category', 'file_name', 'uploader', 'created_at')
    list_filter = ('category', 'created_at')
    search_fields = ('booking__form_no', 'file_name')


@admin.register(OfflineLedgerRecord)
class OfflineLedgerRecordAdmin(admin.ModelAdmin):
    list_display = (
        'booking', 'field_name', 'old_value', 'new_value',
        'operator', 'created_at',
    )
    list_filter = ('field_name', 'created_at')
    search_fields = ('booking__form_no', 'field_name')
