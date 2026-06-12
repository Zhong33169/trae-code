from django.db import models
from apps.auth.models import User


class Application(models.Model):
    DIFFICULTY_CHOICES = [
        ("medical", "医疗"),
        ("disaster", "灾害"),
        ("disability", "残疾"),
        ("low_income", "低收入"),
        ("other", "其他"),
    ]
    STATUS_CHOICES = [
        ("draft", "草稿"),
        ("pending_verify", "待核验"),
        ("pending_approve", "待审批"),
        ("approved", "已通过"),
        ("rejected", "已驳回"),
    ]

    application_no = models.CharField(max_length=20, unique=True)
    creator = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="applications"
    )
    applicant_name = models.CharField(max_length=100)
    applicant_id_card = models.CharField(max_length=18)
    difficulty_type = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES)
    difficulty_description = models.TextField()
    assistance_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    version = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    deadline = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    opinion_text = models.TextField(blank=True, default="")

    class Meta:
        app_label = "applications"
        db_table = "applications_application"

    def __str__(self):
        return self.application_no


class ApplicationMaterial(models.Model):
    STAGE_CHOICES = [
        ("application", "申请阶段"),
        ("verification", "核验阶段"),
        ("approval", "审批阶段"),
    ]

    application = models.ForeignKey(
        Application, on_delete=models.CASCADE, related_name="materials"
    )
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES)
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    material_type = models.CharField(max_length=50, blank=True, default="")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "applications"
        db_table = "applications_material"


class ScanRecord(models.Model):
    RESULT_CHOICES = [
        ("pass", "通过"),
        ("invalid_code", "无效编码"),
        ("duplicate_scan", "重复扫码"),
        ("role_mismatch", "角色不匹配"),
    ]

    application = models.ForeignKey(
        Application, on_delete=models.CASCADE, related_name="scan_records", null=True, blank=True
    )
    scanner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="scan_records"
    )
    code = models.CharField(max_length=100)
    credential_no = models.CharField(max_length=50, blank=True, default="")
    result = models.CharField(max_length=20, choices=RESULT_CHOICES)
    scan_time = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "applications"
        db_table = "applications_scanrecord"


class AuditLog(models.Model):
    application = models.ForeignKey(
        Application, on_delete=models.CASCADE, related_name="audit_logs"
    )
    operator = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="audit_logs"
    )
    action = models.CharField(max_length=50)
    from_status = models.CharField(max_length=20, blank=True, default="")
    to_status = models.CharField(max_length=20, blank=True, default="")
    opinion = models.TextField(blank=True, default="")
    extra_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "applications"
        db_table = "applications_auditlog"
        ordering = ["-created_at"]


class BatchFailRecord(models.Model):
    batch_id = models.CharField(max_length=50)
    application_id = models.IntegerField()
    application_no = models.CharField(max_length=20, blank=True, default="")
    operator = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="batch_failures"
    )
    action = models.CharField(max_length=50)
    error = models.TextField()
    suggestion = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "applications"
        db_table = "applications_batchfailrecord"
        ordering = ["-created_at"]
