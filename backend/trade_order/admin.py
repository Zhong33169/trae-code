from django.contrib import admin
from .models import (
    TradeOrder, OrderEvidence, BatchOperation, BatchOperationItem,
    OrderHistory, UserProfile,
)


@admin.register(TradeOrder)
class TradeOrderAdmin(admin.ModelAdmin):
    list_display = ["order_no", "customer_name", "product_name", "amount", "status", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["order_no", "customer_name", "product_name"]
    readonly_fields = ["version", "created_at", "updated_at"]


@admin.register(OrderEvidence)
class OrderEvidenceAdmin(admin.ModelAdmin):
    list_display = ["order", "evidence_type", "file_name", "uploader", "uploaded_at"]
    list_filter = ["evidence_type", "uploaded_at"]


@admin.register(BatchOperation)
class BatchOperationAdmin(admin.ModelAdmin):
    list_display = ["batch_no", "action", "operator", "status", "total_count", "success_count", "failed_count", "retry_count", "created_at"]
    list_filter = ["action", "status", "created_at"]


@admin.register(BatchOperationItem)
class BatchOperationItemAdmin(admin.ModelAdmin):
    list_display = ["batch", "order", "item_status", "error_code", "error_message", "processed_at"]
    list_filter = ["item_status"]


@admin.register(OrderHistory)
class OrderHistoryAdmin(admin.ModelAdmin):
    list_display = ["order", "operator", "action", "from_status", "to_status", "created_at"]
    list_filter = ["action", "created_at"]


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "display_name", "role", "phone"]
    list_filter = ["role"]
