from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    REGISTRAR = 'registrar', '物料变更登记员'
    SUPERVISOR = 'supervisor', '物料变更审核主管'
    REVIEWER = 'reviewer', '电子元器件工厂复核负责人'


class User(models.Model):
    username = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=50)
    role = models.CharField(max_length=20, choices=Role.choices)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f'{self.name} ({self.get_role_display()})'


class ChangeOrderStatus(models.TextChoices):
    DRAFT = 'draft', '草稿'
    PENDING_REVIEW = 'pending_review', '待审核主管办理'
    SUPPLEMENT_REQUIRED = 'supplement_required', '需补正附件'
    PENDING_FINAL = 'pending_final', '待复核归档'
    RETURNED = 'returned', '已退回'
    ARCHIVED = 'archived', '已归档'
    OVERDUE = 'overdue', '已超时'


class MaterialChangeOrder(models.Model):
    order_no = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=200)
    material_code = models.CharField(max_length=100)
    material_name = models.CharField(max_length=200)
    change_type = models.CharField(max_length=100)
    description = models.TextField()
    status = models.CharField(max_length=30, choices=ChangeOrderStatus.choices, default=ChangeOrderStatus.DRAFT)
    
    registrar = models.ForeignKey(User, on_delete=models.PROTECT, related_name='registered_orders')
    supervisor = models.ForeignKey(User, on_delete=models.PROTECT, related_name='supervised_orders', null=True, blank=True)
    reviewer = models.ForeignKey(User, on_delete=models.PROTECT, related_name='reviewed_orders', null=True, blank=True)
    
    return_reason = models.TextField(blank=True, null=True)
    audit_remark = models.TextField(blank=True, null=True)
    supplement_note = models.TextField(blank=True, null=True)
    
    is_overdue = models.BooleanField(default=False)
    deadline = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'{self.order_no} - {self.title}'

    class Meta:
        ordering = ['-created_at']


class AttachmentStatus(models.TextChoices):
    UPLOADED = 'uploaded', '已上传'
    REJECTED = 'rejected', '已驳回'
    APPROVED = 'approved', '已通过'


class Attachment(models.Model):
    order = models.ForeignKey(MaterialChangeOrder, on_delete=models.CASCADE, related_name='attachments')
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    file_type = models.CharField(max_length=50)
    file_size = models.IntegerField(default=0)
    uploaded_by = models.ForeignKey(User, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=AttachmentStatus.choices, default=AttachmentStatus.UPLOADED)
    reject_reason = models.TextField(blank=True, null=True)
    rejected_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='rejected_attachments', null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f'{self.file_name} ({self.get_status_display()})'


class AuditAction(models.TextChoices):
    CREATED = 'created', '创建'
    SUBMITTED = 'submitted', '提交审核'
    APPROVED_SUPERVISOR = 'approved_supervisor', '审核主管通过'
    REJECTED_SUPERVISOR = 'rejected_supervisor', '审核主管退回'
    SUPPLEMENTED = 'supplemented', '补正附件'
    APPROVED_FINAL = 'approved_final', '复核通过归档'
    REJECTED_FINAL = 'rejected_final', '复核退回'
    ATTACHMENT_REJECTED = 'attachment_rejected', '附件驳回'
    ATTACHMENT_APPROVED = 'attachment_approved', '附件通过'
    REMARK_ADDED = 'remark_added', '添加审计备注'
    MARKED_OVERDUE = 'marked_overdue', '标记超时'


class AuditLog(models.Model):
    order = models.ForeignKey(MaterialChangeOrder, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=50, choices=AuditAction.choices)
    operator = models.ForeignKey(User, on_delete=models.PROTECT)
    reason = models.TextField(blank=True, null=True)
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f'{self.order.order_no} - {self.get_action_display()} by {self.operator.name}'

    class Meta:
        ordering = ['-created_at']
